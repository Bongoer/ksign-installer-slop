import fs from 'node:fs/promises';
import { extractCatalog, SOURCE, DNS_FALLBACK } from '../lib/scrape.mjs';

const output = new URL('../site/catalog.json', import.meta.url);
const old = JSON.parse(await fs.readFile(output, 'utf8'));
try {
  const response = await fetch(SOURCE, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KSign-Pages/1.0)', Accept: 'text/html' },
    signal: AbortSignal.timeout(25000)
  });
  if (!response.ok) throw new Error('AppleJr responded with HTTP ' + response.status);
  const html = await response.text();
  if (html.length > 3000000) throw new Error('HTML exceeded safe size limit');
  const parsed = extractCatalog(html);
  if (parsed.licenses.length < 8 || parsed.certificates.length < 5) {
    throw new Error(`Unexpected catalog counts ${parsed.licenses.length}/${parsed.certificates.length}; refusing to overwrite saved catalog`);
  }
  // Don't commit timestamps on every check when the catalog itself has not changed.
  const next = {
    licenses: parsed.licenses, certificates: parsed.certificates,
    dnsUrl: parsed.dnsUrl || DNS_FALLBACK,
    lastUpdated: old.lastUpdated,
    refreshIntervalSeconds: 120,
    live: true, source: SOURCE, warning: null
  };
  const signature = x => JSON.stringify({ licenses:x.licenses, certificates:x.certificates, dnsUrl:x.dnsUrl });
  if (signature(next) === signature(old) && old.live) {
    console.log('Catalog unchanged');
  } else {
    next.lastUpdated = new Date().toISOString();
    await fs.writeFile(output, JSON.stringify(next, null, 2) + '\n');
    console.log(`Catalog updated: ${next.licenses.length} licenses, ${next.certificates.length} certificates`);
  }
} catch (err) {
  console.warn('Refresh failed, retaining previous catalog:', err.message);
  // Fallback stays available; don't overwrite a functioning catalog.
  process.exitCode = 0;
}
