import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

export async function runMigrations() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── fortuneteller_profiles.style: varchar → text[] ──────────────────────
    const styleTypeRes = await client.query<{ data_type: string; udt_name: string }>(`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'fortuneteller_profiles' AND column_name = 'style'
    `);
    const styleRow = styleTypeRes.rows[0];
    if (styleRow && styleRow.data_type !== "ARRAY") {
      console.log("[migrate] Converting fortuneteller_profiles.style from varchar → text[]");
      await client.query(`
        ALTER TABLE fortuneteller_profiles
          ADD COLUMN IF NOT EXISTS style_new text[] NOT NULL DEFAULT '{}'
      `);
      await client.query(`
        UPDATE fortuneteller_profiles
        SET style_new = CASE
          WHEN style IS NULL OR style = '' THEN '{}'::text[]
          ELSE ARRAY[style]
        END
      `);
      await client.query(`ALTER TABLE fortuneteller_profiles DROP COLUMN style`);
      await client.query(`ALTER TABLE fortuneteller_profiles RENAME COLUMN style_new TO style`);
      console.log("[migrate] style column converted successfully");
    }

    // ── fortuneteller_profiles.genre: add if missing ─────────────────────────
    const genreRes = await client.query<{ count: string }>(`
      SELECT COUNT(*) AS count FROM information_schema.columns
      WHERE table_name = 'fortuneteller_profiles' AND column_name = 'genre'
    `);
    if (parseInt(genreRes.rows[0].count) === 0) {
      console.log("[migrate] Adding fortuneteller_profiles.genre column");
      await client.query(`
        ALTER TABLE fortuneteller_profiles
          ADD COLUMN genre varchar(20) NOT NULL DEFAULT ''
      `);
    }

    // ── querent_profiles: drop tel_number if still present ───────────────────
    const telRes = await client.query<{ count: string }>(`
      SELECT COUNT(*) AS count FROM information_schema.columns
      WHERE table_name = 'querent_profiles' AND column_name = 'tel_number'
    `);
    if (parseInt(telRes.rows[0].count) > 0) {
      console.log("[migrate] Dropping querent_profiles.tel_number");
      await client.query(`ALTER TABLE querent_profiles DROP COLUMN tel_number`);
    }

    // ── querent_profiles: drop postal_code if still present ──────────────────
    const postalRes = await client.query<{ count: string }>(`
      SELECT COUNT(*) AS count FROM information_schema.columns
      WHERE table_name = 'querent_profiles' AND column_name = 'postal_code'
    `);
    if (parseInt(postalRes.rows[0].count) > 0) {
      console.log("[migrate] Dropping querent_profiles.postal_code");
      await client.query(`ALTER TABLE querent_profiles DROP COLUMN postal_code`);
    }

    await client.query("COMMIT");
    console.log("[migrate] All migrations complete");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[migrate] Migration failed, rolled back:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("migrate.ts") ||
  process.argv[1]?.endsWith("migrate.js");
if (isMain) {
  runMigrations().then(() => process.exit(0)).catch(() => process.exit(1));
}
