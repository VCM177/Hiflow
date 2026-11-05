import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Tests run from apps/web (npm workspace), so the path is stable. import.meta.url
// is not a file URL under the jsdom environment.
const tokensCss = readFileSync(
  resolve(process.cwd(), 'src/styles/tokens.css'),
  'utf8',
);

/** Reads every `--hf-*` declaration and resolves `var(--hf-*)` references. */
function readTokens(): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const match of tokensCss.matchAll(/--(hf-[\w-]+):\s*([^;]+);/g)) {
    raw[match[1]] = match[2].trim();
  }
  const resolve = (value: string): string =>
    value.replace(/var\(--(hf-[\w-]+)\)/g, (_, name: string) =>
      resolve(raw[name]),
    );
  return Object.fromEntries(
    Object.entries(raw).map(([name, value]) => [name, resolve(value)]),
  );
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const tokens = readTokens();
const card = tokens['hf-bg-card'];
const page = tokens['hf-bg-page'];

describe('design tokens: contrast', () => {
  it.each([
    ['heading text on card', 'hf-text-heading', card],
    ['body text on card', 'hf-text-body', card],
    ['muted text on card', 'hf-text-muted', card],
    ['heading text on page', 'hf-text-heading', page],
    ['body text on page', 'hf-text-body', page],
    ['muted text on page', 'hf-text-muted', page],
    ['primary text on card', 'hf-primary', card],
    ['primary hover text on card', 'hf-primary-hover', card],
    ['warning status text on card', 'hf-warning-text', card],
    ['success status text on card', 'hf-success-text', card],
    ['destructive status text on card', 'hf-destructive', card],
    ['destructive text on tinted badge', 'hf-destructive-text', '#fce8ed'],
    ['neutral status text on card', 'hf-neutral-text', card],
  ])('%s meets AA (4.5:1)', (_label, token, background) => {
    expect(contrast(tokens[token], background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['label on primary fill', 'hf-primary-foreground', 'hf-primary'],
    ['label on warning text fill', 'hf-primary-foreground', 'hf-warning-text'],
    ['label on success text fill', 'hf-primary-foreground', 'hf-success-text'],
    ['label on destructive fill', 'hf-primary-foreground', 'hf-destructive'],
    ['label on neutral text fill', 'hf-primary-foreground', 'hf-neutral-text'],
  ])('%s meets AA (4.5:1)', (_label, text, fill) => {
    expect(contrast(tokens[text], tokens[fill])).toBeGreaterThanOrEqual(4.5);
  });

  it('control borders meet the 3:1 non-text contrast against the card', () => {
    expect(contrast(tokens['hf-border-control'], card)).toBeGreaterThanOrEqual(
      3,
    );
  });
});

describe('design tokens: shape', () => {
  it('declares the four radius roles, in pixels-equivalent order', () => {
    expect(tokens['hf-radius-badge']).toBe('0.25rem');
    expect(tokens['hf-radius-control']).toBe('0.375rem');
    expect(tokens['hf-radius-container']).toBe('0.5rem');
    expect(tokens['hf-radius-overlay']).toBe('0.75rem');
  });

  it('keeps the chart series in order: primary, success, warning, destructive, neutral', () => {
    expect([1, 2, 3, 4, 5].map((n) => tokens[`hf-chart-${n}`])).toEqual([
      tokens['hf-primary'],
      tokens['hf-success'],
      tokens['hf-warning'],
      tokens['hf-destructive'],
      tokens['hf-neutral'],
    ]);
  });
});
