window.BITCOM_STEPS = [
  {
    "id": "step-1.1",
    "page": "step-1.html",
    "title": "1.1 Download the genomic DNA sequence (FASTA)"
  },
  {
    "id": "step-1.2",
    "page": "step-1.html",
    "title": "1.2 Convert genomic DNA to coding DNA sequences with the Sequence Feature Annotation Tool"
  },
  {
    "id": "step-1.3",
    "page": "step-1.html",
    "title": "1.3 Translate the CDS into a protein sequence"
  },
  {
    "id": "step-2.1",
    "page": "step-2.html",
    "title": "2.1 Clean the synthetic DNA sequence and save it"
  },
  {
    "id": "step-2.2",
    "page": "step-2.html",
    "title": "2.2 Convert synthetic DNA to exons/CDS (and often protein) with SFAT"
  },
  {
    "id": "step-2.3",
    "page": "step-2.html",
    "title": "2.3 Translate the CDS into protein (if not provided by SFAT)"
  },
  {
    "id": "step-2.4",
    "page": "step-2.html",
    "title": "2.4 Find the closest known allele (NIH BLAST)"
  },
  {
    "id": "step-2.5",
    "page": "step-2.html",
    "title": "2.5 Prepare the closest matched allele protein for alignment"
  },
  {
    "id": "step-2.6",
    "page": "step-2.html",
    "title": "2.6 Convert your SFAT protein output into FASTA format"
  },
  {
    "id": "step-2.7",
    "page": "step-2.html",
    "title": "2.7 Align the two proteins (SMS2 first choice)"
  },
  {
    "id": "step-3.0",
    "page": "step-3.html",
    "title": "3.0 Create your variant list (you will reuse it everywhere)"
  },
  {
    "id": "step-3.1",
    "page": "step-3.html",
    "title": "3.1 Is this variation leading to a premature end of the protein?"
  },
  {
    "id": "step-3.1.1",
    "page": "step-3.html",
    "title": "3.1.1 Stop codon introduced by the variant"
  },
  {
    "id": "step-3.1.2",
    "page": "step-3.html",
    "title": "3.1.2 Frameshift (insertion/deletion not divisible by 3)"
  },
  {
    "id": "step-3.1.3",
    "page": "step-3.html",
    "title": "3.1.3 Alternative splicing / splice site disruption (genomic sequences)"
  },
  {
    "id": "step-3.2",
    "page": "step-3.html",
    "title": "3.2 Does this change the Antigen Recognition Domain (ARD; and therefore G/P grouping logic)?"
  },
  {
    "id": "step-3.2.1",
    "page": "step-3.html",
    "title": "3.2.1 Does this lead to another G-group characterization?"
  },
  {
    "id": "step-3.2.2",
    "page": "step-3.html",
    "title": "3.2.2 Does this lead to another P-group characterization?"
  },
  {
    "id": "step-3.2.3",
    "page": "step-3.html",
    "title": "3.2.3 Does this alter the peptide repertoire (binding groove)?"
  },
  {
    "id": "step-3.3",
    "page": "step-3.html",
    "title": "3.3 Is this variation surface-accessible (antibody/NK/T cell relevance)?"
  },
  {
    "id": "step-3.3.1",
    "page": "step-3.html",
    "title": "3.3.1 Run the surface accessibility analysis (NetSurfP-2.0)"
  },
  {
    "id": "step-3.3.2",
    "page": "step-3.html",
    "title": "3.3.2 Identify exposure characteristics of the new amino acids"
  },
  {
    "id": "step-3.3.3",
    "page": "step-3.html",
    "title": "3.3.3 Could this lead to antibody recognition by Bw4/Bw6?"
  },
  {
    "id": "step-3.3.4",
    "page": "step-3.html",
    "title": "3.3.4 Could this lead to antibody recognition in general?"
  },
  {
    "id": "step-3.3.5",
    "page": "step-3.html",
    "title": "3.3.5 Could this lead to altered NK recognition?"
  },
  {
    "id": "step-3.3.6",
    "page": "step-3.html",
    "title": "3.3.6 Could this lead to altered direct T cell recognition?"
  },
  {
    "id": "step-4.1",
    "page": "step-4.html",
    "title": "4.1 Find a proper HLA-A*02:01 PDB model (RCSB)"
  },
  {
    "id": "step-4.2",
    "page": "step-4.html",
    "title": "4.2 Open the structure in Mol* and clean the view"
  },
  {
    "id": "step-4.3",
    "page": "step-4.html",
    "title": "4.3 Prepare the residue positions you need to map"
  },
  {
    "id": "step-4.4",
    "page": "step-4.html",
    "title": "4.4 Select the changed residues in Mol*"
  },
  {
    "id": "step-4.4.1",
    "page": "step-4.html",
    "title": "4.4.1 Turn on Selection Mode and set Picking Level to Residue"
  },
  {
    "id": "step-4.4.2",
    "page": "step-4.html",
    "title": "4.4.2 Select residues from the Sequence panel"
  },
  {
    "id": "step-4.4.3",
    "page": "step-4.html",
    "title": "4.4.3 Select residues by clicking in the 3D canvas"
  },
  {
    "id": "step-4.5",
    "page": "step-4.html",
    "title": "4.5 Color your selected residues so they stay visible"
  },
  {
    "id": "step-4.6",
    "page": "step-4.html",
    "title": "4.6 Show the HLA heavy chain as a surface (exposed vs buried)"
  },
  {
    "id": "step-4.7",
    "page": "step-4.html",
    "title": "4.7 Optional: make a separate component for the variant residues (clean pictures)"
  },
  {
    "id": "step-4.8",
    "page": "step-4.html",
    "title": "4.8 Export a screenshot"
  }
];
