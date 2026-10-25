import test from 'node:test';
import assert from 'node:assert/strict';
import {extractCatalog,parseAttrs,decode,parseTree,textOf} from '../lib/scrape.mjs';
const sample=`<!doctype html><html><body>
<h2>ESign iOS Installer</h2><article><h3>Esign</h3><p>DNS • Wrong license</p><a href="https://applejr.net/post/esign.plist">Install</a></article>
<h2>KSign iOS Installer</h2>
<div class="card"><h3>AppleJr DNS</h3><p>Anti-Revoke</p><a href="https://applejr.ipadownloads.com/dns.mobileconfig">Install</a></div>
<div class="card"><h3>Ksign</h3><p>SIGNED • RAKUTEN SECURITIES 1</p><a href="itms-services://?action=download-manifest&amp;url=https%3A%2F%2Fapplejr.net%2Fpost%2FKsign_1.plist">Install</a></div>
<div class="card"><h3>Ksign</h3><p>DNS • VINWASH</p><button onclick="window.location.href='https://applejr.net/post/Ksign_VINWASH.plist'">Install</button></div>
<div class="card"><h3>Ksign</h3><p>DNS • HSBC Bank</p><button onclick="installApp('maybe-a-code-only')">Install</button></div>
<h2>Scarlet iOS Installer</h2><div class="card"><h3>Scarlet</h3>Random<div>Install</div></div>
<h2>iOS Signing Certificates</h2>
<article><h3>RAKUTEN SECURITIES,INC.</h3><p>SIGNED • Cert</p><a href="https://github.com/AppleJrNet/certs/raw/main/rakuten.zip">Download</a></article>
<article><h3>HSBC Bank</h3><p>DNS • Cert</p><a href="https://github.com/AppleJrNet/certs/raw/main/hsbc.zip">Download</a></article>
<h2>Jailbreak Tools</h2><article><h3>Fake</h3>Cert</article>
<script>const jsString = '<article><h3>Ksign</h3><p>SIGNED • evil</p><a href="http://evil">Install</a></article>';</script>
</body></html>`;
test('extracts published licenses and certs by section',()=>{
 const r=extractCatalog(sample);
 assert.equal(r.licenses.length,3);
 assert.equal(r.licenses[0].name,'RAKUTEN SECURITIES 1');
 assert.equal(r.licenses[0].mode,'SIGNED');
 assert.equal(r.licenses[1].name,'VINWASH');
 assert.equal(r.licenses[1].mode,'DNS');
 assert.equal(r.licenses[2].installUrl,null);
 assert.equal(r.certificates.length,2);
 assert.equal(r.certificates[0].name,'RAKUTEN SECURITIES,INC.');
 assert.equal(r.certificates[0].downloadUrl,'https://github.com/AppleJrNet/certs/raw/main/rakuten.zip');
 assert.equal(r.dnsUrl,'https://applejr.ipadownloads.com/dns.mobileconfig');
});
test('uses valid scheme for .plist manifests',()=>{
 const r=extractCatalog(sample);
 assert.match(r.licenses[0].installUrl,/^itms-services:\/\//);
 assert.match(r.licenses[1].installUrl,/^itms-services:\/\//);
 assert.equal(new URL(r.licenses[1].installUrl).searchParams.get('url'),'https://applejr.net/post/Ksign_VINWASH.plist');
});
test('ignores untrusted script tags and arbitrary Javascript labels',()=>{
 const r=extractCatalog(sample);
 assert.ok(r.licenses.every(x=>!x.name.includes('evil')));
 assert.equal(r.licenses.at(-1).installUrl,null);
});
test('attribute parser handles boolean and mixed quotes',()=>{
 const r=parseAttrs(` class="foo bar" data-zip='https://foo' disabled aria-label=Test />`);
 assert.equal(r.class,'foo bar');assert.equal(r['data-zip'],'https://foo');assert.equal(r.disabled,'');assert.equal(r['aria-label'],'Test');
 assert.equal(decode('A &amp; B &#8226; C'),'A & B • C');
});
test('parses headings of a page',()=>{
 const p=parseTree(sample);assert.equal(textOf(p).includes('KSign iOS Installer'),true);
});
