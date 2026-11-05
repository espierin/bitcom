const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const src=n=>fs.readFileSync(path.join(__dirname,'../assets/summer-school-2026',n),'utf8');
function setup(map=new Map(),broken=false){
 const elements={},events={},blobs=[],all=[];
 function el(){const e={children:[],dataset:{},value:'',textContent:'',append(...x){this.children.push(...x)},after(x){this.next=x},setAttribute(){},addEventListener(t,f){this[t]=f},click(){},remove(){}};all.push(e);return e;}
 const get=id=>elements[id]??=el();
 const fields=['case','scratch_notes'].map(name=>Object.assign(el(),{name,id:name}));
 const form=get('workbook-form');form.querySelectorAll=s=>s==='textarea'?fields:fields.map(f=>({querySelector:()=>({textContent:f.name}),querySelectorAll:()=>[f]}));form.querySelector=()=>({textContent:'Notes'});
 const context={window:{addEventListener:(t,f)=>events[t]=f},document:{createElement:el,createTextNode:s=>s,querySelector:()=>el(),querySelectorAll:()=>[],getElementById:get,body:el()},
 localStorage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>{if(broken)throw Error('quota');map.set(k,v)}},structuredClone,location:{hash:''},Date,JSON,Blob,setTimeout:()=>0,clearTimeout(){},confirm:()=>true,URL:{createObjectURL:b=>{blobs.push(b);return 'blob:test'},revokeObjectURL(){}}};
 vm.createContext(context);vm.runInContext(src('progress-data.js'),context);vm.runInContext(src('progress.js'),context);vm.runInContext(src('workbook.js'),context);
 return {context,map,fields,get,blobs,progress:context.window.WorkshopProgress,save:()=>form.input({target:fields[1]}),export:()=>get('export-json').click(),import:async data=>get('import-json').change({target:{files:[{size:100,text:async()=>JSON.stringify(data)}],value:'file'}})};
}
test('answers, scratchpad and completed tasks survive reload',()=>{const a=setup();a.fields[1].value='My notes';a.save();a.progress.restore({completed:['step-1.1'],last:'step-1.2'});const b=setup(a.map);assert.equal(b.fields[1].value,'My notes');assert.equal(b.progress.snapshot().last,'step-1.2');assert.equal(b.progress.snapshot().completed.length,1)});
test('JSON transfers notes and progress to a fresh device',async()=>{const a=setup();a.fields[1].value='My notes';a.progress.restore({completed:['step-1.1'],last:'step-1.2'});a.export();const data=JSON.parse(await a.blobs[0].text());const b=setup();await b.import(data);assert.equal(b.fields[1].value,'My notes');assert.equal(b.progress.snapshot().last,'step-1.2');assert.equal(b.progress.snapshot().completed.length,1)});
test('old backup retains existing task progress',async()=>{const a=setup();a.progress.restore({completed:['step-1.1'],last:'step-1.2'});await a.import({format:'efi-bitcom-workbook',version:1,answers:{case:'Case 2'}});assert.equal(a.fields[0].value,'Case 2');assert.equal(a.progress.snapshot().last,'step-1.2')});
test('invalid resume link rejects backup before replacing answers',async()=>{const a=setup();a.fields[1].value='Keep';await a.import({format:'efi-bitcom-workbook',version:1,answers:{scratch_notes:'Replace'},progress:{completed:[],last:'https://evil.invalid'}});assert.equal(a.fields[1].value,'Keep');assert.match(a.get('import-status').textContent,/Import failed/)});
test('failed storage still allows current progress and notes to be exported',async()=>{const a=setup(new Map([['efi-bitcom-progress-v1',JSON.stringify({completed:[],last:null})]]),true);a.fields[1].value='Unsaved notes';a.save();a.progress.restore({completed:['step-1.1'],last:'step-1.2'});a.export();const data=JSON.parse(await a.blobs[0].text());assert.equal(data.answers.scratch_notes,'Unsaved notes');assert.equal(data.progress.completed.length,1);assert.match(a.get('save-status').textContent,/unavailable/)});
test('reports include scratchpad and progress',async()=>{const a=setup();a.fields[1].value='Notebook';a.progress.restore({completed:['step-1.1'],last:'step-1.2'});a.get('export-text').click();const report=await a.blobs[0].text();assert.match(report,/Notebook/);assert.match(report,/Completed tasks: 1 \/ 37/)});

test('later pages unlock only when every preceding task is complete',()=>{const a=setup();assert.equal(a.progress.missingBefore('step-1.html').length,0);assert.equal(a.progress.missingBefore('step-2.html').length,3);a.progress.restore({completed:['step-1.1','step-1.2'],last:'step-1.2'});assert.equal(a.progress.missingBefore('step-2.html').length,1);a.progress.restore({completed:['step-1.1','step-1.2','step-1.3'],last:'step-1.3'});assert.equal(a.progress.missingBefore('step-2.html').length,0);assert.ok(a.progress.missingBefore('step-3.html').length>0);assert.equal(a.progress.missingBefore('workbook.html').length,0);a.progress.restore({completed:['step-1.1'],last:'step-1.1'});assert.equal(a.progress.missingBefore('step-2.html').length,2)});

test('editing another field after a storage failure preserves the unsaved answer', async () => {
  const saved = new Map([['efi-bitcom-workbook-v1', JSON.stringify({case:'Old case',scratch_notes:'Old notes'})]]);
  const workbook = setup(saved, true);
  workbook.fields[0].value = 'Updated case';
  workbook.get('workbook-form').input({target:workbook.fields[0]});
  workbook.fields[1].value = 'Updated notes';
  workbook.save();
  workbook.export();
  const backup = JSON.parse(await workbook.blobs[0].text());
  assert.deepEqual(backup.answers, {case:'Updated case',scratch_notes:'Updated notes'});
});
