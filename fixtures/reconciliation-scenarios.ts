import type { BrokerContact, Trade } from '../src/domain/reconciliation/reconciliation.js';

export interface ReconciliationScenario { readonly asOfDate: string; readonly brokerTrades: readonly Trade[]; readonly otMurexTrades: readonly Trade[]; }

const atlas: BrokerContact = { name: 'Atlas Securities', recipient: 'operations@atlas-securities.example' };
const beacon: BrokerContact = { name: 'Beacon Markets', recipient: 'operations@beacon-markets.example' };
const trade = (source: Trade['source'], tradeId: string, isin: string, buySell: Trade['buySell'], currency: string, settlementDate: string, amount: string, quantity: string, price: string, brokerContact?: BrokerContact): Trade => ({ source, tradeId, isin, buySell, currency, settlementDate, amount, quantity, price, ...(brokerContact ? { brokerContact } : {}) });

const cardinal: BrokerContact = { name: 'Cardinal Partners', recipient: 'operations@cardinal-partners.example' };

/**
 * A demo-scale trading day. The three dates below are deliberately minimal because the test
 * suite pins their exact totals; this one carries enough volume and variety for the grid,
 * filters, review gate, and broker drafts to be worth showing.
 */
interface DemoPosition {
  readonly ref: number;
  readonly isin: string;
  readonly buySell: Trade['buySell'];
  readonly currency: string;
  readonly settlementDate: string;
  readonly quantity: string;
  readonly price: string;
  readonly amount: string;
  readonly contact: BrokerContact;
  /** OT/MUREX values when the two systems disagree. */
  readonly otAmount?: string;
  readonly otQuantity?: string;
  /** Only one system booked the trade. */
  readonly only?: 'broker' | 'ot-murex';
}

type DemoVariance = Partial<Pick<DemoPosition, 'otAmount' | 'otQuantity' | 'only'>>;

const position = (ref: number, isin: string, buySell: Trade['buySell'], currency: string, settlementDate: string, quantity: string, price: string, amount: string, contact: BrokerContact, variance: DemoVariance = {}): DemoPosition =>
  ({ ref, isin, buySell, currency, settlementDate, quantity, price, amount, contact, ...variance });

function demoDay(asOfDate: string, positions: readonly DemoPosition[]): ReconciliationScenario {
  const brokerTrades: Trade[] = [];
  const otMurexTrades: Trade[] = [];
  for (const entry of positions) {
    if (entry.only !== 'ot-murex') brokerTrades.push(trade('broker', `BRK-${entry.ref}`, entry.isin, entry.buySell, entry.currency, entry.settlementDate, entry.amount, entry.quantity, entry.price, entry.contact));
    if (entry.only !== 'broker') otMurexTrades.push(trade('ot-murex', `OTM-${entry.ref}`, entry.isin, entry.buySell, entry.currency, entry.settlementDate, entry.otAmount ?? entry.amount, entry.otQuantity ?? entry.quantity, entry.price));
  }
  return { asOfDate, brokerTrades, otMurexTrades };
}

const d19 = '2026-08-19';
const d20 = '2026-08-20';
const d21 = '2026-08-21';

