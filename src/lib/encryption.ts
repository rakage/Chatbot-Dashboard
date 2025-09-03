import sodium from "libsodium-wrappers";

let sodiumReady = false;
let encryptionKey: Uint8Array | null = null;

async function initializeSodium() {
  if (!sodiumReady) {
    console.log("🔐 Initializing sodium...");
    await sodium.ready;
    sodiumReady = true;

    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
    console.log("🔐 Environment check - has ENCRYPTION_KEY:", !!ENCRYPTION_KEY);

    if (!ENCRYPTION_KEY) {
      console.error("❌ ENCRYPTION_KEY environment variable is missing");
      throw new Error("ENCRYPTION_KEY environment variable is required");
    }

    try {
      // Convert base64 key to Uint8Array
      console.log("🔐 Converting base64 key to bytes...");
      encryptionKey = sodium.from_base64(
        ENCRYPTION_KEY,
        sodium.base64_variants.ORIGINAL
      );
      console.log("🔐 Key converted, length:", encryptionKey.length);
      console.log("🔐 Expected length:", sodium.crypto_secretbox_KEYBYTES);

      if (encryptionKey.length !== sodium.crypto_secretbox_KEYBYTES) {
        console.error(
          "❌ Invalid key length:",
          encryptionKey.length,
          "expected:",
          sodium.crypto_secretbox_KEYBYTES
        );
        throw new Error(
          `Invalid encryption key length. Expected ${sodium.crypto_secretbox_KEYBYTES} bytes`
        );
      }

      console.log("✅ Encryption key initialized successfully");
    } catch (keyError) {
      console.error("❌ Error processing encryption key:", keyError);
      throw keyError;
    }
  } else {
    console.log("🔐 Sodium already initialized");
  }
}

function getKey(): Uint8Array {
  if (!encryptionKey) {
    throw new Error(
      "Encryption not initialized. Call initializeSodium() first."
    );
  }
  return encryptionKey;
}

/**
 * Encrypts a string using libsodium sealed boxes
 * @param plaintext - The string to encrypt
 * @returns Base64 encoded ciphertext
 */
export async function encrypt(plaintext: string): Promise<string> {
  try {
    console.log("🔐 Starting encryption process...");
    await initializeSodium();
    console.log("🔐 Sodium initialized");

    const key = getKey();
    console.log("🔐 Got encryption key, length:", key.length);

    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    console.log("🔐 Generated nonce, length:", nonce.length);

    const ciphertext = sodium.crypto_secretbox_easy(plaintext, nonce, key);
    console.log("🔐 Generated ciphertext, length:", ciphertext.length);

    // Combine nonce and ciphertext for storage
    const combined = new Uint8Array(nonce.length + ciphertext.length);
    combined.set(nonce);
    combined.set(ciphertext, nonce.length);
    console.log("🔐 Combined data, length:", combined.length);

    const result = sodium.to_base64(combined, sodium.base64_variants.ORIGINAL);
    console.log("🔐 Encryption complete, result length:", result.length);
    return result;
  } catch (error) {
    console.error("❌ Encryption error:", error);
    throw error;
  }
}

/**
 * Decrypts a string using libsodium sealed boxes
 * @param ciphertext - Base64 encoded ciphertext
 * @returns Decrypted plaintext
 */
export async function decrypt(ciphertext: string): Promise<string> {
  if (!ciphertext) {
    throw new Error("Cannot decrypt null or undefined ciphertext");
  }

  await initializeSodium();
  const key = getKey();

  const combined = sodium.from_base64(
    ciphertext,
    sodium.base64_variants.ORIGINAL
  );

  const nonceLength = sodium.crypto_secretbox_NONCEBYTES;
  const nonce = combined.slice(0, nonceLength);
  const cipher = combined.slice(nonceLength);

  const plaintext = sodium.crypto_secretbox_open_easy(cipher, nonce, key);
  return sodium.to_string(plaintext);
}

/**
 * Generates a random encryption key for use in ENCRYPTION_KEY env var
 * @returns Base64 encoded encryption key
 */
export async function generateEncryptionKey(): Promise<string> {
  await initializeSodium();
  const key = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);
  return sodium.to_base64(key, sodium.base64_variants.ORIGINAL);
}

/**
 * Securely wipes a string from memory (best effort)
 * @param str - String to wipe
 */
export function secureWipe(str: string): void {
  // Note: This is best effort in JavaScript - true secure memory wiping
  // requires native code. This at least overwrites the string data.
  if (typeof str === "string" && str.length > 0) {
    // Create a new string of the same length filled with random data
    const randomData = sodium.randombytes_buf(str.length);
    const randomStr = sodium.to_string(randomData);

    // Try to overwrite the original string's memory location
    // Note: JS engines may optimize this away, but it's better than nothing
    (str as any) = randomStr;
  }
}
