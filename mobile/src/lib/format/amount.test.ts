import { formatTestnetXlm } from './amount';

test('formats whole and fractional base units without floats', () => {
  expect(formatTestnetXlm('200000000')).toBe('20 Testnet XLM');
  expect(formatTestnetXlm('1')).toBe('0.0000001 Testnet XLM');
  expect(formatTestnetXlm('0')).toBe('0 Testnet XLM');
  expect(formatTestnetXlm('90071992547409930000')).toBe('9007199254740.993 Testnet XLM');
});

test('rejects anything that is not a base-unit decimal string', () => {
  for (const bad of ['', '-1', '1.5', '1e9', ' 1']) {
    expect(() => formatTestnetXlm(bad)).toThrow(RangeError);
  }
});
