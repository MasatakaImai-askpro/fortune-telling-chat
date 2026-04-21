import { Pool, neonConfig } from "@neondatabase/serverless";
import bcrypt from "bcrypt";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// ── Test user seed data ───────────────────────────────────────────────────────
const SURNAMES = ["佐藤","鈴木","高橋","田中","伊藤","渡辺","山本","中村","小林","加藤","吉田","山田","佐々木","山口","松本","井上","木村","林","清水","山崎","阿部","池田","橋本","石川","前田","岡田","長谷川","藤田","後藤","近藤","斎藤","村上","坂本","遠藤","青木","藤井","西村","福田","太田","三浦","岡本","松田","中川","中野","原田","小野","田村","竹内","金子","和田","石井","中山","藤原","小川","上野","島田","新井","森","野口"];
const FIRST_NAMES = ["さくら","あおい","ひな","みか","りの","まい","ゆい","なな","れな","あかり","みう","ここ","はるか","みなみ","りさ","えみ","ゆか","まなみ","あやか","のぞみ","ゆきな","あいか","さな","りお","みお","はな","ゆな","らん","いつき","かな","みほ","えりか","なつき","こと","まりな","ちさ","ひとみ","ともか","りか","あゆみ","たくや","けんた","ゆうき","しょうた","りょう","けい","ひろき","だいき","ゆうと","こうき","はるき","かずや","まさき","しんじ","あつし","のぼる"];
const BIRTHPLACES = ["東京都","大阪府","神奈川県","愛知県","福岡県","北海道","京都府","兵庫県","埼玉県","千葉県","広島県","宮城県","静岡県","茨城県","新潟県","熊本県","岡山県","沖縄県","栃木県","長野県","群馬県","鹿児島県","山口県","愛媛県","奈良県","和歌山県","青森県","岩手県","山形県","石川県"];
const ADDRESSES = [
  "東京都新宿区","東京都渋谷区","東京都世田谷区","東京都品川区","東京都豊島区",
  "東京都港区","東京都中野区","東京都杉並区","東京都江東区","東京都台東区",
  "神奈川県横浜市西区","神奈川県横浜市中区","神奈川県川崎市幸区","神奈川県相模原市中央区","神奈川県藤沢市",
  "大阪府大阪市北区","大阪府大阪市浪速区","大阪府大阪市天王寺区","大阪府堺市堺区","大阪府東大阪市",
  "愛知県名古屋市中区","愛知県名古屋市千種区","愛知県名古屋市熱田区","愛知県豊田市","愛知県岡崎市",
  "福岡県福岡市博多区","福岡県福岡市中央区","福岡県北九州市小倉北区","福岡県久留米市","福岡県春日市",
  "北海道札幌市中央区","北海道札幌市北区","北海道旭川市","北海道函館市","北海道帯広市",
  "京都府京都市中京区","京都府京都市左京区","京都府京都市伏見区","京都府宇治市","京都府亀岡市",
  "兵庫県神戸市灘区","兵庫県神戸市東灘区","兵庫県姫路市","兵庫県西宮市","兵庫県尼崎市",
  "埼玉県さいたま市浦和区","埼玉県さいたま市大宮区","埼玉県川越市","埼玉県越谷市","埼玉県所沢市",
  "千葉県千葉市花見川区","千葉県船橋市","千葉県柏市","千葉県松戸市","千葉県市川市",
  "広島県広島市安佐南区","広島県広島市西区","広島県呉市","広島県福山市","広島県東広島市",
  "宮城県仙台市泉区","宮城県仙台市宮城野区","宮城県石巻市","宮城県大崎市","宮城県名取市",
  "静岡県静岡市葵区","静岡県浜松市中区","静岡県沼津市","静岡県富士市","静岡県磐田市",
  "茨城県水戸市","茨城県つくば市","茨城県日立市","茨城県土浦市","茨城県ひたちなか市",
  "新潟県新潟市中央区","新潟県長岡市","新潟県上越市","新潟県三条市","新潟県柏崎市",
  "熊本県熊本市中央区","熊本県熊本市東区","熊本県八代市","熊本県天草市","熊本県菊池市",
  "岡山県岡山市北区","岡山県倉敷市","岡山県津山市","岡山県総社市","岡山県玉野市",
  "沖縄県那覇市","沖縄県浦添市","沖縄県沖縄市","沖縄県うるま市","沖縄県宜野湾市",
];
const BIRTHTIMES = ["00:00","01:30","03:00","04:45","06:00","07:15","08:00","09:30","10:00","11:00","12:00","13:15","14:00","15:30","16:00","17:45","18:00","19:30","20:00","21:00","22:15","23:00","不明"];
const WORRY_CATEGORIES = ["恋愛","仕事","家族","結婚","金運","人間関係","将来","健康"];
const WORRY_MESSAGES = [
  "好きな人に気持ちを伝えるべきか悩んでいます",
  "遠距離恋愛がうまくいくか不安です",
  "転職すべきかどうか迷っています",
  "職場の人間関係に悩んでいます",
  "このまま結婚してよいのか不安です",
  "家族との関係で悩んでいます",
  "金銭的な不安があります",
  "将来のことが漠然と不安です",
  "好きな人に他に好きな人がいるようで辛いです",
  "仕事を続けるか悩んでいます",
  "パートナーとの関係がうまくいっていません",
  "復縁できるか気になっています",
  "友人との関係で悩んでいます",
  "健康に不安を感じています",
  "婚活がうまくいかないです",
  "彼氏との将来について相談したいです",
  "仕事でのストレスが限界です",
  "人生の方向性が見えません",
  "家族の病気のことで悩んでいます",
  "お金のやりくりについて相談したいです",
];

