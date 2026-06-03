import { pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);
const PASSWORD_ALGORITHM = "pbkdf2_sha256";
const PASSWORD_ITERATIONS = 310000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = await pbkdf2Async(
    password,
    salt,
    PASSWORD_ITERATIONS,
    KEY_LENGTH,
    DIGEST,
  );

  return [
    PASSWORD_ALGORITHM,
    PASSWORD_ITERATIONS.toString(),
    salt,
    hash.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, iterationsValue, salt, hashValue] = passwordHash.split("$");

  if (algorithm !== PASSWORD_ALGORITHM || !iterationsValue || !salt || !hashValue) {
    return false;
  }

  const iterations = Number(iterationsValue);
  if (!Number.isInteger(iterations) || iterations <= 0) {
    return false;
  }

  const expectedHash = Buffer.from(hashValue, "base64url");
  const actualHash = await pbkdf2Async(
    password,
    salt,
    iterations,
    expectedHash.length,
    DIGEST,
  );

  return (
    expectedHash.length === actualHash.length &&
    timingSafeEqual(expectedHash, actualHash)
  );
}
