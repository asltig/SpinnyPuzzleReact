/**
 * Level.ts — WatermelonDB model
 * Replaces: Level CoreData entity + Level+Tools category + DBManager level queries.
 */
import { Model, Query } from '@nozbe/watermelondb';
import { field, readonly, date, text } from '@nozbe/watermelondb/decorators';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database';

export class LevelModel extends Model {
  static table = 'levels';

  @text('name')             name!: string;
  @text('package_name')     packageName!: string;
  @text('img_url')          imgUrl!: string;
  @text('img_path')         imgPath!: string;
  @text('layer_img_path')   layerImgPath!: string;
  @field('order')           order!: number;
  @field('image_downloaded') imageDownloaded!: boolean;
  @field('level_completed') levelCompleted!: boolean;
  @field('is_initial_data') isInitialData!: boolean;

  // ─── Queries (replaces DBManager fetch methods) ────────────────────────────

  /** fetchLevelsForPackageName: */
  static forPackage(packageName: string): Query<LevelModel> {
    return database.collections
      .get<LevelModel>('levels')
      .query(
        Q.where('package_name', packageName),
        Q.sortBy('order', Q.asc),
      );
  }

  /** fetchSpinnyCompletedLevelsCount: */
  static async completedCount(): Promise<number> {
    return database.collections
      .get<LevelModel>('levels')
      .query(Q.where('level_completed', true))
      .fetchCount();
  }

  /** fetchNotDownloadedLevels: */
  static notDownloaded(): Query<LevelModel> {
    return database.collections
      .get<LevelModel>('levels')
      .query(Q.where('image_downloaded', false));
  }

  /** fetchLevelByLevelName: */
  static async byName(name: string): Promise<LevelModel | null> {
    const results = await database.collections
      .get<LevelModel>('levels')
      .query(Q.where('name', name))
      .fetch();
    return results[0] ?? null;
  }

  /** fetchLevelForPackageName:levelName: */
  static async byPackageAndName(
    packageName: string,
    levelName: string,
  ): Promise<LevelModel | null> {
    const results = await database.collections
      .get<LevelModel>('levels')
      .query(
        Q.where('package_name', packageName),
        Q.where('name', levelName),
      )
      .fetch();
    return results[0] ?? null;
  }

  /** fetchRandomNotCompletedLevel: */
  static async randomIncomplete(): Promise<LevelModel | null> {
    const all = await database.collections
      .get<LevelModel>('levels')
      .query(Q.where('level_completed', false))
      .fetch();
    if (!all.length) return null;
    return all[Math.floor(Math.random() * all.length)] ?? null;
  }

  /** Seed initial Jigsaw data (createJigsawInitialData in DBManager.m) */
  static async seedJigsawLevels(): Promise<void> {
    await database.write(async () => {
      const col = database.collections.get<LevelModel>('levels');
      for (let i = 1; i <= 8; i++) {
        await col.create((level) => {
          level.name           = `j${i}`;
          level.packageName    = 'Jigsaw';
          level.imgPath        = `j${i}`;
          level.imgUrl         = '';
          level.order          = -i;
          level.imageDownloaded = true;
          level.levelCompleted  = false;
          level.isInitialData   = true;
        });
      }
    });
  }
}
