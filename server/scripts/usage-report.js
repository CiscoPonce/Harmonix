/**
 * Print day-1 and day-7 return rates, recent event counts, and postcard views.
 * Run from server/: `node scripts/usage-report.js`
 * Uses SQLITE_PATH when set (production).
 */
const db = require('../db');

function pct(part, whole) {
  if (!whole) return '0%';
  return `${Math.round((part / whole) * 100)}%`;
}

function printCohorts() {
  console.log('Sign-up cohorts (UTC week)');
  console.log('week        users  day-1+ return  day-7 return');
  const weeks = db.prepare(`
    SELECT strftime('%Y-%W', created_at) AS week, COUNT(*) AS users
    FROM users
    GROUP BY week
    ORDER BY week
  `).all();

  for (const row of weeks) {
    const members = db.prepare(`
      SELECT id, date(created_at) AS joined
      FROM users
      WHERE strftime('%Y-%W', created_at) = ?
    `).all(row.week);

    let day1 = 0;
    let day7 = 0;
    for (const member of members) {
      const activity = db.prepare(`
        SELECT DISTINCT day FROM (
          SELECT date(created_at) AS day
          FROM usage_events
          WHERE user_id = ? AND name IN ('app_open', 'word_delivered')
          UNION
          SELECT date(generated_at) AS day
          FROM daily_words
          WHERE user_id = ?
        )
      `).all(member.id, member.id).map((item) => item.day).filter(Boolean);

      const joined = member.joined;
      if (activity.some((day) => day > joined)) day1 += 1;
      const start = shift(joined, 7);
      const end = shift(joined, 13);
      if (activity.some((day) => day >= start && day <= end)) day7 += 1;
    }

    console.log(
      `${String(row.week).padEnd(11)} ${String(row.users).padStart(5)}  ${pct(day1, row.users).padStart(13)}  ${pct(day7, row.users).padStart(12)}`
    );
  }
  if (!weeks.length) console.log('(no users)');
}

function shift(isoDate, days) {
  const [year, month, day] = String(isoDate).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function printRecentEvents() {
  console.log('\nLast 28 days — events by name and platform');
  const rows = db.prepare(`
    SELECT name, COALESCE(platform, 'unknown') AS platform, COUNT(*) AS n
    FROM usage_events
    WHERE created_at >= datetime('now', '-28 days')
    GROUP BY name, platform
    ORDER BY name, platform
  `).all();
  if (!rows.length) {
    console.log('(none)');
    return;
  }
  for (const row of rows) {
    console.log(`${row.name.padEnd(20)} ${String(row.platform).padEnd(10)} ${row.n}`);
  }
}

function printPostcards() {
  console.log('\nLast 28 days — postcard views');
  const views = db.prepare(`
    SELECT COUNT(*) AS n
    FROM usage_events
    WHERE name = 'postcard_viewed' AND created_at >= datetime('now', '-28 days')
  `).get().n;
  const distinct = db.prepare(`
    SELECT COUNT(DISTINCT json_extract(props_json, '$.postcard')) AS n
    FROM usage_events
    WHERE name = 'postcard_viewed' AND created_at >= datetime('now', '-28 days')
  `).get().n;
  console.log(`views ${views}`);
  console.log(`distinct postcards ${distinct}`);
}

printCohorts();
printRecentEvents();
printPostcards();
