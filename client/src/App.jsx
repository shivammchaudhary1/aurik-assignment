import { useEffect, useState } from 'react';
import { formatDate, getJson, pretty } from './api';
import { LINES, MACHINES, PLANTS } from './data/assets';
import StatusBadge from './components/StatusBadge';
import IngestionPanel from './components/IngestionPanel';
import './App.css';

const statusOrder = ['critical', 'high', 'warning', 'watch', 'normal', 'unknown'];

function Stat({ label, value, detail, tone }) {
  return <div className={`stat panel ${tone ? `stat-${tone}` : ''}`}><span className="stat-label">{label}</span><strong>{value ?? '—'}</strong><span className="stat-detail">{detail}</span></div>;
}

function MachineDetail({ machine, state }) {
  return <section className="panel machine-detail" aria-labelledby="machine-detail-title">
    <div className="detail-heading"><div><p className="eyebrow">Machine details</p><h3 id="machine-detail-title">{machine.id} <span className="detail-type">/ {machine.type}</span></h3></div>{state && <StatusBadge status={state.derived_status} />}</div>
    {!state ? <div className="empty-state"><strong>Machine state unavailable</strong><p>Start the backend and seed the assessment data to load this machine.</p></div> : <>
      <dl className="facts detail-facts"><div><dt>Line</dt><dd>{state.line_id}</dd></div><div><dt>Needs attention</dt><dd>{state.needs_attention ? 'Yes' : 'No'}</dd></div><div><dt>Attention level</dt><dd className="capitalize">{state.attention_level}</dd></div><div><dt>Processing</dt><dd>{pretty(state.processing_status)}</dd></div><div><dt>Last event</dt><dd>{formatDate(state.latest_relevant_event_time)}</dd></div><div><dt>Last processed</dt><dd>{formatDate(state.last_processed_at)}</dd></div></dl>
      {state.freshness?.is_stale && <div className="alert warning">Stale signal data. The assessment samples are dated April 2026; the backend still preserves their attention status.</div>}
      <div className="detail-section"><h4>Contributing reasons</h4>{state.reason_codes?.length ? <div className="chip-list">{state.reason_codes.map(code => <span className="chip" key={code}>{pretty(code)}</span>)}</div> : <p className="muted small">No active reason codes.</p>}</div>
      <div className="detail-section"><h4>Latest signals</h4>{state.latest_signals?.length ? <ul className="signal-list">{state.latest_signals.map((signal, index) => <li key={`${signal.sourceId}-${index}`}><span className="signal-header"><strong>{pretty(signal.eventType || signal.category)}</strong><span className="muted small">{formatDate(signal.eventTime)}</span></span><span className="muted small">{signal.vendor} · {signal.sourceId} · Level {signal.level}</span></li>)}</ul> : <p className="muted small">No processed signals for this machine.</p>}</div>
      {state.source_event_refs?.length > 0 && <div className="detail-section"><h4>Source record references</h4><p className="muted small">{state.source_event_refs.map(ref => `${ref.vendor}: ${ref.sourceId}`).join(' · ')}</p></div>}
    </>}
  </section>;
}

