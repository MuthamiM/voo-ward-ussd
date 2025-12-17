const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
let pool = null;

async function getDb() {
  if (!DATABASE_URL) {
    console.warn("⚠️ DATABASE_URL not set, using stub database");
    return createStubDb();
  }

  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on("error", (err) => {
      console.error("PostgreSQL pool error:", err);
    });

    console.log("✅ PostgreSQL pool created");
  }

  return pool;
}

async function query(text, params) {
  const db = await getDb();
  if (db.query) {
    const result = await db.query(text, params);
    return result.rows;
  }
  return [];
}

async function queryOne(text, params) {
  const rows = await query(text, params);
  return rows[0] || null;
}

async function insert(table, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const columns = keys.join(", ");

  const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
  const rows = await query(sql, values);
  return rows[0];
}

async function update(table, id, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");

  const sql = `UPDATE ${table} SET ${setClause} WHERE id = $${
    keys.length + 1
  } RETURNING *`;
  const rows = await query(sql, [...values, id]);
  return rows[0];
}

async function remove(table, id) {
  const sql = `DELETE FROM ${table} WHERE id = $1 RETURNING *`;
  const rows = await query(sql, [id]);
  return rows[0];
}

async function findById(table, id) {
  const sql = `SELECT * FROM ${table} WHERE id = $1`;
  return await queryOne(sql, [id]);
}

async function findAll(
  table,
  where = {},
  orderBy = "created_at DESC",
  limit = 100
) {
  let sql = `SELECT * FROM ${table}`;
  const values = [];

  const keys = Object.keys(where);
  if (keys.length > 0) {
    const conditions = keys
      .map((k, i) => {
        values.push(where[k]);
        return `${k} = $${i + 1}`;
      })
      .join(" AND ");
    sql += ` WHERE ${conditions}`;
  }

  sql += ` ORDER BY ${orderBy} LIMIT ${limit}`;
  return await query(sql, values);
}

async function count(table, where = {}) {
  let sql = `SELECT COUNT(*) as count FROM ${table}`;
  const values = [];

  const keys = Object.keys(where);
  if (keys.length > 0) {
    const conditions = keys
      .map((k, i) => {
        values.push(where[k]);
        return `${k} = $${i + 1}`;
      })
      .join(" AND ");
    sql += ` WHERE ${conditions}`;
  }

  const result = await queryOne(sql, values);
  return parseInt(result?.count || "0", 10);
}

function createStubDb() {
  return {
    query: async () => ({ rows: [] }),
    collection: () => ({
      find: () => ({
        sort: () => ({ limit: () => ({ toArray: async () => [] }) }),
      }),
      findOne: async () => null,
      insertOne: async () => {
        throw new Error("Database not configured");
      },
      updateOne: async () => {
        throw new Error("Database not configured");
      },
      deleteOne: async () => {
        throw new Error("Database not configured");
      },
      countDocuments: async () => 0,
    }),
  };
}

async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("PostgreSQL pool closed");
  }
}

module.exports = {
  getDb,
  query,
  queryOne,
  insert,
  update,
  remove,
  findById,
  findAll,
  count,
  closeDb,
};