function getZodiac(m: number, d: number): string {
  const boundaries = [20,19,21,20,21,21,23,23,23,24,23,22];
  const signs = ["山羊座","水瓶座","魚座","牡羊座","牡牛座","双子座","蟹座","獅子座","乙女座","天秤座","蠍座","射手座","山羊座"];
  return d < boundaries[m - 1] ? signs[m - 1] : signs[m];
}

function seededRand(seed: number, max: number): number {
  const x = Math.sin(seed) * 10000;
  return Math.floor((x - Math.floor(x)) * max);
}

function buildTestUsers() {
  const list: Array<{
    email: string; name: string; address: string; birthdate: string; zodiacSign: string;
    birthplace: string; birthtime: string; worryCategory: string; worryMessage: string;
    partnerName: string; partnerBirthdate: string; partnerZodiacSign: string;
    partnerBirthplace: string; partnerBirthtime: string; points: number;
  }> = [];

  for (let i = 31; i <= 105; i++) {
    const s = (offset: number) => seededRand(i * 97 + offset, 1000);
    // address uses a separate seed formula (i * 13 + 999) to match existing dev data
    const addrSeed = Math.sin(i * 13 + 999) * 10000;
    const address = ADDRESSES[Math.floor((addrSeed - Math.floor(addrSeed)) * ADDRESSES.length)];
    const surname = SURNAMES[s(1) % SURNAMES.length];
    const first = FIRST_NAMES[s(2) % FIRST_NAMES.length];
    const y = 1970 + (s(3) % 31);
    const m = 1 + (s(4) % 12);
    const maxD = [31,28,31,30,31,30,31,31,30,31,30,31][m - 1];
    const d = 1 + (s(5) % maxD);
    const birthdate = `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const hasPartner = i % 5 === 0;
    let partnerName = "", partnerBirthdate = "", partnerZodiacSign = "", partnerBirthplace = "", partnerBirthtime = "";
    if (hasPartner) {
      const py = 1965 + (s(10) % 36);
      const pm = 1 + (s(11) % 12);
      const pmaxD = [31,28,31,30,31,30,31,31,30,31,30,31][pm - 1];
      const pd = 1 + (s(12) % pmaxD);
      partnerName = SURNAMES[s(13) % SURNAMES.length] + FIRST_NAMES[s(14) % FIRST_NAMES.length];
      partnerBirthdate = `${py}-${String(pm).padStart(2,"0")}-${String(pd).padStart(2,"0")}`;
      partnerZodiacSign = getZodiac(pm, pd);
      partnerBirthplace = BIRTHPLACES[s(15) % BIRTHPLACES.length];
      partnerBirthtime = BIRTHTIMES[s(16) % BIRTHTIMES.length];
    }
    const pointOptions = [0, 0, 0, 500, 1000, 2000, 3000];
    list.push({
      email: `querent${i}@example.com`,
      name: surname + first,
      address,
      birthdate, zodiacSign: getZodiac(m, d),
      birthplace: BIRTHPLACES[s(6) % BIRTHPLACES.length],
      birthtime: BIRTHTIMES[s(7) % BIRTHTIMES.length],
      worryCategory: WORRY_CATEGORIES[s(8) % WORRY_CATEGORIES.length],
      worryMessage: WORRY_MESSAGES[s(9) % WORRY_MESSAGES.length],
      partnerName, partnerBirthdate, partnerZodiacSign, partnerBirthplace, partnerBirthtime,
      points: pointOptions[s(17) % pointOptions.length],
    });
  }
  return list;
}

export async function seedTestUsers() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const testUsers = buildTestUsers();
    const checkRes = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM users WHERE email = 'querent31@example.com'`
    );
    const alreadySeeded = parseInt(checkRes.rows[0].count) > 0;

    if (!alreadySeeded) {
      // Fresh seed: insert all 75 users with address
      console.log("[seed] Seeding 75 test querent users...");
      const passwordHash = await bcrypt.hash("Test1234", 10);
      let count = 0;
      for (const u of testUsers) {
        const userRes = await client.query<{ id: number }>(
          `INSERT INTO users (email, password, role, created_at)
           VALUES ($1, $2, '1', NOW())
           ON CONFLICT (email) DO NOTHING RETURNING id`,
          [u.email, passwordHash]
        );
        if (userRes.rows.length === 0) continue;
        const userId = userRes.rows[0].id;
        await client.query(
          `INSERT INTO querent_profiles (
             user_id, name, address, birthdate, zodiac_sign,
             birthplace, birthtime, worry_category, worry_message,
             partner_name, partner_birthdate, partner_zodiac_sign,
             partner_birthplace, partner_birthtime,
             is_subscription, points, created_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,false,$15,NOW())
           ON CONFLICT (user_id) DO NOTHING`,
          [
            userId, u.name, u.address, u.birthdate, u.zodiacSign,
            u.birthplace, u.birthtime, u.worryCategory, u.worryMessage,
            u.partnerName, u.partnerBirthdate, u.partnerZodiacSign,
            u.partnerBirthplace, u.partnerBirthtime, u.points,
          ]
        );
        count++;
      }
      console.log(`[seed] Seeded ${count} test querent users`);
    }

    // Backfill addresses for any test users where address is still empty
    const emptyAddrRes = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM querent_profiles qp
       JOIN users u ON u.id = qp.user_id
       WHERE u.email LIKE 'querent%@example.com'
         AND u.email != 'querent%'
         AND qp.address = ''`
    );
    const emptyCount = parseInt(emptyAddrRes.rows[0].count);
    if (emptyCount > 0) {
      console.log(`[seed] Backfilling addresses for ${emptyCount} test users...`);
      for (const u of testUsers) {
        await client.query(
          `UPDATE querent_profiles qp
           SET address = $1
           FROM users usr
           WHERE usr.id = qp.user_id
             AND usr.email = $2
             AND qp.address = ''`,
          [u.address, u.email]
        );
      }
      console.log("[seed] Address backfill complete");
    } else {
      if (alreadySeeded) console.log("[seed] Test users already seeded and addresses OK, skipping");
    }
  } finally {
    client.release();
    await pool.end();
  }
}

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
