const mongoose = require('mongoose');
const dns = require('dns');
const https = require('https');

const CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 12000),
  connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 12000),
};

function errorText(error) {
  const parts = [];
  let current = error;
  let depth = 0;
  while (current && depth < 5) {
    if (current.code) parts.push(String(current.code));
    if (current.message) parts.push(String(current.message));
    current = current.cause;
    depth += 1;
  }
  return parts.join(' | ');
}

function isSrvDnsError(error) {
  const text = errorText(error);
  return /querySrv|ECONNREFUSED|ENOTFOUND|ETIMEOUT|EAI_AGAIN|ESERVFAIL|EREFUSED/i.test(text);
}

function setPublicDnsServers() {
  const configured = (process.env.MONGO_DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!configured.length) return false;

  try {
    dns.setServers(configured);
    console.log(`MongoDB DNS retry enabled (${configured.join(', ')})`);
    return true;
  } catch (error) {
    console.warn('Could not set fallback DNS servers:', error.message);
    return false;
  }
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          accept: 'application/dns-json, application/json',
          'user-agent': 'whatsapp-clone-mongodb-dns-fallback/1.0',
        },
        timeout: 8000,
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`DNS-over-HTTPS returned HTTP ${response.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (_error) {
            reject(new Error('DNS-over-HTTPS returned invalid JSON'));
          }
        });
      }
    );

    request.on('timeout', () => request.destroy(new Error('DNS-over-HTTPS request timed out')));
    request.on('error', reject);
  });
}

async function dohLookup(name, type) {
  const providers = [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`,
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`,
  ];

  let lastError;
  for (const provider of providers) {
    try {
      const json = await requestJson(provider);
      if (json && Number(json.Status) === 0 && Array.isArray(json.Answer)) return json.Answer;
      lastError = new Error(`DNS-over-HTTPS lookup failed with status ${json && json.Status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('DNS-over-HTTPS lookup failed');
}

function normalizeTxtData(data) {
  if (!data) return '';
  // DoH JSON may return TXT chunks like: "authSource=admin&replicaSet=..."
  return String(data)
    .replace(/^"|"$/g, '')
    .replace(/"\s+"/g, '')
    .replace(/\\"/g, '"');
}

async function buildDirectUriFromSrv(srvUri) {
  const parsed = new URL(srvUri);
  const clusterHost = parsed.hostname;
  if (!clusterHost) throw new Error('Invalid MongoDB SRV hostname');

  const srvAnswers = await dohLookup(`_mongodb._tcp.${clusterHost}`, 'SRV');
  const hosts = srvAnswers
    .map((answer) => String(answer.data || '').trim().split(/\s+/))
    .filter((parts) => parts.length >= 4)
    .map((parts) => {
      const port = parts[2];
      const host = parts[3].replace(/\.$/, '');
      return `${host}:${port}`;
    });

  if (!hosts.length) throw new Error('No MongoDB Atlas hosts were returned by DNS-over-HTTPS');

  const params = new URLSearchParams(parsed.searchParams);
  try {
    const txtAnswers = await dohLookup(clusterHost, 'TXT');
    for (const answer of txtAnswers) {
      const txt = normalizeTxtData(answer.data);
      const txtParams = new URLSearchParams(txt);
      for (const [key, value] of txtParams.entries()) {
        if (!params.has(key)) params.set(key, value);
      }
    }
  } catch (error) {
    console.warn('MongoDB TXT lookup fallback skipped:', error.message);
  }

  if (!params.has('tls') && !params.has('ssl')) params.set('tls', 'true');

  // URL keeps credentials percent-encoded, which is what a MongoDB URI needs.
  const auth = parsed.username
    ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ''}@`
    : '';
  const database = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '/';
  const query = params.toString();

  return `mongodb://${auth}${hosts.join(',')}${database}${query ? `?${query}` : ''}`;
}

async function connectWithUri(uri) {
  await mongoose.connect(uri, CONNECT_OPTIONS);
}

async function connectMongo() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error('MONGO_URI is not configured in backend/.env');

  try {
    await connectWithUri(mongoUri);
    return;
  } catch (firstError) {
    if (!mongoUri.startsWith('mongodb+srv://') || !isSrvDnsError(firstError)) throw firstError;

    console.warn('MongoDB Atlas SRV DNS lookup failed. Retrying with public DNS...');

    if (setPublicDnsServers()) {
      try {
        await connectWithUri(mongoUri);
        return;
      } catch (secondError) {
        if (!isSrvDnsError(secondError)) throw secondError;
        console.warn('Public DNS SRV retry failed. Trying DNS-over-HTTPS fallback...');
      }
    }

    const enableDoh = String(process.env.MONGO_DOH_FALLBACK || 'true').toLowerCase() !== 'false';
    if (!enableDoh) throw firstError;

    try {
      const directUri = await buildDirectUriFromSrv(mongoUri);
      await connectWithUri(directUri);
      return;
    } catch (fallbackError) {
      const original = errorText(firstError);
      const fallback = errorText(fallbackError);
      throw new Error(
        'MongoDB Atlas could not be reached because DNS/network access is blocked. ' +
          'The app tried the normal SRV lookup, public DNS, and DNS-over-HTTPS fallback. ' +
          'Check internet access, firewall/VPN, and MongoDB Atlas Network Access (allow your current IP). ' +
          `Original: ${original}. Fallback: ${fallback}`
      );
    }
  }
}

module.exports = async () => {
  await connectMongo();
  console.log('MongoDB connected');

  // Small compatibility migration for messages created by older copies of
  // this project. It keeps existing chat history visible after upgrading.
  try {
    const messages = mongoose.connection.collection('messages');
    await messages.updateMany(
      { conversation: { $exists: false }, Conversation: { $exists: true } },
      [{ $set: { conversation: '$Conversation' } }]
    );
    await messages.updateMany(
      { mediaUrl: { $in: [null, ''] }, imageOrVideoUrl: { $exists: true, $ne: '' } },
      [{ $set: { mediaUrl: '$imageOrVideoUrl' } }]
    );
    await messages.updateMany({ messageStatus: 'send' }, { $set: { messageStatus: 'sent' } });
  } catch (error) {
    console.warn('Legacy message migration skipped:', error.message);
  }
};
