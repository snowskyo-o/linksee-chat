import crypto from "node:crypto";

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${digest}`;
}

export function verifyPassword(password, passwordHash) {
  if (!passwordHash || !passwordHash.startsWith("scrypt$")) {
    return false;
  }
  const [, salt, digest] = passwordHash.split("$");
  const current = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(current, "hex"));
}
