/**
 * Package.ts — WatermelonDB model
 * Replaces: Package CoreData entity + DBManager package queries.
 */
import { Model, Query } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database';

export class PackageModel extends Model {
  static table = 'packages';

  @text('name')                   name!: string;
  @text('background_color_dark')  backgroundColorDark!: string;
  @text('background_color_light') backgroundColorLight!: string;
  @text('circle_color')           circleColor!: string;
  /** JSON-encoded string array — parse with colorUtils.parseCircleColors */
  @text('circle_range_colors')    circleRangeColors!: string;
  @text('touched_layer_color')    touchedLayerColor!: string;
  @field('is_purchased')          isPurchased!: boolean;

  // ─── Queries (replaces DBManager package fetch methods) ───────────────────

  /** fetchAllPackages: */
  static all(): Query<PackageModel> {
    return database.collections.get<PackageModel>('packages').query();
  }

  /** fetchPackageByPackageName: */
  static async byName(name: string): Promise<PackageModel | null> {
    const results = await database.collections
      .get<PackageModel>('packages')
      .query(Q.where('name', name))
      .fetch();
    return results[0] ?? null;
  }

  /** fetchSpinnyPackages: — packages whose levels use the ring mechanic */
  static spinny(): Query<PackageModel> {
    return database.collections
      .get<PackageModel>('packages')
      .query(Q.where('name', Q.notEq('Jigsaw')), Q.where('name', Q.notEq('Patchwork')));
  }
}
