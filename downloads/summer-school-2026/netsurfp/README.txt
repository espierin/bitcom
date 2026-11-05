EFI BITCom saved NetSurfP results
NetSurfP-3.0 calculated 5 November 2026. Job: 6AEC44F200009710C695E525

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
