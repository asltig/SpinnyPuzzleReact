/**
 * GameSettings.ts — WatermelonDB model
 * Single-row table (id = '1'). Replaces GameSettings CoreData entity.
 */
import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';
import { database } from '../database';
import { HINTS_DEFAULT_COUNT, SERVER_SYNC_DAYS } from '../../constants/gameConstants';

export class GameSettingsModel extends Model {
  static table = 'game_settings';

  @field('hints_count')        hintsCount!: number;
  @field('app_review_counter') appReviewCounter!: number;
  @field('last_sync_date')     lastSyncDate!: number;
  @field('levels_loaded_ok')   levelsLoadedOk!: boolean;
  @field('packages_loaded_ok') packagesLoadedOk!: boolean;
  @field('need_update_db')     needUpdateDB!: boolean;

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** canSyncDataFromServer: — checks if SERVER_SYNC_DAYS have elapsed */
  get canSync(): boolean {
    if (!this.lastSyncDate) return true;
    const daysSince = (Date.now() - this.lastSyncDate) / (1000 * 60 * 60 * 24);
    return daysSince >= SERVER_SYNC_DAYS;
  }

  /** Fetch or create the singleton settings row. */
  static async getOrCreate(): Promise<GameSettingsModel> {
    const col = database.collections.get<GameSettingsModel>('game_settings');
    const all = await col.query().fetch();
    if (all.length > 0) return all[0]!;

    return database.write(() =>
      col.create((s) => {
        s.hintsCount        = HINTS_DEFAULT_COUNT;
        s.appReviewCounter  = 0;
        s.lastSyncDate      = 0;
        s.levelsLoadedOk    = false;
        s.packagesLoadedOk  = false;
        s.needUpdateDB      = false;
      }),
    );
  }
}
