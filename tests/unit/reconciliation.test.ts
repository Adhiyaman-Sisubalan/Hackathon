import { describe, expect, it } from 'vitest';
import { decimalEqual, normalizeDecimal } from '../../src/domain/decimal.js';
import { DuplicateTradeIdError, reconcileTrades } from '../../src/domain/reconciliation/reconciliation.js';

const trade = (source: 'broker' | 'ot-murex', tradeId: string, amount = '10', quantity = '1') => ({ source, tradeId, isin: 'US0000000001', buySell: 'buy' as const, currency: 'USD', settlementDate: '2026-08-15', amount, quantity, price: '10.00' });

describe('deterministic reconciliation', () => {
  it('normalizes decimals without binary floating point and pairs Trade IDs in ASCII ordinal order', () => {
    expect(normalizeDecimal('001.2300')).toBe('1.23');
    expect(decimalEqual('0.10', '0.1')).toBe(true);
    expect(decimalEqual('100.00', '100')).toBe(true);
    const results = reconcileTrades([trade('broker', 'Z-2', '20', '2'), trade('broker', 'A-10', '10.0', '1.00'), trade('broker', 'A-2', '30', '3')], [trade('ot-murex', 'OTM-1', '10', '1'), trade('ot-murex', 'OTM-2', '31', '4')]);
    expect(results.map((result) => [result.brokerTrade?.tradeId, result.otMurexTrade?.tradeId, result.status, result.reason])).toEqual([
      ['A-10', 'OTM-1', 'matched', null], ['A-2', 'OTM-2', 'unmatched', 'amount-and-quantity-mismatch'], ['Z-2', undefined, 'missing-from-ot-murex', null]
    ]);
  });

  it('emits canonical surplus and mismatch statuses and rejects duplicate source IDs', () => {
    const broker = [trade('broker', 'B-1', '11', '1'), trade('broker', 'B-2'), { ...trade('broker', 'B-3'), isin: 'US0000000003' }];
    const otMurex = [trade('ot-murex', 'O-1', '10', '1'), trade('ot-murex', 'O-2', '10', '2'), { ...trade('ot-murex', 'O-3'), isin: 'US0000000002' }];
    const results = reconcileTrades(broker, otMurex);
    expect(results.map((result) => result.status)).toEqual(['unmatched', 'unmatched', 'missing-from-broker', 'missing-from-ot-murex']);
    expect(results.slice(0, 2).map((result) => result.reason)).toEqual(['amount-mismatch', 'quantity-mismatch']);
    expect(() => reconcileTrades([trade('broker', 'B-1'), trade('broker', 'B-1')], [])).toThrow(DuplicateTradeIdError);
  });

  it('keeps canonical price evidence, validates source membership, and gives punctuation-safe result identities', () => {
    const results = reconcileTrades([trade('broker', 'A:B'), trade('broker', 'A')], [trade('ot-murex', 'C'), trade('ot-murex', 'B:C')]);
    expect(results.map((result) => result.id)).toEqual(['["A","B:C"]', '["A:B","C"]']);
    expect(new Set(results.map((result) => result.id)).size).toBe(2);
    expect(results[0]?.brokerTrade?.price).toBe('10');
    expect(() => reconcileTrades([{ ...trade('ot-murex', 'wrong') }], [])).toThrow('Expected broker source trades.');
  });
});