// 32 positions: 24 matched, 4 unmatched, 2 missing from broker, 2 missing from OT/MUREX.
// The resulting 25.0% unresolved rate clears the seeded 11.0% baseline, so the anomaly warning shows.
const demoPositions: readonly DemoPosition[] = [
  position(301, 'US0378331005', 'buy', 'USD', d19, '12500', '196.00', '2450000.00', atlas),
  position(302, 'US5949181045', 'sell', 'USD', d19, '4250', '406.20', '1726350.00', atlas),
  position(303, 'US02079K3059', 'buy', 'USD', d20, '3200', '178.50', '571200.00', beacon),
  position(304, 'US0231351067', 'sell', 'USD', d19, '5600', '184.75', '1034600.00', atlas),
  position(305, 'US88160R1014', 'buy', 'USD', d21, '1800', '242.30', '436140.00', beacon, { otAmount: '436410.00' }),
  position(306, 'US67066G1040', 'sell', 'USD', d19, '2400', '118.65', '284760.00', cardinal),
  position(307, 'US30303M1027', 'buy', 'USD', d20, '1500', '512.40', '768600.00', atlas),
  position(308, 'US46625H1005', 'sell', 'USD', d19, '7000', '208.15', '1457050.00', beacon),
  position(309, 'US1912161007', 'buy', 'USD', d20, '9000', '71.20', '640800.00', cardinal),
  position(310, 'US4781601046', 'sell', 'USD', d21, '3300', '152.90', '504570.00', atlas, { otQuantity: '3800' }),
  position(311, 'GB00B03MLX29', 'buy', 'GBP', d19, '15000', '28.45', '426750.00', beacon),
  position(312, 'GB0009252882', 'sell', 'GBP', d20, '8200', '15.62', '128084.00', cardinal),
  position(313, 'GB00BH4HKS39', 'buy', 'GBP', d19, '42000', '0.74', '31080.00', atlas),
  position(314, 'GB0007980591', 'sell', 'GBP', d21, '26000', '4.38', '113880.00', beacon, { only: 'ot-murex' }),
  position(315, 'FR0000120271', 'buy', 'EUR', d19, '6400', '58.90', '376960.00', cardinal),
  position(316, 'FR0000120644', 'sell', 'EUR', d20, '5100', '62.35', '317985.00', atlas),
  position(317, 'FR0000121014', 'buy', 'EUR', d19, '900', '645.00', '580500.00', beacon, { otAmount: '612750.00', otQuantity: '950' }),
  position(318, 'DE0007236101', 'sell', 'EUR', d21, '2700', '176.40', '476280.00', cardinal),
  position(319, 'DE0005190003', 'buy', 'EUR', d19, '4400', '82.15', '361460.00', atlas),
  position(320, 'DE000BASF111', 'sell', 'EUR', d20, '8800', '43.20', '380160.00', beacon),
  position(321, 'NL0011821202', 'buy', 'EUR', d19, '21000', '16.85', '353850.00', cardinal),
  position(322, 'NL0000235190', 'sell', 'EUR', d21, '2100', '148.60', '312060.00', atlas, { only: 'broker' }),
  position(323, 'CH0038863350', 'buy', 'CHF', d19, '3600', '91.40', '329040.00', beacon),
  position(324, 'CH0012032048', 'sell', 'CHF', d20, '1400', '248.75', '348250.00', cardinal),
  position(325, 'JP3633400001', 'buy', 'JPY', d19, '18000', '2815.00', '50670000.00', atlas),
  position(326, 'JP3435000009', 'sell', 'JPY', d21, '5200', '13240.00', '68848000.00', beacon, { otAmount: '68884000.00' }),
  position(327, 'XS0971721963', 'buy', 'USD', d20, '1200', '920.00', '1104000.00', cardinal),
  position(328, 'XS1082022778', 'sell', 'USD', d19, '800', '1015.50', '812400.00', atlas),
  position(329, 'IT0003128367', 'buy', 'EUR', d20, '34000', '6.92', '235280.00', beacon),
  position(330, 'ES0113900J37', 'sell', 'EUR', d19, '48000', '4.56', '218880.00', cardinal, { only: 'ot-murex' }),
  position(331, 'SE0000108656', 'buy', 'SEK', d21, '26000', '78.40', '2038400.00', atlas),
  position(332, 'DK0060534915', 'sell', 'DKK', d19, '3100', '655.20', '2031120.00', beacon, { only: 'broker' })
];

const scenarios: readonly ReconciliationScenario[] = [
  {
    asOfDate: '2026-08-13',
    brokerTrades: [trade('broker', 'BRK-001', 'US0000000001', 'buy', 'USD', '2026-08-17', '100.00', '10.0', '10', atlas)],
    otMurexTrades: [trade('ot-murex', 'OTM-001', 'US0000000001', 'buy', 'USD', '2026-08-17', '100', '10', '10.000')]
  },
  {
    asOfDate: '2026-08-14',
    brokerTrades: [trade('broker', 'BRK-101', 'US0000000002', 'sell', 'USD', '2026-08-18', '200', '20', '10', atlas), trade('broker', 'BRK-102', 'US0000000003', 'buy', 'EUR', '2026-08-18', '30', '3', '10', beacon)],
    otMurexTrades: [trade('ot-murex', 'OTM-101', 'US0000000002', 'sell', 'USD', '2026-08-18', '201', '20', '10')]
  },
  {
    asOfDate: '2026-08-15',
    brokerTrades: [
      trade('broker', 'BRK-201', 'US0000000004', 'buy', 'USD', '2026-08-19', '100.00', '10.0', '10', atlas),
      trade('broker', 'BRK-202', 'US0000000005', 'sell', 'EUR', '2026-08-19', '200', '20', '10', atlas),
      trade('broker', 'BRK-A', 'US0000000006', 'buy', 'USD', '2026-08-19', '10', '1', '10', beacon),
      trade('broker', 'BRK-Z', 'US0000000006', 'buy', 'USD', '2026-08-19', '40', '4', '10', beacon),
      trade('broker', 'BRK-203', 'US0000000007', 'sell', 'GBP', '2026-08-19', '50', '5', '10', atlas)
    ],
    otMurexTrades: [
      trade('ot-murex', 'OTM-201', 'US0000000004', 'buy', 'USD', '2026-08-19', '100', '10', '10.00'),
      trade('ot-murex', 'OTM-202', 'US0000000005', 'sell', 'EUR', '2026-08-19', '201', '21', '10'),
      trade('ot-murex', 'OTM-A', 'US0000000006', 'buy', 'USD', '2026-08-19', '10', '1', '10'),
      trade('ot-murex', 'OTM-203', 'US0000000007', 'sell', 'GBP', '2026-08-19', '55', '5', '10'),
      trade('ot-murex', 'OTM-204', 'US0000000008', 'buy', 'JPY', '2026-08-19', '70', '7', '10')
    ]
  },
  demoDay('2026-08-17', demoPositions)
];

export const reconciliationScenarios = {
  find(asOfDate: string): ReconciliationScenario | undefined { return scenarios.find((scenario) => scenario.asOfDate === asOfDate); },
  supportedDates: scenarios.map((scenario) => scenario.asOfDate)
} as const;
