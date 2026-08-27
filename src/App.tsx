/**
 * App.tsx
 * Root component. Provides:
 *   - NavigationContainer (react-navigation v7)
 *   - GestureHandlerRootView (react-native-gesture-handler — MUST wrap entire tree)
 *   - SafeAreaProvider
 *   - Push notification foreground handler
 *
 * Replaces: AppDelegate.m bootstrap + rootViewController setup.
 */
import React, { useEffect } from 'react';
import { StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Orientation from 'react-native-orientation-locker';

import RootNavigator      from './navigation/RootNavigator';
import { CircularRevealOverlay } from './components/CircularRevealOverlay';
import { pushService }       from './services/notifications/pushService';
import { soundService }      from './services/audio/soundService';
import { useProgressStore }  from './stores/useProgressStore';
import { getIsMusicOn, getIsSoundOn } from './storage/settingsStorage';

// Hydrate completed-level set and sound flags before the first render.
// useSettingsStore.hydrate() calls uuidv4() which needs a crypto polyfill
// that isn't ready at module load time, so we prime soundService directly
// from MMKV here (synchronous, no crypto) so music/sound state is correct
// before any screen focuses.
useProgressStore.getState().hydrate();
soundService.isMusicOn = getIsMusicOn();
soundService.isSoundOn = getIsSoundOn();

export default function App(): React.JSX.Element {
  // App-wide default: landscape-locked. SpinnyGamePlayScreen (iOS only) is
  // the only screen that dynamically unlocks portrait while it's focused,
  // re-locking to landscape on blur — see its useFocusEffect.
  useEffect(() => {
    Orientation.lockToLandscape();
  }, []);

  // ── Foreground push notification handler ─────────────────────────────────
  useEffect(() => {
    const unsubscribe = pushService.onForegroundMessage(({ title, body }) => {
      // In Step 12 this will show an in-app banner.
      // For now just log so the wiring is confirmed.
      console.log('[push foreground]', title, body);
    });
    return unsubscribe;
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar hidden translucent barStyle="light-content" />
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
        <CircularRevealOverlay />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
