"""Validate archived NetSurfP outputs and package a self-contained offline viewer.
Run from repository root after editing viewer HTML/JS or archived data.
Never calls a prediction service.
"""
from pathlib import Path
import csv, hashlib, json, re, zipfile
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
payload = {}
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
    item['source_hash_note'] = 'Source FASTA checksums use LF newlines, matching repository files and bundled source copies.'
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
    payload[item['result_file']] = result

unresolved = [
    {'id': 'case02genomic', 'label': 'Case 02 — genomic input', 'notice': 'No unique translated protein is established for this genomic input. Do not use the independent Case 02 CDS prediction for it. Resolve the transcript with the facilitator; record the uncertainty. You may inspect the reference as a separate exercise, not as a prediction of this variant.', 'answer': case_answers['02']},
    {'id': 'case03', 'label': 'Case 03 — genomic input', 'notice': 'No unique translated protein is established from this genomic input. A conventional annotation does not resolve an altered splice outcome. No variant prediction is fabricated here. Discuss the transcript and record the uncertainty; the reference can be inspected separately for learning.', 'answer': case_answers['03']}
]
ordered = [items[0], items[1], items[2], unresolved[0], unresolved[1], *items[3:]]
manifest = {'tool': 'NetSurfP', 'version': '3.0', 'method': 'ESM1b', 'run_date': '2026-11-05',
            'job_id': '6AEC44F200009710C695E525',
            'source_url': 'https://services.healthtech.dtu.dk/services/NetSurfP-3.0/tmp/6AEC44F200009710C695E525/6AEC44F200009710C695E525.json',
            'raw_sha256': {ext: sha((base / ('raw-batch.' + ext)).read_bytes()) for ext in ['json', 'csv', 'zip']},
            'numbering': '1-based in exact submitted protein; no implicit mature-protein offset',
            'inputs': ordered}
(base / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8', newline='\n')
payload['manifest.json'] = manifest
(base / 'README.txt').write_text('EFI BITCom NetSurfP-3.0 workshop archive\nCalculated 5 November 2026. Job: '+manifest['job_id']+'\n\nExtract the entire ZIP, then open index.html. It runs without internet or a local server.\nThe data and plots are read locally; external tool/workshop links require internet.\nFull original exports: raw-batch.json / .csv / .zip. Per-input JSON retains all output fields.\nExact prepared FASTA inputs, hashes, preparation and source records are in manifest.json.\nPositions are 1-based in each input. Match sequences exactly before interpretation.\nNo predicted variant is invented for unresolved genomic splice cases.\nThis archive has no automatic expiry; keep a local backup.\n', encoding='utf-8')

html = (root / 'netsurfp-viewer.html').read_text(encoding='utf-8')
html = re.sub(r'<script\b[^>]*>.*?</script>', '', html, flags=re.S)
html = html.replace('</head>', '<script src="offline-data.js" defer></script><script src="assets/summer-school-2026/netsurfp-core.js" defer></script><script src="assets/summer-school-2026/netsurfp-timer.js" defer></script><script src="assets/summer-school-2026/netsurfp-viewer.js" defer></script></head>')
# Preserve internal section links and archive downloads; other workshop pages are online links.
html = re.sub(r'href="((?!downloads/|assets/)[a-z0-9-]+\.html[^\"]*)"', lambda m: 'href="https://espierin.github.io/bitcom/'+m[1]+'"', html)
html = html.replace('href="downloads/summer-school-2026/netsurfp/offline-results.zip"', 'href="downloads/summer-school-2026/netsurfp/README.txt"').replace('Download offline viewer and full results (ZIP)', 'Read offline archive instructions')
with zipfile.ZipFile(base / 'offline-results.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('index.html', html)
    z.writestr('offline-data.js', 'window.NetSurfPOffline='+json.dumps(payload).replace('<', '\\u003c')+';')
    z.writestr('README.txt', (base / 'README.txt').read_text())
    for p in base.iterdir():
        if p.is_file() and p.name != 'offline-results.zip': z.write(p, p.relative_to(root))
    for name in ['workshop.css', 'efi-links.css', 'efi-logo-white.svg', 'hla-banner.png', 'netsurfp-core.js', 'netsurfp-timer.js', 'netsurfp-viewer.js']:
        p = root / 'assets/summer-school-2026' / name; z.write(p, p.relative_to(root))
    # Retain source inputs, not only transformed model inputs.
    for item in items:
        for source in item['source_file'].split('; '):
            path = root/source if source.startswith('assets/') else base.parent/source
            if str(path.relative_to(root)).replace('\\','/') not in z.namelist(): z.writestr(str(path.relative_to(root)).replace('\\','/'), path.read_bytes().replace(b'\r\n', b'\n'))
print('Verified 8 exact predictions, 2271 residues; archived unresolved-input explanations and offline viewer.')
