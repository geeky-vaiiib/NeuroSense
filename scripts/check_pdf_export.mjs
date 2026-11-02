// Generates explicitly synthetic fixtures for visual QA; never uses saved participant records.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generatePDF } from '../src/utils/generatePDF.js';
const root=resolve(process.argv[2] || '/tmp/neurosense-pdf-check');
mkdirSync(root,{recursive:true});
for (const category of ['child','adult','toddler']) {
  const threshold=category==='toddler'?3:6;
  const basis={instrument:category==='toddler'?'Q-CHAT-10':`AQ-10 (${category})`,total_score:threshold,max_score:10,threshold,
    scoring_version:3,meets_threshold:true,interpretation:'At or above threshold. Screening only; not a diagnosis.',
    source:'Autism Research Centre form, accessed 2026-11-02',
    items:Array.from({length:10},(_,i)=>({id:`${category==='toddler'?'Q':'A'}${i+1}`,answer:category==='toddler'?'C':'Definitely agree',points:i<threshold?1:0}))};
  const c={id:`SYNTHETIC-QA-${category}`,category,categoryLabel:category,subjectName:'Synthetic export fixture - no participant data',
    age:category==='adult'?30:8,age_months:20,gender:'Prefer not to say',screeningDate:'2026-11-02',questionnaire_basis:basis,
    questionnaire_model:null,gaze_status:'skipped',modality_states:[{id:'gaze',status:'skipped'},{id:'speech',status:'model_unavailable'},{id:'facial',status:'model_unavailable'}]};
  const doc=await generatePDF(c,null,{save:false});
  writeFileSync(resolve(root,`${category}.pdf`),Buffer.from(doc.output('arraybuffer')));
}
