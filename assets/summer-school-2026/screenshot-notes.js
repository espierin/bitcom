// Coordinates are percentages of the complete, unmodified demonstration images.
window.BITCOM_SCREEN_NOTES = {
  'sfat-input.jpg': [
    ['sfat-paste', 52, 49, 'Paste Sequence', 'Paste only the DNA letters from one record. The FASTA header names the entry; it is not part of the DNA. Keep the original FASTA for traceability.'],
    ['sfat-locus', 42, 71, 'Select Locus', 'Choose the gene that produced your input. B is for this example; an HLA-A workshop input needs A. The locus helps SFAT match the expected gene features.'],
    ['sfat-level', 42, 81, 'Select Level', 'Choose Genomic when the file includes introns and CDS when it is coding-only. A wrong level can give misleading feature boundaries. Scroll down to Annotate Sequence Now.']
  ],
  'sfat-features.jpg': [
    ['sfat-run', 15, 13, 'Annotate Sequence Now', 'Submit after checking the sequence, locus and level. If you change any of these, run again before reading the feature table.'],
    ['sfat-map', 30, 30, 'Feature Map', 'Follow the exons and intervening introns along the genomic sequence. The map shows the order; use the table for exact base positions.'],
    ['sfat-boundary', 48, 72, 'Start and Length', 'The last base of a feature is Start + Length − 1. Record which view produced these numbers: genomic coordinates count introns; CDS coordinates do not.']
  ],
  'sfat-cds.jpg': [
    ['sfat-cds', 16, 49, 'CDS tab', 'Switch from Genomic to CDS, then scroll to the Sequence block below the table. Copy its DNA letters into your CDS file. Coding exons are joined in this view; introns are excluded.'],
    ['sfat-cds-start', 48, 71, 'CDS coordinates', 'Exon 2 starts at 74 in this example. Do not use that value as the genomic start or assume it applies to your case.']
  ],
  'sfat-protein.jpg': [
    ['sfat-protein', 24, 49, 'Protein tab', 'Select Protein and scroll below Features. Protein positions count amino acids, not bases. The signal peptide is included in this full input.'],
    ['sfat-aa-copy', 46, 91, 'Protein sequence', 'Select the letters in Sequence and copy them into your protein text file. Count the actual residues and exclude stop marks from an alignment FASTA.']
  ],
  'translate-input.jpg': [
    ['translate-paste', 22, 45, 'DNA or RNA sequence', 'Paste your CDS letters into the large box on the left. Genomic DNA contains introns and is not a substitute for CDS when interpreting the translation.'],
    ['translate-settings', 57, 43, 'Format and strand', 'Select Compact and forward when the CDS is already in coding orientation. Keep the standard genetic code. This setting changes display, not the choice of reading frame.'],
    ['translate-run', 20, 66, 'Translate!', 'Submit the CDS and compare frames against the expected coding frame and reference. The longest-looking translation is not enough to establish the right frame.']
  ],
  'translate-result.jpg': [
    ['translate-frame', 13, 65, 'Reading frame heading', 'Read the frame header before copying any output. This example matches forward Frame 1; use your input orientation and annotation to decide for your case.'],
    ['translate-copy', 48, 72, 'Protein letters and stop', 'Copy the protein letters from the supported frame. Record the location of the first stop separately; a terminal dash marks translation termination, not an extra residue.']
  ],
  'blast-input.jpg': [
    ['blast-paste', 15, 34, 'Enter Query Sequence', 'Paste one nucleotide query here. BLAST accepts FASTA. If you compare CDS and genomic queries, run them separately and label the input type in your notes.'],
    ['blast-db', 25, 48, 'Database', 'Check and record the selected database before running. The pictured choice is not necessarily today’s default. Top hits depend on the search space as well as the query.'],
    ['blast-run', 5, 78, 'BLAST', 'Submit once. In the results, inspect Descriptions and Alignments; consider coverage and mismatches as well as percent identity before choosing a comparator.']
  ],
  'sms-input.jpg': [
    ['sms-first', 35, 27, 'Paste sequence one', 'Replace all example text in the first box with the complete reference FASTA, including its header. Check you have one entry, not the example plus your entry.'],
    ['sms-second', 40, 40, 'Paste sequence two', 'Replace all example text in the second box with the complete synthetic FASTA. Each box should have one header and its protein letters.'],
    ['sms-run', 31, 53, 'Settings and Submit', 'Verify BLOSUM62, gap opening 12 and extension 2, then click Submit above the settings. The result opens separately; verify both input lengths before reading differences.']
  ],
  'sms-result.jpg': [
    ['sms-check', 32, 5, 'Input names and lengths', 'Confirm the two reported input lengths match your own FASTAs. A mismatch may indicate a truncated copy or that the tool removed characters.'],
    ['sms-copy', 33, 25, 'Two aligned FASTA records', 'Copy from the first > through the last residue of the second record, keeping alignment gaps. Omit the introductory text and score. A gap column is not a residue number.']
  ],
  'align-input.jpg': [
    ['uniprot-paste', 46, 24, 'Both FASTAs in one box', 'This optional tool takes the two complete records together in one box, unlike SMS2. Check for two distinct headers and the message that two sequences were detected.'],
    ['uniprot-run', 85, 82, 'Run Align', 'Submit once. Keep the results tab while the job runs. If it queues, switch to SMS2 or use the matching saved comparison as instructed.']
  ],
  'align-queue.jpg': [
    ['uniprot-status', 61, 36, 'Queued status', 'Queued is not a result. Keep the job reference if needed, but do not resubmit. Follow the fallback in task 2.7 if waiting would hold up your analysis.']
  ],
  'netsurfp-input.jpg': [
    ['net-paste', 28, 49, 'Sequence submission', 'Paste one verified, unaligned protein FASTA. Remove gap and stop symbols. If an input includes the leader peptide, the prediction positions count it too.'],
    ['net-run', 9, 66, 'Submit', 'Submit only if the facilitator asks. During the group session use the saved results for your exact sequence; do not keep retrying a slow job.']
  ],
  'netsurfp-result.jpg': [
    ['net-plot', 31, 48, 'Per-residue plot', 'Hover over the residue in the live plot and cross-check its number and amino-acid letter. The colour indicates predicted exposure; use the numeric RSA to support your call.'],
    ['net-export', 86, 40, 'Export this prediction', 'Export the residue data for your input. Record the model version, exact input, position and RSA. A prediction is evidence about accessibility, not proof of recognition.']
  ],
  'molstar-selection.jpg': [
    ['mol-chain', 28, 2, 'Entity and chain', 'Select the HLA heavy chain, not the peptide or β2-microglobulin. This screen is HLA-B; use the HLA-A model and the chain you verified in the task.'],
    ['mol-sequence', 25, 8, 'Sequence panel', 'Click the mapped letter on the selected chain. Compare its author residue number and identity with your mapping table. Insertions or missing coordinates can invalidate a simple offset.'],
    ['mol-pick', 21, 15, 'Residue picking level', 'Enable Selection Mode and set the picking level to Residue. A click should select one amino acid, rather than an atom or the whole chain.'],
    ['mol-canvas', 43, 53, '3D canvas', 'You can also select a visible residue on the model. Confirm the same chain and residue in the sequence panel; overlapping chains can make visual picking ambiguous.']
  ],
  'molstar-color.jpg': [
    ['mol-colour', 38, 15, 'Apply Theme to Selection', 'Open the paintbrush and keep Current Selection. Choose a contrasting colour; verify the selection before applying it. Hover alone does not colour the structure.'],
    ['mol-apply', 50, 53, 'Apply Theme', 'Apply the colour and check that it remains when you move the pointer away. Record the chain, positions and what the colour means for your figure.']
  ],
  'molstar-surface-menu.jpg': [
    ['mol-component', 97, 46, 'Component Actions', 'Open the three-dot menu for the component you want. For a heavy-chain-only surface, use a component containing just that chain. Polymer in the example includes other chains.'],
    ['mol-surface', 81, 73, 'Molecular Surface', 'Choose Add Representation → Molecular Surface. A surface helps you reason about exposure in this template; the view depends on which components are included.']
  ],
  'molstar-export.jpg': [
    ['mol-camera', 42, 15, 'Screenshot / State Snapshot', 'Open the camera menu once you have a useful orientation. Check that your variant markers and intended components are visible in the preview.'],
    ['mol-download', 61, 40, 'Download PNG', 'Choose a readable resolution and download. Save the image in your workshop folder, and note the filename, PDB ID, chain and colour key in the workbook.']
  ],
  'molstar-entry.jpg': [
    ['mol-entry-id', 38, 24, 'PDB ID and structure title', 'Read the PDB ID and confirm the allotype in the entry title or molecule information. This is the HLA-B demonstration.'],
    ['mol-entry-assembly', 14, 17, 'Biological Assembly 1', 'Check which assembly contains the heavy chain, β2-microglobulin and peptide before opening the viewer.'],
    ['mol-entry', 13, 69, 'Explore in 3D → Structure', 'Click Structure under the assembly image to open the Mol* viewer for this entry. The screenshot uses PDB 7S79 for practice.']
  ],
  'molstar-workspace.jpg': [
    ['mol-workspace', 24, 2, 'Sequence panel: entity and chain', 'Choose the HLA heavy-chain entity by name, then its chain. This controls the sequence row displayed at the top.'],
    ['mol-workspace-canvas', 41, 56, '3D canvas', 'Drag to rotate and scroll to zoom. In this view teal is the heavy chain, orange is β2-microglobulin and the purple peptide lies in the groove. Verify the labels in your model.'],
    ['mol-workspace-controls', 86, 30, 'Components panel', 'A component groups atoms for display. Use its eye to show or hide it. The same component may contain several chains.']
  ],
  'molstar-visibility.jpg': [
    ['mol-visibility', 94, 45, 'Eye icons for Water and Ion', 'The crossed-out eyes indicate these two components are hidden in the demonstration. Click an eye again to restore its component.'],
    ['mol-visibility-polymer', 85, 38, 'Polymer remains visible', 'Polymer groups several chains here. Hiding its row would remove their cartoon views together.']
  ],
  'molstar-residue-hover.jpg': [
    ['mol-residue-hover', 2, 5, 'Hovered G in the sequence', 'Hover the letter to see its residue identifier. The demonstration starts at mature G1.'],
    ['mol-residue-label', 70, 97, 'Chain and residue label', 'Read the label at the lower right of the canvas. Here it identifies chain A, GLY 1, of 7S79 in the first assembly instance. Record the equivalent label from your own model.']
  ],
  'molstar-canvas-hover.jpg': [
    ['mol-canvas-pick', 39, 34, 'Hover a residue on the model', 'The magenta patch is the residue under the pointer. Here the canvas label identifies chain A, TRP 133.'],
    ['mol-canvas-label', 70, 97, 'Check the canvas hover label', 'Move the pointer over the ribbon or atom and check the chain, residue number and amino acid before clicking. Use the sequence panel if the intended site is difficult to pick.']
  ],
  'molstar-residue-selection.jpg': [
    ['mol-mode', 77, 34, 'Toggle Selection Mode', 'The cursor icon enables the selection toolbar. A click in Selection Mode changes the active selection.'],
    ['mol-level', 27, 13, 'Picking Level: Residue', 'Choose Residue so a click acts on one amino acid. Use Chain temporarily only when you need the entire heavy chain.'],
    ['mol-select-two', 3, 5, 'Two individual letters selected', 'The green G and M are separate practice sites. Click each intended letter once and check the selection count.'],
    ['mol-select-count', 86, 23, 'Selection count and Clear', 'Check that the count matches your intended sites. The small clear button at the right resets the current selection.']
  ],
  'molstar-theme-controls.jpg': [
    ['mol-theme-menu', 41, 13, 'Paintbrush: Apply Theme to Selection', 'Open this menu with your mapped residues selected. Keep Current Selection and choose Color.'],
    ['mol-theme-palette', 42, 29, 'Choose a contrasting colour', 'Choose a colour you can distinguish from the model and the temporary green selection. Keep the colour key with your notes.'],
    ['mol-theme-apply', 51, 47, 'Apply Theme', 'Apply the theme, then clear the temporary selection and check that the colour remains on the representation you styled.']
  ],
  'molstar-theme-applied.jpg': [
    ['mol-theme-result', 48, 50, 'Colour after clearing the selection', 'The red patch persists on the styled cartoon even though the green sequence selection and counter have cleared.']
  ],
  'molstar-heavychain-menu.jpg': [
    ['mol-surface-chain', 27, 13, 'Picking Level: Chain', 'Click the mapped heavy-chain sequence and verify that only this chain is selected. The right-hand panel shows 1 Chain Selected.'],
    ['mol-surface-choice', 38, 23, 'Representation: Molecular Surface', 'In Add Component, choose Molecular Surface for the current heavy-chain selection. Give it a label in Options and click Create Component.'],
    ['mol-surface-count', 86, 23, '1 Chain Selected', 'Check this counter before creating the surface. Selecting the grouped Polymer component can include other chains.']
  ],
  'molstar-heavychain-surface.jpg': [
    ['mol-surface-result', 39, 41, 'Heavy-chain surface', 'The teal molecular surface follows the heavy-chain component. The peptide and β2-microglobulin remain available for context. Inspect the site from multiple angles.'],
    ['mol-surface-component', 94, 55, 'Component visibility', 'Use the eyes next to the labelled rows to toggle the heavy-chain surface or the mapped sticks independently.']
  ],
  'molstar-component-named.jpg': [
    ['mol-create-menu', 44, 13, 'Cube: Create Component of Selection with Representation', 'Open this tool with the mapped residues selected to make a separately controllable component.'],
    ['mol-stick-choice', 38, 23, 'Representation: Ball & Stick', 'Keep Current Selection, choose Ball & Stick, and open Options to enter a label for the sites.'],
    ['mol-stick-create', 49, 36, 'Create Component', 'Confirm the settings, then look for the new component row in the right-hand panel.']
  ],
  'molstar-capture-panel.jpg': [
    ['mol-export-camera', 77, 17, 'Screenshot / State Snapshot', 'Use the camera menu to export the model view. Review the preview and crop before downloading.'],
    ['mol-export-download', 72, 35, 'Download PNG', 'Click Download in the screenshot panel. Open the saved PNG and check the view, marked sites and readability.']
  ]
};
