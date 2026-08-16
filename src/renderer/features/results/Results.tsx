import { createColumnHelper, columnFilteringFeature, columnVisibilityFeature, constructFilterFn, createFilteredRowModel, createSortedRowModel, rowSortingFeature, tableFeatures, useTable } from '@tanstack/react-table';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { compareNormalizedDecimals, normalizeDecimal } from '../../../domain/decimal.js';
import { reconciliationStatuses, type ReconciliationStatus } from '../../../domain/reconciliation/reconciliation.js';
import type { ReconciliationWorkspace } from '../../../shared/contracts/reconciliation.js';
import { ReconciliationStatusText } from '../../components/StatusText.js';
import { SummaryStrip } from '../../components/SummaryStrip.js';
import styles from './Results.module.css';

type ReconciliationResult = ReconciliationWorkspace['results'][number];

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
  const [reviewError, setReviewError] = useState<string>();
  const [compactInspectorOpen, setCompactInspectorOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inspectorHeadingRef = useRef<HTMLHeadingElement>(null);
  const inspectorInvokerRef = useRef<HTMLButtonElement>(null);
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
  const toggle = (status: ReconciliationStatus) => setSelected((current) => current.includes(status) ? current.filter((value) => value !== status) : [...current, status]);
  const clearFilters = () => setSelected(reconciliationStatuses);
  const isAllResolved = workspace.metrics.unresolved === 0;
  const hasActiveFilters = selected.length !== reconciliationStatuses.length;

  const review = async (result: ReconciliationResult) => {
    if (result.status !== 'unmatched' || result.reviewed) return;
    setReviewError(undefined);
    if (!window.reconciliation) { setReviewError('Result review is unavailable. Please retry.'); return; }
    const response = await window.reconciliation.runs.reviewResult(workspace.runId, result.id);
    if (response.ok) {
      onWorkspaceChanged?.(response.data.workspace);
      return;
    }
    setReviewError(response.error.message);
  };
  const selectResult = (result: ReconciliationResult) => {
    setSelectedResultId(result.id);
    setReviewError(undefined);
    void review(result);
  };
  const closeInspector = () => {
    setCompactInspectorOpen(false);
    requestAnimationFrame(() => inspectorInvokerRef.current?.focus());
  };
  useEffect(() => {
    if (compactInspectorOpen) inspectorHeadingRef.current?.focus();
  }, [compactInspectorOpen]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && compactInspectorOpen) { event.preventDefault(); closeInspector(); } };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [compactInspectorOpen]);

  return <section aria-labelledby="results-title" className={styles.results}>
    <p className={styles.eyebrow}>Completed reconciliation</p><h1 ref={headingRef} id="results-title" tabIndex={-1}>Results</h1>
    <p>Run {workspace.runId} · As-of date {formatDate(workspace.asOfDate)}</p>
    <SummaryStrip summary={workspace} />
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
        <tbody>{visibleRows.map((row) => <tr key={row.id} className={styles.row} data-selected={selectedResultId === row.id} aria-selected={selectedResultId === row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id} className={cell.column.columnDef.meta?.numeric ? styles.numeric : cell.column.columnDef.meta?.date ? styles.date : undefined}>
          {cell.column.id === 'counterparty' ? <button type="button" className={styles.select} aria-label={`Select ${row.original.tradeId ?? 'reconciliation record'}`} aria-pressed={selectedResultId === row.id} aria-describedby={reviewError && selectedResultId === row.id ? 'review-error' : undefined} onClick={() => selectResult(row.original.result)}>{row.getValue<string>('counterparty')}</button> : <table.FlexRender cell={cell} />}
        </td>)}</tr>)}</tbody>
        </table>
      </div>
      <button ref={inspectorInvokerRef} type="button" className={styles.openInspector} onClick={() => setCompactInspectorOpen(true)} disabled={!selectedResult}>Open inspector</button>
      <DetailPanel result={selectedResult} reviewError={reviewError} onRetry={() => selectedResult && void review(selectedResult)} className={styles.detailPanel} />
      {compactInspectorOpen && <aside className={styles.compactInspector} aria-labelledby="inspector-title">
        <button type="button" className={styles.closeInspector} onClick={closeInspector}>Close inspector</button>
        <DetailPanel result={selectedResult} reviewError={reviewError} onRetry={() => selectedResult && void review(selectedResult)} headingRef={inspectorHeadingRef} compact />
      </aside>}
    </div>
  </section>;
}

function DetailPanel({ result, reviewError, onRetry, className, compact, headingRef }: {
  result: ReconciliationResult | undefined;
  reviewError?: string;
  onRetry: () => void;
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
        {result.status === 'unmatched' && <div><dt>Review</dt><dd>{result.reviewed ? 'Reviewed' : 'Saving review…'}</dd></div>}
      </dl>
      {reviewError && <div id="review-error" className={styles.error} role="alert"><p>Review could not be saved: {reviewError}</p><button type="button" onClick={onRetry}>Retry review</button></div>}
      <Evidence title="Broker evidence" trade={result.brokerTrade} missing="Broker evidence is not available for this Result." />
      <Evidence title="OT/MUREX evidence" trade={result.otMurexTrade} missing="OT/MUREX evidence is not available for this Result." />
    </>}
  </aside>;
}

function Evidence({ title, trade, missing }: { title: string; trade: ReconciliationResult['brokerTrade']; missing: string }) {
  return <section className={styles.evidence}><h3>{title}</h3>{!trade ? <p>{missing}</p> : <dl>
    <div><dt>Trade ID</dt><dd>{trade.tradeId}</dd></div><div><dt>ISIN</dt><dd>{trade.isin}</dd></div><div><dt>Buy / sell</dt><dd>{trade.buySell}</dd></div><div><dt>Currency</dt><dd>{trade.currency}</dd></div>
    <div><dt>Settlement date</dt><dd>{formatDate(trade.settlementDate)}</dd></div><div><dt>Amount</dt><dd>{formatDecimal(trade.amount)}</dd></div><div><dt>Quantity</dt><dd>{formatDecimal(trade.quantity)}</dd></div><div><dt>Price</dt><dd>{formatDecimal(trade.price)}</dd></div>
  </dl>}</section>;
}
