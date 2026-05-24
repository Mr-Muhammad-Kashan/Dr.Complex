const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDb, upsertSchool, countSchools, getSchoolById } = require('../../src/db');
const { rowFromPayload } = require('../../src/ingest');
const {
  EXIT, cmdAdd, cmdUpsert, cmdDelete, cmdList, cmdShow, cmdBulk, runCli,
} = require('../../src/admin');

function seed(db, payload) {
  upsertSchool(db, rowFromPayload(payload));
}

function makePayload(overrides = {}) {
  return {
    cds_meta: {
      ipeds_id: '999001',
      cds_year: '2024-2025',
      school_name: 'Test University',
      state: 'CA',
      city: 'Testville',
      ...overrides,
    },
    cds_admissions: { class_size: { applicants_total: 1000 } },
  };
}

function writeTmpJson(obj) {
  const tmp = path.join(os.tmpdir(), `admin-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(tmp, JSON.stringify(obj));
  return tmp;
}

function captureConsole() {
  const out = []; const err = [];
  const origLog = console.log; const origErr = console.error;
  console.log = (...a) => out.push(a.join(' '));
  console.error = (...a) => err.push(a.join(' '));
  return {
    out, err,
    restore: () => { console.log = origLog; console.error = origErr; },
  };
}

describe('admin CLI', () => {
  let db;
  let cap;

  beforeEach(() => {
    db = openDb(':memory:');
    cap = captureConsole();
  });
  afterEach(() => {
    cap.restore();
    db.close();
  });

  describe('add', () => {
    it('inserts a valid CDS JSON from a file path', () => {
      const tmp = writeTmpJson(makePayload());
      try {
        expect(cmdAdd(db, tmp)).toBe(EXIT.OK);
        expect(countSchools(db)).toBe(1);
        expect(getSchoolById(db, '999001').cds_meta.school_name).toBe('Test University');
      } finally {
        fs.unlinkSync(tmp);
      }
    });

    it('returns CONFLICT when (ipeds_id, year) already exists', () => {
      const tmp = writeTmpJson(makePayload());
      try {
        cmdAdd(db, tmp);
        expect(cmdAdd(db, tmp)).toBe(EXIT.CONFLICT);
        expect(countSchools(db)).toBe(1);
      } finally {
        fs.unlinkSync(tmp);
      }
    });

    it('returns VALIDATION when payload missing required fields', () => {
      const tmp = writeTmpJson({ cds_meta: { ipeds_id: '999001' } });
      try {
        expect(cmdAdd(db, tmp)).toBe(EXIT.VALIDATION);
        expect(countSchools(db)).toBe(0);
      } finally {
        fs.unlinkSync(tmp);
      }
    });

    it('returns USAGE on missing file', () => {
      expect(cmdAdd(db, '/nonexistent/path/x.json')).toBe(EXIT.USAGE);
    });
  });

  describe('upsert', () => {
    it('inserts if absent, overwrites if present', () => {
      const tmp1 = writeTmpJson(makePayload({ school_name: 'V1' }));
      const tmp2 = writeTmpJson(makePayload({ school_name: 'V2' }));
      try {
        expect(cmdUpsert(db, tmp1)).toBe(EXIT.OK);
        expect(getSchoolById(db, '999001').cds_meta.school_name).toBe('V1');
        expect(cmdUpsert(db, tmp2)).toBe(EXIT.OK);
        expect(getSchoolById(db, '999001').cds_meta.school_name).toBe('V2');
        expect(countSchools(db)).toBe(1);
      } finally {
        fs.unlinkSync(tmp1); fs.unlinkSync(tmp2);
      }
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      seed(db, makePayload({ cds_year: '2024-2025' }));
      seed(db, makePayload({ cds_year: '2025-2026' }));
    });

    it('deletes a single year when --year given', () => {
      expect(cmdDelete(db, '999001', { year: '2024-2025' })).toBe(EXIT.OK);
      expect(countSchools(db)).toBe(1);
      expect(getSchoolById(db, '999001').cds_meta.cds_year).toBe('2025-2026');
    });

    it('deletes all years when --year omitted', () => {
      expect(cmdDelete(db, '999001')).toBe(EXIT.OK);
      expect(countSchools(db)).toBe(0);
    });

    it('returns NOT_FOUND when nothing matches', () => {
      expect(cmdDelete(db, '000000')).toBe(EXIT.NOT_FOUND);
    });

    it('returns USAGE without ipeds_id', () => {
      expect(cmdDelete(db, undefined)).toBe(EXIT.USAGE);
    });
  });

  describe('list', () => {
    beforeEach(() => {
      seed(db, makePayload({ ipeds_id: '111', school_name: 'Alpha U', state: 'CA' }));
      seed(db, makePayload({ ipeds_id: '222', school_name: 'Beta College', state: 'MA' }));
    });

    it('prints all rows by default', () => {
      expect(cmdList(db)).toBe(EXIT.OK);
      const text = cap.out.join('\n');
      expect(text).toMatch(/Alpha U/);
      expect(text).toMatch(/Beta College/);
      expect(text).toMatch(/2 record\(s\)/);
    });

    it('filters by --name (case-insensitive substring)', () => {
      expect(cmdList(db, { name: 'alph' })).toBe(EXIT.OK);
      const text = cap.out.join('\n');
      expect(text).toMatch(/Alpha U/);
      expect(text).not.toMatch(/Beta College/);
    });

    it('filters by --state', () => {
      expect(cmdList(db, { state: 'ma' })).toBe(EXIT.OK);
      const text = cap.out.join('\n');
      expect(text).toMatch(/Beta College/);
      expect(text).not.toMatch(/Alpha U/);
    });

    it('reports empty result', () => {
      cmdDelete(db, '111'); cmdDelete(db, '222');
      expect(cmdList(db)).toBe(EXIT.OK);
      expect(cap.out.join('\n')).toMatch(/no records/);
    });
  });

  describe('show', () => {
    beforeEach(() => {
      seed(db, makePayload());
    });

    it('prints full CDS JSON', () => {
      expect(cmdShow(db, '999001')).toBe(EXIT.OK);
      const parsed = JSON.parse(cap.out.join('\n'));
      expect(parsed.cds_meta.school_name).toBe('Test University');
    });

    it('returns NOT_FOUND for missing record', () => {
      expect(cmdShow(db, '000000')).toBe(EXIT.NOT_FOUND);
    });
  });

  describe('bulk', () => {
    let tmpDir;
    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-bulk-'));
      fs.writeFileSync(path.join(tmpDir, 'a.json'), JSON.stringify(makePayload({ ipeds_id: '111', school_name: 'Alpha' })));
      fs.writeFileSync(path.join(tmpDir, 'b.json'), JSON.stringify(makePayload({ ipeds_id: '222', school_name: 'Beta' })));
    });
    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('upserts every JSON file in a directory', () => {
      expect(cmdBulk(db, tmpDir)).toBe(EXIT.OK);
      expect(countSchools(db)).toBe(2);
    });

    it('--reset wipes existing rows before loading', () => {
      seed(db, makePayload({ ipeds_id: '999', school_name: 'Gamma' }));
      expect(countSchools(db)).toBe(1);
      expect(cmdBulk(db, tmpDir, { reset: true })).toBe(EXIT.OK);
      expect(countSchools(db)).toBe(2);
      expect(getSchoolById(db, '999')).toBeNull();
      expect(getSchoolById(db, '111').cds_meta.school_name).toBe('Alpha');
    });

    it('without --reset is additive', () => {
      seed(db, makePayload({ ipeds_id: '999', school_name: 'Gamma' }));
      expect(cmdBulk(db, tmpDir)).toBe(EXIT.OK);
      expect(countSchools(db)).toBe(3);
    });

    it('returns USAGE for missing dir arg', () => {
      expect(cmdBulk(db, undefined)).toBe(EXIT.USAGE);
    });

    it('returns USAGE for nonexistent dir', () => {
      expect(cmdBulk(db, '/no/such/path')).toBe(EXIT.USAGE);
    });
  });

  describe('runCli dispatcher', () => {
    it('routes "add" command end-to-end', () => {
      const tmp = writeTmpJson(makePayload({ ipeds_id: '888', school_name: 'Dispatch U' }));
      try {
        expect(runCli(['add', tmp], { db })).toBe(EXIT.OK);
        expect(getSchoolById(db, '888').cds_meta.school_name).toBe('Dispatch U');
      } finally {
        fs.unlinkSync(tmp);
      }
    });

    it('treats "update" as alias for "upsert"', () => {
      const tmp = writeTmpJson(makePayload({ ipeds_id: '888' }));
      try {
        expect(runCli(['update', tmp], { db })).toBe(EXIT.OK);
        expect(countSchools(db)).toBe(1);
      } finally {
        fs.unlinkSync(tmp);
      }
    });

    it('returns OK for help', () => {
      expect(runCli(['help'], { db })).toBe(EXIT.OK);
    });

    it('returns USAGE for unknown command', () => {
      expect(runCli(['nonsense'], { db })).toBe(EXIT.USAGE);
    });
  });
});
