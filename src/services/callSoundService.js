// CallSoundService for Rubaru
// Supports modern expo-audio (Expo SDK 52+) with fallback to expo-av and safe no-op handling

let ExpoAudio = null;
try {
  ExpoAudio = require('expo-audio');
} catch (e) {
  // expo-audio not available
}

let ExpoAV = null;
try {
  ExpoAV = require('expo-av');
} catch (e) {
  // expo-av not available
}

const SOUND_ASSETS = {
  ringback: require('../assets/sounds/ringback.wav'),
  ringtone: require('../assets/sounds/ringtone.wav'),
  connect: require('../assets/sounds/call_connect.wav'),
  end: require('../assets/sounds/call_end.wav'),
  reconnect: require('../assets/sounds/call_reconnect.wav'),
};

class CallSoundService {
  constructor() {
    this.currentPlayer = null;
    this.currentSound = null;
    this.currentKey = null;
    this.isAudioModeConfigured = false;
  }

  async _configureAudioMode() {
    if (this.isAudioModeConfigured) return;
    try {
      if (ExpoAudio && typeof ExpoAudio.setAudioModeAsync === 'function') {
        await ExpoAudio.setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'mixWithOthers',
        });
        this.isAudioModeConfigured = true;
      } else if (ExpoAV && ExpoAV.Audio && typeof ExpoAV.Audio.setAudioModeAsync === 'function') {
        await ExpoAV.Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        this.isAudioModeConfigured = true;
      }
    } catch (e) {
      console.warn('[CALL SOUNDS] Failed to configure audio mode:', e.message);
    }
  }

  async playSound(key, { isLooping = false, volume = 1.0 } = {}) {
    await this._configureAudioMode();

    // If the same looping sound is already active, don't restart
    if (this.currentKey === key && (this.currentPlayer || this.currentSound) && isLooping) {
      return;
    }

    await this.stopAll();

    const asset = SOUND_ASSETS[key];
    if (!asset) {
      console.warn(`[CALL SOUNDS] Unknown sound key: ${key}`);
      return;
    }

    try {
      // 1. Try modern expo-audio
      if (ExpoAudio && typeof ExpoAudio.createAudioPlayer === 'function') {
        const player = ExpoAudio.createAudioPlayer(asset);
        if (player) {
          player.loop = isLooping;
          player.volume = volume;
          player.play();

          this.currentPlayer = player;
          this.currentKey = key;

          if (!isLooping) {
            // Auto release after sound finishes
            setTimeout(() => {
              if (this.currentPlayer === player) {
                try {
                  player.pause();
                  if (typeof player.remove === 'function') player.remove();
                } catch (e) {}
                this.currentPlayer = null;
                this.currentKey = null;
              }
            }, 3000);
          }
          return;
        }
      }

      // 2. Try legacy expo-av
      if (ExpoAV && ExpoAV.Audio && ExpoAV.Audio.Sound) {
        const { sound } = await ExpoAV.Audio.Sound.createAsync(
          asset,
          {
            shouldPlay: true,
            isLooping,
            volume,
          },
          (status) => {
            if (status.didJustFinish && !status.isLooping) {
              sound.unloadAsync().catch(() => {});
              if (this.currentSound === sound) {
                this.currentSound = null;
                this.currentKey = null;
              }
            }
          }
        );

        this.currentSound = sound;
        this.currentKey = key;
        return;
      }
    } catch (err) {
      console.warn(`[CALL SOUNDS] Error playing sound '${key}':`, err.message);
    }
  }

  async playRingback() {
    return this.playSound('ringback', { isLooping: true, volume: 0.85 });
  }

  async playRingtone() {
    return this.playSound('ringtone', { isLooping: true, volume: 1.0 });
  }

  async playConnect() {
    return this.playSound('connect', { isLooping: false, volume: 0.9 });
  }

  async playEnd() {
    return this.playSound('end', { isLooping: false, volume: 0.85 });
  }

  async playReconnect() {
    return this.playSound('reconnect', { isLooping: false, volume: 0.75 });
  }

  async stopAll() {
    if (this.currentPlayer) {
      try {
        const player = this.currentPlayer;
        this.currentPlayer = null;
        this.currentKey = null;
        player.pause();
        if (typeof player.remove === 'function') player.remove();
      } catch (e) {}
    }

    if (this.currentSound) {
      try {
        const sound = this.currentSound;
        this.currentSound = null;
        this.currentKey = null;
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch (e) {}
    }
  }
}

export const callSoundService = new CallSoundService();
export default callSoundService;
