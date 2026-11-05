"""Validate archived NetSurfP outputs and generate the saved-results data.
Run after changing archived data or case answers.
Never calls a prediction service.
"""
from pathlib import Path
import csv, hashlib, json, re
from bs4 import BeautifulSoup

root = Path(__file__).resolve().parents[1]
base = root / 'downloads/summer-school-2026/netsurfp'
sha = lambda data: hashlib.sha256(data).hexdigest()
items = json.loads((base / 'preparation.json').read_text())
raw = json.loads((base / 'raw-batch.json').read_text())
assert len(raw) == len(items) == 8
by_id = {item['id'].split('_', 1)[1]: item for item in raw}
answers = BeautifulSoup((root / 'downloads.html').read_text(encoding='utf-8'), 'html.parser').select('.case details')
case_answers = {
    str(i + 1).zfill(2): '\n\n'.join(block.get_text(' ', strip=True)
                                   for block in answer.select('h4, p')
                                   if not block.select_one('a'))
    for i, answer in enumerate(answers)
}
assert len(case_answers) == 6
for item in items:
    result = by_id[item['id']]
    assert result['seq'] == item['sequence'], item['id']
    assert len(result['seq']) == item['length']
    assert sha(item['sequence'].encode()) == item['sequence_sha256']
    for key in ['rsa', 'asa', 'q3', 'q8', 'q3_prob', 'q8_prob', 'phi', 'psi', 'disorder']:
        assert len(result[key]) == item['length'], (item['id'], key)
    assert all(0 <= v <= 1 for v in result['rsa'])
    item['result_file'] = item['id'] + '.json'
    item['csv_file'] = item['id'] + '.csv'
    output = json.dumps(result, indent=2).encode()
    (base / item['result_file']).write_bytes(output)
    item['result_sha256'] = sha(output)
    item['input_file_sha256'] = sha((base / item['input_file']).read_bytes())
    item['source_sha256'] = {}
    for source in item['source_file'].split('; '):
        path = root / source if source.startswith('assets/') else base.parent / source
        item['source_sha256'][source] = sha(path.read_bytes().replace(b'\r\n', b'\n'))
    item['source_hash_note'] = 'Source FASTA checksums use LF newlines, matching repository files.'
    with (base / item['csv_file']).open('w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        fields = ['rsa', 'asa', 'q3', 'q8', 'phi', 'psi', 'disorder', 'q3_prob', 'q8_prob']
        writer.writerow(['input_id', 'position', 'amino_acid'] + fields)
        for i, aa in enumerate(result['seq']):
            writer.writerow([item['id'], i+1, aa] + [json.dumps(result[k][i]) if isinstance(result[k][i], list) else result[k][i] for k in fields])
    case = re.match(r'case(\d\d)', item['id'])
    item['answer'] = case_answers[case[1]] if case else 'This is a reference or demonstration input. Interpret the residue selected by you; the prediction alone does not establish immune recognition.'
    if item['id'] in ['case02cds', 'case04', 'case05protein', 'case05cds']:
        item['notice'] = 'Read Exact input and provenance before use. This prepared input does not establish expression or the biological protein product.'

unresolved = [
    {'id': 'case02genomic', 'label': 'Case 02 · genomic input', 'notice': 'No unique translated protein is established for this genomic input. Do not use the independent Case 02 CDS prediction for it. Resolve the transcript with the facilitator; record the uncertainty. You may inspect the reference as a separate exercise, not as a prediction of this variant.', 'answer': case_answers['02']},
    {'id': 'case03', 'label': 'Case 03 · genomic input', 'notice': 'No unique translated protein is established from this genomic input. A conventional annotation does not resolve an altered splice outcome. No variant prediction is fabricated here. Discuss the transcript and record the uncertainty; the reference can be inspected separately for learning.', 'answer': case_answers['03']}
]
ordered = [items[0], items[1], items[2], unresolved[0], unresolved[1], *items[3:]]
manifest = {'tool': 'NetSurfP', 'version': '3.0', 'method': 'ESM1b', 'run_date': '2026-11-05',
            'job_id': '6AEC44F200009710C695E525',
            'source_url': 'https://services.healthtech.dtu.dk/services/NetSurfP-3.0/tmp/6AEC44F200009710C695E525/6AEC44F200009710C695E525.json',
            'raw_sha256': {ext: sha((base / ('raw-batch.' + ext)).read_bytes()) for ext in ['json', 'csv', 'zip']},
            'numbering': '1-based in exact submitted protein; no implicit mature-protein offset',
            'inputs': ordered}
(base / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8', newline='\n')
readme = f"""EFI BITCom saved NetSurfP results
NetSurfP-3.0 calculated 5 November 2026. Job: {manifest['job_id']}

Open the viewer at https://espierin.github.io/bitcom/netsurfp-viewer.html#saved-results
and select the case and input type you analysed. Use the exact case FASTA,
or verify your own protein against it. Enter the ungapped position from your
variant list, counting from 1 in the verified input.

Files in this directory:
  inputs.fasta               Exact protein inputs for the full batch
  <case>.fasta               Exact input for one prediction
  <case>.csv / <case>.json    Per-residue table / full result for one prediction
  raw-batch.csv / .json      Original NetSurfP exports for the full batch
  manifest.json              Case labels, file names and provenance

Use manifest.json to identify the file for your input. In a case CSV, find
the position, check amino_acid, and read rsa. If your spreadsheet displays
one column, import with a comma delimiter. The two unresolved genomic
splice inputs have no established protein and no variant prediction.
"""
(base / 'README.txt').write_text(readme, encoding='utf-8', newline='\n')
print('Verified 8 exact predictions and 2271 residues.')
