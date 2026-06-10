/**
 * GameLog.ts — WatermelonDB model
 * Deduplicated analytics event log. Replaces GameLogs CoreData entity.
 * Original: one row per event name; count increments on each occurrence.
 */
import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database';

export class GameLogModel extends Model {
  static table = 'game_logs';

  @text('event_name') eventName!: string;
  @field('count')     count!: number;
  @field('date')      date!: number;

  // ─── Query helpers ────────────────────────────────────────────────────────

  /** fetchLogForLogName: */
  static async byEventName(name: string): Promise<GameLogModel | null> {
    const results = await database.collections
      .get<GameLogModel>('game_logs')
      .query(Q.where('event_name', name))
      .fetch();
    return results[0] ?? null;
  }

  /**
   * Upsert an event: increment count if exists, create if not.
   * Replaces logEventDBForEntityName: in AppManager.m
   * Returns the final count (used to suffix "EventName xN" for Firebase).
   */
  static async upsert(eventName: string): Promise<number> {
    const col = database.collections.get<GameLogModel>('game_logs');
    const existing = await GameLogModel.byEventName(eventName);

    if (existing) {
      await database.write(() =>
        existing.update((log) => {
          log.count += 1;
          log.date   = Date.now();
        }),
      );
      return existing.count + 1;
    }

    await database.write(() =>
      col.create((log) => {
        log.eventName = eventName;
        log.count     = 1;
        log.date      = Date.now();
      }),
    );
    return 1;
  }
}
