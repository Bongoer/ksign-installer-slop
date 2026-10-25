/**
 * AppleJr catalog reader. No DOM, browser, npm packages, or hidden endpoints needed.
 * Works with ordinary HTML cards; if AppleJr uses runtime JS for an action and does
 * not publish its URL in HTML, that action is intentionally marked as unresolved.
 */
export const SOURCE = 'https://applejr.net/';
export const DNS_FALLBACK = 'https://applejr.ipadownloads.com/';

const ENTITIES = {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',bull:'•',middot:'·',ndash:'-',mdash:'-',hellip:'…'};
export function decode(s='') {
  return String(s).replace(/&(#(?:x[0-9a-f]+|[0-9]+)|[a-z]+);/gi, (_, entity) => {
    if (entity[0] === '#') {
      const n = entity[1].toLowerCase()==='x' ? parseInt(entity.slice(2),16) : parseInt(entity.slice(1),10);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    }
    return ENTITIES[entity.toLowerCase()] ?? `&${entity};`;
  });
}
export function parseAttrs(raw='') {
  const attrs = {};
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m=re.exec(raw))) {
    const name=m[1].toLowerCase();
    if(name && name !== '/') attrs[name]=decode(m[2]??m[3]??m[4]??'');
  }
  return attrs;
}
export function parseTree(html) {
  // Ignore scripts and styles, which can contain pseudo-tags in JS strings.
  const safe=String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'')
                         .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,'')
                         .replace(/<!--[\s\S]*?-->/g,'');
  const root={tag:'root',attrs:{},children:[],parent:null,text:'',start:0,end:safe.length};
  const stack=[root];
  const voids=new Set(['img','input','br','hr','meta','link','source','area','wbr','path','use']);
  const re=/<\/?([a-z][\w:-]*)\b([^>]*)>/gi;
  let m,last=0;
  while((m=re.exec(safe))){
    const before=safe.slice(last,m.index).replace(/<[^<]*$/,'');
    if(before) stack.at(-1).text+=decode(before);
    const closing=m[0].startsWith('</');
    const tag=m[1].toLowerCase();
    if(closing){
      const at=stack.findLastIndex(n=>n.tag===tag);
      if(at>0){for(let i=stack.length-1;i>=at;i--)stack[i].end=re.lastIndex;stack.length=at;}
    }else{
      const node={tag,attrs:parseAttrs(m[2]),children:[],parent:stack.at(-1),text:'',start:m.index,end:re.lastIndex};
      stack.at(-1).children.push(node);
      if(!voids.has(tag) && !/\/\s*>$/.test(m[0]))stack.push(node);
    }
    last=re.lastIndex;
  }
  if(last<safe.length)stack.at(-1).text+=decode(safe.slice(last));
  return root;
}
export function nodes(root, pred){
  const out=[];
  function rec(n){if(pred(n))out.push(n);for(const c of n.children)rec(c);}
  rec(root);return out;
}
export function textOf(n){
  // Parsing direct text in a node loses order, but yields all words reliably.
  return [n.text,...n.children.map(textOf)].join(' ').replace(/\s+/g,' ').trim();
}
const allowedHosts = ['applejr.net','www.applejr.net','applejr.ipadownloads.com','github.com','raw.githubusercontent.com','objects.githubusercontent.com','api.khoindvn.io.vn'];
function cleanURL(input, base=SOURCE){
  if(!input || typeof input!=='string')return null;
  let s=decode(input).replace(/\\\//g,'/').replace(/\\u0026/ig,'&').trim();
  if(s.startsWith('itms-services:')){
    const manifest=s.match(/[?&]url=([^&]+)/);
    if(!manifest)return null;
    try {const embedded=decodeURIComponent(manifest[1]); if(!/^https:\/\//i.test(embedded)) return null;}catch{return null;}
    return s;
  }
  if(s.startsWith('https%3A%2F%2F')){try{s=decodeURIComponent(s);}catch{}}
  try {
    const url=new URL(s,base);
    if(url.protocol!=='https:')return null;
    if(url.username||url.password)return null;
    // Don't trust arbitrary outbound link destinations scraped from another page.
    if(!allowedHosts.includes(url.hostname.toLowerCase()) && !url.hostname.toLowerCase().endsWith('.githubusercontent.com')) return null;
    if(url.pathname.toLowerCase().endsWith('.plist'))return `itms-services://?action=download-manifest&url=${encodeURIComponent(url.href)}`;
    return url.href;
  }catch{return null;}
}
function findCandidateURLs(raw){
  const out=[];
  const value=decode(String(raw??'')).replace(/\\\//g,'/');
  // For inline JS handlers and data attributes, prefer the installation URL inside.
  const full = /itms-services:\/\/[^\s'"<>)]*|https?:\/\/[^\s'"<>)]*|(?:\/|\.\/)[a-z\w/.-]+\.(?:plist|mobileconfig|zip|p12)(?:\?[^'"\s<>)]*)?/gi;
  for(const match of value.matchAll(full)){
    const url=cleanURL(match[0]);if(url)out.push(url);
  }
  const trimmed=value.trim();
  // Only explicit URLs/paths are allowed as direct attributes. Never treat an
  // inline JS function name or arbitrary label as a relative URL.
  if (/^(?:https:\/\/|itms-services:\/\/|\/|\.\/)/i.test(trimmed)) {
    const rawDirect=cleanURL(trimmed);
    if(rawDirect)out.push(rawDirect);
  }
  return [...new Set(out)];
}
function urlsInside(card) {
  const candidates=[];
  for(const n of nodes(card,()=>true)){
    const a=n.attrs;
    for(const key of ['href','data-url','data-href','data-link','data-install','data-install-url','data-ipa-url','data-manifest','data-manifest-url','data-download-url','onclick']){
      if(a[key]){
        for(const u of findCandidateURLs(a[key])){
          candidates.push({url:u,origin:key,tag:n.tag,caption:textOf(n).slice(0,75)});
        }
      }
    }
  }
  const score=c=>{
    let s=0;
    if(c.url.startsWith('itms-services:'))s+=50;
    if(/\.(zip|p12|mobileprovision)(\?|$)/i.test(c.url))s+=25;
    if(/gate\.html/i.test(c.url))s+=40;
    if(/\/dns|mobileconfig|ipadownloads/i.test(c.url))s+=25;
    if(/(install|download)/i.test(c.caption))s+=20;
    if(['href','data-install','onclick','data-url'].includes(c.origin))s+=10;
    if(/(youtube|youtu\.be)/i.test(c.url))s-=80;
    return s;
  };
  return candidates.sort((a,b)=>score(b)-score(a));
}
function findSection(root, startRe, stopRe) {
  const heads=nodes(root,n=>/^h[1-3]$/.test(n.tag));
  const start=heads.find(n=>startRe.test(textOf(n)));
  if(!start)return null;
  const after=heads.find(n=>n.start>start.start && /^h[12]$/.test(n.tag) && stopRe.test(textOf(n)));
  return {start:start.end,end:after?.start??Number.MAX_SAFE_INTEGER};
}
function cardFor(node, section){
  let p=node.parent, best=node.parent;
  while(p && p.tag!=='root'){
    const h3=nodes(p,n=>n.tag==='h3' && n.start>=section.start && n.start<section.end);
    if(h3.length===1){best=p;if(/\b(install|download)\b/i.test(textOf(p)))return p;}
    if(h3.length>1 || p.start<section.start-1000)break;
    p=p.parent;
  }
  return best;
}
function metaFromCard(card,headingText,kind){
  const raw=textOf(card).replace(/\b(KSign|Download|Install)\b/gi,' ').replace(/\s+/g,' ').trim();
  if(kind==='license'){
    const mode=/\bSIGNED\b/i.test(raw)?'SIGNED':/\bDNS\b/i.test(raw)?'DNS':'OTHER';
    const name=raw.replace(/^.*?\b(?:SIGNED|DNS)\b\s*[•:·-]?\s*/i,'')
      .replace(/\b(?:Download|Install)\b.*$/i,'').trim() || headingText;
    return {name:name.slice(0,130),mode};
  }
  const mode=/\bSIGNED\b/i.test(raw)?'SIGNED':/\bDNS\b/i.test(raw)?'DNS':'OTHER';
  return {name:headingText.trim().slice(0,130),mode};
}
function slug(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);}
export function extractCatalog(html){
  const root=parseTree(html);
  const ksec=findSection(root,/KSign\s+iOS\s+Installer/i,/Scarlet\s+iOS\s+Installer/i);
  const csec=findSection(root,/iOS\s+Signing\s+Certificates/i,/Jailbreak\s+Tools/i);
  const licenseRows=[],certRows=[];
  if(ksec){
    for(const h of nodes(root,n=>n.tag==='h3' && n.start>=ksec.start && n.start<ksec.end && /Ksign/i.test(textOf(n)))){
      const card=cardFor(h,ksec), {name,mode}=metaFromCard(card,textOf(h),'license');
      if(!name || /^AppleJr DNS$/i.test(name))continue;
      const url=urlsInside(card).find(x=>/^(itms-services:|https:)/.test(x.url))?.url??null;
      licenseRows.push({id:slug(name),name,mode,installUrl:url,sourceUrl:`${SOURCE}#ksign`});
    }
  }
  if(csec){
    for(const h of nodes(root,n=>n.tag==='h3' && n.start>=csec.start && n.start<csec.end)){
      const card=cardFor(h,csec),{name,mode}=metaFromCard(card,textOf(h),'cert');
      if(!name || /AppleJr DNS/i.test(name))continue;
      const url=urlsInside(card).find(x=>/https:\/\//.test(x.url))?.url??null;
      certRows.push({id:slug(name),name,mode,downloadUrl:url,sourceUrl:`${SOURCE}#certs`});
    }
  }
  // DNS can appear more than once; take first KSign occurrence and prefer real link.
  let dnsUrl=null;
  if(ksec){
    const dnsNode=nodes(root,n=>n.tag==='h3' && n.start>=ksec.start && n.start<ksec.end && /AppleJr DNS/i.test(textOf(n)))[0];
    if(dnsNode) dnsUrl=urlsInside(cardFor(dnsNode,ksec))[0]?.url??null;
  }
  const uniq=rows=>Array.from(new Map(rows.filter(r=>r.name && r.name.length<150).map(r=>[r.name.toLowerCase(),r])).values());
  return {licenses:uniq(licenseRows),certificates:uniq(certRows),dnsUrl:dnsUrl??DNS_FALLBACK};
}
