import assert from "node:assert/strict";
import test from "node:test";

import {
  decryptJson,
  decryptSecret,
  encryptJson,
  encryptSecret,
} from "./secret";

test("encryptSecret and decryptSecret roundtrips plaintext successfully", () => {
  const token = "pk_test_1234567890abcdef!@#$%^&*()_+";
  const encrypted = encryptSecret(token);

  assert.ok(encrypted.startsWith("v1:"));
  assert.notEqual(encrypted, token);

  const decrypted = decryptSecret(encrypted);
  assert.equal(decrypted, token);
});

test("encryptJson and decryptJson roundtrips structured credentials object", () => {
  const credentials = {
    apiKey: "clck_live_secret_key_xyz",
    clientId: "client-id-123",
    webhookSecret: "whsec_abcd",
  };

  const encrypted = encryptJson(credentials);
  const decrypted = decryptJson<typeof credentials>(encrypted);

  assert.deepEqual(decrypted, credentials);
});

test("decryptSecret rejects tampered ciphertext or tags", () => {
  const original = "super-secret-token";
  const encrypted = encryptSecret(original);
  const parts = encrypted.split(":");

  // Alter last char of ciphertext
  const tamperedCiphertext =
    parts[3].slice(0, -1) + (parts[3].slice(-1) === "a" ? "b" : "a");
  const tamperedPayload = `${parts[0]}:${parts[1]}:${parts[2]}:${tamperedCiphertext}`;

  assert.throws(
    () => decryptSecret(tamperedPayload),
    /Failed to decrypt integration secret/
  );
});

test("decryptSecret rejects invalid payload formats", () => {
  assert.throws(() => decryptSecret("not-a-valid-encrypted-string"));
  assert.throws(() => decryptSecret("v2:abc:def:ghi"));
});
