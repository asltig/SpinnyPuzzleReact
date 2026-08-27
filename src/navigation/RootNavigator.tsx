/**
 * RootNavigator.tsx
 * Top-level navigation tree.
 *
 * Structure:
 *   RootStack
 *     ├─ Splash                (initial route — app bootstrap, replaces itself)
 *     ├─ ChooseGameType        (home screen)
 *     ├─ SpinnyStack           → SpinnyNavigator
 *     ├─ JigsawStack           → JigsawNavigator
 *     ├─ PatchworkStack        → PatchworkNavigator
 *     ├─ WatchAd   (modal)
 *     ├─ IAP       (modal)
 *     ├─ Language  (modal)
 *     └─ RateUs    (modal)
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';

// Sub-navigators
import SpinnyNavigator   from './SpinnyNavigator';
import JigsawNavigator   from './JigsawNavigator';
import PatchworkNavigator from './PatchworkNavigator';
import MemoryNavigator    from './MemoryNavigator';
import OnetNavigator      from './OnetNavigator';

// Screens
import SplashScreen         from '../screens/SplashScreen';
import ChooseGameTypeScreen from '../screens/ChooseGameTypeScreen';
import WatchAdScreen        from '../screens/modals/WatchAdScreen';
import IAPScreen            from '../screens/modals/IAPScreen';
import LanguageScreen       from '../screens/modals/LanguageScreen';
import RateUsScreen         from '../screens/modals/RateUsScreen';

const Root = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator(): React.JSX.Element {
  return (
    <Root.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: 'none',
      }}
    >
      {/* ── Main flow ─────────────────────────────── */}
      <Root.Screen name="Splash"         component={SplashScreen} />
      <Root.Screen name="ChooseGameType" component={ChooseGameTypeScreen} />
      <Root.Screen name="MemoryStack"    component={MemoryNavigator} />
      <Root.Screen name="OnetStack"      component={OnetNavigator} />
      <Root.Screen name="SpinnyStack"    component={SpinnyNavigator} />
      <Root.Screen name="JigsawStack"    component={JigsawNavigator} />
      <Root.Screen name="PatchworkStack" component={PatchworkNavigator} />

      {/* ── Modals ────────────────────────────────── */}
      <Root.Group
        screenOptions={{
          presentation: 'transparentModal',
          animation: 'fade',
        }}
      >
        <Root.Screen name="WatchAd"  component={WatchAdScreen} />
        <Root.Screen name="IAP"      component={IAPScreen} />
        <Root.Screen name="Language" component={LanguageScreen} />
        <Root.Screen name="RateUs"   component={RateUsScreen} />
      </Root.Group>
    </Root.Navigator>
  );
}
