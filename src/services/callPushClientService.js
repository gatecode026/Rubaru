import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import api from './api';
import { useCallStore } from '../store/callStore';

const INSTALLATION_ID_KEY = '@rubaru_installation_id';
const PROCESSED_CALLS_KEY = '@rubaru_processed_calls';

class CallPushClientService {
  constructor() {
    this.installationId = null;
    this.processedCalls = new Set();
    this.isInitialized = false;
  }

  /**
   * Initialize installation ID and load processed call cache
   */
  async initialize() {
    if (this.isInitialized) return this.installationId;

    try {
      let id = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
      if (!id) {
        id = `inst_${Platform.OS}_${uuidv4()}`;
        await AsyncStorage.setItem(INSTALLATION_ID_KEY, id);
      }
      this.installationId = id;

      const cached = await AsyncStorage.getItem(PROCESSED_CALLS_KEY);
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) {
          this.processedCalls = new Set(list.slice(-50)); // Keep last 50 for deduplication
        }
      }

      this.isInitialized = true;
      return this.installationId;
    } catch (e) {
      console.warn('[CALL PUSH CLIENT] Initialization error:', e.message);
      this.installationId = `inst_${Platform.OS}_${Date.now()}`;
      return this.installationId;
    }
  }

  /**
   * Register push device token with the backend
   */
  async registerDeviceToken(pushToken, voipPushToken = null) {
    if (!pushToken) return { success: false, error: 'NO_PUSH_TOKEN' };
    const installationId = await this.initialize();

    try {
      const payload = {
        installationId,
        platform: Platform.OS.toUpperCase(),
        pushToken,
        voipPushToken,
        provider: Platform.OS === 'ios' ? (voipPushToken ? 'APNS' : 'EXPO') : 'FCM',
        environment: __DEV__ ? 'DEVELOPMENT' : 'PRODUCTION',
        appVersion: '1.0.0',
        deviceMetadata: {
          osVersion: Platform.Version,
          platform: Platform.OS,
        },
      };

      const res = await api.post('/v1/devices/register', payload);
      return { success: true, data: res.data };
    } catch (err) {
      console.warn('[CALL PUSH CLIENT] Device registration failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Revoke device registration on logout
   */
  async revokeDeviceRegistration() {
    try {
      const installationId = await this.initialize();
      await api.delete(`/v1/devices/${installationId}`);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Validate and process an incoming call push payload
   */
  async processIncomingCallPush(pushPayload) {
    if (!pushPayload) return { handled: false, error: 'EMPTY_PAYLOAD' };

    const callId = pushPayload.callId || pushPayload.sessionId;
    if (!callId) return { handled: false, error: 'MISSING_CALL_ID' };

    // 1. Check expiration
    if (pushPayload.expiresAt) {
      const expiresDate = new Date(pushPayload.expiresAt);
      if (!isNaN(expiresDate.getTime()) && Date.now() > expiresDate.getTime()) {
        console.warn(`[CALL PUSH CLIENT] Incoming call ${callId} push arrived expired.`);
        return { handled: false, expired: true };
      }
    }

    // 2. Deduplication check
    if (this.processedCalls.has(callId)) {
      const currentStore = useCallStore.getState();
      if (currentStore.callId === callId) {
        return { handled: true, duplicate: true };
      }
    }

    this.processedCalls.add(callId);
    this._persistProcessedCalls();

    // 3. Dispatch to Zustand callStore
    const callType = (pushPayload.callType || 'AUDIO').toLowerCase() === 'video' ? 'video' : 'audio';
    const caller = pushPayload.caller || {};

    useCallStore.getState().handleIncomingCall({
      callId,
      sessionId: callId,
      callerId: caller.id || caller._id,
      callerName: caller.displayName || caller.name || 'Rubaru User',
      callerAvatar: caller.avatarUrl || '',
      callType,
      communicationType: callType.toUpperCase(),
      ratePerMinute: pushPayload.ratePerMinute || (callType === 'video' ? 10 : 5),
    });

    return { handled: true, callId };
  }

  /**
   * Handle deep-link entry for cold-starts and notification action taps
   * Scheme: rubaru://call/:callId?action=ANSWER|DECLINE
   */
  async parseAndHandleCallDeepLink(url, router) {
    if (!url || !url.includes('rubaru://call')) return { handled: false };

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname || '';
      let callId = urlObj.searchParams.get('callId') || urlObj.searchParams.get('sessionId');

      if (!callId && pathname.includes('call/')) {
        callId = pathname.split('call/')[1]?.split('?')[0];
      }

      const action = (urlObj.searchParams.get('action') || 'OPEN').toUpperCase();

      if (!callId) return { handled: false, error: 'NO_CALL_ID' };

      const token = await AsyncStorage.getItem('userToken');
      if (!token) return { handled: false, error: 'UNAUTHENTICATED' };

      const store = useCallStore.getState();

      if (action === 'ANSWER') {
        const acceptResult = await store.acceptIncomingCall();
        if (acceptResult?.success && router) {
          router.push({
            pathname: '/active-call',
            params: {
              callSessionId: callId,
              contactName: store.peerName || 'User',
              avatarUri: store.peerAvatar || '',
              callType: store.callType || 'audio',
              receiverId: store.peerId,
              isInitiator: 'false',
              ratePerMinute: String(store.ratePerMinute || 5),
            },
          });
        }
        return { handled: true, action: 'ANSWER', callId };
      } else if (action === 'DECLINE') {
        await store.rejectIncomingCall('DECLINED_FROM_NOTIFICATION');
        return { handled: true, action: 'DECLINE', callId };
      } else {
        // Just open active call screen if active or incoming
        if (router && (store.callStatus === 'ACTIVE' || store.callStatus === 'INCOMING' || store.callStatus === 'RINGING')) {
          router.push('/active-call');
        }
        return { handled: true, action: 'OPEN', callId };
      }
    } catch (e) {
      console.warn('[CALL PUSH CLIENT] Deep link handling error:', e.message);
      return { handled: false, error: e.message };
    }
  }

  async _persistProcessedCalls() {
    try {
      const list = Array.from(this.processedCalls).slice(-50);
      await AsyncStorage.setItem(PROCESSED_CALLS_KEY, JSON.stringify(list));
    } catch (e) {}
  }
}

export const callPushClientService = new CallPushClientService();
export default callPushClientService;
