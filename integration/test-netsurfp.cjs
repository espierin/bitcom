const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const base=path.join(__dirname,'../downloads/summer-school-2026/netsurfp');
const core=require('../assets/summer-school-2026/netsurfp-core.js');
const read=n=>fs.readFileSync(path.join(base,n));
const manifest=JSON.parse(read('manifest.json'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('all eight archived predictions match exact FASTA and checksums',()=>{
 const computed=manifest.inputs.filter(i=>i.result_file);assert.equal(computed.length,8);
 let residues=0;
 for(const i of computed){const d=core.validate(JSON.parse(read(i.result_file)),core.parseProtein(read(i.input_file).toString()));assert.equal(sha(read(i.result_file)),i.result_sha256);assert.equal(sha(read(i.input_file)),i.input_file_sha256);assert.equal(sha(d.seq),i.sequence_sha256);residues+=d.seq.length;assert.equal(core.residue(d,1).aa,d.seq[0]);assert.equal(core.residue(d,d.seq.length).aa,d.seq.at(-1));assert.throws(()=>core.residue(d,d.seq.length+1));}
 assert.equal(residues,2271);
 for(const ext of ['json','csv','zip'])assert.equal(sha(read('raw-batch.'+ext)),manifest.raw_sha256[ext]);
});
test('parser preserves unknown residues and rejects multiple, aligned or stop-containing input',()=>{
 assert.equal(core.parseProtein('>test\n acd x\n'),'ACDX');
 for(const input of ['>a\nACD\n>b\nEFG','AC-D','ACD*','ACD123',''])assert.throws(()=>core.parseProtein(input));
 assert.equal(JSON.parse(read('case05protein.json')).seq.at(-1),'X');
});
test('invalid positions and incomplete or mismatched predictions cannot be interpreted',()=>{
 const d=JSON.parse(read('case02cds.json'));assert.equal(d.seq.length,30);
 for(const p of [0,-1,31,1.5,'1e1',''])assert.throws(()=>core.residue(d,p));
 assert.throws(()=>core.validate(d,'AAA'));assert.throws(()=>core.validate({...d,rsa:[]},d.seq));assert.throws(()=>core.validate({...d,rsa:d.rsa.map(()=>NaN)},d.seq));
 assert.equal(manifest.inputs.filter(i=>!i.result_file).length,2);
});
test('two-minute timer persists across reload and expires without resubmitting',()=>{
 const map=new Map();let now=1000;
 function setup(){const els={};let tick;const context={document:{getElementById:id=>els[id]??=(id==='ns-timer-start'?{addEventListener:(e,f)=>els.start=f}:{textContent:''})},window:{addEventListener(){}},localStorage:{getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)},Date:{now:()=>now},setInterval:f=>tick=f};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/summer-school-2026/netsurfp-timer.js'),'utf8'),context);return{els,tick};}
 const a=setup();a.els.start();assert.match(a.els['ns-timer-status'].textContent,/2:00/);now+=60000;const b=setup();assert.match(b.els['ns-timer-status'].textContent,/1:00/);now+=60000;b.tick();assert.match(b.els['ns-timer-status'].textContent,/Two minutes have passed/);assert.match(b.els['ns-timer-status'].textContent,/do not resubmit/);
});
