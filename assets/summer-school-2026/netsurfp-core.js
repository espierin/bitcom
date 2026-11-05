(function(root){
  function parseProtein(text){
    const lines=text.trim().split(/\r?\n/);let headers=0,sequence='';
    for(const line of lines){if(line.trim().startsWith('>')){headers++;if(headers>1||sequence)throw Error('Paste exactly one protein FASTA entry.');}else sequence+=line.replace(/\s/g,'').toUpperCase();}
    if(!sequence||!/^[ACDEFGHIKLMNPQRSTVWYXBZJUO]+$/.test(sequence))throw Error('Use one unaligned protein sequence. Do not remove unknown residues or stop markers silently; follow the preparation instructions.');
    return sequence;
  }
  function residue(data,value){
    if(!/^\d+$/.test(String(value)))throw Error('Enter a whole-number position starting at 1.');
    const p=Number(value);if(p<1||p>data.seq.length)throw Error(`Position must be between 1 and ${data.seq.length} for this input.`);
    return {position:p,aa:data.seq[p-1],rsa:data.rsa[p-1],asa:data.asa[p-1]};
  }
  function validate(data,sequence){
    if(data.seq!==sequence)throw Error('Stored output does not match its input. Do not use this dataset.');
    for(const field of ['rsa','asa'])if(!Array.isArray(data[field])||data[field].length!==sequence.length||data[field].some(v=>!Number.isFinite(v)||v<0||(field==='rsa'&&v>1)))throw Error('Stored prediction is incomplete or invalid.');
    return data;
  }
  const api={parseProtein,residue,validate};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NetSurfPCore=api;
})(typeof window==='undefined'?globalThis:window);
