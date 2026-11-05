const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../assets/summer-school-2026/workbook-window.js'),'utf8');
function setup(page='step-1.html',blocked=false,openedHref='about:blank'){
  let click;const calls=[],navigations=[],messages=[],events={};
  const link={href:'https://example.org/bitcom/workbook.html#blast'};
  const popup={
    location:{href:openedHref,replace(href){navigations.push(href);this.href=href}},
    focus(){},
    postMessage(...args){messages.push(args)}
  };
  const window={open:(...args)=>{calls.push(args);return blocked?null:popup},addEventListener:(name,fn)=>events[name]=fn};
  vm.runInNewContext(code,{window,location:new URL('https://example.org/bitcom/'+page),URL,document:{querySelectorAll:()=>[link],addEventListener:(name,fn)=>click=fn}});
  return{window,link,calls,navigations,messages,popup,click:(href=link.href,extra={})=>{let prevented=false;click({target:{closest:()=>({href})},button:0,preventDefault(){prevented=true},...extra});return prevented}};
}
test('workbook opens in reusable separate window at requested field',()=>{const a=setup();assert.equal(a.link.target,'EFI_BITCom_Workbook');assert.equal(a.click(),true);assert.equal(a.navigations[0],a.link.href);assert.equal(a.calls[0][1],'EFI_BITCom_Workbook');assert.match(a.calls[0][2],/popup=yes/)});
test('an open workbook changes fields without replacing the document',()=>{const a=setup('step-2.html',false,'https://example.org/bitcom/workbook.html#synthetic');assert.equal(a.click(),true);assert.equal(a.popup.location.hash,'#blast');assert.equal(a.navigations.length,0)});
test('a repeat jump asks the open workbook to focus the same field again',()=>{const a=setup('step-2.html',false,'https://example.org/bitcom/workbook.html#blast');assert.equal(a.click(),true);assert.equal(a.messages[0][0].hash,'#blast');assert.equal(a.messages[0][1],'https://example.org');assert.equal(a.navigations.length,0)});
test('other internal and external links retain normal behavior',()=>{const a=setup();assert.equal(a.click('https://example.org/bitcom/step-2.html'),false);assert.equal(a.click('https://external.org/workbook.html'),false);assert.equal(a.calls.length,0)});
test('blocked popup leaves normal target fallback',()=>{const a=setup('index.html',true);assert.equal(a.click(),false)});
test('modifier click keeps browser controls',()=>{const a=setup();assert.equal(a.click(undefined,{ctrlKey:true}),false);assert.equal(a.calls.length,0)});
test('workbook claims its name without opening another window',()=>{const a=setup('workbook.html');assert.equal(a.window.name,'EFI_BITCom_Workbook');assert.equal(a.calls.length,0)});
