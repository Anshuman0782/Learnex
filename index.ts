// Must load first: background notification work (reply from notification,
// stop call ringing) runs even when the app is closed.
import './src/realtime/backgroundNotifications';
import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
