const fs = require("fs");
const os = require("os");
const path = require("path");
const { MongoClient, ServerApiVersion } = require("mongodb");

// MongoDB can be disabled via environment variable
if (process.env.DISABLE_MONGO === '1') {
  console.log('[MONGO] Disabled via DISABLE_MONGO=1');
  module.exports = {
    getDb: () => { throw new Error('MongoDB is disabled'); },
    client: null,
    MONGO_URI: null
  };
  return;
}

// Read URI from secure local config (cross-platform)
function tryRead(p){ try { return fs.readFileSync(p, 'utf8').trim(); } catch { return null; } }

// Detect platform and try appropriate paths
const isWindows = os.platform() === 'win32';
const WSL_CONFIG = process.env.HOME ? path.join(process.env.HOME, '.config/voo-ward/mongo_uri') : null;
const WIN_LOCALAPP = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'voo-ward', 'mongo_uri') : null;
const WIN_PROGDATA = 'C:\\ProgramData\\voo-ward\\mongo_uri';

const MONGO_URI =
  (isWindows && WIN_LOCALAPP && tryRead(WIN_LOCALAPP)) ||
  (isWindows && tryRead(WIN_PROGDATA)) ||
  (!isWindows && WSL_CONFIG && tryRead(WSL_CONFIG)) ||
  process.env.MONGO_URI ||
  (() => { throw new Error('MongoDB URI not found in LocalAppData/ProgramData/.config or MONGO_URI env'); })();

// Create secure MongoDB client with TLS enforced
const client = new MongoClient(MONGO_URI, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  tls: true,                // Require TLS
  family: 4,                 // Force IPv4 DNS resolution
  maxPoolSize: 20,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 30000,
  serverSelectionTimeoutMS: 8000,
});

// Lazy connector function for shared DB usage
async function getDb() {
  if (!client.topology || client.topology.isDisconnected()) {
    await client.connect();
  }
  return client.db("voo_ward");
}

module.exports = { getDb, client, MONGO_URI };