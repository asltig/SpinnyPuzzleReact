/**
 * SpinnyNavigator.tsx
 * Native-stack navigator for the Spinny game flow.
 *
 * Screen flow: SpinnyLevels → SpinnyGamePlay → LevelComplete
 *
 * ─── Transition design ────────────────────────────────────────────────────────
 *   SpinnyLevels  → SpinnyGamePlay   slide_from_right  (entering a level)
 *   SpinnyGamePlay → LevelComplete   fade              (win screen emerges softly)
 *   LevelComplete  → SpinnyGamePlay  slide_from_right  (next level, via replace)
 *   LevelComplete  → SpinnyLevels    slide_from_left   (pop-to-top goes back)
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { SpinnyStackParamList } from './types';

import SpinnyLevelsScreen  from '../screens/Spinny/SpinnyLevelsScreen';
import SpinnyGamePlayScreen from '../screens/Spinny/SpinnyGamePlayScreen';
import LevelCompleteScreen  from '../screens/Spinny/LevelCompleteScreen';

const Stack = createNativeStackNavigator<SpinnyStackParamList>();

export default function SpinnyNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown:   false,
        // Default transition for level entry — feels like advancing forward.
        animation:     'slide_from_right',
        gestureEnabled: true,
        // Slightly longer duration than the 350ms default — feels more deliberate.
        animationDuration: 320,
      }}
    >
      <Stack.Screen
        name="SpinnyLevels"
        component={SpinnyLevelsScreen}
        options={{ animation: 'none' }}
      />

      <Stack.Screen
        name="SpinnyGamePlay"
        component={SpinnyGamePlayScreen}
        options={{
          // Keep slide_from_right (inherited). Board builds its own entry fade.
          gestureEnabled: false,  // swipe-back would discard game progress unexpectedly
        }}
      />

      <Stack.Screen
        name="LevelComplete"
        component={LevelCompleteScreen}
        options={{
          // Soft fade-in: win screen surfaces over the board without a hard cut.
          animation:         'fade',
          animationDuration: 350,
          // Prevent swipe-back to gameplay — player must use the buttons.
          gestureEnabled:    false,
        }}
      />
    </Stack.Navigator>
  );
}
