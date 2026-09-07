import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const VERSION_PREFIX = "v1";

function getEncryptionKey(): Buffer {
  const secretSource =
    process.env.INTEGRATION_ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "worklens-default-integration-dev-key-change-in-production";

  return createHash("sha256").update(secretSource).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: `v1:<iv_hex>:<tag_hex>:<ciphertext_hex>`
 */
export function encryptSecret(plaintext: string): string {
  if (typeof plaintext !== "string") {
    throw new TypeError("Plaintext must be a string");
  }

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `${VERSION_PREFIX}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts an encrypted string created by encryptSecret.
 */
export function decryptSecret(encryptedPayload: string): string {
  if (!encryptedPayload || typeof encryptedPayload !== "string") {
    throw new TypeError("Encrypted payload must be a non-empty string");
  }

  const parts = encryptedPayload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION_PREFIX) {
    throw new Error("Invalid or unsupported encrypted payload format");
  }

  const [, ivHex, tagHex, ciphertextHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    throw new Error("Failed to decrypt integration secret: authentication tag verification failed");
  }
}

/**
 * Encrypts an arbitrary object/record as JSON.
 */
export function encryptJson<T = unknown>(data: T): string {
  return encryptSecret(JSON.stringify(data));
}

/**
 * Decrypts an encrypted JSON payload and parses it.
 */
export function decryptJson<T = unknown>(encryptedPayload: string): T {
  const decrypted = decryptSecret(encryptedPayload);
  return JSON.parse(decrypted) as T;
}
