const $ = id => document.getElementById(id);
const iconKey = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="15.8" cy="8" r="4.5" stroke="currentColor" stroke-width="1.7"/><path d="m12.65 11.25-8.55 8.55V16.5l2.6-2.6h2.7l1.2-1.2v-2.15" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="6.8" r=".9" fill="currentColor"/></svg>`;
const iconCert = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3.5h7l4 4V14m-3.5-10v4h4M7 3.5a2 2 0 0 0-2 2V18c0 1.1.9 2 2 2h5" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16.5" cy="17" r="3.4" stroke="currentColor" stroke-width="1.5"/><path d="m15.2 17 1 1 1.7-1.8" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const chevron = `<svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>`;
const state = {tab:'licenses',query:'',data:null,fetching:false};
const cacheKey='ksign-github-pages-catalog-v1';
function safeUrl(url){
  if(typeof url!=='string')return null;
  if(url.startsWith('itms-services://?action=download-manifest&url=')){
    try{const embedded=new URL(new URLSearchParams(url.slice(url.indexOf('?')+1)).get('url')); return embedded.protocol==='https:'?url:null}catch{return null}
  }
  try{const u=new URL(url);return u.protocol==='https:'?u.href:null}catch{return null}
}
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node}
function makeRow(item){
  const kind=state.tab==='licenses'?'license':'certificate';
  const direct=safeUrl(kind==='license'?item.installUrl:item.downloadUrl);
  const source=safeUrl(item.sourceUrl)||'https://applejr.net/';
  const gated=Boolean(direct && direct.includes('/post/download/gate.html'));
  const row=el('a','item');row.href=direct||source;row.target=direct?.startsWith('itms-services:')?'_self':'_blank';row.rel='noopener noreferrer';
  row.setAttribute('aria-label',`${direct&&!gated?(kind==='license'?'Install ':'Download '):'View source: '}${item.name}`);
  const icon=el('span',`icon item-icon ${kind==='certificate'?'certificate':''}`);icon.setAttribute('aria-hidden','true');icon.innerHTML=kind==='license'?iconKey:iconCert;
  const copy=el('span','row-copy');copy.append(el('span','row-title',item.name||'Unnamed'));
  if(kind==='license'&&item.mode==='DNS')copy.append(el('span','row-sub','DNS certificate'));
  if(kind==='certificate')copy.append(el('span','row-sub','Signing certificate'));
  row.append(icon,copy,el('span','row-action',gated?'Continue':(direct?(kind==='license'?'Install':'Download'):'View')));
  const arr=el('span');arr.innerHTML=chevron;row.append(...arr.childNodes);
  return row;
}
function render(){
  const licenses=state.tab==='licenses',list=$('catalog');
  $('tabLicenses').classList.toggle('selected',licenses);
  $('tabCertificates').classList.toggle('selected',!licenses);
  $('tabLicenses').setAttribute('aria-selected',String(licenses));
  $('tabCertificates').setAttribute('aria-selected',String(!licenses));
  list.setAttribute('aria-labelledby',licenses?'tabLicenses':'tabCertificates');
  const items=state.data?.[state.tab]||[];
  const filtered=items.filter(i=>(i.name||'').toLocaleLowerCase().includes(state.query.toLocaleLowerCase()));
  list.replaceChildren();
  if(filtered.length){for(const item of filtered)list.append(makeRow(item));}
  else list.append(el('div','placeholder',state.data?'No matching results':'Loading options...'));
  $('count').textContent=state.data?`${filtered.length} ${licenses?'licenses':'certificates'}`:'';
  const d=state.data;
  $('syncInfo').className=d&&!d.live?'warning':'';
  $('syncInfo').textContent=d?(d.live?'From AppleJr'+(d.lastUpdated?' · '+new Date(d.lastUpdated).toLocaleDateString():''):'Saved list'):'From AppleJr';
  $('clearSearch').hidden=!state.query;
  const dns=safeUrl(d?.dnsUrl);if(dns)$('dnsLink').href=dns;
}
async function refresh(force=false){
  if(state.fetching)return;
  state.fetching=true;$('reload').disabled=true;$('reload').classList.add('busy');
  try{
    const url=new URL('./catalog.json',document.baseURI);url.searchParams.set('t',String(Date.now()));
    const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(17000)});
    if(!response.ok)throw new Error('Catalog unavailable');
    const data=await response.json();if(!Array.isArray(data.licenses)||!Array.isArray(data.certificates))throw new Error('Bad catalog');
    state.data=data;
    try{localStorage.setItem(cacheKey,JSON.stringify(data))}catch{}
  }catch(e){if(!state.data){try{state.data=JSON.parse(localStorage.getItem(cacheKey))}catch{}}if(state.data)state.data={...state.data,live:false};}
  finally{state.fetching=false;$('reload').disabled=false;$('reload').classList.remove('busy');render()}
}
$('tabLicenses').addEventListener('click',()=>{state.tab='licenses';render()});
$('tabCertificates').addEventListener('click',()=>{state.tab='certificates';render()});
$('reload').addEventListener('click',()=>refresh(true));
$('search').addEventListener('input',e=>{state.query=e.target.value.trim();render()});
$('clearSearch').addEventListener('click',()=>{$('search').value='';state.query='';render();$('search').focus()});
try{state.data=JSON.parse(localStorage.getItem(cacheKey))}catch{}
render();refresh();setInterval(()=>refresh(),120000);
