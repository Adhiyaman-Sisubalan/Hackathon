import { useEffect, useId, useRef, useState } from 'react';
import { settingsTableDefinition, settingsTableDefinitions, type SettingsRow, type SettingsTableId, type SettingsValues } from '../../../shared/contracts/settings.js';
import type { ReconciliationApi } from '../../../shared/contracts/preload.js';
import styles from './Settings.module.css';

type SettingsApi = ReconciliationApi['settings'];
type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly rows: readonly SettingsRow[] }
  | { readonly kind: 'error'; readonly message: string; readonly retryable: boolean };

type Draft = { readonly id: number | 'new'; readonly values: SettingsValues };

function emptyDraft(table: SettingsTableId): Draft {
  return { id: 'new', values: Object.fromEntries(settingsTableDefinition(table).columns.map((column) => [column.id, ''])) };
}

export function Settings({ api }: { api?: SettingsApi } = {}) {
  const [table, setTable] = useState<SettingsTableId>('source-header-mapping');
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [draft, setDraft] = useState<Draft>();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pendingDeleteId, setPendingDeleteId] = useState<number>();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const formHeadingRef = useRef<HTMLHeadingElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const selectId = useId();
  const settingsApi = api ?? window.reconciliation?.settings;
  const definition = settingsTableDefinition(table);

  const load = async (target: SettingsTableId) => {
    setState({ kind: 'loading' });
    if (!settingsApi) { setState({ kind: 'error', message: 'Settings access is unavailable.', retryable: false }); return; }
    try {
      const response = await settingsApi.list(target);
      if (!response.ok) { setState({ kind: 'error', message: response.error.message, retryable: response.error.retryable }); return; }
      setState({ kind: 'ready', rows: response.data.rows });
    } catch { setState({ kind: 'error', message: 'Settings could not be loaded.', retryable: true }); }
  };

  useEffect(() => { headingRef.current?.focus(); }, []);
  useEffect(() => {
    // Switching tables abandons any in-progress edit rather than carrying the wrong shape across.
    setDraft(undefined); setFormError(undefined); setNotice(undefined); setPendingDeleteId(undefined);
    void load(table);
  }, [table]);
  useEffect(() => { if (state.kind === 'error') retryRef.current?.focus(); }, [state.kind]);
  useEffect(() => { if (draft) formHeadingRef.current?.focus(); }, [draft?.id]);

  const closeForm = () => {
    setDraft(undefined);
    setFormError(undefined);
    addButtonRef.current?.focus();
  };

  const submit = async () => {
    if (!draft || !settingsApi || saving) return;
    const blank = definition.columns.filter((column) => (draft.values[column.id] ?? '').trim() === '');
    if (blank.length > 0) { setFormError(`${blank.map((column) => column.label).join(', ')} cannot be empty.`); return; }
    setSaving(true); setFormError(undefined);
    try {
      const response = draft.id === 'new'
        ? await settingsApi.create(table, draft.values)
        : await settingsApi.update(table, draft.id, draft.values);
      if (!response.ok) { setFormError(response.error.message); return; }
      setState({ kind: 'ready', rows: response.data.rows });
      setNotice(draft.id === 'new' ? 'Row added.' : 'Row saved.');
      setDraft(undefined);
      addButtonRef.current?.focus();
    } catch { setFormError('The row could not be saved. Please retry.'); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!settingsApi || saving) return;
    setSaving(true); setFormError(undefined);
    try {
      const response = await settingsApi.remove(table, id);
      if (!response.ok) { setNotice(undefined); setFormError(response.error.message); return; }
      setState({ kind: 'ready', rows: response.data.rows });
      setNotice('Row deleted.');
      setPendingDeleteId(undefined);
    } catch { setFormError('The row could not be deleted. Please retry.'); }
    finally { setSaving(false); }
  };

  return <section aria-labelledby="settings-title" className={styles.settings}>
    <div className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Configuration</p>
        <h1 ref={headingRef} id="settings-title" tabIndex={-1}>Settings</h1>
      </div>
    </div>

    <div className={styles.chooser}>
      <label htmlFor={selectId}>Settings table</label>
      <select id={selectId} className={styles.select} value={table} onChange={(event) => setTable(event.target.value as SettingsTableId)}>
        {settingsTableDefinitions.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
      </select>
      <p className={styles.chooserNote}>{definition.description}</p>
    </div>

    <section className={styles.card} aria-labelledby="settings-table-title">
      <div className={styles.cardHead}>
        <div>
          <h2 id="settings-table-title">{definition.label}</h2>
          <p className={styles.count} aria-live="polite">
            {state.kind === 'ready' ? `${state.rows.length} ${state.rows.length === 1 ? 'row' : 'rows'}.` : state.kind === 'loading' ? 'Loading rows…' : 'Rows unavailable.'}
            {notice ? ` ${notice}` : ''}
          </p>
        </div>
        <button ref={addButtonRef} type="button" className={styles.primary} disabled={state.kind !== 'ready' || Boolean(draft)} onClick={() => { setNotice(undefined); setDraft(emptyDraft(table)); }}>Add row</button>
      </div>

      {formError && !draft && <div className={styles.error} role="alert"><p>{formError}</p></div>}

      {draft && <form className={styles.form} aria-labelledby="settings-form-title" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <h3 ref={formHeadingRef} id="settings-form-title" tabIndex={-1}>{draft.id === 'new' ? `Add a ${definition.label} row` : `Edit row ${draft.id}`}</h3>
        <div className={styles.fields}>
          {definition.columns.map((column) => <label key={column.id} className={styles.field}>
            <span>{column.label}</span>
            <input
              type="text"
              value={draft.values[column.id] ?? ''}
              maxLength={200}
              disabled={saving}
              onChange={(event) => setDraft({ ...draft, values: { ...draft.values, [column.id]: event.target.value } })}
            />
          </label>)}
        </div>
        {formError && <div className={styles.error} role="alert"><p>{formError}</p></div>}
        <div className={styles.formActions}>
          {/* Never just "Add row": that is the toolbar button's name, and two controls
              sharing one accessible name is ambiguous to anyone navigating by name. */}
          <button type="submit" className={styles.primary} disabled={saving}>{saving ? 'Saving…' : draft.id === 'new' ? 'Save new row' : 'Save changes'}</button>
          <button type="button" className={styles.secondary} disabled={saving} onClick={closeForm}>Cancel</button>
        </div>
      </form>}

      {state.kind === 'loading' && <p className={styles.loading}>Loading {definition.label}…</p>}

      {state.kind === 'error' && <div className={styles.error} role="alert">
        <p>{state.message}</p>
        {state.retryable && <button ref={retryRef} type="button" className={styles.secondary} onClick={() => void load(table)}>Retry</button>}
      </div>}

      {state.kind === 'ready' && state.rows.length === 0 && <div className={styles.empty}>
        <p>No rows yet. Add the first {definition.label} row.</p>
      </div>}

      {state.kind === 'ready' && state.rows.length > 0 && <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className={styles.visuallyHidden}>{definition.label} rows</caption>
          <thead><tr>
            {definition.columns.map((column) => <th key={column.id} scope="col">{column.label}</th>)}
            <th scope="col" className={styles.actionsHead}>Actions</th>
          </tr></thead>
          <tbody>{state.rows.map((row) => <tr key={row.id} data-editing={draft?.id === row.id ? true : undefined}>
            {definition.columns.map((column) => <td key={column.id}>{row.values[column.id]}</td>)}
            <td className={styles.actions}>
              {pendingDeleteId === row.id
                ? <span className={styles.confirm}>
                    <span className={styles.confirmText}>Delete?</span>
                    <button type="button" className={styles.danger} disabled={saving} onClick={() => void remove(row.id)}>Yes, delete</button>
                    <button type="button" className={styles.secondary} disabled={saving} onClick={() => setPendingDeleteId(undefined)}>Keep</button>
                  </span>
                : <span className={styles.rowActions}>
                    <button type="button" className={styles.secondary} disabled={saving || Boolean(draft)} onClick={() => { setNotice(undefined); setDraft({ id: row.id, values: { ...row.values } }); }}>Edit</button>
                    <button type="button" className={styles.secondary} disabled={saving || Boolean(draft)} onClick={() => { setNotice(undefined); setPendingDeleteId(row.id); }}>Delete</button>
                  </span>}
            </td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  </section>;
}
