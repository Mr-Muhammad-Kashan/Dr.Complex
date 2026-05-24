const fs = require('fs');
const path = require('path');

const BAKED_DB_PATH = '/app/seed.db';
const IMAGE_BUILD_ID_PATH = '/app/build_id';

function readBuildId(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch {
    return null;
  }
}

function dbBuildIdPath(dbPath) {
  return path.join(path.dirname(dbPath), 'build_id');
}

// Decides whether the live SQLite DB needs to be replaced with the baked one.
// Pure: takes plain values; easy to unit-test.
function decideRefresh({ imageBuildId, dbBuildId, bakedDbExists, dbExists }) {
  if (!imageBuildId) return { refresh: false, reason: 'no_image_build_id' };
  if (!bakedDbExists) return { refresh: false, reason: 'no_baked_db' };
  if (!dbExists) return { refresh: true, reason: 'fresh_volume' };
  if (imageBuildId !== dbBuildId) return { refresh: true, reason: 'build_id_mismatch' };
  return { refresh: false, reason: 'build_id_matches' };
}

// Side-effecting wrapper that reads env+filesystem and performs the swap if needed.
// Returns a summary suitable for logging.
function maybeRefreshDb({
  dbPath,
  imageBuildId = process.env.BUILD_ID || readBuildId(IMAGE_BUILD_ID_PATH),
  bakedDbPath = BAKED_DB_PATH,
} = {}) {
  const dbExists = fs.existsSync(dbPath);
  const bakedDbExists = fs.existsSync(bakedDbPath);
  const dbBuildId = readBuildId(dbBuildIdPath(dbPath));
  const decision = decideRefresh({
    imageBuildId, dbBuildId, bakedDbExists, dbExists,
  });
  if (!decision.refresh) {
    return { ...decision, imageBuildId, dbBuildId };
  }

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  // Remove any WAL/SHM sidecars so the new DB starts clean.
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const f = `${dbPath}${suffix}`;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  fs.copyFileSync(bakedDbPath, dbPath);
  fs.writeFileSync(dbBuildIdPath(dbPath), `${imageBuildId}\n`);
  return { ...decision, imageBuildId, dbBuildId };
}

module.exports = {
  decideRefresh,
  maybeRefreshDb,
  readBuildId,
  dbBuildIdPath,
  BAKED_DB_PATH,
  IMAGE_BUILD_ID_PATH,
};
