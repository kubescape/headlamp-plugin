import { toCsv } from './csv';

it('quotes fields with separators, quotes and line breaks', () => {
  expect(
    toCsv(
      ['a', 'b'],
      [
        ['x,y', 'say "hi"'],
        ['line\nbreak', 3],
      ]
    )
  ).toBe('a,b\r\n"x,y","say ""hi"""\r\n"line\nbreak",3\r\n');
});

it('writes empty fields for missing values', () => {
  expect(toCsv(['a', 'b', 'c'], [[null, undefined, false]])).toBe('a,b,c\r\n,,false\r\n');
});

it('stops spreadsheets from running text as formulas, but keeps negative numbers', () => {
  expect(toCsv(['a'], [['=HYPERLINK("x")'], ['@SUM(1)'], ['-1+1'], [-1]])).toBe(
    'a\r\n"\'=HYPERLINK(""x"")"\r\n\'@SUM(1)\r\n\'-1+1\r\n-1\r\n'
  );
});
