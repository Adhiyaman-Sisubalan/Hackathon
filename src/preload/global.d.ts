import type { ReconciliationApi } from '../shared/contracts/preload.js';

declare global { interface Window { reconciliation?: ReconciliationApi; } }

export {};
