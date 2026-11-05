// node integration/test-group-40.cjs URL sms2-source-directory
// Sends only GET requests to the supplied BITCom origin. DTU failure and wait
// are simulated. Upstream SMS2 code runs locally in separate JavaScript contexts.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { performance } = require('node:perf_hooks');
const { runInNewContext } = require('node:vm');
const { createHash } = require('node:crypto');
const { parseProtein } = require('../assets/summer-school-2026/netsurfp-core.js');

const [address, smsDir] = process.argv.slice(2);
const site = new URL(address);
const archive = 'downloads/summer-school-2026/netsurfp/';
const alignments = 'downloads/summer-school-2026/saved-alignments/';
const assets = 'assets/summer-school-2026/';
const file = name => readFileSync(resolve(__dirname,'..',name),'utf8');
const sources = ['netsurfp-core.js','netsurfp-timer.js','netsurfp-viewer.js'].map(name => file(assets+name));
const alignmentManifest = JSON.parse(file(alignments+'manifest.json'));
const sms = ['sms_common.js','pairwise_affine_align.js','pairwise_align_protein.js'].map(name => readFileSync(join(smsDir,name),'utf8')).join('\n');
const sha = value => createHash('sha256').update(value).digest('hex');
assert.equal(sha(readFileSync(join(smsDir,'pairwise_affine_align.js'))), alignmentManifest.scriptSha256);

const cases = ['case01','case02cds','case02genomic','case03','case04','case05protein','case05cds','case06','reference','demoB'];
const unresolved = new Set(['case02genomic','case03']);
let active = 0, peak = 0, requests = 0;
async function get(name) {
  const url = new URL(name,site);
  assert.equal(url.origin,site.origin);
  active++;
  peak = Math.max(peak,active);
  requests++;
  try {
    const response = await fetch(url,{signal:AbortSignal.timeout(20000)});
    assert.equal(response.status,200,url.href);
    return await response.text();
  } finally { active--; }
}

function entries(text) {
  return text.trim().split(/^>/m).filter(Boolean).map(record=>record.split(/\r?\n/).slice(1).join(''));
}
function testAlignment(id, input, expected, readable) {
  const [first, second] = entries(input);
  const record = alignmentManifest.records.find(record=>record.id===id);
  assert.deepEqual([sha(first),sha(second)],record.sequenceSha256);
  assert.match(readable,/Ranges count residues in each input/);
  let output = '';
  const ctx = {alert: message=>{throw new Error(message);}};
  runInNewContext(sms,ctx);
  ctx.openWindow = ctx.openPre = ctx.closePre = ctx.closeWindow = () => {};
  ctx.outputWindow = {document:{write: text=>{output += text;}}};
  const selection = value=>({selectedIndex:0,options:[{value}]});
  const elements = [
    {value:'>Reference\n'+first},{value:'>Compared_input\n'+second},
    null,null,null,selection('blosum62'),selection('12'),selection('2'),
  ];
  assert.equal(ctx.pairwiseAlignProtein({forms:[{elements}]}),true);
  const aligned = entries(output.slice(output.indexOf('>Reference\n'),output.indexOf('Alignment score:')));
  assert.deepEqual(aligned,entries(expected));
  assert.equal(aligned[0].replaceAll('-',''),first);
  assert.equal(aligned[1].replaceAll('-',''),second);
}

function element() {
  return {value:'',hidden:true,children:[],events:{},setAttribute(){},
    append(...children){this.children.push(...children);},
    replaceChildren(){this.children=[];},
    addEventListener(type,listener){this.events[type]=listener;}};
}
async function testViewer(id, slow) {
  const elements = new Map(), persisted = new Map();
  const lookup = id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
  let now = 1000, tick;
  const ctx = {
    window:{addEventListener(){}},
    document:{getElementById:lookup,createElement:element,createElementNS:element},
    localStorage:{getItem:key=>persisted.get(key),setItem:(key,value)=>persisted.set(key,value)},
    Date:{now:()=>now},setInterval:callback=>{tick=callback;},
    fetch:async name=>{
      assert.ok(name.startsWith(archive),name);
      return {ok:true,json:async()=>JSON.parse(await get(name))};
    },
  };
  for(const script of sources)runInNewContext(script,ctx);
  if(slow){
    lookup('ns-timer-start').events.click();
    assert.match(lookup('ns-timer-status').textContent,/2:00 remaining/);
    now += 120000;
    tick();
    assert.match(lookup('ns-timer-status').textContent,/Two minutes have passed/);
  }
  // Let the real viewer's manifest request finish before selecting the dataset.
  const deadline = performance.now()+21000;
  while(!lookup('ns-case').children.length && performance.now()<deadline){
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  assert.equal(lookup('ns-case').children.length,10,lookup('ns-case-status').textContent);
  lookup('ns-case').value=id;
  await lookup('ns-case').events.change();
  if(unresolved.has(id)){
    assert.match(lookup('ns-case-status').textContent,/No unique translated protein/);
    assert.equal(lookup('ns-entry').hidden,true);
    lookup('ns-case').value='demoB';
    await lookup('ns-case').events.change();
    id = 'demoB';
  }
  const sequence = await get(archive+id+'.fasta');
  lookup('ns-sequence').value=sequence;
  lookup('ns-verify').events.click();
  assert.match(lookup('ns-verify-status').textContent,/Exact sequence match/);
  lookup('ns-position').value='1';
  if(id!=='demoB')lookup('ns-reference-position').value='1';
  await lookup('ns-lookup-form').events.submit({preventDefault(){}});
  assert.equal(lookup('ns-results').hidden,false,lookup('ns-lookup-status').textContent);
  const row = lookup('ns-values').children[0].children.map(cell=>cell.textContent);
  assert.equal(row[2],parseProtein(sequence)[0]);
  assert.ok(Number(row[3])>=0 && Number(row[3])<=1);
  assert.ok(lookup('ns-chart').children.length);
}

async function client(index) {
  const start = performance.now();
  const id = cases[index % cases.length];
  const pair = unresolved.has(id)||id==='reference'?'demoB':id;
  const guide = await get('alignment-results.html');
  assert.ok(guide.includes(pair+'-comparison.txt'));
  const pairFiles = [];
  for(const suffix of ['inputs.fasta','aligned.fasta','comparison.txt']){
    pairFiles.push(await get(alignments+pair+'-'+suffix));
  }
  testAlignment(pair,...pairFiles);
  const viewer = await get('netsurfp-viewer.html');
  assert.ok(viewer.includes('ns-lookup-form'));
  await testViewer(id,index<20);
  return performance.now()-start;
}

(async()=>{
  const start = performance.now();
  const outcomes = await Promise.allSettled(Array.from({length:40},(_,i)=>client(i)));
  const failures = outcomes.flatMap((outcome,i)=>outcome.status==='rejected'?[{client:i+1,error:outcome.reason.message}]:[]);
  const durations = outcomes.flatMap(o=>o.status==='fulfilled'?[o.value]:[]).sort((a,b)=>a-b);
  console.log(JSON.stringify({mode:'online archive',
    passed:durations.length, failed:failures.length, failures,
    p95Seconds:Number((durations[Math.ceil(durations.length*.95)-1]/1000).toFixed(2)),
    elapsedSeconds:Number(((performance.now()-start)/1000).toFixed(2)),
    httpRequests:requests,peakInFlight:peak}));
  assert.equal(failures.length,0);
})().catch(error=>{console.error(error);process.exitCode=1;});
