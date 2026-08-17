// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Settings } from '../../src/renderer/features/settings/Settings.js';
import type { ReconciliationApi } from '../../src/shared/contracts/preload.js';
import type { SettingsRow, SettingsTableId, SettingsValues } from '../../src/shared/contracts/settings.js';

afterEach(cleanup);

const mappingRows: SettingsRow[] = [
  { id: 1, values: { provider: 'stpbroadcast@streamingedge.com', sourceField: 'COUNTERPARTY', targetField: 'BROKER', remarks: 'Tradition' } },
  { id: 2, values: { provider: 'Do_Not_Reply@bgcpartners.com', sourceField: 'MIC CODE', targetField: 'MIC', remarks: 'BGC' } }
];
const enrichmentRows: SettingsRow[] = [
  { id: 1, values: { provider: 'stpbroadcast@streamingedge.com', field: 'BUY/SELL', source: 'S', target: 'SELL' } }
];

/** Mirrors the bridge: every call answers with the whole reloaded table. */
function stubApi(overrides: Partial<ReconciliationApi['settings']> = {}): ReconciliationApi['settings'] {
  const rowsFor = (table: SettingsTableId) => table === 'source-header-mapping' ? mappingRows : table === 'data-enrichment' ? enrichmentRows : [];
  return {
    list: vi.fn(async (table: SettingsTableId) => ({ ok: true as const, data: { table, rows: rowsFor(table) } })),
    create: vi.fn(async (table: SettingsTableId, values: SettingsValues) => ({ ok: true as const, data: { table, rows: [...rowsFor(table), { id: 99, values }] } })),
    update: vi.fn(async (table: SettingsTableId, id: number, values: SettingsValues) => ({ ok: true as const, data: { table, rows: rowsFor(table).map((row) => row.id === id ? { id, values } : row) } })),
    remove: vi.fn(async (table: SettingsTableId, id: number) => ({ ok: true as const, data: { table, rows: rowsFor(table).filter((row) => row.id !== id) } })),
    ...overrides
  };
}

