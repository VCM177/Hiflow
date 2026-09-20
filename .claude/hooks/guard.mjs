// PreToolUse guard. Reads the tool call as JSON on stdin and answers with a
// permission decision: "deny" for things that must never happen, "ask" for
// outward-facing or hard-to-reverse actions the user has to confirm each time.
// Anything not matched is left alone (no output, exit 0).

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
    /(^|[\s;&|])(cat|type|less|more|head|tail|bat|Get-Content|gc)\s+[^;&|]*\.env(\.\w+)?(\s|$|[;&|])/.test(
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
  if (/\bgit\s+push\b/.test(cmd)) {
    decide('ask', 'Pushing is outward-facing. Confirm this specific push.');
  }
  if (/\bgit\s+merge\b/.test(cmd)) {
    decide(
      'ask',
      'Merges into main need a green suite and explicit confirmation. Check the current branch first.',
    );
  }
  if (/\bgit\s+(reset\s+--hard|clean\s+-\w*f|branch\s+-D|rebase)\b/.test(cmd)) {
    decide('ask', 'Hard to reverse. Look at what will be lost, then confirm.');
  }
}

if (tool === 'Bash') {
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
