import { useEffect, useMemo, useRef, useState } from 'react';
import { reconciliationStatuses, type ReconciliationStatus } from '../../../domain/reconciliation/reconciliation.js';
import type { ReconciliationWorkspace } from '../../../shared/contracts/reconciliation.js';
import styles from './Results.module.css';
import { SummaryStrip } from '../../components/SummaryStrip.js';

const statusLabels: Record<ReconciliationStatus, string> = {
  matched: 'Matched', unmatched: 'Unmatched', 'missing-from-broker': 'Missing from Broker', 'missing-from-ot-murex': 'Missing from OT/MUREX'
};

export function Results({ workspace, initialSelected = reconciliationStatuses }: { workspace: ReconciliationWorkspace; initialSelected?: readonly ReconciliationStatus[] }) {
  const [selected, setSelected] = useState<readonly ReconciliationStatus[]>(initialSelected);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  const visible = useMemo(() => workspace.results.filter((result) => selected.includes(result.status)), [workspace.results, selected]);
  const toggle = (status: ReconciliationStatus) => setSelected((current) => current.includes(status) ? current.filter((value) => value !== status) : [...current, status]);
  return <section aria-labelledby="results-title" className={styles.results}>
    <p className={styles.eyebrow}>Completed reconciliation</p><h1 ref={headingRef} id="results-title" tabIndex={-1}>Results</h1>
    <p>Run {workspace.runId} · As-of date {workspace.asOfDate}</p>
    <SummaryStrip summary={workspace} />
    <fieldset><legend>Status filters</legend><div className={styles.filters}>{reconciliationStatuses.map((status) => <label key={status}><input type="checkbox" checked={selected.includes(status)} onChange={() => toggle(status)} /> {statusLabels[status]}</label>)}</div></fieldset>
    <p aria-live="polite">Showing {visible.length} results.{selected.length > 0 && visible.length === 0 && workspace.metrics.unresolved === 0 ? ' All results resolved.' : ''}</p>
  </section>;
}
