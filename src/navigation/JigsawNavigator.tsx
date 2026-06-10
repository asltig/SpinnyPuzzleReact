/**
 * JigsawNavigator.tsx
 * Native-stack navigator for the Jigsaw game flow.
 * Screens: JigsawLevels → JigsawGame
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { JigsawStackParamList } from './types';

import JigsawLevelsScreen from '../screens/Jigsaw/JigsawLevelsScreen';
import JigsawGameScreen   from '../screens/Jigsaw/JigsawGameScreen';

const Stack = createNativeStackNavigator<JigsawStackParamList>();

export default function JigsawNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="JigsawLevels" component={JigsawLevelsScreen} options={{ animation: 'none' }} />
      <Stack.Screen
        name="JigsawGame"
        component={JigsawGameScreen}
        options={{ gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}
