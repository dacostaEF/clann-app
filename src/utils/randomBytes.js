import * as Crypto from 'expo-crypto';

export function randomBytes(length) {
  const bytes = new Uint8Array(length);
  Crypto.getRandomBytes(bytes);
  return bytes;
}

