import type { DashboardSummary } from '../../../shared/contracts/dashboard.js';
import type { Migration, SqliteDatabase } from '../../adapters/sqlite/database.js';

export interface SeedFixture { version: string; apply(database: SqliteDatabase): void; }

export class RunsService {
  constructor(private readonly database: SqliteDatabase, private readonly fixture: SeedFixture) {}

  migrate(migrations: readonly Migration[]): void { this.database.migrate(migrations); }

  seed(): void {
    this.database.transaction(() => {
      if (this.database.hasSeed(this.fixture.version)) return;
      this.fixture.apply(this.database);
      this.database.recordSeed(this.fixture.version);
    });
  }

  latestSummary(): DashboardSummary | null { return this.database.latestSummary(); }
}
