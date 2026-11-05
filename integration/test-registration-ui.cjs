const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=name=>readFileSync(path.join(__dirname,'../assets/summer-school-2026',name),'utf8');
const receipt={receipt:'r'.repeat(43),scope:'account-a',expires:Date.now()/1000+3600};
function setup({enabled=true,hash='',map=new Map(),server={},saveUnavailable=()=>false}={}) {
  const elements=new Map(),calls=[],events={},intervals=new Map();
  const get=id=>{
    if(!elements.has(id))elements.set(id,{
      value:'',hidden:true,checked:false,dataset:{},reportValidity:()=>true,
      addEventListener(type,handler){this[type]=handler;},
      querySelector(){return {focus(){}};},focus(){},
    });
    return elements.get(id);
  };
  let cleared=false, nextSave;
  const context={
    window:{BITCOM_REGISTRATION:{enabled,api:'https://workshop.invalid'},addEventListener:(type,f)=>events[type]=f,dispatchEvent(){}},
    document:{getElementById:get,querySelectorAll:()=>[],addEventListener(){}},
    navigator:{}, StorageEvent:class {},
    localStorage:{getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)},
    location:{hash,pathname:'/bitcom/register.html'},history:{replaceState(){cleared=true;}},
    URLSearchParams,AbortSignal,
    clearTimeout(){nextSave=undefined;},
    setTimeout(callback){nextSave=callback;},
    setInterval(callback,delay){intervals.set(delay,callback);return delay;},
    fetch:async (url,request)=>{
      const route=new URL(url).pathname;
      const body=JSON.parse(request.body);
      calls.push([route,body]);
      let status=200,data={};
      if(route==='/confirm')data=receipt;
      if(route==='/load')data=server;
      if(route==='/save'){
        if(saveUnavailable()){status=503;data={detail:'service_unavailable'};}
        else if((server[body.kind]?.revision||0)!==body.revision){status=409;data={detail:'newer_server_copy'};}
        else{data={revision:body.revision+1};server[body.kind]={revision:data.revision,data:body.data};}
      }
      return {ok:status===200,status,json:async()=>data};
    },
  };
  vm.createContext(context);
  vm.runInContext(source('cloud-work.js'),context);
  vm.runInContext(source('registration.js'),context);
  return {get,calls,map,server,intervals,flushEdit:()=>nextSave?.(),cloud:context.window.WorkshopCloud,cleared:()=>cleared,
    submit:async()=>{get('registration-email').value='person@example.org';await get('registration-form').submit({preventDefault(){}});}};
}
test('disabled and guest pages never send account requests on load',async()=>{
  const disabled=setup({enabled:false});await disabled.submit();
  assert.equal(disabled.calls.length,0);assert.equal(disabled.get('registration-form').hidden,true);
  assert.equal(setup().calls.length,0);
});
test('sending a link does not sign the participant in',async()=>{
  const a=setup();await a.submit();
  assert.equal(a.calls[0][0],'/request');
  assert.equal(a.cloud.session(),null);
  assert.equal(a.get('registration-success').hidden,true);
});
test('confirm strips the URL secret and restores server work under the account key',async()=>{
  const a=setup({hash:'#bitcom_token=secret',server:{workbook:{revision:2,data:{scratch_notes:'Server note'}}}});
  assert.equal(a.cleared(),true);
  await a.submit();
  assert.equal(a.calls[0][1].token,'secret');
  assert.equal(a.get('registration-success').hidden,false);
  assert.equal(JSON.parse(a.map.get(a.cloud.storageKey('workbook'))).scratch_notes,'Server note');
  assert.ok(![...a.map.values()].some(v=>v.includes('secret')));
});
test('guest work is copied only by choice and only into empty server sections',async()=>{
  const map=new Map([['efi-bitcom-workbook-v1',JSON.stringify({scratch_notes:'Guest note'})]]);
  const a=setup({hash:'#bitcom_token=secret',map});a.get('copy-guest-work').checked=true;
  await a.submit();
  assert.equal(a.server.workbook.data.scratch_notes,'Guest note');
  assert.equal(JSON.parse(map.get('efi-bitcom-workbook-v1')).scratch_notes,'Guest note');
  const b=setup({hash:'#bitcom_token=secret',map,server:{workbook:{revision:5,data:{scratch_notes:'Existing'}}}});
  b.get('copy-guest-work').checked=true;await b.submit();
  assert.equal(b.server.workbook.data.scratch_notes,'Existing');
});
test('server conflict retains pending local data and preserves newer server work',async()=>{
  const server={workbook:{revision:1,data:{scratch_notes:'First'}}};
  const a=setup({hash:'#bitcom_token=secret',server});await a.submit();
  server.workbook={revision:2,data:{scratch_notes:'Newer on another device'}};
  a.cloud.queue('workbook',{scratch_notes:'Local edits'});
  assert.equal(await a.cloud.connect(receipt,false),false);
  assert.equal(server.workbook.data.scratch_notes,'Newer on another device');
  assert.equal(JSON.parse(a.map.get(a.cloud.storageKey('workbook')+':sync')).pending.scratch_notes,'Local edits');
});
test('autosave retries pending signed-in edits after a temporary failure',async()=>{
  let unavailable=true;
  const a=setup({hash:'#bitcom_token=secret',saveUnavailable:()=>unavailable});
  await a.submit();
  a.cloud.queue('workbook',{scratch_notes:'My note'});
  assert.equal(await a.flushEdit(),false);
  assert.equal(a.server.workbook,undefined);
  unavailable=false;
  const retry=a.intervals.get(600000);
  assert.equal(await retry(),true);
  assert.equal(a.server.workbook.data.scratch_notes,'My note');
  const requests=a.calls.length;
  await retry();
  assert.equal(a.calls.length,requests);
});
