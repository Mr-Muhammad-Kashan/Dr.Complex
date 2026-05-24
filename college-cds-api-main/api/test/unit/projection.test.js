const { parseFields, project, leanResult, getAtPath } = require('../../src/lib/projection');

describe('parseFields', () => {
  it('returns null when no fields param', () => {
    expect(parseFields(undefined)).toBeNull();
    expect(parseFields('')).toBeNull();
  });
  it('splits and trims comma-separated paths', () => {
    expect(parseFields(' a.b , c , d.e.f ')).toEqual(['a.b', 'c', 'd.e.f']);
  });
  it('drops empty entries', () => {
    expect(parseFields('a,,b,')).toEqual(['a', 'b']);
  });
});

describe('getAtPath', () => {
  const src = { a: { b: { c: 42 } }, x: null };
  it('walks the path', () => {
    expect(getAtPath(src, ['a', 'b', 'c'])).toBe(42);
  });
  it('returns undefined on missing path', () => {
    expect(getAtPath(src, ['a', 'b', 'z'])).toBeUndefined();
  });
  it('returns undefined when traversing into null', () => {
    expect(getAtPath(src, ['x', 'y'])).toBeUndefined();
  });
});

describe('project', () => {
  const src = {
    cds_meta: { school_name: 'Harvard', ipeds_id: '166027', state: 'MA' },
    cds_admissions: { test_scores: { sat_math_25th: 750 }, class_size: { enrolled_total: 1647 } },
  };

  it('returns source unchanged when no fields', () => {
    expect(project(src, null)).toBe(src);
    expect(project(src, [])).toBe(src);
  });

  it('projects single nested path', () => {
    expect(project(src, ['cds_meta.school_name'])).toEqual({
      cds_meta: { school_name: 'Harvard' },
    });
  });

  it('projects multiple paths and merges nested structures', () => {
    const out = project(src, ['cds_meta.school_name', 'cds_meta.ipeds_id', 'cds_admissions.test_scores']);
    expect(out).toEqual({
      cds_meta: { school_name: 'Harvard', ipeds_id: '166027' },
      cds_admissions: { test_scores: { sat_math_25th: 750 } },
    });
  });

  it('omits missing paths silently', () => {
    expect(project(src, ['cds_meta.school_name', 'cds_meta.zip'])).toEqual({
      cds_meta: { school_name: 'Harvard' },
    });
  });
});

describe('leanResult', () => {
  it('returns lean shape from a row', () => {
    const row = {
      ipeds_id: '166027',
      cds_year: '2024-2025',
      name: 'Harvard University',
      state: 'MA',
      city: 'Cambridge',
      payload: '{}',
    };
    expect(leanResult(row)).toEqual({
      ipeds_id: '166027',
      name: 'Harvard University',
      state: 'MA',
      city: 'Cambridge',
      cds_year: '2024-2025',
    });
  });
});
