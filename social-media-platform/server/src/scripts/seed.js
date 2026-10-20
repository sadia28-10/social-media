// Creates clearly labelled DEMO data for local development. Safe to run more than once.
// All demo accounts share the password below. Never use it (or these accounts) in production.
const bcrypt = require('bcrypt');
const config = require('../config/env');
const { pool, withTransaction } = require('../config/db');

const DEMO_PASSWORD = 'DemoPass123';

const users = [
  { username: 'demo_alice', displayName: 'Alice (demo)', bio: 'Demo account. Learning full-stack development.', location: 'Demo City' },
  { username: 'demo_bob', displayName: 'Bob (demo)', bio: 'Demo account. Coffee, code and databases.', location: 'Sample Town' },
  { username: 'demo_carol', displayName: 'Carol (demo)', bio: 'Demo account. Designing simple interfaces.', location: 'Example Bay' },
  { username: 'demo_dave', displayName: 'Dave (demo)', bio: 'Demo account. Shipping small projects weekly.', location: 'Test Village' },
];

// [author, minutes ago, text]
const posts = [
  ['demo_alice', 300, 'Just finished the login flow for my first full-stack project. HttpOnly cookies feel so much safer than localStorage. #webdev #security'],
  ['demo_bob', 240, 'PostgreSQL tip: a UNIQUE constraint beats checking for duplicates in application code. The database is the last line of defence. #postgres #webdev'],
  ['demo_carol', 200, 'Design rule I keep coming back to: consistent spacing makes an average UI look intentional. #design #ux'],
  ['demo_dave', 150, 'Week 3 of my internship. Learned more about REST design than in a whole semester. #internship #nodejs'],
  ['demo_alice', 100, 'Who else is building a portfolio project this month? Share what you are working on! #internship #portfolio'],
  ['demo_bob', 60, 'Wrote my first integration tests for an Express API today. Finding bugs before users do is a great feeling. #nodejs #testing'],
  ['demo_carol', 30, 'Dark mode done, and the contrast checker is finally happy. #design #webdev'],
  ['demo_dave', 10, 'Deployed the backend to a free tier host. Cold starts are real, but it works! #nodejs #deployment'],
];

const follows = [
  ['demo_alice', 'demo_bob'], ['demo_alice', 'demo_carol'], ['demo_bob', 'demo_alice'],
  ['demo_carol', 'demo_alice'], ['demo_dave', 'demo_alice'], ['demo_dave', 'demo_bob'],
];

const comments = [
  [0, 'demo_bob', 'Great choice. Do not forget CSRF protection with cookies!'],
  [0, 'demo_carol', 'Nice work, the flow looks clean.'],
  [1, 'demo_alice', 'Learned this the hard way. Constraints first!'],
  [4, 'demo_dave', 'Working on a social platform, funnily enough.'],
];

const likes = [
  [0, 'demo_bob'], [0, 'demo_carol'], [0, 'demo_dave'], [1, 'demo_alice'], [1, 'demo_dave'],
  [2, 'demo_alice'], [3, 'demo_alice'], [4, 'demo_bob'], [5, 'demo_alice'], [7, 'demo_alice'],
];

async function seed() {
  if (config.isProd && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
    throw new Error('Refusing to seed demo data in production. Set SEED_ALLOW_PRODUCTION=true to override.');
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  await withTransaction(async (client) => {
    const ids = {};
    for (const u of users) {
      const { rows } = await client.query(
        `INSERT INTO users (username, email, password_hash, display_name, bio, location)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
         RETURNING id`,
        [u.username, `${u.username}@example.com`, passwordHash, u.displayName, u.bio, u.location]
      );
      ids[u.username] = rows[0].id;
    }

    const existing = await client.query('SELECT COUNT(*)::int AS count FROM posts WHERE user_id = ANY($1)', [Object.values(ids)]);
    if (existing.rows[0].count > 0) {
      console.log('Demo posts already exist, skipping posts, comments, likes and follows.');
      return;
    }

    const postIds = [];
    for (const [author, minutesAgo, content] of posts) {
      const { rows } = await client.query(
        "INSERT INTO posts (user_id, content, created_at) VALUES ($1, $2, now() - make_interval(mins => $3::int)) RETURNING id",
        [ids[author], content, minutesAgo]
      );
      postIds.push(rows[0].id);
    }
    for (const [follower, followee] of follows) {
      await client.query('INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [ids[follower], ids[followee]]);
    }
    for (const [postIndex, author, content] of comments) {
      await client.query('INSERT INTO comments (post_id, user_id, content) VALUES ($1, $2, $3)', [postIds[postIndex], ids[author], content]);
    }
    for (const [postIndex, user] of likes) {
      await client.query('INSERT INTO likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [postIds[postIndex], ids[user]]);
    }
  });

  console.log(`Demo data ready. Log in as demo_alice / demo_bob / demo_carol / demo_dave with password: ${DEMO_PASSWORD}`);
}

seed()
  .catch((err) => {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
