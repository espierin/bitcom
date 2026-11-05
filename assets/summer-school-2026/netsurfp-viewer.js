(() => {
  'use strict';
  const $=id=>document.getElementById(id),base='downloads/summer-school-2026/netsurfp/';
  const core=window.NetSurfPCore;let manifest,selected,data,reference,verified=false,generation=0,lookupGeneration=0,fileGeneration=0;
  const cache=new Map();
  async function json(file){
    if(cache.has(file))return cache.get(file);
    try{
      const response=await fetch(base+file);
      if(!response.ok)throw Error('Saved data unavailable.');
      const saved=await response.json();
      cache.set(file,saved);
      return saved;
    }catch{
      throw Error('Saved data could not be loaded. Check your connection and reload the viewer.');
    }
  }
  function invalidate(){
    lookupGeneration++;
    verified=false;
    $('ns-lookup').disabled=true;
    $('ns-results').hidden=true;
    $('ns-verify-status').textContent='';
    $('ns-lookup-status').textContent='';
  }
  function link(id,file){$(id).href=base+file;}
  async function choose(){
    const version=++generation;invalidate();data=null;selected=manifest.inputs.find(x=>x.id===$('ns-case').value);
    $('ns-position').value='';$('ns-reference-position').value='';$('ns-sequence').value='';$('ns-file').value='';$('ns-answer').open=false;
    $('ns-dataset').hidden=true;$('ns-entry').hidden=true;
    $('ns-answer-text').textContent='Select a case to see its detailed answer.';
    if(!selected){$('ns-case-status').textContent='Select your assigned case and the exact input you analysed.';return;}
    $('ns-case-status').textContent=selected.notice||'Loading the selected dataset…';
    $('ns-answer-text').textContent=selected.answer||'Use the original case answer on Downloads after recording your interpretation.';
    if(!selected.result_file){$('ns-case-status').textContent=selected.notice;return;}
    try{
      const result=await json(selected.result_file);if(version!==generation)return;
      data=core.validate(result,selected.sequence);
      $('ns-length').textContent=`${selected.length} residues · NetSurfP-${manifest.version} · calculated ${manifest.run_date}. Positions are 1-based in this exact input, including any signal peptide present.`;
      $('ns-preparation').textContent=selected.preparation;
      $('ns-source').textContent=selected.source_file;
      $('ns-sha').textContent=selected.sequence_sha256;
      $('ns-job').textContent=manifest.job_id;
      link('ns-input-download',selected.input_file);link('ns-json-download',selected.result_file);link('ns-csv-download',selected.csv_file);
      $('ns-position').max=data.seq.length;
      $('ns-dataset').hidden=false;$('ns-entry').hidden=false;
      $('ns-case-status').textContent=selected.notice||'Dataset ready. Verify your protein below.';
    }catch(e){if(version===generation)$('ns-case-status').textContent=e.message;}
  }
  $('ns-case').addEventListener('change',choose);
  $('ns-sequence').addEventListener('input',()=>{fileGeneration++;invalidate();});
  $('ns-file').addEventListener('change',async e=>{
    const f=e.target.files[0];if(!f)return;
    const v=generation, fileVersion=++fileGeneration;
    invalidate();
    $('ns-sequence').value='';
    try {
      if(f.size>100000)throw Error('Choose a single protein file smaller than 100 kB.');
      const content=await f.text();
      if(v!==generation||fileVersion!==fileGeneration)return;
      $('ns-sequence').value=content;
      $('ns-verify-status').textContent='File loaded locally. Click Verify sequence.';
    } catch(e) {
      if(v===generation&&fileVersion===fileGeneration)$('ns-verify-status').textContent=e.message;
    }
  });
  $('ns-verify').addEventListener('click',()=>{
    invalidate();try{
      const input=core.parseProtein($('ns-sequence').value);
      if(input!==data.seq)throw Error('Sequence mismatch. These predictions do not apply to your input. Check the selected case, signal peptide, translation and preparation; do not change your sequence merely to make it match.');
      verified=true;$('ns-lookup').disabled=false;$('ns-verify-status').textContent='Exact sequence match confirmed. Enter the position you identified in your alignment.';
    }catch(e){$('ns-verify-status').textContent=e.message;}
  });
  function chart(target,d,p,label){
    target.replaceChildren();const ns='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 800 245');svg.setAttribute('role','img');svg.setAttribute('aria-label',`${label}: RSA across ${d.seq.length} residues. Selected position ${p}. Exact selected values are in the table.`);
    function node(tag,attrs,text){const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;svg.append(e);return e;}
    const x=i=>50+(d.seq.length===1?0:i/(d.seq.length-1)*725),y=v=>200-v*175;
    for(const value of [0,.25,.5,.75,1]){node('line',{x1:50,x2:775,y1:y(value),y2:y(value),stroke:'#dce4eb'});node('text',{x:8,y:y(value)+4,'font-size':13},String(value));}
    node('polyline',{points:d.rsa.map((v,i)=>`${x(i)},${y(v)}`).join(' '),fill:'none',stroke:'#064a89','stroke-width':2});
    node('line',{x1:x(p-1),x2:x(p-1),y1:25,y2:200,stroke:'#a83e3e','stroke-dasharray':'4 4'});
    node('circle',{cx:x(p-1),cy:y(d.rsa[p-1]),r:5,fill:'#a83e3e'});
    node('text',{x:50,y:223,'font-size':13},'1');node('text',{x:775,y:223,'text-anchor':'end','font-size':13},String(d.seq.length));
    node('text',{x:410,y:242,'text-anchor':'middle','font-size':13},'Position in the submitted protein');node('text',{x:50,y:16,'font-size':14},label+' · RSA (0 to 1)');target.append(svg);
  }
  $('ns-lookup-form').addEventListener('submit',async event=>{
    event.preventDefault();$('ns-results').hidden=true;$('ns-lookup-status').textContent='';if(!verified)return;
    const version=generation,lookupVersion=++lookupGeneration,chosen=selected,chosenData=data;
    try{
      const row=core.residue(chosenData,$('ns-position').value),rows=[[chosen.label,row]];
      const refValue=$('ns-reference-position').value;
      if(refValue){const item=manifest.inputs.find(x=>x.id==='reference');reference=core.validate(await json(item.result_file),item.sequence);if(version!==generation||lookupVersion!==lookupGeneration||!verified)return;rows.push(['Reference A*01:01:01:01',core.residue(reference,refValue)]);}
      $('ns-values').replaceChildren();
      for(const[label,r]of rows){const tr=document.createElement('tr');for(const value of [label,r.position,r.aa,r.rsa.toFixed(4),r.asa.toFixed(2)]){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('ns-values').append(tr);}
      chart($('ns-chart'),chosenData,row.position,chosen.label);$('ns-reference-chart').hidden=!refValue;
      if(refValue)chart($('ns-reference-chart'),reference,Number(refValue),'Reference');
      $('ns-observation').value=rows.map(([label,r])=>`${label}: input position ${r.position}; amino acid ${r.aa}; RSA ${r.rsa.toFixed(4)}; ASA ${r.asa.toFixed(2)} Å²`).join('\n')+`\nNetSurfP-${manifest.version}; precomputed ${manifest.run_date}; input SHA-256 ${chosen.sequence_sha256}\nMy exposure interpretation and evidence: \nNumbering / mapping notes: `;
      $('ns-results').hidden=false;
      $('ns-lookup-status').textContent='Values loaded. Make your own exposure interpretation before opening the explanation.';
    }catch(e){if(version===generation&&lookupVersion===lookupGeneration)$('ns-lookup-status').textContent=e.message;}
  });
  // Never leave stale values visible after a position edit.
  for(const id of ['ns-position','ns-reference-position'])$(id).addEventListener('input',()=>{lookupGeneration++;$('ns-results').hidden=true;$('ns-lookup-status').textContent='';});
  function download(text,filename){
    const url=URL.createObjectURL(new Blob([text],{type:'application/octet-stream'}));
    const a=document.createElement('a');
    a.href=url;
    a.download=filename;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  $('ns-download-observation').addEventListener('click',()=>download($('ns-observation').value,'netsurfp-observation.txt'));
  json('manifest.json').then(m=>{manifest=m;for(const item of m.inputs){const o=document.createElement('option');o.value=item.id;o.textContent=item.label;$('ns-case').append(o);}$('ns-case').disabled=false;$('ns-case-status').textContent='Choose a case to begin. No residue position or interpretation is prefilled.';}).catch(e=>{$('ns-case-status').textContent=e.message;});
})();
