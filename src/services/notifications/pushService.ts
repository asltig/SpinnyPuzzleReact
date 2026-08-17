/**
 * pushService.ts
 * FCM push notification registration and foreground handler.
 * Replaces: PushNotificationManager singleton.
 *
 * Uses the React Native Firebase v21 modular API to avoid the
 * "namespaced API deprecated" LogBox warning.
 */
import {
  getMessaging,
  requestPermission,
  getToken,
  onMessage,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';

class PushService {
  /** Request permission and register FCM token. Call at app start. */
  async register(): Promise<string | null> {
    try {
      const m = getMessaging();
      const authStatus = await requestPermission(m);
      const enabled =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;

      if (!enabled) return null;

      return await getToken(m);
    } catch (e) {
      console.log('[push] register failed:', e);
      return null;
    }
  }

  /** Set up foreground message handler. Returns unsubscribe fn. */
  onForegroundMessage(handler: (notification: { title?: string; body?: string }) => void): () => void {
    try {
      return onMessage(getMessaging(), async (remoteMessage) => {
        handler({
          title: remoteMessage.notification?.title,
          body:  remoteMessage.notification?.body,
        });
      });
    } catch (e) {
      console.log('[push] Firebase not initialized — skipping foreground handler:', e);
      return () => {};
    }
  }
}

export const pushService = new PushService();
