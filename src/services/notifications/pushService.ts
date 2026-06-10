/**
 * pushService.ts
 * FCM push notification registration and foreground handler.
 * Replaces: PushNotificationManager singleton.
 */
import messaging from '@react-native-firebase/messaging';

class PushService {
  /** Request permission and register FCM token. Call at app start. */
  async register(): Promise<string | null> {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) return null;

      const token = await messaging().getToken();
      return token;
    } catch (e) {
      console.warn('[push] register failed:', e);
      return null;
    }
  }

  /** Set up foreground message handler. Returns unsubscribe fn. */
  onForegroundMessage(handler: (notification: { title?: string; body?: string }) => void): () => void {
    try {
      return messaging().onMessage(async (remoteMessage) => {
        handler({
          title: remoteMessage.notification?.title,
          body:  remoteMessage.notification?.body,
        });
      });
    } catch (e) {
      console.warn('[push] Firebase not initialized — skipping foreground handler:', e);
      return () => {};
    }
  }
}

export const pushService = new PushService();
