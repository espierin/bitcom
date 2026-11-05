// Usage: node integration/build_saved_alignments.cjs path/to/pairwise_affine_align.js
// Use the original SMS2 script from https://www.bioinformatics.org/sms2/scripts/.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.join(__dirname, '..');
const { parseProtein } = require('../assets/summer-school-2026/netsurfp-core.js');

const data = path.join(__dirname, '../downloads/summer-school-2026');
const archive = path.join(data, 'netsurfp');
const destination = path.join(data, 'saved-alignments');
const source = path.resolve(process.argv[2]);
const { align } = require(source);
const method = 'SMS2 Pairwise Align Protein, BLOSUM62, gap opening 12, gap extension 2';
const readProtein = id => parseProtein(fs.readFileSync(path.join(archive, id + '.fasta'), 'utf8'));
const sha256 = text => createHash('sha256').update(text).digest('hex');
const wrap = text => text.match(/.{1,60}/g).join('\n');
const reference = readProtein('reference');
const demo = readProtein('demoB');
const short = readProtein('case05protein');
assert.equal(short.at(-1), 'X');

const pairs = [
  ['case01', 'Case 01', reference, readProtein('case01'), 'Use the supplied Case 01 protein and the workshop A*01:01:01:01 reference.'],
  ['case02cds', 'Case 02 — independent CDS', reference, readProtein('case02cds'), 'Use the verified translation of the independent CDS before its first stop. This pair does not apply to the genomic input.'],
  ['case04', 'Case 04', reference, readProtein('case04'), 'Use the CDS-verified amino-acid segment before the stop. The terminal marker in the original protein file is excluded.'],
  ['case05protein', 'Case 05 — supplied short protein', reference, short.slice(0,-1), 'The alignment covers the known amino-acid prefix only. The original terminal X remains unresolved and is outside this alignment. Use the unmodified short sequence when verifying its exact NetSurfP archive.'],
  ['case05cds', 'Case 05 — supplied CDS', reference, readProtein('case05cds'), 'Use the independent CDS translation. Treat the short protein file as a separate record.'],
  ['case06', 'Case 06', reference, readProtein('case06'), 'Use the supplied Case 06 protein and the workshop A*01:01:01:01 reference.'],
  ['demoB', 'HLA-B demonstration', demo, 'A' + demo.slice(1), 'Separate practice pair for an unresolved or unmatched case. The second input is an artificial demonstration sequence.'],
];

fs.mkdirSync(destination, { recursive: true });
const records = pairs.map(([id, label, first, second, preparation]) => {
  assert.match(first + second, /^[ACDEFGHIKLMNPQRSTVWY]+$/);
  const result = align(first, second, 'blosum62', 12, 2);
  const { alignedM, alignedN, score } = result;
  assert.equal(alignedM.length, alignedN.length);
  assert.equal(alignedM.replaceAll('-', ''), first);
  assert.equal(alignedN.replaceAll('-', ''), second);
  const referenceLabel = id === 'demoB' ? 'HLA-B demonstration reference' : 'A*01:01:01:01 workshop reference';
  const fasta = `>Reference\n${wrap(first)}\n>Compared_input\n${wrap(second)}\n`;
  const aligned = `>Reference\n${wrap(alignedM)}\n>Compared_input\n${wrap(alignedN)}\n`;
  const blocks = [];
  let firstEnd = 0, secondEnd = 0;
  for (let i = 0; i < alignedM.length; i += 60) {
    const a = alignedM.slice(i, i + 60), b = alignedN.slice(i, i + 60);
    const firstStart = firstEnd, secondStart = secondEnd;
    firstEnd += a.replaceAll('-', '').length;
    secondEnd += b.replaceAll('-', '').length;
    const matches = Array.from(a, (letter, j) => letter === b[j] ? '|' : a[j] === '-' || b[j] === '-' ? ' ' : '*').join('');
    const range = (start, end) => start === end ? 'gap' : `${start+1}–${end}`;
    blocks.push(`Reference  ${a}  ${range(firstStart,firstEnd)}\n${('           '+matches).trimEnd()}\nCompared   ${b}  ${range(secondStart,secondEnd)}`);
  }
  fs.writeFileSync(path.join(destination,id+'-inputs.fasta'),fasta);
  fs.writeFileSync(path.join(destination,id+'-aligned.fasta'),aligned);
  fs.writeFileSync(path.join(destination,id+'-comparison.txt'),[
    label, method, `Reference: ${referenceLabel} (${first.length} residues)`,
    `Compared input: ${second.length} residues. ${preparation}`,
    'Ranges count residues in each input from 1, excluding gaps. | means identical and * marks a substitution.',
    'Alignment gaps are representations of correspondence, not individual biological events.',
    `Alignment score: ${score}`, '', blocks.join('\n\n'), '',
  ].join('\n'));
  return { id, label, reference:referenceLabel, preparation, lengths:[first.length,second.length],
    sequenceSha256:[sha256(first),sha256(second)], score };
});

fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify({
  method, script:'https://www.bioinformatics.org/sms2/scripts/pairwise_affine_align.js',
  scriptSha256:sha256(fs.readFileSync(source)), records,
},null,2)+'\n');
const template = fs.readFileSync(path.join(root, 'alignment-help.html'), 'utf8');
const head = template.slice(0, template.indexOf('</nav>') + '</nav>'.length)
  .replace(/<title>[^<]*<\/title>/, '<title>Saved protein comparisons | EFI BITCom</title>');
const dir = 'downloads/summer-school-2026/saved-alignments/';
const sections = records.map(record => `<details class="case" id="${record.id}"><summary>${record.label}</summary>
<div class="support-content"><p><strong>Reference:</strong> ${record.reference}. ${record.preparation}</p>
<ul><li><a href="${dir}${record.id}-inputs.fasta" download>Download the two exact protein inputs</a></li>
<li><a href="${dir}${record.id}-comparison.txt" download>Download the readable comparison with residue ranges</a></li>
<li><a href="${dir}${record.id}-aligned.fasta" download>Download aligned FASTA</a></li></ul></div></details>`);
const guide = `<section><h2>Saved protein comparisons</h2>
<p>Use this route for task 2.7 if SMS2 is slow, its result window is blocked, or the service is unreachable. The saved files require no alignment job.</p>
<ol><li>Open your case and download the exact input pair. Compare both proteins with yours, including lengths and all residues. The HLA-A comparisons use the supplied A*01:01:01:01 workshop reference. If you chose a different BLAST hit, keep that finding and label this saved result as a comparison with the workshop reference.</li>
<li>Download the readable comparison and open it in a plain-text editor. Read the letters in the same column. A vertical bar shows identity, an asterisk marks a substitution, and a hyphen marks a gap. Count letters in each row separately using its residue range.</li>
<li>Record the positions and letters in your variant list. Keep the method, reference and input names with your result. Continue to the NetSurfP archive using the verified protein and its own residue positions.</li></ol>
<p><strong>Case 02 genomic and Case 03:</strong> record that the variant protein is unresolved. Use the HLA-B demonstration below for alignment practice and the separately labelled HLA-B prediction for the RSA exercise. Those results belong to the demonstration.</p>
<p>All pairs use ${method}. <a href="${dir}manifest.json" download>Download provenance and sequence checksums</a>.</p>
${sections.join('\n')}
<p><a href="netsurfp-viewer.html#saved-results">Open saved NetSurfP results</a> · <a href="step-2.html#step-2.7">Return to task 2.7</a></p>
</section></main>
<footer>European Federation for Immunogenetics · Bioinformatics &amp; IT Committee</footer>
</body></html>\n`;
fs.writeFileSync(path.join(root, 'alignment-results.html'), head + guide);
console.log(`Archived ${records.length} SMS2 pairs with verified sequence recovery.`);
