import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MemoryStackParamList } from './types';
import MemoryLevelsScreen from '../screens/Memory/MemoryLevelsScreen';
import MemoryGameScreen   from '../screens/Memory/MemoryGameScreen';

const Stack = createNativeStackNavigator<MemoryStackParamList>();

export default function MemoryNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, orientation: 'landscape' }}
      initialRouteName="MemoryLevels">
      <Stack.Screen name="MemoryLevels" component={MemoryLevelsScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="MemoryGame"   component={MemoryGameScreen} />
    </Stack.Navigator>
  );
}
