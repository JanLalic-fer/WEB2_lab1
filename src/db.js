import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes('render.com') ? { rejectUnauthorized: false } : false,
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELECT_FIELDS = `id, name, document, issued_at AS "issuedAt", status`;

export async function getStats() {
  const result = await pool.query(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active
    FROM passes
  `);
  return result.rows[0];
}

export async function getPass(id) {
  if (!UUID_REGEX.test(id)) return null; // neispravan ID = ne postoji
  const result = await pool.query(`SELECT ${SELECT_FIELDS} FROM passes WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

export async function getAllPasses() {
  const result = await pool.query(`SELECT ${SELECT_FIELDS} FROM passes ORDER BY issued_at DESC`);
  return result.rows;
}

export async function createPass(name, document) {
  const result = await pool.query(
    `INSERT INTO passes (name, document) VALUES ($1, $2) RETURNING ${SELECT_FIELDS}`,
    [name, document]
  );
  return result.rows[0];
}

export async function cancelPass(id) {
  if (!UUID_REGEX.test(id)) return;
  await pool.query(`UPDATE passes SET status = 'CANCELLED' WHERE id = $1`, [id]);
}

export async function deletePass(id) {
  if (!UUID_REGEX.test(id)) return;
  await pool.query(`DELETE FROM passes WHERE id = $1`, [id]);
}