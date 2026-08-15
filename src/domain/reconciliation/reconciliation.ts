import { decimalEqual, normalizeDecimal } from '../decimal.js';

export const reconciliationStatuses = ['matched', 'unmatched', 'missing-from-broker', 'missing-from-ot-murex'] as const;
export type ReconciliationStatus = typeof reconciliationStatuses[number];
export type TradeSource = 'broker' | 'ot-murex';

export interface Trade {
  readonly source: TradeSource;
  readonly tradeId: string;
  readonly isin: string;
  readonly buySell: 'buy' | 'sell';
  readonly currency: string;
  readonly settlementDate: string;
  readonly amount: string;
  readonly quantity: string;
  readonly price: string;
}

export interface ReconciliationResult {
  readonly id: string;
  readonly status: ReconciliationStatus;
  readonly reason: 'amount-mismatch' | 'quantity-mismatch' | 'amount-and-quantity-mismatch' | null;
  readonly brokerTrade: Trade | null;
  readonly otMurexTrade: Trade | null;
}

export class DuplicateTradeIdError extends Error {
  readonly code = 'DUPLICATE_TRADE_ID';
  constructor() { super('Fixture contains duplicate Trade IDs.'); }
}

function keyOf(trade: Trade): string {
  return JSON.stringify([trade.isin, trade.buySell, trade.currency, trade.settlementDate]);
}

function asciiCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalized(trade: Trade): Trade {
  if (!/^[\x21-\x7e]+$/.test(trade.tradeId)) throw new Error('Trade IDs must be printable ASCII.');
  return { ...trade, amount: normalizeDecimal(trade.amount), quantity: normalizeDecimal(trade.quantity), price: normalizeDecimal(trade.price) };
}

export function validateUniqueTradeIds(trades: readonly Trade[]): void {
  const ids = new Set<string>();
  for (const trade of trades) {
    if (ids.has(trade.tradeId)) throw new DuplicateTradeIdError();
    ids.add(trade.tradeId);
  }
}

export function validateSourceMembership(trades: readonly Trade[], source: TradeSource): void {
  if (trades.some((trade) => trade.source !== source)) throw new Error(`Expected ${source} source trades.`);
}

export function reconcileTrades(brokerInput: readonly Trade[], otMurexInput: readonly Trade[]): readonly ReconciliationResult[] {
  validateSourceMembership(brokerInput, 'broker');
  validateSourceMembership(otMurexInput, 'ot-murex');
  validateUniqueTradeIds(brokerInput);
  validateUniqueTradeIds(otMurexInput);
  const broker = brokerInput.map(normalized);
  const otMurex = otMurexInput.map(normalized);
  const groups = new Map<string, { broker: Trade[]; otMurex: Trade[] }>();
  for (const trade of [...broker, ...otMurex]) {
    const group = groups.get(keyOf(trade)) ?? { broker: [], otMurex: [] };
    (trade.source === 'broker' ? group.broker : group.otMurex).push(trade);
    groups.set(keyOf(trade), group);
  }
  const results: ReconciliationResult[] = [];
  for (const key of [...groups.keys()].sort(asciiCompare)) {
    const group = groups.get(key)!;
    group.broker.sort((left, right) => asciiCompare(left.tradeId, right.tradeId));
    group.otMurex.sort((left, right) => asciiCompare(left.tradeId, right.tradeId));
    const count = Math.max(group.broker.length, group.otMurex.length);
    for (let index = 0; index < count; index += 1) {
      const brokerTrade = group.broker[index] ?? null;
      const otMurexTrade = group.otMurex[index] ?? null;
      const id = JSON.stringify([brokerTrade?.tradeId ?? null, otMurexTrade?.tradeId ?? null]);
      if (!brokerTrade) { results.push({ id, status: 'missing-from-broker', reason: null, brokerTrade, otMurexTrade }); continue; }
      if (!otMurexTrade) { results.push({ id, status: 'missing-from-ot-murex', reason: null, brokerTrade, otMurexTrade }); continue; }
      const amountMatches = decimalEqual(brokerTrade.amount, otMurexTrade.amount);
      const quantityMatches = decimalEqual(brokerTrade.quantity, otMurexTrade.quantity);
      const status: ReconciliationStatus = amountMatches && quantityMatches ? 'matched' : 'unmatched';
      const reason = status === 'matched' ? null : !amountMatches && !quantityMatches ? 'amount-and-quantity-mismatch' : !amountMatches ? 'amount-mismatch' : 'quantity-mismatch';
      results.push({ id, status, reason, brokerTrade, otMurexTrade });
    }
  }
  return results;
}
