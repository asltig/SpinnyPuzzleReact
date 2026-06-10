/**
 * syncService.ts
 * Level and package sync from the server.
 * Replaces: AppManager.sendSyncDataRequestForVersionWithCompletion
 *           + sendFetchLevelsRequest + sendFetchPackagesRequest.
 *
 * Sync cadence: SERVER_SYNC_DAYS (5) days — matches original.
 */
import { apiClient } from './apiClient';
import { database } from '../../db/database';
import { LevelModel }       from '../../db/models/Level';
import { PackageModel }     from '../../db/models/Package';
import { GameSettingsModel } from '../../db/models/GameSettings';
import { SERVER_SYNC_DAYS }  from '../../constants/gameConstants';
import { getApiVersion, setApiVersion } from '../../storage/settingsStorage';

// ─── API method paths — match original method_get_levels / method_get_packages ──
const METHOD_GET_LEVELS   = '/levels';
const METHOD_GET_PACKAGES = '/packages';

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Run a full sync if enough time has elapsed, otherwise just download pending images.
 * Replaces: sendSyncDataRequestForVersionWithCompletion:
 */
export async function syncIfNeeded(): Promise<void> {
  const settings = await GameSettingsModel.getOrCreate();
  if (settings.canSync) {
    await syncPackages();
    await syncLevels();
    await database.write(() =>
      settings.update((s) => {
        s.lastSyncDate = Date.now();
      }),
    );
  }
}

/**
 * Fetch and upsert all packages from the server.
 * Replaces: sendFetchPackagesRequestForVersionWithCompletion:
 */
async function syncPackages(): Promise<void> {
  try {
    const response = await apiClient.post<{ data: unknown[] }>(METHOD_GET_PACKAGES, {
      version: getApiVersion(),
    });
    const data = response.data?.data ?? [];
    if (data.length > 0) await upsertPackages(data);
  } catch (e) {
    console.warn('[sync] packages failed:', e);
  }
}

/**
 * Fetch and upsert all levels from the server.
 * Replaces: sendFetchLevelsRequestForVersionWithCompletion:
 */
async function syncLevels(): Promise<void> {
  try {
    const response = await apiClient.post<{ version: string; data: unknown[] }>(
      METHOD_GET_LEVELS,
      { version: getApiVersion() },
    );
    const { version, data } = response.data;
    if (version) setApiVersion(version);
    if (data?.length > 0) await upsertLevels(data);
  } catch (e) {
    console.warn('[sync] levels failed:', e);
  }
}

// ─────────────────────────────────────────────
// DB write helpers
// ─────────────────────────────────────────────

async function upsertPackages(rawPackages: unknown[]): Promise<void> {
  await database.write(async () => {
    const col = database.collections.get<PackageModel>('packages');
    for (const raw of rawPackages) {
      const data = raw as Record<string, unknown>;
      const existing = await PackageModel.byName(String(data['name'] ?? ''));
      if (existing) {
        await existing.update((p) => applyPackageData(p, data));
      } else {
        await col.create((p) => applyPackageData(p, data));
      }
    }
  });
}

async function upsertLevels(rawLevels: unknown[]): Promise<void> {
  await database.write(async () => {
    const col = database.collections.get<LevelModel>('levels');
    for (const raw of rawLevels) {
      const data = raw as Record<string, unknown>;
      const existing = await LevelModel.byName(String(data['name'] ?? ''));
      if (existing) {
        await existing.update((l) => applyLevelData(l, data));
      } else {
        await col.create((l) => applyLevelData(l, data));
      }
    }
  });
}

// ─── Field mappers — match ObjC DBManager.savePackage: / saveLevel: exactly ───

function applyPackageData(pkg: PackageModel, data: Record<string, unknown>): void {
  pkg.name                  = String(data['name']                    ?? '');
  pkg.backgroundColorDark   = String(data['background_color_dark']   ?? '#000000');
  pkg.backgroundColorLight  = String(data['background_color_light']  ?? '#ffffff');
  pkg.circleColor           = String(data['circle_color']            ?? '#ffffff');
  pkg.circleRangeColors     = JSON.stringify(data['circle_range_colors'] ?? []);
  // API sends both spellings; prefer snake_case (ObjC line 212 overrides line 210)
  pkg.touchedLayerColor     = String(
    data['touched_layer_color'] ?? data['touchedLayerColor'] ?? '#ffffff',
  );
  pkg.isPurchased           = false;
}

function applyLevelData(level: LevelModel, data: Record<string, unknown>): void {
  level.name        = String(data['name']        ?? '');
  // Server returns camelCase packageName (confirmed by live API 2026-06-04)
  level.packageName = String(data['packageName'] ?? data['package_name'] ?? '');
  // Server field: "image" (relative path like "uploads/levels/...")
  level.imgPath     = String(data['image']             ?? data['img_path']   ?? '');
  // Server field: "background_image" for patchwork bg
  level.layerImgPath = String(data['background_image'] ?? data['layer_img_path'] ?? '');
  level.imgUrl      = String(data['img_url']     ?? '');
  level.order       = Number(data['order']       ?? 0);
  // Jigsaw / Dinosaurs / Jungle / RightPosition images must be downloaded
  const needsDownload = ['Jigsaw', 'Dinosaurs', 'Jungle', 'RightPosition'].includes(
    level.packageName,
  );
  level.imageDownloaded = !needsDownload;
  level.levelCompleted  = false;
  level.isInitialData   = false;
}
