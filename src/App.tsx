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

import RootNavigator      from './navigation/RootNavigator';
import { CircularRevealOverlay } from './components/CircularRevealOverlay';
import { pushService }    from './services/notifications/pushService';
import { soundService }   from './services/audio/soundService';
import { useProgressStore } from './stores/useProgressStore';

// Hydrate completed-level set from MMKV before the first render.
// The store's hydrate() reads the persisted JSON array and populates the
// in-memory Set. Without this call every app restart starts with an empty
// Set and all levels appear incomplete — matching NSUserDefaults always being
// loaded in the ObjC original (no explicit "hydration" step needed there).
useProgressStore.getState().hydrate();

export default function App(): React.JSX.Element {
  // ── Foreground push notification handler ─────────────────────────────────
  useEffect(() => {
    const unsubscribe = pushService.onForegroundMessage(({ title, body }) => {
      // In Step 12 this will show an in-app banner.
      // For now just log so the wiring is confirmed.
      console.log('[push foreground]', title, body);
    });
    return unsubscribe;
  }, []);

  // ── Cleanup audio on unmount ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      soundService.stopAll();
    };
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
