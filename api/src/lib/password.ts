import bcrypt from 'bcryptjs';

// bcryptjs (pure JS) — chosen over native `bcrypt` so password hashing can never
// fail on a missing native build, including inside Railway's preDeployCommand.
const SALT_ROUNDS = 10;

export function hash(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function compare(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}
