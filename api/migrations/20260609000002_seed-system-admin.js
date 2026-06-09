/* eslint-disable camelcase */
const bcrypt = require('bcryptjs');

// Seed exactly one system_admin so the live demo can log in. Idempotent via
// ON CONFLICT — re-running migrations never duplicates or errors. Credentials
// come from env at migrate time (Railway preDeployCommand); the password is
// bcrypt-hashed here, never stored in plaintext.

function esc(value) {
  return String(value).replace(/'/g, "''");
}

exports.up = (pgm) => {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@reliefnet.org';
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
  const passwordHash = bcrypt.hashSync(password, 10);

  pgm.sql(`
    INSERT INTO users (full_name, email, password_hash, role)
    VALUES ('System Administrator', '${esc(email)}', '${esc(passwordHash)}', 'system_admin')
    ON CONFLICT (email) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@reliefnet.org';
  pgm.sql(`DELETE FROM users WHERE email = '${esc(email)}' AND role = 'system_admin';`);
};
