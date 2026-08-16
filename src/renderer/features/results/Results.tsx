import { createColumnHelper, columnFilteringFeature, columnVisibilityFeature, constructFilterFn, createFilteredRowModel, createSortedRowModel, rowSortingFeature, tableFeatures, useTable } from '@tanstack/react-table';
import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react';
import { compareNormalizedDecimals, normalizeDecimal } from '../../../domain/decimal.js';
import { reconciliationStatuses, type ReconciliationStatus } from '../../../domain/reconciliation/reconciliation.js';
import type { BrokerEmailDraft, ReconciliationWorkspace } from '../../../shared/contracts/reconciliation.js';
import { ReconciliationStatusText } from '../../components/StatusText.js';
import { SummaryStrip } from '../../components/SummaryStrip.js';
import styles from './Results.module.css';

type ReconciliationResult = ReconciliationWorkspace['results'][number];
type ReviewError = { readonly resultId: string; readonly message: string; readonly retryable: boolean };
type CommentError = { readonly resultId: string; readonly message: string; readonly retryable: boolean };
type PreviewError = { readonly resultId: string; readonly message: string; readonly retryable: boolean };
type ReportError = { readonly message: string; readonly retryable: boolean };

type ResultRow = {
  readonly result: ReconciliationResult;
  readonly counterparty: string;
  readonly isin: string | undefined;
  readonly buySell: string | undefined;
  readonly amount: string | undefined;
  readonly quantity: string | undefined;
  readonly currency: string | undefined;
  readonly settlementDate: string | undefined;
  readonly status: ReconciliationStatus;
  readonly tradeId: string | undefined;
  readonly broker: string;
  readonly sourceSystem: string;
  readonly tradeDate: string | undefined;
  readonly price: string | undefined;
  readonly accountBook: string;
  readonly mismatchReason: string;
};

const statusLabels: Record<ReconciliationStatus, string> = {
  matched: 'Matched', unmatched: 'Unmatched', 'missing-from-broker': 'Missing from Broker', 'missing-from-ot-murex': 'Missing from OT/MUREX'
};

const statusFilter = constructFilterFn({
  filter: (status: ReconciliationStatus, selected: readonly ReconciliationStatus[]) => selected.includes(status),
  autoRemove: () => false
});

const tableFeaturesForResults = tableFeatures({
  columnFilteringFeature,
  filterFns: { statusFilter },
  filteredRowModel: createFilteredRowModel(),
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  columnVisibilityFeature,
  columnMeta: {} as { numeric?: boolean; date?: boolean }
});

const column = createColumnHelper<typeof tableFeaturesForResults, ResultRow>();
const columns = column.columns([
  column.accessor('counterparty', { header: 'Counterparty', enableHiding: false }),
  column.accessor('isin', { header: 'ISIN', enableHiding: false, sortUndefined: 'last' }),
  column.accessor('buySell', { id: 'buySell', header: 'Buy / sell', enableHiding: false, sortUndefined: 'last', cell: ({ getValue }) => valueOrDash(getValue<string | undefined>()) }),
  column.accessor('amount', { header: 'Amount', enableHiding: false, sortUndefined: 'last', sortFn: decimalSort, cell: ({ getValue }) => formatDecimal(getValue<string | undefined>()), meta: { numeric: true } }),
  column.accessor('quantity', { header: 'Quantity', enableHiding: false, sortUndefined: 'last', sortFn: decimalSort, cell: ({ getValue }) => formatDecimal(getValue<string | undefined>()), meta: { numeric: true } }),
  column.accessor('currency', { header: 'Currency', enableHiding: false, sortUndefined: 'last' }),
  column.accessor('settlementDate', { header: 'Settlement date', enableHiding: false, sortUndefined: 'last', cell: ({ getValue }) => formatDate(getValue<string | undefined>()), meta: { date: true } }),
  column.accessor('status', { header: 'Status', enableHiding: false, filterFn: 'statusFilter', cell: ({ getValue }) => <ReconciliationStatusText status={getValue<ReconciliationStatus>()} /> }),
  column.accessor('tradeId', { header: 'Trade ID', sortUndefined: 'last' }),
  column.accessor('broker', { header: 'Broker' }),
  column.accessor('sourceSystem', { header: 'Source system' }),
  column.accessor('tradeDate', { header: 'Trade date', sortUndefined: 'last', cell: ({ getValue }) => formatDate(getValue<string | undefined>()), meta: { date: true } }),
  column.accessor('price', { header: 'Price', sortUndefined: 'last', sortFn: decimalSort, cell: ({ getValue }) => formatDecimal(getValue<string | undefined>()), meta: { numeric: true } }),
  column.accessor('accountBook', { id: 'accountBook', header: 'Account / book' }),
  column.accessor('mismatchReason', { id: 'mismatchReason', header: 'Mismatch reason' })
]);

