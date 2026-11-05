const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/summer-school-2026/registration.js'),'utf8');
function setup({enabled=true,hash='',responses=[]}={}) {
 const events={},elements={},calls=[],changes=[],blobs=[];
 const get=id=>elements[id]??=( {value:'',checked:false,hidden:id==='registration-success',disabled:false,textContent:'',
  addEventListener:(type,fn)=>events[id+':'+type]=fn,reportValidity:()=>true,focus(){},querySelector:()=>({focus(){}})} );
 const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map};};
 const localStorage=storage(),sessionStorage=storage();
 const context={window:{BITCOM_REGISTRATION:{enabled,api:'https://test.invalid'},localStorage,sessionStorage},
  localStorage,sessionStorage,document:{getElementById:get,createElement:()=>({click(){}})},
  location:{hash,pathname:'/register.html'},history:{replaceState:(_,__,url)=>changes.push(url)},
  URLSearchParams,AbortSignal,Date,JSON,Blob,setTimeout:()=>0,
  URL:{createObjectURL:blob=>{blobs.push(blob);return 'blob:test';},revokeObjectURL(){}},
  fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});const r=responses.shift()||{status:200,data:{accepted:true}};
   return {ok:r.status<400,status:r.status,json:async()=>r.data};}};
 vm.runInNewContext(source,context);
 return {elements,get,calls,changes,localStorage,sessionStorage,blobs,
  submit:()=>events['registration-form:submit']({preventDefault(){}}),click:id=>events[id+':click']()};
}
const key='efi-bitcom-registration-receipt-v1';
test('disabled registration does not collect or transmit',async()=>{
 const app=setup({enabled:false});app.get('registration-email').value='person@example.org';await app.submit();
 assert.equal(app.calls.length,0);assert.equal(app.get('registration-email').disabled,true);
});
test('email requested is not misrepresented as confirmed',async()=>{
 const app=setup();app.get('registration-email').value='person@example.org';await app.submit();
 assert.match(app.calls[0].url,/\/request$/);assert.equal(app.get('registration-success').hidden,true);
});
test('confirmation clears URL and stores only workshop receipt; export omits secrets',async()=>{
 const app=setup({hash:'#token_hash=one-time-secret',responses:[{status:200,data:{email:'person@example.org',
 workshop:'efi-bitcom-2026-session-1',confirmed_at:'2026-11-05T10:00:00Z',registered_at:'2026-11-05T10:01:00Z',receipt:'opaque-workshop-only',expires:Date.now()/1000+1000}}]});
 assert.deepEqual(app.changes,['/register.html']);assert.equal(app.calls.length,0);
 app.get('registration-email').value='person@example.org';await app.submit();
 assert.equal(app.get('registration-success').hidden,false);
 assert.equal(app.sessionStorage.getItem(key).includes('one-time-secret'),false);
 assert.equal(app.localStorage.getItem(key),null);
 app.click('download-registration');const exported=await app.blobs[0].text();
 assert.equal(exported.includes('receipt'),false);assert.equal(exported.includes('secret'),false);
});
test('failed identity verification never saves browser confirmation',async()=>{
 const app=setup({hash:'#token_hash=bad',responses:[{status:400,data:{detail:'confirmation_invalid_or_expired'}}]});
 app.get('registration-email').value='person@example.org';await app.submit();
 assert.equal(app.get('registration-success').hidden,true);assert.equal(app.sessionStorage.getItem(key),null);
});
test('remembered receipt requires email and server verification',async()=>{
 const app=setup({responses:[{status:401,data:{detail:'confirmation_required'}},{status:200,data:{accepted:true}}]});
 app.localStorage.setItem(key,JSON.stringify({receipt:'existing-receipt',expires:Date.now()/1000+1000}));
 assert.equal(app.get('registration-email').value,'');assert.equal(app.calls.length,0);
 app.get('registration-email').value='different@example.org';await app.submit();
 assert.match(app.calls[0].url,/\/resume$/);assert.match(app.calls[1].url,/\/request$/);
 assert.equal(app.get('registration-success').hidden,true);assert.equal(app.localStorage.getItem(key),null);
});
