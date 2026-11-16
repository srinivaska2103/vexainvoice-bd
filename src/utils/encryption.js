const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.JWT_SECRET || 'vexa_invoice_super_secret_jwt_key_2026_production';
// Key must be exactly 32 bytes for aes-256-gcm
const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();

/**
 * Encrypt sensitive string (e.g. WhatsApp Access Token)
 */
function encryptToken(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt sensitive string
 */
function decryptToken(encryptedData) {
  if (!encryptedData) return null;
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return null;

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt token:', err.message);
    return null;
  }
}

module.exports = {
  encryptToken,
  decryptToken
};
