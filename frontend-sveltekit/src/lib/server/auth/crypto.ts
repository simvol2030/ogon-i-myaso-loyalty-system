import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { env } from '$env/dynamic/private';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

// Derive a 32-byte key from the SESSION_SECRET
function deriveKey(secret: string, salt: Buffer): Buffer {
	return createHash('sha256')
		.update(secret + salt.toString('hex'))
		.digest();
}

export interface EncryptedData {
	encrypted: string;
	iv: string;
	authTag: string;
	salt: string;
}

/**
 * Encrypts data using AES-256-GCM
 * @param data - The data to encrypt (will be JSON stringified)
 * @returns Base64 encoded encrypted data with IV, auth tag, and salt
 */
export function encrypt(data: any): string {
	const secret = env.SESSION_SECRET || 'fallback-secret-change-in-production';

	if (!env.SESSION_SECRET) {
		console.error('WARNING: SESSION_SECRET not set in environment. Using insecure fallback!');
	}

	const salt = randomBytes(SALT_LENGTH);
	const key = deriveKey(secret, salt);
	const iv = randomBytes(IV_LENGTH);

	const cipher = createCipheriv(ALGORITHM, key, iv);

	const plaintext = JSON.stringify(data);
	let encrypted = cipher.update(plaintext, 'utf8', 'base64');
	encrypted += cipher.final('base64');

	const authTag = cipher.getAuthTag();

	const result: EncryptedData = {
		encrypted,
		iv: iv.toString('base64'),
		authTag: authTag.toString('base64'),
		salt: salt.toString('base64')
	};

	// Return as single base64-encoded JSON string
	return Buffer.from(JSON.stringify(result)).toString('base64');
}

/**
 * Decrypts data encrypted with the encrypt() function
 * @param encryptedString - Base64 encoded encrypted data
 * @returns Decrypted and parsed data, or null if decryption fails
 */
export function decrypt(encryptedString: string): any | null {
	try {
		const secret = env.SESSION_SECRET || 'fallback-secret-change-in-production';

		// Decode the base64 JSON
		const encryptedData: EncryptedData = JSON.parse(
			Buffer.from(encryptedString, 'base64').toString('utf8')
		);

		const salt = Buffer.from(encryptedData.salt, 'base64');
		const key = deriveKey(secret, salt);
		const iv = Buffer.from(encryptedData.iv, 'base64');
		const authTag = Buffer.from(encryptedData.authTag, 'base64');

		const decipher = createDecipheriv(ALGORITHM, key, iv);
		decipher.setAuthTag(authTag);

		let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
		decrypted += decipher.final('utf8');

		return JSON.parse(decrypted);
	} catch (error) {
		console.error('Decryption failed:', error);
		return null;
	}
}

/**
 * Generates a secure random session secret
 * Run this once to generate a SESSION_SECRET for your .env file
 */
export function generateSessionSecret(): string {
	return randomBytes(32).toString('base64');
}
