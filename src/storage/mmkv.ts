/**
 * mmkv.ts
 * Single MMKV instance shared across all storage modules.
 * Replaces NSUserDefaults — same synchronous read/write behavior.
 *
 * Original: [NSUserDefaults standardUserDefaults] + synchronize calls throughout AppManager.m
 */
import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV({ id: 'spinnypuzzle' });