function decimalSort(rowA: { getValue: <T>(columnId: string) => T }, rowB: { getValue: <T>(columnId: string) => T }, columnId: string): number {
  return compareNormalizedDecimals(rowA.getValue<string>(columnId), rowB.getValue<string>(columnId));
}

function valueOrDash(value: string | undefined): string { return value ?? '—'; }

function formatDecimal(value: string | undefined): string {
  if (!value) return '—';
  const normalized = normalizeDecimal(value);
  const [whole, fraction] = normalized.split('.');
  const sign = whole!.startsWith('-') ? '-' : '';
  const digits = sign ? whole!.slice(1) : whole!;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${grouped}${fraction ? `.${fraction}` : ''}`;
}

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function rowFor(result: ReconciliationResult): ResultRow {
  const source = result.brokerTrade ?? result.otMurexTrade;
  return {
    result,
    counterparty: source ? (source.source === 'broker' ? 'Broker source' : 'OT/MUREX source') : '—',
    isin: source?.isin,
    buySell: source?.buySell ? source.buySell[0]!.toUpperCase() + source.buySell.slice(1) : undefined,
    amount: source?.amount,
    quantity: source?.quantity,
    currency: source?.currency,
    settlementDate: source?.settlementDate,
    status: result.status,
    tradeId: source?.tradeId,
    broker: result.brokerTrade ? 'Available' : 'Not supplied',
    sourceSystem: source?.source === 'broker' ? 'Broker' : source ? 'OT/MUREX' : '—',
    tradeDate: undefined,
    price: source?.price,
    accountBook: '—',
    mismatchReason: result.reason ? result.reason.replaceAll('-', ' ') : '—'
  };
}

export function Results({ workspace, initialSelected = reconciliationStatuses, loadError, onRetry, onWorkspaceChanged }: {
  workspace: ReconciliationWorkspace;
  initialSelected?: readonly ReconciliationStatus[];
  loadError?: string | null;
  onRetry?: () => void;
  onWorkspaceChanged?: (workspace: ReconciliationWorkspace) => void;
}) {
  const [selected, setSelected] = useState<readonly ReconciliationStatus[]>(initialSelected);
  const [selectedResultId, setSelectedResultId] = useState<string>();
  const [reviewErrors, setReviewErrors] = useState<ReadonlyMap<string, ReviewError>>(new Map());
  const [reviewingResultIds, setReviewingResultIds] = useState<ReadonlySet<string>>(new Set());
  const [locallyReviewedResultIds, setLocallyReviewedResultIds] = useState<ReadonlySet<string>>(new Set());
  const [commentDrafts, setCommentDrafts] = useState<ReadonlyMap<string, string>>(new Map());
  const [commentErrors, setCommentErrors] = useState<ReadonlyMap<string, CommentError>>(new Map());
  const [savingCommentResultIds, setSavingCommentResultIds] = useState<ReadonlySet<string>>(new Set());
  const [savedCommentResultIds, setSavedCommentResultIds] = useState<ReadonlySet<string>>(new Set());
  const [previewDrafts, setPreviewDrafts] = useState<ReadonlyMap<string, BrokerEmailDraft>>(new Map());
  const [previewErrors, setPreviewErrors] = useState<ReadonlyMap<string, PreviewError>>(new Map());
  const [previewingResultIds, setPreviewingResultIds] = useState<ReadonlySet<string>>(new Set());
  const [savingReport, setSavingReport] = useState(false);
  const [reportError, setReportError] = useState<ReportError>();
  const [reportDestination, setReportDestination] = useState<string>();
  const [compactInspectorOpen, setCompactInspectorOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inspectorHeadingRef = useRef<HTMLHeadingElement>(null);
  const inspectorInvokerRef = useRef<HTMLButtonElement>(null);
  const previewHeadingRef = useRef<HTMLHeadingElement>(null);
  const previewButtonRef = useRef<HTMLButtonElement>(null);
  const reportWorkspaceRunIdRef = useRef(workspace.runId);
  const reportOperationRef = useRef(0);
  const inFlightReviewIds = useRef(new Set<string>());
  const inFlightCommentIds = useRef(new Set<string>());
  const inFlightPreviewIds = useRef(new Set<string>());
  const workspaceMutationQueue = useRef(Promise.resolve());
  const compactInspectorOpenRef = useRef(false);
  useEffect(() => { headingRef.current?.focus(); }, []);
  const data = useMemo(() => workspace.results.map(rowFor), [workspace.results]);
  const table = useTable({
    features: tableFeaturesForResults,
    columns,
    data,
    getRowId: (row) => row.result.id,
    initialState: { columnVisibility: Object.fromEntries(['tradeId', 'broker', 'sourceSystem', 'tradeDate', 'price', 'accountBook', 'mismatchReason'].map((id) => [id, false])) },
    state: { columnFilters: [{ id: 'status', value: selected }] },
    enableMultiSort: false
  });
  const visibleRows = table.getRowModel().rows;
  const selectedResult = workspace.results.find((result) => result.id === selectedResultId);
  const selectedReviewed = Boolean(selectedResult?.reviewed || (selectedResultId && locallyReviewedResultIds.has(selectedResultId)));
  const selectedReviewing = Boolean(selectedResultId && reviewingResultIds.has(selectedResultId));
  const selectedReviewError = selectedResultId ? reviewErrors.get(selectedResultId) : undefined;
  const selectedCommentError = selectedResultId ? commentErrors.get(selectedResultId) : undefined;
  const selectedPreviewError = selectedResultId ? previewErrors.get(selectedResultId) : undefined;
  const selectedPreviewDraft = selectedResultId ? previewDrafts.get(selectedResultId) : undefined;
  const toggle = (status: ReconciliationStatus) => setSelected((current) => current.includes(status) ? current.filter((value) => value !== status) : [...current, status]);
  const clearFilters = () => setSelected(reconciliationStatuses);
  const isAllResolved = workspace.metrics.unresolved === 0;
  const outstandingReviews = workspace.reviewProgress.totalUnmatched - workspace.reviewProgress.reviewedUnmatched;
  const hasActiveFilters = selected.length !== reconciliationStatuses.length;

  useEffect(() => {
    if (reportWorkspaceRunIdRef.current !== workspace.runId) {
      reportWorkspaceRunIdRef.current = workspace.runId;
      reportOperationRef.current += 1;
      setSavingReport(false);
      setReportError(undefined);
      setReportDestination(undefined);
    }
  }, [workspace.runId]);

  const review = async (result: ReconciliationResult) => {
    const resultId = result.id;
    if (result.status !== 'unmatched' || result.reviewed || locallyReviewedResultIds.has(resultId) || inFlightReviewIds.current.has(resultId)) return;
    inFlightReviewIds.current.add(resultId);
    setReviewingResultIds((current) => new Set(current).add(resultId));
    setReviewErrors((current) => {
      const next = new Map(current);
      next.delete(resultId);
      return next;
    });
    try {
      if (!window.reconciliation) {
        setReviewErrors((current) => new Map(current).set(resultId, { resultId, message: 'Result review is unavailable.', retryable: false }));
        return;
      }
      const response = await enqueueWorkspaceMutation(workspaceMutationQueue, () => window.reconciliation!.runs.reviewResult(workspace.runId, resultId));
      if (response.ok) {
        setLocallyReviewedResultIds((current) => new Set(current).add(resultId));
        setReviewErrors((current) => {
          const next = new Map(current);
          next.delete(resultId);
          return next;
        });
        onWorkspaceChanged?.(response.data.workspace);
        return;
      }
      setReviewErrors((current) => new Map(current).set(resultId, { resultId, message: response.error.message, retryable: response.error.retryable }));
    } catch {
      setReviewErrors((current) => new Map(current).set(resultId, { resultId, message: 'The result review could not be saved. Please retry.', retryable: true }));
    } finally {
      inFlightReviewIds.current.delete(resultId);
      setReviewingResultIds((current) => {
        const next = new Set(current);
        next.delete(resultId);
        return next;
      });
    }
  };
  const selectResult = (result: ReconciliationResult) => {
    setSelectedResultId(result.id);
    void review(result);
  };
  const commentDraftFor = (result: ReconciliationResult) => commentDrafts.get(result.id) ?? result.comment ?? '';
  const setCommentDraft = (resultId: string, comment: string) => {
    setCommentDrafts((current) => new Map(current).set(resultId, comment));
    setCommentErrors((current) => {
      const next = new Map(current);
      next.delete(resultId);
      return next;
    });
    setSavedCommentResultIds((current) => {
      const next = new Set(current);
      next.delete(resultId);
      return next;
    });
  };
  const saveComment = async (result: ReconciliationResult) => {
    const resultId = result.id;
    if (result.status === 'matched' || inFlightCommentIds.current.has(resultId)) return;
    const comment = commentDraftFor(result);
    inFlightCommentIds.current.add(resultId);
    setSavingCommentResultIds((current) => new Set(current).add(resultId));
    setCommentErrors((current) => {
      const next = new Map(current);
      next.delete(resultId);
      return next;
    });
    setSavedCommentResultIds((current) => {
      const next = new Set(current);
      next.delete(resultId);
      return next;
    });
    try {
      if (!window.reconciliation) {
        setCommentErrors((current) => new Map(current).set(resultId, { resultId, message: 'Comment saving is unavailable.', retryable: false }));
        return;
      }
      const response = await enqueueWorkspaceMutation(workspaceMutationQueue, () => window.reconciliation!.runs.saveComment(workspace.runId, resultId, comment));
      if (response.ok) {
        const savedComment = response.data.workspace.results.find((candidate) => candidate.id === resultId)?.comment;
        setCommentDraft(resultId, savedComment ?? '');
        setSavedCommentResultIds((current) => new Set(current).add(resultId));
        onWorkspaceChanged?.(response.data.workspace);
        return;
      }
      setCommentErrors((current) => new Map(current).set(resultId, { resultId, message: response.error.message, retryable: response.error.retryable }));
    } catch {
      setCommentErrors((current) => new Map(current).set(resultId, { resultId, message: 'The comment could not be saved. Please retry.', retryable: true }));
    } finally {
      inFlightCommentIds.current.delete(resultId);
      setSavingCommentResultIds((current) => {
        const next = new Set(current);
        next.delete(resultId);
        return next;
      });
    }
  };
  const previewBrokerEmail = async (result: ReconciliationResult) => {
    const resultId = result.id;
    if (result.status !== 'unmatched' || !result.brokerTrade?.brokerContact || inFlightPreviewIds.current.has(resultId)) return;
    inFlightPreviewIds.current.add(resultId);
    setPreviewingResultIds((current) => new Set(current).add(resultId));
    setPreviewErrors((current) => { const next = new Map(current); next.delete(resultId); return next; });
    try {
      if (!window.reconciliation) {
        setPreviewErrors((current) => new Map(current).set(resultId, { resultId, message: 'Broker email previews are unavailable.', retryable: false }));
        return;
      }
      const response = await enqueueWorkspaceMutation(workspaceMutationQueue, () => window.reconciliation!.runs.previewBrokerEmail(workspace.runId, resultId));
      if (response.ok) {
        setPreviewDrafts((current) => new Map(current).set(resultId, response.data.draft));
        requestAnimationFrame(() => previewHeadingRef.current?.focus());
        return;
      }
      setPreviewErrors((current) => new Map(current).set(resultId, { resultId, message: response.error.message, retryable: response.error.retryable }));
    } catch {
      setPreviewErrors((current) => new Map(current).set(resultId, { resultId, message: 'The broker email draft could not be prepared. Please retry.', retryable: true }));
    } finally {
      inFlightPreviewIds.current.delete(resultId);
      setPreviewingResultIds((current) => { const next = new Set(current); next.delete(resultId); return next; });
    }
  };
  const closePreview = (resultId: string) => {
    setPreviewDrafts((current) => { const next = new Map(current); next.delete(resultId); return next; });
    requestAnimationFrame(() => previewButtonRef.current?.focus());
  };
  const saveReport = async () => {
    if (savingReport || outstandingReviews > 0) return;
    const runId = workspace.runId;
    const operation = reportOperationRef.current + 1;
    reportOperationRef.current = operation;
    setSavingReport(true); setReportError(undefined); setReportDestination(undefined);
    try {
      if (!window.reconciliation) {
        if (reportOperationRef.current === operation && reportWorkspaceRunIdRef.current === runId) setReportError({ message: 'Verified report saving is unavailable.', retryable: false });
        return;
      }
      const response = await enqueueWorkspaceMutation(workspaceMutationQueue, () => window.reconciliation!.runs.saveReport(runId));
      if (reportOperationRef.current !== operation || reportWorkspaceRunIdRef.current !== runId) return;
      if (response.ok) setReportDestination(response.data.destination);
      else setReportError({ message: response.error.message, retryable: response.error.retryable });
    } catch {
      if (reportOperationRef.current === operation && reportWorkspaceRunIdRef.current === runId) setReportError({ message: 'The verified report could not be saved. Please retry.', retryable: true });
    } finally {
      if (reportOperationRef.current === operation && reportWorkspaceRunIdRef.current === runId) setSavingReport(false);
    }
  };
  const closeInspector = () => {
    compactInspectorOpenRef.current = false;
    setCompactInspectorOpen(false);
    inspectorInvokerRef.current?.focus();
  };
  useEffect(() => {
    compactInspectorOpenRef.current = compactInspectorOpen;
    if (compactInspectorOpen) inspectorHeadingRef.current?.focus();
  }, [compactInspectorOpen]);
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 800px)');
    if (!media) return;
    const closeAfterViewportChange = () => { if (compactInspectorOpenRef.current && !media.matches) closeInspector(); };
    media.addEventListener?.('change', closeAfterViewportChange);
    return () => media.removeEventListener?.('change', closeAfterViewportChange);
  }, []);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && compactInspectorOpen) { event.preventDefault(); closeInspector(); } };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [compactInspectorOpen]);

  return <section aria-labelledby="results-title" className={styles.results}>
    <p className={styles.eyebrow}>Completed reconciliation</p><h1 ref={headingRef} id="results-title" tabIndex={-1}>Results</h1>
    <p>Run {workspace.runId} · As-of date {formatDate(workspace.asOfDate)}</p>
    <SummaryStrip summary={workspace} />
    <section className={styles.report} aria-label="Verified report">
      <h2>Verified report</h2>
      {outstandingReviews > 0 ? <p>Save is available after {outstandingReviews} unmatched {outstandingReviews === 1 ? 'result is' : 'results are'} reviewed.</p> : <p>All unmatched Results are reviewed. The report will contain the authoritative saved Run.</p>}
      <button type="button" onClick={() => void saveReport()} disabled={savingReport || outstandingReviews > 0} aria-describedby={outstandingReviews > 0 ? 'report-review-gate' : undefined}>{savingReport ? 'Saving verified report…' : 'Save verified report'}</button>
      {outstandingReviews > 0 && <p id="report-review-gate">{outstandingReviews} unmatched {outstandingReviews === 1 ? 'review remains' : 'reviews remain'}.</p>}
      {reportDestination && <p className={styles.success} role="status">Verified report saved to {reportDestination}.</p>}
      {reportError && <div className={styles.error} role="alert"><p>{reportError.message}</p>{reportError.retryable && <button type="button" onClick={() => void saveReport()}>Retry saving report</button>}</div>}
    </section>
    {loadError && <div className={styles.error} role="alert"><p>Results could not be refreshed: {loadError}</p>{onRetry && <button type="button" onClick={onRetry}>Retry</button>}</div>}
    <div className={styles.toolbar}>
      <fieldset><legend>Status filters</legend><div className={styles.filters}>{reconciliationStatuses.map((status) => <label key={status}><input type="checkbox" checked={selected.includes(status)} onChange={() => toggle(status)} /> {statusLabels[status]}</label>)}</div></fieldset>
      <fieldset><legend>Columns</legend><div className={styles.columns}>{table.getAllLeafColumns().filter((column) => column.getCanHide()).map((column) => <label key={column.id}><input type="checkbox" checked={column.getIsVisible()} onChange={column.getToggleVisibilityHandler()} /> {String(column.columnDef.header)}</label>)}</div></fieldset>
    </div>
    <div className={styles.feedback} aria-live="polite">
      <p>Showing {visibleRows.length} results.{visibleRows.length === 0 && isAllResolved ? ' All results resolved.' : ''}</p>
      <p>{workspace.metrics.total} total results.</p>
      {isAllResolved && <p>All results in this run are resolved. Matched records remain available.</p>}
      {visibleRows.length === 0 && <div className={styles.empty}><p>No matching records.</p>{hasActiveFilters && <button type="button" onClick={clearFilters}>Clear filters</button>}</div>}
    </div>
    <p className={styles.sourceNote}>Source values use Broker when present; otherwise OT/MUREX values are shown.</p>
    <div className={styles.workspace}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
        <thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => {
          const sorted = header.column.getIsSorted();
          const canSort = header.column.getCanSort();
          return <th key={header.id} scope="col" aria-sort={sorted === false ? 'none' : sorted === 'asc' ? 'ascending' : 'descending'} className={header.column.columnDef.meta?.numeric ? styles.numeric : header.column.columnDef.meta?.date ? styles.date : undefined}>
            {canSort ? <button type="button" className={styles.sortButton} onClick={() => header.column.toggleSorting()}>{String(header.column.columnDef.header)}{sorted === 'asc' ? ' ↑' : sorted === 'desc' ? ' ↓' : ''}</button> : String(header.column.columnDef.header)}
          </th>;
        })}</tr>)}</thead>
        <tbody>{visibleRows.map((row) => <tr key={row.id} className={styles.row} data-selected={selectedResultId === row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id} className={cell.column.columnDef.meta?.numeric ? styles.numeric : cell.column.columnDef.meta?.date ? styles.date : undefined}>
          {cell.column.id === 'counterparty' ? <button type="button" className={styles.select} aria-label={`${selectedResultId === row.id ? 'Selected' : 'Select'} ${row.original.tradeId ?? 'reconciliation record'}`} aria-describedby={selectedReviewError && selectedResultId === row.id ? 'review-error' : selectedResultId === row.id ? 'selected-result-status' : undefined} onClick={() => selectResult(row.original.result)}>{row.getValue<string>('counterparty')}</button> : <table.FlexRender cell={cell} />}
        </td>)}</tr>)}</tbody>
        </table>
      </div>
      {selectedResult && <p id="selected-result-status" className={styles.visuallyHidden}>Selected Result: {selectedResult.brokerTrade?.tradeId ?? selectedResult.otMurexTrade?.tradeId ?? 'reconciliation record'}.</p>}
      <button ref={inspectorInvokerRef} type="button" className={styles.openInspector} onClick={() => setCompactInspectorOpen(true)} disabled={!selectedResult}>Open inspector</button>
      {selectedReviewError && <div id="review-error" className={styles.error} role="alert"><p>Review could not be saved: {selectedReviewError.message}</p>{selectedReviewError.retryable && <button type="button" onClick={() => selectedResult && void review(selectedResult)}>Retry review</button>}</div>}
      <DetailPanel result={selectedResult} reviewed={selectedReviewed} reviewing={selectedReviewing} commentDraft={selectedResult ? commentDraftFor(selectedResult) : ''} commentError={selectedCommentError} savingComment={Boolean(selectedResultId && savingCommentResultIds.has(selectedResultId))} commentSaved={Boolean(selectedResultId && savedCommentResultIds.has(selectedResultId))} previewDraft={selectedPreviewDraft} previewError={selectedPreviewError} previewing={Boolean(selectedResultId && previewingResultIds.has(selectedResultId))} onCommentDraftChange={setCommentDraft} onSaveComment={saveComment} onPreview={previewBrokerEmail} onClosePreview={closePreview} previewHeadingRef={previewHeadingRef} previewButtonRef={previewButtonRef} className={styles.detailPanel} />
      {compactInspectorOpen && <aside className={styles.compactInspector} aria-labelledby="inspector-title">
        <button type="button" className={styles.closeInspector} onClick={closeInspector}>Close inspector</button>
        <DetailPanel result={selectedResult} reviewed={selectedReviewed} reviewing={selectedReviewing} commentDraft={selectedResult ? commentDraftFor(selectedResult) : ''} commentError={selectedCommentError} savingComment={Boolean(selectedResultId && savingCommentResultIds.has(selectedResultId))} commentSaved={Boolean(selectedResultId && savedCommentResultIds.has(selectedResultId))} previewDraft={selectedPreviewDraft} previewError={selectedPreviewError} previewing={Boolean(selectedResultId && previewingResultIds.has(selectedResultId))} onCommentDraftChange={setCommentDraft} onSaveComment={saveComment} onPreview={previewBrokerEmail} onClosePreview={closePreview} previewHeadingRef={previewHeadingRef} previewButtonRef={previewButtonRef} headingRef={inspectorHeadingRef} compact />
      </aside>}
    </div>
  </section>;
}

function DetailPanel({ result, reviewed, reviewing, commentDraft, commentError, savingComment, commentSaved, previewDraft, previewError, previewing, onCommentDraftChange, onSaveComment, onPreview, onClosePreview, previewHeadingRef, previewButtonRef, className, compact, headingRef }: {
  result: ReconciliationResult | undefined;
  reviewed: boolean;
  reviewing: boolean;
  commentDraft: string;
  commentError: CommentError | undefined;
  savingComment: boolean;
  commentSaved: boolean;
  previewDraft: BrokerEmailDraft | undefined;
  previewError: PreviewError | undefined;
  previewing: boolean;
  onCommentDraftChange(resultId: string, comment: string): void;
  onSaveComment(result: ReconciliationResult): void;
  onPreview(result: ReconciliationResult): void;
  onClosePreview(resultId: string): void;
  previewHeadingRef: RefObject<HTMLHeadingElement | null>;
  previewButtonRef: RefObject<HTMLButtonElement | null>;
  className?: string;
  compact?: boolean;
  headingRef?: RefObject<HTMLHeadingElement | null>;
}) {
  const source = result?.brokerTrade ?? result?.otMurexTrade;
  const key = source ? `${source.isin} · ${source.buySell === 'buy' ? 'Buy' : 'Sell'} · ${source.currency} · ${formatDate(source.settlementDate)}` : 'Unavailable';
  return <aside className={className} aria-label="Result detail">
    <h2 ref={headingRef} id={compact ? 'inspector-title' : undefined} tabIndex={compact ? -1 : undefined}>Result detail</h2>
    {!result && <p>Select a Result to inspect its evidence.</p>}
    {result && <>
      <dl className={styles.detailSummary}>
        <div><dt>Reconciliation key</dt><dd>{key}</dd></div>
        <div><dt>Status</dt><dd><ReconciliationStatusText status={result.status} /></dd></div>
        <div><dt>Reason</dt><dd>{result.reason?.replaceAll('-', ' ') ?? '—'}</dd></div>
        {result.status === 'unmatched' && <div><dt>Review</dt><dd>{reviewed ? 'Reviewed' : reviewing ? 'Saving review…' : 'Not reviewed'}</dd></div>}
      </dl>
      <Evidence title="Broker evidence" trade={result.brokerTrade} missing="Broker evidence is not available for this Result." />
      <Evidence title="OT/MUREX evidence" trade={result.otMurexTrade} missing="OT/MUREX evidence is not available for this Result." />
      <CommentEditor result={result} draft={commentDraft} error={commentError} saving={savingComment} saved={commentSaved} onDraftChange={onCommentDraftChange} onSave={onSaveComment} />
      <BrokerPreview result={result} draft={previewDraft} error={previewError} previewing={previewing} onPreview={onPreview} onClose={onClosePreview} headingRef={previewHeadingRef} buttonRef={previewButtonRef} />
    </>}
  </aside>;
}

function CommentEditor({ result, draft, error, saving, saved, onDraftChange, onSave }: {
  result: ReconciliationResult;
  draft: string;
  error: CommentError | undefined;
  saving: boolean;
  saved: boolean;
  onDraftChange(resultId: string, comment: string): void;
  onSave(result: ReconciliationResult): void;
}) {
  const controlId = useId();
  const errorId = `${controlId}-error`;
  if (result.status === 'matched') return <section className={styles.comment}><h3>Comment</h3><p>Comments are unavailable for matched Results.</p></section>;
  return <section className={styles.comment} aria-label="Resolution comment">
    <h3>Comment</h3>
    <label htmlFor={controlId}>Comment</label>
    <textarea id={controlId} value={draft} onChange={(event) => onDraftChange(result.id, event.target.value)} aria-describedby={error ? errorId : undefined} aria-invalid={Boolean(error)} disabled={saving} />
    <button type="button" onClick={() => onSave(result)} disabled={saving}>{saving ? 'Saving comment…' : 'Save comment'}</button>
    {saved && <p className={styles.success} role="status">Comment saved.</p>}
    {error && <div id={errorId} className={styles.error} role="alert"><p>{error.message}</p>{error.retryable && <button type="button" onClick={() => onSave(result)}>Retry comment save</button>}</div>}
  </section>;
}

function BrokerPreview({ result, draft, error, previewing, onPreview, onClose, headingRef, buttonRef }: {
  result: ReconciliationResult;
  draft: BrokerEmailDraft | undefined;
  error: PreviewError | undefined;
  previewing: boolean;
  onPreview(result: ReconciliationResult): void;
  onClose(resultId: string): void;
  headingRef: RefObject<HTMLHeadingElement | null>;
  buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  if (draft) return <section className={styles.preview} aria-label="Broker email draft">
    <p className={styles.draftStatus} aria-label="Draft status">Draft</p>
    <h3 ref={headingRef} tabIndex={-1}>Broker email draft</h3>
    <dl className={styles.detailSummary}>
      <div><dt>To</dt><dd>{draft.recipient}</dd></div>
      <div><dt>Subject</dt><dd>{draft.subject}</dd></div>
    </dl>
    <p className={styles.emailBody}>{draft.body}</p>
    <table className={styles.draftTable}>
      <caption>Unmatched trades for {draft.brokerName}</caption>
      <thead><tr><th scope="col">Trade ID</th><th scope="col">ISIN</th><th scope="col">Buy / sell</th><th scope="col">Amount</th><th scope="col">Quantity</th><th scope="col">Currency</th><th scope="col">Settlement date</th><th scope="col">Mismatch reason</th><th scope="col">Comment</th></tr></thead>
      <tbody>{draft.rows.map((row) => <tr key={row.tradeId}><td>{row.tradeId}</td><td>{row.isin}</td><td>{row.buySell}</td><td>{formatDecimal(row.amount)}</td><td>{formatDecimal(row.quantity)}</td><td>{row.currency}</td><td>{formatDate(row.settlementDate)}</td><td>{row.mismatchReason.replaceAll('-', ' ')}</td><td>{row.comment ?? '—'}</td></tr>)}</tbody>
    </table>
    <p className={styles.previewNotice}>This is a preview only. No email will be sent.</p>
    <button type="button" onClick={() => onClose(result.id)}>Back to detail</button>
  </section>;
  const explanation = result.status !== 'unmatched' ? 'Email drafts are available only for unmatched Results.' : !result.brokerTrade?.brokerContact ? 'Broker details are unavailable for this Result.' : null;
  return <section className={styles.preview} aria-label="Broker email preview">
    <h3>Broker email</h3>
    {explanation ? <p>{explanation}</p> : <button ref={buttonRef} type="button" onClick={() => onPreview(result)} disabled={previewing}>{previewing ? 'Preparing draft…' : 'Preview broker email'}</button>}
    {error && <div className={styles.error} role="alert"><p>{error.message}</p>{error.retryable && <button type="button" onClick={() => onPreview(result)}>Retry</button>}<button type="button" onClick={() => onClose(result.id)}>Back to detail</button></div>}
  </section>;
}

function Evidence({ title, trade, missing }: { title: string; trade: ReconciliationResult['brokerTrade']; missing: string }) {
  return <section className={styles.evidence}><h3>{title}</h3>{!trade ? <p>{missing}</p> : <dl>
    <div><dt>Trade ID</dt><dd>{trade.tradeId}</dd></div><div><dt>ISIN</dt><dd>{trade.isin}</dd></div><div><dt>Buy / sell</dt><dd>{trade.buySell}</dd></div><div><dt>Currency</dt><dd>{trade.currency}</dd></div>
    <div><dt>Settlement date</dt><dd>{formatDate(trade.settlementDate)}</dd></div><div><dt>Amount</dt><dd>{formatDecimal(trade.amount)}</dd></div><div><dt>Quantity</dt><dd>{formatDecimal(trade.quantity)}</dd></div><div><dt>Price</dt><dd>{formatDecimal(trade.price)}</dd></div>
  </dl>}</section>;
}

function enqueueWorkspaceMutation<T>(queue: RefObject<Promise<void> | null>, mutation: () => Promise<T>): Promise<T> {
  const pending = (queue.current ?? Promise.resolve()).then(mutation, mutation);
  queue.current = pending.then(() => undefined, () => undefined);
  return pending;
}
