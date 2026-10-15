import { pretty } from '../api';

const statusStyles = new Set(['normal', 'watch', 'warning', 'high', 'critical', 'unknown', 'none']);

export default function StatusBadge({ status = 'unknown', label }) {
  const clean = String(status || 'unknown').toLowerCase();
  const variant = statusStyles.has(clean) ? clean : 'unknown';
  return <span className={`status-badge status-${variant}`}><span className="status-dot" aria-hidden="true" />{label || pretty(clean)}</span>;
}
