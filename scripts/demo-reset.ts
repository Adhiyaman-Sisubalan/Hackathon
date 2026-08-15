import { rmSync } from 'node:fs';
import { join } from 'node:path';

const userData = process.env.RECONCILIATION_USER_DATA;
if (!userData) throw new Error('Set RECONCILIATION_USER_DATA to the demo user-data directory before resetting it.');
rmSync(join(userData, 'reconciliation.sqlite'), { force: true });
