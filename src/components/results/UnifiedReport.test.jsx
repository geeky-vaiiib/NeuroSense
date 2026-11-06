import { render, screen } from '@testing-library/react';
import { it, expect } from 'vitest';
import UnifiedReport from './UnifiedReport';
it('renders backend text and null states without deriving scores or probabilities',()=>{
 const report={case_id:'contract',report_version:'research-report-v1',generated_at:'2026-11-05',provenance:'Recorded research example',screening_conclusion:'Below threshold',summary:['Questionnaire only'],formatting:'Server formatting',modalities:[{id:'speech',label:'Speech emotion',status:'failed_quality',status_label:'Failed quality',output:null,inclusion_reason:'Excluded',limitations:['Not calibrated'],values:[{name:'Score',value:.999,text:'Backend text only'},{name:'Model',text:'speech-v1'}]}]};
 render(<UnifiedReport report={report}/>);
 expect(screen.getByText('Score: Backend text only')).toBeInTheDocument();expect(screen.getByText('Model output: Unavailable')).toBeInTheDocument();expect(screen.queryByText(/99.9%/)).not.toBeInTheDocument();
});
