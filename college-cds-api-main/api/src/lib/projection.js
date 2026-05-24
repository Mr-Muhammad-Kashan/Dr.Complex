function parseFields(fieldsParam) {
  if (!fieldsParam) return null;
  return String(fieldsParam)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function setAtPath(target, parts, value) {
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (cursor[key] === undefined || cursor[key] === null || typeof cursor[key] !== 'object') {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
}

function getAtPath(source, parts) {
  let cursor = source;
  for (const key of parts) {
    if (cursor === null || cursor === undefined || typeof cursor !== 'object') return undefined;
    cursor = cursor[key];
  }
  return cursor;
}

function project(source, fields) {
  if (!fields || fields.length === 0) return source;
  const out = {};
  for (const f of fields) {
    const parts = f.split('.').filter(Boolean);
    if (parts.length === 0) continue;
    const value = getAtPath(source, parts);
    if (value !== undefined) setAtPath(out, parts, value);
  }
  return out;
}

function leanResult(row) {
  return {
    ipeds_id: row.ipeds_id,
    name: row.name,
    state: row.state,
    city: row.city,
    cds_year: row.cds_year,
  };
}

module.exports = { parseFields, project, leanResult, getAtPath };
