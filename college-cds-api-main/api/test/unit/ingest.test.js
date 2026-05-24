const { validateCdsPayload, rowFromPayload } = require('../../src/ingest');

const goodPayload = {
  cds_meta: {
    ipeds_id: '166027',
    cds_year: '2024-2025',
    school_name: 'Harvard University',
    state: 'MA',
    city: 'Cambridge',
  },
};

describe('validateCdsPayload', () => {
  it('accepts a well-formed payload', () => {
    expect(validateCdsPayload(goodPayload, 'h.json')).toEqual([]);
  });
  it('rejects non-object input', () => {
    expect(validateCdsPayload(null, 'h.json')).toHaveLength(1);
    expect(validateCdsPayload('string', 'h.json')).toHaveLength(1);
  });
  it('rejects missing cds_meta', () => {
    expect(validateCdsPayload({}, 'h.json')).toContainEqual(expect.stringMatching(/cds_meta/));
  });
  it('rejects missing ipeds_id', () => {
    const bad = JSON.parse(JSON.stringify(goodPayload));
    delete bad.cds_meta.ipeds_id;
    expect(validateCdsPayload(bad, 'h.json')).toContainEqual(expect.stringMatching(/ipeds_id/));
  });
  it('rejects missing cds_year', () => {
    const bad = JSON.parse(JSON.stringify(goodPayload));
    delete bad.cds_meta.cds_year;
    expect(validateCdsPayload(bad, 'h.json')).toContainEqual(expect.stringMatching(/cds_year/));
  });
  it('rejects missing school_name', () => {
    const bad = JSON.parse(JSON.stringify(goodPayload));
    delete bad.cds_meta.school_name;
    expect(validateCdsPayload(bad, 'h.json')).toContainEqual(expect.stringMatching(/school_name/));
  });
});

describe('rowFromPayload', () => {
  it('extracts indexed columns and serializes full payload', () => {
    const row = rowFromPayload(goodPayload);
    expect(row.ipeds_id).toBe('166027');
    expect(row.cds_year).toBe('2024-2025');
    expect(row.name).toBe('Harvard University');
    expect(row.state).toBe('MA');
    expect(row.city).toBe('Cambridge');
    expect(JSON.parse(row.payload)).toEqual(goodPayload);
    expect(row.ingested_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('null-fills missing state/city', () => {
    const minimal = { cds_meta: { ipeds_id: '1', cds_year: 'y', school_name: 's' } };
    const row = rowFromPayload(minimal);
    expect(row.state).toBeNull();
    expect(row.city).toBeNull();
  });
});
