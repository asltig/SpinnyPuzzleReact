/**
 * PatchworkNavigator.tsx
 * Native-stack navigator for the Patchwork game flow.
 * Screens: PatchworkLevels → PatchworkGame
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { PatchworkStackParamList } from './types';

import PatchworkLevelsScreen from '../screens/Patchwork/PatchworkLevelsScreen';
import PatchworkGameScreen   from '../screens/Patchwork/PatchworkGameScreen';

const Stack = createNativeStackNavigator<PatchworkStackParamList>();

export default function PatchworkNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="PatchworkLevels" component={PatchworkLevelsScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="PatchworkGame"   component={PatchworkGameScreen}
        options={{ gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}
