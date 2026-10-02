// PreToolUse guard. Reads the tool call as JSON on stdin and answers with a
// permission decision: "deny" for things that must never happen, "ask" for
// outward-facing or hard-to-reverse actions the user has to confirm each time.
// Anything not matched is left alone (no output, exit 0).

import { execSync } from 'node:child_process';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);

let call;
try {
  call = JSON.parse(Buffer.concat(chunks).toString('utf8'));
} catch {
  process.exit(0);
}

const tool = call.tool_name;
const input = call.tool_input ?? {};

/** Paths that hold real secrets: `.env`, `.env.local`, ... but not `.env.example`. */
const isSecretFile = (p) =>
  /(^|[\\/])\.env(\.(?!example$)[^\\/]+)?$/.test(String(p ?? ''));

function decide(decision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

const PROTECTED_BRANCH = /^(main|master)$/;

/** Current branch of the project checkout, or '' when unknown (detached HEAD, git error). */
function currentBranch() {
  try {
    return execSync('git branch --show-current', {
      cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

/** A push is plain when it adds commits to a branch other than main/master. */
function isPlainPush(push) {
  const args = push.split(/\s+/).slice(2);
  const flags = args.filter((a) => a.startsWith('-'));
  const positional = args.filter((a) => !a.startsWith('-'));
  const riskyFlag = flags.some(
    (f) =>
      /^--(force.*|delete|mirror|all|prune|tags)$/.test(f) ||
      /^-[a-zA-Z]*[fd]/.test(f),
  );
  if (riskyFlag) return false;

  const refspecs = positional.slice(1);
  if (
    refspecs.some(
      (r) =>
        r.startsWith('+') ||
        r.startsWith(':') ||
        /(^|:|\/)(main|master)$/.test(r),
    )
  ) {
    return false;
  }
  // No refspec or a bare HEAD pushes the current branch.
  if (refspecs.length === 0 || refspecs.some((r) => r === 'HEAD')) {
    const branch = currentBranch();
    return Boolean(branch) && !PROTECTED_BRANCH.test(branch);
  }
  return true;
}

function checkBash(cmd) {
  // --- never ---
  if (/--no-verify\b/.test(cmd)) {
    decide(
      'deny',
      'Do not bypass git hooks (--no-verify). Fix what the hook reports.',
    );
  }
  if (/\bgit\s+commit\b/.test(cmd)) {
    if (/co-authored-by|generated with/i.test(cmd)) {
      decide(
        'deny',
        'Commits are header-only: no Co-Authored-By trailer, no "Generated with" line.',
      );
    }
    if ((cmd.match(/\s-m\s/g) ?? []).length > 1) {
      decide(
        'deny',
        'Commits are header-only: use a single -m with the header.',
      );
    }
  }
  if (/\bgit\s+stash\s+(pop|apply)\s*($|[;&|])/.test(cmd)) {
    decide(
      'deny',
      'A bare `git stash pop/apply` can land on the wrong stash. Record the stash hash and use it.',
    );
  }
  if (/\bgit\s+(checkout|restore)\b[^;&|]*--\s+\.(\s|$)/.test(cmd)) {
    decide(
      'deny',
      'Restoring the whole tree from a ref silently discards work. Restore explicit paths instead.',
    );
  }
  if (
    /(^|[\s;&|])(cat|type|less|more|head|tail|bat|sed|awk|grep|rg|cut|sort|strings|Get-Content|gc|Select-String|sls)\s+[^;&|]*\.env(\.\w+)?(\s|$|[;&|])/.test(
      cmd,
    ) &&
    !/\.env\.example/.test(cmd)
  ) {
    decide(
      'deny',
      'Never print .env files: they hold connection strings and secrets.',
    );
  }
  if (/\b(printenv|neonctl\s+connection-string)\b/.test(cmd)) {
    decide('deny', 'Never print environment values or connection strings.');
  }
  if (
    /\$\{?(DATABASE_URL|JWT_SECRET|REDIS_URL)\b/.test(cmd) &&
    /\b(echo|printf|Write-Output)\b/.test(cmd)
  ) {
    decide('deny', 'Never print secret environment variables.');
  }

  // --- confirm every time ---
  const push = cmd.match(/\bgit\s+push\b[^;&|]*/)?.[0].trim();
  // The owner has approved plain pushes of any branch except main/master.
  // Force, delete, mirror, +refspec and anything reaching main/master still
  // need a confirmation.
  if (push && !isPlainPush(push)) {
    decide(
      'ask',
      'Force, delete or main/master push. Confirm this specific push.',
    );
  }
  // Merging into a working branch (e.g. syncing origin/develop) is approved.
  // Merging into main/master needs a green suite and explicit confirmation.
  if (/\bgit\s+merge\b/.test(cmd) && !/\bgit\s+merge\s+--abort\b/.test(cmd)) {
    const branch = currentBranch();
    if (
      /\bgit\s+(checkout|switch)\s+(-\S+\s+)*(main|master)\b/.test(cmd) ||
      !branch ||
      PROTECTED_BRANCH.test(branch)
    ) {
      decide(
        'ask',
        'Merges into main need a green suite and explicit confirmation.',
      );
    }
  }
  if (/\bgit\s+(reset\s+--hard|clean\s+-\w*f|branch\s+-D|rebase)\b/.test(cmd)) {
    decide('ask', 'Hard to reverse. Look at what will be lost, then confirm.');
  }
}

if (tool === 'Bash' || tool === 'PowerShell') {
  checkBash(String(input.command ?? ''));
} else if (tool === 'Read' || tool === 'Grep') {
  if (isSecretFile(input.file_path) || isSecretFile(input.path)) {
    decide(
      'deny',
      'Never read .env files. .env.example documents every variable.',
    );
  }
}

process.exit(0);
