const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-gcm';
const KEY_FILE = path.join(__dirname, '.data-key');

function parseKey(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, 'hex');
  try {
    const buf = Buffer.from(trimmed, 'base64');
    if (buf.length === 32) return buf;
  } catch {
    // fall through
  }
  return null;
}

function loadOrCreateKey() {
  const envKey = parseKey(process.env.WALLET_DATA_KEY);
  if (envKey) return { key: envKey, source: 'WALLET_DATA_KEY env var' };

  if (fs.existsSync(KEY_FILE)) {
    const hex = fs.readFileSync(KEY_FILE, 'utf8').trim();
    const key = parseKey(hex);
    if (key) return { key, source: 'backend/.data-key' };
  }

  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, key.toString('hex'), { mode: 0o600 });
  return { key, source: 'backend/.data-key (generated)' };
}

const { key: DATA_KEY, source: KEY_SOURCE } = loadOrCreateKey();

function encrypt(plaintextObj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, DATA_KEY, iv);
  const json = JSON.stringify(plaintextObj);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    algorithm: ALGORITHM,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted.toString('hex'),
  };
}

function decrypt(envelope) {
  const iv = Buffer.from(envelope.iv, 'hex');
  const tag = Buffer.from(envelope.tag, 'hex');
  const data = Buffer.from(envelope.data, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, DATA_KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

function isEnvelope(obj) {
  return !!obj && typeof obj === 'object' && obj.algorithm === ALGORITHM &&
    typeof obj.iv === 'string' && typeof obj.tag === 'string' && typeof obj.data === 'string';
}

module.exports = { encrypt, decrypt, isEnvelope, ALGORITHM, KEY_SOURCE };
