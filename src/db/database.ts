/**
 * database.ts
 * WatermelonDB instance + adapter setup.
 * Replaces: DBManager singleton (the Core Data stack).
 *
 * Uses the SQLite adapter (JSI mode for better performance on New Architecture).
 */
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { LevelModel }       from './models/Level';
import { PackageModel }     from './models/Package';
import { GameSettingsModel } from './models/GameSettings';
import { GameLogModel }     from './models/GameLog';

const adapter = new SQLiteAdapter({
  schema,
  // migrations — add migration files here as schema evolves
  migrations: undefined,
  // Use JSI adapter for synchronous reads on the JS thread (New Architecture)
  jsi: true,
  onSetUpError: (error) => {
    console.error('[DB] Setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [
    LevelModel,
    PackageModel,
    GameSettingsModel,
    GameLogModel,
  ],
});

/** Convenience getter — collection shorthand (replaces DBManagerKit.fetchX calls). */
export const levels       = () => database.collections.get<LevelModel>('levels');
export const packages     = () => database.collections.get<PackageModel>('packages');
export const gameSettings = () => database.collections.get<GameSettingsModel>('game_settings');
export const gameLogs     = () => database.collections.get<GameLogModel>('game_logs');
