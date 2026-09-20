import { CsvColumn, toCsv, UTF8_BOM } from './csv';

interface Row {
  title: string;
  count: number | null;
  at?: Date;
}
const columns: CsvColumn<Row>[] = [
  { key: 'title', label: 'Tiêu đề' },
  { key: 'count', label: 'Số lượng' },
];

describe('toCsv', () => {
  it('starts with a UTF-8 BOM so Excel reads Vietnamese correctly', () => {
    expect(toCsv(columns, []).startsWith(UTF8_BOM)).toBe(true);
  });

  it('writes a header, then one CRLF-terminated line per row', () => {
    const csv = toCsv(columns, [
      { title: 'Lập trình viên', count: 3 },
      { title: 'Kế toán', count: 0 },
    ]);

    expect(csv).toBe(
      `${UTF8_BOM}Tiêu đề,Số lượng\r\nLập trình viên,3\r\nKế toán,0\r\n`,
    );
  });

  it('quotes cells containing commas, quotes or line breaks', () => {
    const csv = toCsv(columns, [
      { title: 'A, B', count: 1 },
      { title: 'Say "hi"', count: 2 },
      { title: 'two\nlines', count: 3 },
    ]);

    expect(csv).toContain('"A, B",1');
    expect(csv).toContain('"Say ""hi""",2');
    expect(csv).toContain('"two\nlines",3');
  });

  it('renders null and undefined as empty cells and dates as ISO text', () => {
    const csv = toCsv(
      [...columns, { key: 'at', label: 'Ngày' }],
      [{ title: 'x', count: null, at: new Date('2026-09-20T01:02:03Z') }],
    );

    expect(csv).toContain('x,,2026-09-20T01:02:03.000Z');
  });

  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tcmd', '=HYPERLINK("http://x")'])(
    'neutralises a text cell that would run as a formula: %s',
    (evil) => {
      const line = toCsv(columns, [{ title: evil, count: 1 }]).split('\r\n')[1];

      // The cell now begins with an apostrophe, so it is shown, not executed.
      expect(line.replace(/^"/, '').startsWith("'")).toBe(true);
    },
  );

  it('leaves negative numbers alone: only text can be a formula', () => {
    expect(toCsv(columns, [{ title: 'x', count: -5 }])).toContain('x,-5');
  });
});
