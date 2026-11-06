import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import UnifiedReport from '../components/results/UnifiedReport';
import ExplanationPanel from '../components/results/ExplanationPanel';
import { casesApi } from '../services/api';
import { useShap } from '../hooks/useShap';
import { generatePDF } from '../utils/generatePDF';

export default function Results() {
  const { caseId } = useParams();
  const [detail,setDetail]=useState(null), [error,setError]=useState(''), [loading,setLoading]=useState(true), [retry,setRetry]=useState(0), [exporting,setExporting]=useState(false);
  const { explanations,loading:explanationLoading,errors,fetchExplanation,getSortedFeatures }=useShap();
  useEffect(()=>{
    let active=true;
    async function load(){
      setLoading(true);setError('');setDetail(null);
      try{const id=caseId || (await casesApi.list())[0]?.id;const data=id ? await casesApi.get(id) : null;if(active)setDetail(data);}
      catch(e){if(active)setError(e.message);}finally{if(active)setLoading(false);}
    }
    load();return()=>{active=false;};
  },[caseId,retry]);
  async function download(mode){setExporting(true);try{await generatePDF(detail,explanations[detail.id],{mode});}catch(e){setError(`Report download failed: ${e.message}`);}finally{setExporting(false);}}
  if(loading)return <section className="panel" role="status">Opening your saved screening summary…</section>;
  if(!detail)return <section className="panel"><h1>Your screening summary</h1><p role={error?'alert':undefined}>{error || 'No saved screening is available yet.'}</p>{error && <button className="btn btn-secondary" onClick={()=>setRetry(x=>x+1)}>Try again</button>}<Link className="btn btn-primary" to="/app/screening">Start a screening</Link></section>;
  const report=detail.display_report || detail.report;
  if(!report)return <section className="panel"><h1>Your screening summary</h1><p>The saved report could not be opened. Try refreshing or return to your saved screenings.</p><Link to="/app/cases">Saved screenings</Link></section>;
  return <main id="results-page">
    {error && <p role="alert">{error}</p>}

    <UnifiedReport report={report} actions={<div className="summary-actions"><button id="download-pdf-btn" className="btn btn-primary" disabled={exporting} onClick={()=>download('simple')}>{exporting?'Preparing report…':'Download report'}</button><button className="btn btn-secondary" disabled={exporting} onClick={()=>download('technical')}>Detailed technical report</button><Link className="btn btn-secondary" to="/app/screening">Start another screening</Link><Link className="btn btn-secondary" to="/app/cases">Saved screenings</Link></div>} technicalContent={<section><h3>Questionnaire model explanations</h3><p>SHAP and LIME describe a supplementary model’s output, not the screening decision or a cause of autism. They are generated only when requested.</p><button className="btn btn-secondary" disabled={explanationLoading[detail.id]} onClick={()=>fetchExplanation(detail.id).catch(()=>{})}>{explanationLoading[detail.id]?'Loading explanation…':'Load model explanations'}</button>{errors[detail.id] && <p role="alert">The explanation could not be loaded. Your saved result is unchanged. You can try again.</p>}{explanations[detail.id] && <ExplanationPanel features={getSortedFeatures(detail.id)} lime={explanations[detail.id].lime} modelExplanation={explanations[detail.id].modelExplanation} category={detail.category}/>}</section>}/>
  </main>;
}
