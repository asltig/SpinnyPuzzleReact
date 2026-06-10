import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OnetStackParamList } from './types';
import OnetLevelsScreen from '../screens/Onet/OnetLevelsScreen';
import OnetGameScreen   from '../screens/Onet/OnetGameScreen';

const Stack = createNativeStackNavigator<OnetStackParamList>();

export default function OnetNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, orientation: 'landscape' }}>
      <Stack.Screen name="OnetLevels" component={OnetLevelsScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="OnetGame"   component={OnetGameScreen} />
    </Stack.Navigator>
  );
}