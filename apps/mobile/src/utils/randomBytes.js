import * as Crypto from "expo-crypto";

export function randomBytes(length) {
  const n = Number(length);

  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`randomBytes: length inválido (${length})`);
  }

  if (n > 1024) {
    throw new Error(`randomBytes: length acima do limite do expo-crypto (${n})`);
  }

  return Crypto.getRandomBytes(n);
}

