import { useEffect, useState } from 'react';
import { formatDate, getJson, pretty, submitVendorData } from '../api';

const VENDORS = [
  { id: 'pulseforge', label: 'PulseForge', records: 'events' },
  { id: 'thermexwatch', label: 'ThermexWatch', records: 'readings' },
  { id: 'maintaflow', label: 'MaintaFlow', records: 'records' },
];
const FINISHED = new Set(['completed', 'partial', 'failed']);

export default function IngestionPanel({ onProcessed }) {
  const [vendor, setVendor] = useState('pulseforge');
  const [jsonText, setJsonText] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [job, setJob] = useState(null);
  const [exampleBusy, setExampleBusy] = useState(false);

  const refreshJob = async (jobId) => {
    try {
      const data = await getJson(`/api/jobs/${jobId}`);
      setJob((current) => current?.job_id === jobId ? data : current);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (!job?.job_id || FINISHED.has(job.status)) return undefined;
    const timerId = setInterval(() => refreshJob(job.job_id), 1800);
    return () => clearInterval(timerId);
  // Only restart polling when job ID/status change, not on every field update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.job_id, job?.status]);

  async function loadExample() {
    setError('');
    setExampleBusy(true);
    try {
      const response = await fetch(`/samples/${vendor}_sample.json`);
      if (!response.ok) throw new Error('Could not load bundled sample');
      const body = await response.json();
      setJsonText(JSON.stringify(body, null, 2));
      setJob(null);
    } catch (err) { setError(err.message); }
    finally { setExampleBusy(false); }
  }

  async function uploadFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    if (file.size > 1024 * 1024) {
      setError('File is too large. The backend accepts at most 1 MB.');
    } else {
      setJsonText(await file.text());
      setJob(null);
    }
    event.target.value = '';
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    let parsed;
    try { parsed = JSON.parse(jsonText); }
    catch { setError('Please provide valid JSON before submitting.'); return; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setError('Vendor payload must be a JSON object.'); return;
    }
    setBusy(true);
    setJob(null);
    try {
      const queued = await submitVendorData(vendor, parsed, apiKey);
      setJob(queued);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <section className="stack gap-lg" aria-labelledby="ingest-title">
      <div className="section-heading">
        <div><h2 id="ingest-title">Ingest vendor data</h2><p className="muted">Submit native vendor JSON and track background processing.</p></div>
      </div>
      <div className="ingest-layout">
        <form className="panel ingest-form stack" onSubmit={submit}>
          <label className="field"><span>Data source</span><select value={vendor} onChange={event => { setVendor(event.target.value); setJob(null); setJsonText(''); setError(''); }}>
            {VENDORS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select></label>
          <div className="sample-tools"><span className="field-label">JSON payload</span><button type="button" className="text-button" onClick={loadExample} disabled={exampleBusy}>{exampleBusy ? 'Loading…' : 'Use assessment sample'}</button></div>
          <textarea aria-label="Vendor JSON payload" spellCheck="false" className="json-input" value={jsonText} onChange={event => setJsonText(event.target.value)} placeholder={`Paste the vendor JSON containing the ${VENDORS.find(v => v.id === vendor)?.records} array…`} rows={14} />
          <label className="file-label">Or choose a local JSON file <input type="file" accept=".json,application/json" onChange={uploadFile} /></label>
          <label className="field"><span>API key <small>(only if configured on backend)</small></span><input type="password" autoComplete="off" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="Optional x-api-key" /></label>
          {error && <div className="alert error" role="alert">{error}</div>}
          <button type="submit" className="button primary" disabled={busy || !jsonText.trim()}>{busy ? 'Sending…' : 'Submit to processing queue'}</button>
        </form>

        <section className="panel job-panel stack" aria-label="Processing job status">
          <div><h3>Processing status</h3><p className="muted">After acceptance, the server processes records asynchronously.</p></div>
          {!job ? (
            <div className="empty-state"><strong>No job submitted yet</strong><p>Load a sample or paste JSON, then submit a batch to see its job ID and results.</p></div>
          ) : (
            <>
              <div className="job-header"><span className={`job-status job-${job.status}`}>{pretty(job.status)}</span><button type="button" className="button secondary button-sm" onClick={() => refreshJob(job.job_id)}>Check status</button></div>
              <dl className="facts"><div><dt>Job ID</dt><dd className="mono job-id">{job.job_id}</dd></div><div><dt>Vendor</dt><dd>{job.vendor}</dd></div><div><dt>Received</dt><dd>{formatDate(job.created_at)}</dd></div><div><dt>Completed</dt><dd>{formatDate(job.completed_at)}</dd></div></dl>
              <div className="job-counts"><div><strong>{job.total ?? job.accepted_records ?? '—'}</strong><span>Received</span></div><div><strong>{job.inserted ?? '—'}</strong><span>Inserted</span></div><div><strong>{job.duplicates ?? '—'}</strong><span>Duplicates</span></div><div><strong>{job.rejected ?? '—'}</strong><span>Rejected</span></div></div>
              {job.last_error && <p className="alert error">{job.last_error}</p>}
              {job.issues?.length > 0 && <div><h4>Record issues</h4><ul className="issue-list">{job.issues.slice(0, 8).map((issue, index) => <li key={`${issue.index}-${index}`}>Record {issue.index ?? '?'}: {issue.message}</li>)}</ul></div>}
              {FINISHED.has(job.status) && <button className="button secondary" type="button" onClick={onProcessed}>Open refreshed dashboard</button>}
              {!FINISHED.has(job.status) && <p className="muted small">This panel checks status automatically every few seconds.</p>}
            </>
          )}
        </section>
      </div>
    </section>
  );
}
