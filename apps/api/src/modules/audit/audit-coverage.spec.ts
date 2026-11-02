import { AUDIT_EVENT_NAMES } from '@hiflow/shared-types';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', '..');

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.ts$/.test(name) && !/\.spec\.ts$/.test(name) ? [path] : [];
  });

describe('audit event coverage', () => {
  it('has a place in the code that records every event in the catalogue', () => {
    // The seed tells a story with the same events; that does not count as recording one.
    const live = sourceFiles(SRC)
      .filter((file) => !file.includes(join('database', 'seeds')))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    const unused = AUDIT_EVENT_NAMES.filter(
      (event) => !new RegExp(`['"]${event}['"]`).test(live),
    );

    expect(unused).toEqual([]);
  });
});