describe('Settings screen', () => {
  it('opens on Source_Header_Mapping and lists its rows under the table’s own columns', async () => {
    render(<Settings api={stubApi()} />);
    expect((await screen.findByLabelText('Settings table') as HTMLSelectElement).value).toBe('source-header-mapping');
    for (const header of ['Provider', 'SourceField', 'TargetField', 'Remarks']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeTruthy();
    }
    expect(await screen.findByText('COUNTERPARTY')).toBeTruthy();
    expect(screen.getByText('MIC CODE')).toBeTruthy();
  });

  it('switches tables from the dropdown and reloads that table’s columns', async () => {
    const api = stubApi();
    render(<Settings api={api} />);
    await screen.findByText('COUNTERPARTY');
    fireEvent.change(screen.getByLabelText('Settings table'), { target: { value: 'data-enrichment' } });
    await waitFor(() => expect(api.list).toHaveBeenCalledWith('data-enrichment'));
    for (const header of ['Provider', 'Field', 'Source', 'Target']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeTruthy();
    }
    // The mapping table's own columns are gone rather than left behind.
    expect(screen.queryByRole('columnheader', { name: 'SourceField' })).toBeNull();
    expect(await screen.findByText('SELL')).toBeTruthy();
  });

  it('creates a row from the add form using the selected table’s fields', async () => {
    const api = stubApi();
    render(<Settings api={api} />);
    await screen.findByText('COUNTERPARTY');
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'ops@example.com' } });
    fireEvent.change(screen.getByLabelText('SourceField'), { target: { value: 'SETTLE_CCY' } });
    fireEvent.change(screen.getByLabelText('TargetField'), { target: { value: 'CURRENCY' } });
    fireEvent.change(screen.getByLabelText('Remarks'), { target: { value: 'Example' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save new row' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith('source-header-mapping', { provider: 'ops@example.com', sourceField: 'SETTLE_CCY', targetField: 'CURRENCY', remarks: 'Example' }));
    expect(await screen.findByText('SETTLE_CCY')).toBeTruthy();
  });

  it('edits an existing row from its own values', async () => {
    const api = stubApi();
    render(<Settings api={api} />);
    await screen.findByText('COUNTERPARTY');
    const row = screen.getByText('COUNTERPARTY').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));
    expect((screen.getByLabelText('TargetField') as HTMLInputElement).value).toBe('BROKER');
    fireEvent.change(screen.getByLabelText('TargetField'), { target: { value: 'COUNTERPARTY BROKER' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('source-header-mapping', 1, { provider: 'stpbroadcast@streamingedge.com', sourceField: 'COUNTERPARTY', targetField: 'COUNTERPARTY BROKER', remarks: 'Tradition' }));
  });

  it('confirms before deleting and does not call the bridge until confirmed', async () => {
    const api = stubApi();
    render(<Settings api={api} />);
    await screen.findByText('MIC CODE');
    const row = screen.getByText('MIC CODE').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Delete' }));
    expect(api.remove).not.toHaveBeenCalled();
    fireEvent.click(within(row).getByRole('button', { name: 'Yes, delete' }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('source-header-mapping', 2));
  });

  it('keeps an empty required value out of the bridge and says which column is blank', async () => {
    const api = stubApi();
    render(<Settings api={api} />);
    await screen.findByText('COUNTERPARTY');
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'ops@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save new row' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('SourceField, TargetField, Remarks cannot be empty.');
    expect(api.create).not.toHaveBeenCalled();
  });

  it('saves an Email_Group row with a blank CC, since that column is optional', async () => {
    const api = stubApi();
    render(<Settings api={api} />);
    await screen.findByText('COUNTERPARTY');
    fireEvent.change(screen.getByLabelText('Settings table'), { target: { value: 'email-group' } });
    await waitFor(() => expect(api.list).toHaveBeenCalledWith('email-group'));
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));
    fireEvent.change(screen.getByLabelText('Email Group Name'), { target: { value: 'Test desk' } });
    fireEvent.change(screen.getByLabelText(/^To/), { target: { value: 'a@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save new row' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith('email-group', { groupName: 'Test desk', to: 'a@example.com', cc: '', remarks: '' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('still refuses a blank required column on a table that has optional ones', async () => {
    const api = stubApi();
    render(<Settings api={api} />);
    await screen.findByText('COUNTERPARTY');
    fireEvent.change(screen.getByLabelText('Settings table'), { target: { value: 'email-group' } });
    await waitFor(() => expect(api.list).toHaveBeenCalledWith('email-group'));
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));
    fireEvent.change(screen.getByLabelText('Email Group Name'), { target: { value: 'Test desk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save new row' }));
    expect((await screen.findByRole('alert')).textContent).toContain('To cannot be empty.');
    expect(api.create).not.toHaveBeenCalled();
  });

  it('surfaces a load failure with a retry that reloads the selected table', async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ ok: false as const, error: { code: 'QUERY_FAILED', message: 'Settings could not be loaded. Please retry.', retryable: true } })
      .mockResolvedValue({ ok: true as const, data: { table: 'source-header-mapping' as const, rows: mappingRows } });
    render(<Settings api={stubApi({ list })} />);
    expect((await screen.findByRole('alert')).textContent).toContain('Settings could not be loaded.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('COUNTERPARTY')).toBeTruthy();
  });

  it('reports a rejected save without dropping what was typed', async () => {
    const create = vi.fn(async () => ({ ok: false as const, error: { code: 'INVALID_REQUEST' as const, message: 'Remarks cannot be empty.', retryable: false } }));
    render(<Settings api={stubApi({ create })} />);
    await screen.findByText('COUNTERPARTY');
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));
    for (const [label, value] of [['Provider', 'ops@example.com'], ['SourceField', 'A'], ['TargetField', 'B'], ['Remarks', 'C']]) {
      fireEvent.change(screen.getByLabelText(label!), { target: { value } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Save new row' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Remarks cannot be empty.'));
    expect((screen.getByLabelText('SourceField') as HTMLInputElement).value).toBe('A');
  });
});
