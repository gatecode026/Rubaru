import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform, PermissionsAndroid } from 'react-native';
import api from './api';
import { useCallStore } from '../store/callStore';
import paidCommunicationClient from './paidCommunicationService';

const generateInstallationId = () => `inst_${Platform.OS}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

const INSTALLATION_ID_KEY = '@rubaru_installation_id';
const PROCESSED_CALLS_KEY = '@rubaru_processed_calls';

/**
 * Enterprise Call Push Client Service (R4-C15)
 * Coordinates FCM/APNs VoIP payloads, deep-linking, deduplication, and authoritative server sync
 */
class CallPushClientService {
  constructor() {
    this.installationId = null;
    this.processedCalls = new Set();
    this.isInitialized = false;
    this.isProcessingDeepLink = false;
  }

  /**
   * Initialize installation ID and load processed call cache
   */
  async initialize() {
    if (this.isInitialized) return this.installationId;

    try {
      let id = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
      if (!id) {
        id = generateInstallationId();
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
   * Request Android 13+ POST_NOTIFICATIONS runtime permission
   */
  async requestNotificationPermissions() {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: 'Call Notifications',
            message: 'Rubaru needs notification access so you never miss incoming audio and video calls.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (e) {
        console.warn('[CALL PUSH CLIENT] Notification permission request error:', e.message);
        return false;
      }
    }
    return true;
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
   * Mark a call as processed in the deduplication cache
   */
  markCallProcessed(callId) {
    if (!callId) return;
    this.processedCalls.add(callId);
    this._persistProcessedCalls();
  }

  /**
   * Check if a call has already been processed
   */
  isCallProcessed(callId) {
    return Boolean(callId && this.processedCalls.has(callId));
  }

  /**
   * Validate and process an incoming call push payload
   */
  async processIncomingCallPush(pushPayload) {
    if (!pushPayload) return { handled: false, error: 'EMPTY_PAYLOAD' };

    const callId = pushPayload.callId || pushPayload.sessionId;
    if (!callId) return { handled: false, error: 'MISSING_CALL_ID' };

    // 1. Expiration check: reject expired push notifications
    const expiresAt = pushPayload.expiresAt || pushPayload.requestExpiresAt;
    if (expiresAt) {
      const expiresDate = new Date(expiresAt);
      if (!isNaN(expiresDate.getTime()) && Date.now() > expiresDate.getTime()) {
        console.warn(`[CALL PUSH CLIENT] Incoming call ${callId} push arrived expired.`);
        return { handled: false, expired: true };
      }
    }

    // 2. Deterministic Deduplication: check if already in store or cache
    const currentStore = useCallStore.getState();
    if (currentStore.callId === callId && currentStore.callStatus !== 'IDLE' && currentStore.callStatus !== 'ENDED') {
      this.markCallProcessed(callId);
      return { handled: true, duplicate: true };
    }

    if (this.processedCalls.has(callId)) {
      return { handled: true, duplicate: true };
    }

    this.markCallProcessed(callId);

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
      expiresAt,
    });

    return { handled: true, callId };
  }

  /**
   * Process incoming call cancellation / dismissal push from server
   */
  processCallCancellationPush(payload) {
    const callId = payload?.sessionId || payload?.callId;
    if (!callId) return;
    const currentStore = useCallStore.getState();
    if (currentStore.callId === callId || currentStore.callStatus === 'INCOMING') {
      currentStore.handleCallEnded({
        callId,
        sessionId: callId,
        status: 'CANCELLED',
        endReason: payload?.reason || 'CALL_CANCELLED',
      });
    }
  }

  /**
   * Handle deep-link entry for cold-starts and notification action taps
   * Scheme: rubaru://call/:callId?action=ANSWER|DECLINE|OPEN
   */
  async parseAndHandleCallDeepLink(url, router) {
    if (!url || !url.includes('rubaru://call')) return { handled: false };
    if (this.isProcessingDeepLink) {
      console.warn('[CALL PUSH CLIENT] Deep link processing already in progress, ignoring duplicate tap');
      return { handled: false, error: 'ACTION_IN_PROGRESS' };
    }

    this.isProcessingDeepLink = true;

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname || '';
      let callId = urlObj.searchParams.get('callId') || urlObj.searchParams.get('sessionId');

      if (!callId) {
        const match = url.match(/call\/([a-zA-Z0-9_\-]+)/);
        if (match) {
          callId = match[1];
        } else if (pathname && pathname !== '/') {
          callId = pathname.replace(/^\/+/, '').split('/')[0]?.split('?')[0];
        }
      }

      const action = (urlObj.searchParams.get('action') || 'OPEN').toUpperCase();

      if (!callId) {
        this.isProcessingDeepLink = false;
        return { handled: false, error: 'NO_CALL_ID' };
      }

      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        this.isProcessingDeepLink = false;
        return { handled: false, error: 'UNAUTHENTICATED' };
      }

      const store = useCallStore.getState();

      // 1. If call is already active for this callId
      if (store.callId === callId && (store.callStatus === 'ACTIVE' || store.callStatus === 'CONNECTING')) {
        this.isProcessingDeepLink = false;
        if (action === 'DECLINE') {
          await store.hangupCall('USER_HUNG_UP');
          return { handled: true, action: 'DECLINE', callId };
        }
        if (router) {
          router.push('/active-call');
        }
        return { handled: true, action: 'ALREADY_ACTIVE', callId };
      }

      // 2. Authoritative Server State Synchronization
      // Query backend to verify call is actually pending/ringing
      let session = null;
      try {
        session = await paidCommunicationClient.getSession(callId);
      } catch (err) {
        console.warn('[CALL PUSH CLIENT] Failed to fetch session status:', err.message);
      }

      // 3. Stale Notification Handling
      const isTerminal = session && [
        'ENDED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REJECTED', 'MISSED', 'EXPIRED', 'DECLINED'
      ].includes(session.status);

      if (isTerminal) {
        console.log(`[CALL PUSH CLIENT] Stale notification tapped for terminal call ${callId} (${session.status}).`);
        store.resetToIdle();
        this.isProcessingDeepLink = false;
        return { handled: true, stale: true, callId, status: session.status };
      }

      // 4. Pending / Ringing Call Handling
      if (session && ['PENDING', 'INITIATED', 'RINGING'].includes(session.status)) {
        const caller = session.initiator || session.caller || {};
        const callType = (session.communicationType || session.callType || 'AUDIO').toLowerCase() === 'video' ? 'video' : 'audio';

        store.handleIncomingCall({
          callId,
          sessionId: callId,
          callerId: caller._id || caller.id,
          callerName: caller.displayName || caller.name || 'Rubaru User',
          callerAvatar: caller.avatarUrl || caller.avatarUri || '',
          callType,
          communicationType: callType.toUpperCase(),
          ratePerMinute: session.ratePerMinuteSnapshot || session.ratePerMinute || (callType === 'video' ? 10 : 5),
          expiresAt: session.requestExpiresAt || session.expiresAt,
        });

        if (action === 'ANSWER') {
          const acceptResult = await store.acceptIncomingCall();
          this.isProcessingDeepLink = false;
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
          this.isProcessingDeepLink = false;
          return { handled: true, action: 'DECLINE', callId };
        } else {
          this.isProcessingDeepLink = false;
          return { handled: true, action: 'OPEN', callId };
        }
      }

      // 5. Active Call on Server
      if (session && (session.status === 'ACTIVE' || session.status === 'CONNECTING')) {
        store.handleSync({ hasActiveCall: true, call: session });
        if (router) {
          router.push('/active-call');
        }
        this.isProcessingDeepLink = false;
        return { handled: true, action: 'ACTIVE', callId };
      }

      this.isProcessingDeepLink = false;
      return { handled: false, error: 'UNKNOWN_SESSION_STATE' };
    } catch (e) {
      this.isProcessingDeepLink = false;
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
