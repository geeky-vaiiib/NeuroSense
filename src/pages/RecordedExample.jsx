import { useState } from 'react';
import { researchApi } from '../services/api';
import UnifiedReport from '../components/results/UnifiedReport';
import { generatePDF } from '../utils/generatePDF';
export default function RecordedExample() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true); setError('');
    try { setReport(await researchApi.recordedExample()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  return <main style={{ display: 'grid', gap: 16 }}>
    <section className="panel">{report ? <p className="ns-eyebrow">Recorded research example</p> : <h1>Recorded research example</h1>}
      <p>Explicit offline fallback: genuine saved model outputs from separate permitted datasets, with synthetic questionnaire answers. These are different people and tasks, not a multimodal participant or a live recording. Never used to fill a missing case result.</p>
      <button className="btn btn-primary" disabled={loading} onClick={load}>{loading ? 'Loading saved example…' : 'Load recorded example'}</button>
      {error && <p role="alert">{error}</p>}
    </section>
    {report && <><button className="btn btn-secondary" onClick={() => generatePDF({ report }).catch(e => setError(e.message))}>Download example report</button><button className="btn btn-secondary" onClick={() => generatePDF({report},null,{mode:'technical'}).catch(e => setError(e.message))}>Detailed example technical report</button><UnifiedReport report={report}/></>}
  </main>;
}
