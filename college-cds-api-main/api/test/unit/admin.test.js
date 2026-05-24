const { parseFlags } = require('../../src/admin');

describe('parseFlags', () => {
  it('separates positional from flags', () => {
    expect(parseFlags(['166027', '--year', '2024-2025'])).toEqual({
      flags: { year: '2024-2025' },
      positional: ['166027'],
    });
  });
  it('handles bare flags (no value)', () => {
    expect(parseFlags(['--dry-run'])).toEqual({
      flags: { 'dry-run': true },
      positional: [],
    });
  });
  it('treats next-token starting with -- as a bare flag, not a value', () => {
    expect(parseFlags(['--name', '--state', 'MA'])).toEqual({
      flags: { name: true, state: 'MA' },
      positional: [],
    });
  });
  it('keeps multiple positionals', () => {
    expect(parseFlags(['add', 'file.json', '--year', 'Y'])).toEqual({
      flags: { year: 'Y' },
      positional: ['add', 'file.json'],
    });
  });
  it('returns empty objects for no args', () => {
    expect(parseFlags([])).toEqual({ flags: {}, positional: [] });
  });
});