function Overview({ plantId, refreshToken, onRefresh }) {
  const [lineId, setLineId] = useState('all');
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [plantSummary, setPlantSummary] = useState(null);
  const [lineSummary, setLineSummary] = useState(null);
  const [states, setStates] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lineError, setLineError] = useState('');
  const [online, setOnline] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  const plantMachines = MACHINES.filter(machine => machine.plantId === plantId);
  const plantLines = LINES.filter(line => line.plantId === plantId);
  const visibleMachines = plantMachines.filter(machine => lineId === 'all' || machine.lineId === lineId);
  const selectedMachine = visibleMachines.find(machine => machine.id === selectedMachineId) || visibleMachines[0];
  const scopedSummary = lineId === 'all' ? plantSummary : lineSummary;

  useEffect(() => { setLineId('all'); setSelectedMachineId(''); }, [plantId]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      setPlantSummary(null);
      setStates({});
      const signal = controller.signal;
      const [health, summary, results] = await Promise.allSettled([
        getJson('/health', { signal }),
        getJson(`/api/plants/${plantId}/summary`, { signal }),
        Promise.all(plantMachines.map(async (machine) => {
          try { return [machine.id, await getJson(`/api/machines/${machine.id}/status`, { signal })]; }
          catch (err) { if (signal.aborted) throw err; return [machine.id, null]; }
        })),
      ]);
      if (signal.aborted) return;
      setOnline(health.status === 'fulfilled');
      if (summary.status === 'fulfilled') setPlantSummary(summary.value);
      else setError(summary.reason?.message || 'Failed to retrieve plant summary');
      if (results.status === 'fulfilled') setStates(Object.fromEntries(results.value));
      setUpdatedAt(new Date());
      setLoading(false);
    }
    load();
    return () => controller.abort();
  // plantMachines are fixed assessment references, keyed by plantId.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantId, refreshToken]);

  useEffect(() => {
    if (lineId === 'all') { setLineSummary(null); setLineError(''); return undefined; }
    const controller = new AbortController();
    setLineSummary(null);
    setLineError('');
    getJson(`/api/plants/${plantId}/lines/${lineId}/summary`, { signal: controller.signal })
      .then(setLineSummary)
      .catch(err => { if (err.name !== 'AbortError') setLineError(err.message); });
    return () => controller.abort();
  }, [plantId, lineId, refreshToken]);

  return <section className="stack gap-lg">
    <div className="section-heading"><div><h2>Operations overview</h2><p className="muted">Machine-level attention derived from all vendor signals.</p></div><div className="overview-tools"><span className={`connection ${online ? 'online' : 'offline'}`}><span className="connection-dot" />{online ? 'Backend connected' : 'Backend offline'}</span><button className="button secondary" onClick={onRefresh} disabled={loading}>{loading ? 'Loading…' : 'Refresh data'}</button></div></div>
    {error && <div className="alert error" role="alert">{error} <span className="small">Check that MongoDB and the Node server are running. Run the backend seed/demo scripts to populate machines.</span></div>}
    <div className="filters"><label>Production line <select value={lineId} onChange={event => { setLineId(event.target.value); setSelectedMachineId(''); }}><option value="all">All lines</option>{plantLines.map(line => <option value={line.id} key={line.id}>{line.id} · {line.name}</option>)}</select></label><span className="small muted">{updatedAt ? `Last checked: ${formatDate(updatedAt)}` : 'Waiting for data'}</span></div>
    {lineError && <div className="alert error" role="alert">Line summary: {lineError}</div>}
    <div className="stats-grid"><Stat label="Machines" value={scopedSummary?.total_machines} detail="In selected scope" /><Stat label="Need attention" value={scopedSummary?.needing_attention} detail="Action may be required" tone="amber" /><Stat label="Critical machines" value={scopedSummary?.critical_machines?.length} detail="Highest attention" tone="red" /><Stat label="Not processed" value={scopedSummary?.machines_not_processed?.length} detail="No derived state yet" /></div>
    <div className="overview-grid">
      <section className="panel status-panel"><div className="panel-heading"><h3>Status distribution</h3><span className="muted small">{lineId === 'all' ? 'Entire plant' : lineId}</span></div><div className="status-bars">{statusOrder.map(status => { const count = scopedSummary?.by_status?.[status] || 0; const total = scopedSummary?.total_machines || 0; return <div className="status-bar-row" key={status}><span className="capitalize">{status}</span><div className="bar-track"><div className={`bar-fill bar-${status}`} style={{ width: total ? `${count / total * 100}%` : '0%' }} /></div><strong>{scopedSummary ? count : '—'}</strong></div>; })}</div></section>
      <section className="panel lines-panel"><div className="panel-heading"><h3>Line attention</h3><span className="muted small">Ranked by need</span></div>{plantSummary?.lines?.length ? <div className="line-list">{plantSummary.lines.map(line => <button key={line.line_id} className={`line-row ${lineId === line.line_id ? 'active' : ''}`} onClick={() => { setLineId(line.line_id); setSelectedMachineId(''); }}><span><strong>{line.line_id}</strong><small>{LINES.find(l => l.id === line.line_id)?.name}</small></span><span className="line-number"><b>{line.needing_attention}</b><small>of {line.total_machines} need attention</small></span></button>)}</div> : <p className="muted small">No line summary available yet.</p>}</section>
    </div>
    <section className="panel table-panel"><div className="panel-heading"><div><h3>Machines</h3><p className="muted small">Select a machine to inspect reasons and source events.</p></div><span className="count-label">{visibleMachines.length} assets</span></div><div className="table-scroll"><table><thead><tr><th>Machine</th><th>Line</th><th>Operational status</th><th>Attention</th><th>Freshness</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{visibleMachines.map(machine => { const state = states[machine.id]; return <tr key={machine.id} className={selectedMachine?.id === machine.id ? 'selected-row' : ''}><td><strong>{machine.id}</strong><span className="cell-subtext">{machine.type}</span></td><td>{machine.lineId}</td><td>{state ? <StatusBadge status={state.derived_status} /> : <span className="muted small">{loading ? 'Loading…' : 'Unavailable'}</span>}</td><td>{state ? (state.needs_attention ? 'Yes' : 'No') : '—'}</td><td>{state ? (state.freshness?.is_stale ? <span className="stale">Stale</span> : 'Fresh') : '—'}</td><td><button className="text-button" onClick={() => setSelectedMachineId(machine.id)}>Details</button></td></tr>; })}</tbody></table></div></section>
    {selectedMachine && <MachineDetail machine={selectedMachine} state={states[selectedMachine.id]} />}
    <p className="footer-note">Reference machine/line labels come from the supplied assessment CSVs. Live statuses, reasons, and summaries come from the backend APIs.</p>
  </section>;
}

