import type { ReconciliationStatus } from '../../domain/reconciliation/reconciliation.js';
import styles from './StatusText.module.css';

const labels: Record<ReconciliationStatus, string> = {
  matched: 'Matched',
  unmatched: 'Unmatched',
  'missing-from-broker': 'Missing from Broker',
  'missing-from-ot-murex': 'Missing from OT/MUREX'
};

const markers: Record<ReconciliationStatus, string> = {
  matched: '✓', unmatched: '!', 'missing-from-broker': '◀', 'missing-from-ot-murex': '▶'
};

export function StatusText({ children, assertive = false }: { children: React.ReactNode; assertive?: boolean }) {
  return <p role={assertive ? 'alert' : 'status'} aria-live={assertive ? 'assertive' : 'polite'}>{children}</p>;
}

export function ReconciliationStatusText({ status }: { status: ReconciliationStatus }) {
  return <span className={`${styles.status} ${styles[status]}`}><span aria-hidden="true" className={styles.marker}>{markers[status]}</span>{labels[status]}</span>;
}
