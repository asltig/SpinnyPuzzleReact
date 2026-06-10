/**
 * patchworkService.ts
 * Mirrors ObjC DBManager.createPatchworkInitialData + fetchDownloadedLevelsWithLocalDataForPackageName:@"RightPosition"
 *
 * Bundled data: 3 hardcoded levels (p3→p2→p1, ordered 0→1→2 matching ObjC array index).
 * Server data:  POST /levels, filter packageName === "RightPosition", cached to MMKV.
 * Merge:        sort by order ASC, assign display index.
 *
 * Piece frame format: [x, y, width, height] in source-image pixel coordinates.
 * Used by PatchworkGameScreen to place each piece on the canvas.
 */

import { storage }            from '../../storage/mmkv';
import { apiClient }          from '../api/apiClient';
import { getApiVersion, setApiVersion } from '../../storage/settingsStorage';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PatchworkPiece {
  name:  string;
  frame: [number, number, number, number];  // [x, y, w, h] in source image pixels
}

export interface PatchworkLevel {
  /** Unique key: "p1" | "p2" | "p3" for bundled; server slug for downloaded. */
  name:          string;
  /** Sort key — bundled: 0/1/2; server: positive integers. */
  order:         number;
  /** Background scene image key (shown before level is completed). */
  bgImgPath:     string;
  /** Full-assembled image key (shown after completion). */
  imgPath:       string;
  isInitialData: boolean;
  /** Piece placement data — empty for server levels until downloaded. */
  pieces:        PatchworkPiece[];
  /** 0-based display position after merging and sorting. */
  index:         number;
}

// ─── MMKV key ─────────────────────────────────────────────────────────────────
const KEY_SERVER = 'patchwork.serverLevels';

// ─── Bundled seed — matches ObjC DBManager.createPatchworkInitialData ────────
// ObjC array order: [p3(0), p2(1), p1(2)]
const BUNDLED: Omit<PatchworkLevel, 'index'>[] = [
  {
    name:          'p3',
    order:          0,
    bgImgPath:     'p3_bg',
    imgPath:       'p3_img',
    isInitialData:  true,
    // g3_7_* — 5 pieces (generic/misc scene)
    pieces: [
      { name: 'g3_7_1', frame: [105,  720, 427, 319] },
      { name: 'g3_7_2', frame: [87,   45,  386, 343] },
      { name: 'g3_7_3', frame: [875, 1072, 469, 318] },
      { name: 'g3_7_4', frame: [1001, 85,  565, 373] },
      { name: 'g3_7_5', frame: [594,  325, 341, 583] },
    ],
  },
  {
    name:          'p2',
    order:          1,
    bgImgPath:     'p2_bg',
    imgPath:       'p2_img',
    isInitialData:  true,
    // g3_2_* — 6 pieces (insects scene)
    pieces: [
      { name: 'g3_2_ant',     frame: [931,  1082, 438, 224] },
      { name: 'g3_2_fly',     frame: [1178,  36,  627, 419] },
      { name: 'g3_2_bee',     frame: [1369, 471,  356, 355] },
      { name: 'g3_2_spider',  frame: [931,  511,  262, 203] },
      { name: 'g3_2_ladybug', frame: [345,  923,  400, 360] },
      { name: 'g3_2_snail',   frame: [1090, 740,  351, 339] },
    ],
  },
  {
    name:          'p1',
    order:          2,
    bgImgPath:     'p1_bg',
    imgPath:       'p1_img',
    isInitialData:  true,
    // g3_11_* — 10 pieces (toys/room scene)
    pieces: [
      { name: 'g3_11_airplane',        frame: [1124, 250,  455, 197] },
      { name: 'g3_11_ball',            frame: [1284, 1109, 252, 242] },
      { name: 'g3_11_car',             frame: [437,  687,  386, 218] },
      { name: 'g3_11_duck',            frame: [697,  1096, 264, 268] },
      { name: 'g3_11_motorcycle',      frame: [1466, 678,  374, 227] },
      { name: 'g3_11_pail-and-shovel', frame: [878,  101,  240, 346] },
      { name: 'g3_11_pyramid',         frame: [905,  615,  234, 290] },
      { name: 'g3_11_robot',           frame: [118,  1022, 204, 342] },
      { name: 'g3_11_tower',           frame: [1002, 1050, 248, 310] },
      { name: 'g3_11_train',           frame: [100,  165,  409, 275] },
    ],
  },
];

// ─── MMKV helpers ─────────────────────────────────────────────────────────────
function loadServer(): Omit<PatchworkLevel, 'index'>[] {
  const raw = storage.getString(KEY_SERVER);
  if (!raw) return [];
  try { return JSON.parse(raw) as Omit<PatchworkLevel, 'index'>[]; } catch { return []; }
}
function saveServer(levels: Omit<PatchworkLevel, 'index'>[]): void {
  storage.set(KEY_SERVER, JSON.stringify(levels));
}

// ─── Merge + sort (mirrors CoreData sort by "order" ASC) ─────────────────────
function merge(server: Omit<PatchworkLevel, 'index'>[]): PatchworkLevel[] {
  const all = [...BUNDLED, ...server];
  all.sort((a, b) => a.order - b.order);
  return all.map((l, i) => ({ ...l, index: i }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Return cached/bundled levels synchronously. */
export function getPatchworkLevels(): PatchworkLevel[] {
  return merge(loadServer());
}

/**
 * Fetch fresh RightPosition levels from server.
 * Server confirmed live at https://bluger.ch/puzzle/api/ (2026-06-04):
 *  - POST /levels with form-encoded body { version }
 *  - Returns { version, data: [...] }
 *  - RightPosition levels have field "description" = JSON string with piece positions
 *  - Image paths are relative: "uploads/levels/l6_bg_image.jpg"
 *    Full URL = IMG_BASE_URL + path (not needed for levels screen — stored as-is)
 */
export async function syncPatchworkLevels(): Promise<PatchworkLevel[]> {
  try {
    const res = await apiClient.post<{ version: string; data: unknown[] }>(
      '/levels',
      { version: getApiVersion() },
    );
    const { version, data } = res.data;
    if (version) setApiVersion(version);
    if (Array.isArray(data) && data.length > 0) {
      const raw = (data as Record<string, unknown>[]).filter(
        (d) => String(d['packageName'] ?? '') === 'RightPosition',
      );
      const server: Omit<PatchworkLevel, 'index'>[] = raw.map((d) => {
        // Server "description" field = JSON string of pieces:
        // '[{"name":"g3_6_dinosaur_1","frame":[146,966,530,317]},...]'
        let pieces: PatchworkPiece[] = [];
        try {
          const desc = String(d['description'] ?? '');
          if (desc) pieces = JSON.parse(desc) as PatchworkPiece[];
        } catch { /* malformed description — keep empty */ }

        return {
          name:          String(d['name']             ?? ''),
          order:         Number(d['order']            ?? 99),
          bgImgPath:     String(d['background_image'] ?? ''),  // relative path
          imgPath:       String(d['image']            ?? ''),  // relative path
          isInitialData: false,
          pieces,
        };
      });
      saveServer(server);
    }
  } catch { /* offline — use cached data */ }
  return getPatchworkLevels();
}