export default function App() {
  const [tab, setTab] = useState('overview');
  const [plantId, setPlantId] = useState('PLANT_01');
  const [refreshToken, setRefreshToken] = useState(0);
  const refresh = () => setRefreshToken(token => token + 1);

  return <div className="app-layout">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">A</div><div><strong>AURIK</strong><small>EQUIPMENT MONITOR</small></div></div><div className="sidebar-section-label">WORKSPACE</div><nav aria-label="Primary"><button className={`nav-item ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}><span className="nav-icon" aria-hidden="true">▦</span>Overview</button><button className={`nav-item ${tab === 'ingestion' ? 'active' : ''}`} onClick={() => setTab('ingestion')}><span className="nav-icon" aria-hidden="true">⇧</span>Data ingestion</button></nav><div className="sidebar-bottom"><span className="sidebar-small">Assessment prototype</span><span className="sidebar-small">Node · Express · MongoDB · React</span></div></aside>
    <main className="main-area"><header className="topbar"><div><p className="eyebrow">Industrial monitoring</p><h1>{tab === 'overview' ? 'Equipment dashboard' : 'Vendor data ingestion'}</h1></div><div className="topbar-controls"><label htmlFor="plant-picker">Plant</label><select id="plant-picker" value={plantId} onChange={event => setPlantId(event.target.value)}>{PLANTS.map(plant => <option key={plant.id} value={plant.id}>{plant.label} · {plant.id}</option>)}</select></div></header><div className="content">{tab === 'overview' ? <Overview plantId={plantId} refreshToken={refreshToken} onRefresh={refresh} /> : <IngestionPanel onProcessed={() => { refresh(); setTab('overview'); }} />}</div></main>
  </div>;
}
