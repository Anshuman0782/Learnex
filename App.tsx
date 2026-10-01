import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/context/AppContext';
import { CallProvider } from './src/realtime/CallContext';
import { CallModal } from './src/components/common/CallModal';
import { NotificationRouter } from './src/components/common/NotificationRouter';
import { AppNavigator } from './src/navigation/AppNavigator';
import * as NativeSplash from 'expo-splash-screen';

// Keep the native logo splash up until the animated splash takes over.
void NativeSplash.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <CallProvider>
          <StatusBar style="dark" />
          <AppNavigator />
          {/* Global call UI — appears for outgoing and incoming calls anywhere in the app */}
          <CallModal />
          {/* Opens what a notification is about (push taps + bell taps) */}
          <NotificationRouter />
        </CallProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
