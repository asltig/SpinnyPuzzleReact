/**
 * SpinnyPuzzle — React Native entry point
 * Registers the root App component with the native runtime.
 *
 * react-native-gesture-handler must be imported first (before any other RN imports)
 * so its touch event interceptors are registered before React Navigation's.
 * https://docs.swmansion.com/react-native-gesture-handler/docs/installation
 */
import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
