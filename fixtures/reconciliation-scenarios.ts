import type { Trade } from '../src/domain/reconciliation/reconciliation.js';

export interface ReconciliationScenario { readonly asOfDate: string; readonly brokerTrades: readonly Trade[]; readonly otMurexTrades: readonly Trade[]; }

const trade = (source: Trade['source'], tradeId: string, isin: string, buySell: Trade['buySell'], currency: string, settlementDate: string, amount: string, quantity: string, price: string): Trade => ({ source, tradeId, isin, buySell, currency, settlementDate, amount, quantity, price });

const scenarios: readonly ReconciliationScenario[] = [
  {
    asOfDate: '2026-08-13',
    brokerTrades: [trade('broker', 'BRK-001', 'US0000000001', 'buy', 'USD', '2026-08-17', '100.00', '10.0', '10')],
    otMurexTrades: [trade('ot-murex', 'OTM-001', 'US0000000001', 'buy', 'USD', '2026-08-17', '100', '10', '10.000')]
  },
  {
    asOfDate: '2026-08-14',
    brokerTrades: [trade('broker', 'BRK-101', 'US0000000002', 'sell', 'USD', '2026-08-18', '200', '20', '10'), trade('broker', 'BRK-102', 'US0000000003', 'buy', 'EUR', '2026-08-18', '30', '3', '10')],
    otMurexTrades: [trade('ot-murex', 'OTM-101', 'US0000000002', 'sell', 'USD', '2026-08-18', '201', '20', '10')]
  },
  {
    asOfDate: '2026-08-15',
    brokerTrades: [
      trade('broker', 'BRK-201', 'US0000000004', 'buy', 'USD', '2026-08-19', '100.00', '10.0', '10'),
      trade('broker', 'BRK-202', 'US0000000005', 'sell', 'EUR', '2026-08-19', '200', '20', '10'),
      trade('broker', 'BRK-A', 'US0000000006', 'buy', 'USD', '2026-08-19', '10', '1', '10'),
      trade('broker', 'BRK-Z', 'US0000000006', 'buy', 'USD', '2026-08-19', '40', '4', '10'),
      trade('broker', 'BRK-203', 'US0000000007', 'sell', 'GBP', '2026-08-19', '50', '5', '10')
    ],
    otMurexTrades: [
      trade('ot-murex', 'OTM-201', 'US0000000004', 'buy', 'USD', '2026-08-19', '100', '10', '10.00'),
      trade('ot-murex', 'OTM-202', 'US0000000005', 'sell', 'EUR', '2026-08-19', '201', '21', '10'),
      trade('ot-murex', 'OTM-A', 'US0000000006', 'buy', 'USD', '2026-08-19', '10', '1', '10'),
      trade('ot-murex', 'OTM-204', 'US0000000008', 'buy', 'JPY', '2026-08-19', '70', '7', '10')
    ]
  }
];

export const reconciliationScenarios = {
  find(asOfDate: string): ReconciliationScenario | undefined { return scenarios.find((scenario) => scenario.asOfDate === asOfDate); },
  supportedDates: scenarios.map((scenario) => scenario.asOfDate)
} as const;
