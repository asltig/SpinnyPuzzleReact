/**
 * schema.ts
 * WatermelonDB table definitions.
 * Mirrors the original Core Data model (5 entities → 4 tables;
 * WaitingRequest is handled by MMKV retry queue instead).
 */
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [

    // ─── Level ──────────────────────────────────────────────────────────────
    // Original: Level CoreData entity + Level+Tools category
    tableSchema({
      name: 'levels',
      columns: [
        { name: 'name',             type: 'string'  },
        { name: 'package_name',     type: 'string',  isIndexed: true },
        { name: 'img_url',          type: 'string'  },
        { name: 'img_path',         type: 'string'  },
        { name: 'layer_img_path',   type: 'string'  },
        { name: 'order',            type: 'number'  },
        { name: 'image_downloaded', type: 'boolean' },
        { name: 'level_completed',  type: 'boolean', isIndexed: true },
        { name: 'is_initial_data',  type: 'boolean' },
      ],
    }),

    // ─── Package ─────────────────────────────────────────────────────────────
    // Original: Package CoreData entity
    tableSchema({
      name: 'packages',
      columns: [
        { name: 'name',                  type: 'string', isIndexed: true },
        { name: 'background_color_dark', type: 'string' },
        { name: 'background_color_light',type: 'string' },
        { name: 'circle_color',          type: 'string' },
        // JSON-encoded string array — one hex color per ring
        // Original: circleRangeColors stored as string, parsed with objectFromString
        { name: 'circle_range_colors',   type: 'string' },
        { name: 'touched_layer_color',   type: 'string' },
        { name: 'is_purchased',          type: 'boolean' },
      ],
    }),

    // ─── GameSettings ────────────────────────────────────────────────────────
    // Original: GameSettings CoreData entity (single row — id = '1')
    tableSchema({
      name: 'game_settings',
      columns: [
        { name: 'hints_count',       type: 'number'  },
        { name: 'app_review_counter',type: 'number'  },
        // Unix timestamp ms. Original: lastSyncDateForServer NSDate
        { name: 'last_sync_date',    type: 'number'  },
        { name: 'levels_loaded_ok',  type: 'boolean' },
        { name: 'packages_loaded_ok',type: 'boolean' },
        { name: 'need_update_db',    type: 'boolean' },
      ],
    }),

    // ─── GameLog ─────────────────────────────────────────────────────────────
    // Original: GameLogs CoreData entity
    // Deduplication: one row per event name; count incremented on each occurrence
    tableSchema({
      name: 'game_logs',
      columns: [
        { name: 'event_name', type: 'string', isIndexed: true },
        { name: 'count',      type: 'number'  },
        // Unix timestamp ms. Original: date NSDate
        { name: 'date',       type: 'number'  },
      ],
    }),

  ],
});
