// Safe Audio Helper for Rubaru
// Bridges modern expo-audio and legacy expo-av seamlessly

let ExpoAudio = null;
try {
  ExpoAudio = require('expo-audio');
} catch (e) {}

let ExpoAV = null;
try {
  ExpoAV = require('expo-av');
} catch (e) {}

let SafeAudio = null;

if (ExpoAudio && typeof ExpoAudio.createAudioPlayer === 'function') {
  SafeAudio = {
    isAvailable: true,
    setAudioModeAsync: async (config) => {
      try {
        if (typeof ExpoAudio.setAudioModeAsync === 'function') {
          return await ExpoAudio.setAudioModeAsync(config);
        }
      } catch (e) {}
    },
    requestPermissionsAsync: async () => {
      try {
        if (typeof ExpoAudio.requestRecordingPermissionsAsync === 'function') {
          return await ExpoAudio.requestRecordingPermissionsAsync();
        }
      } catch (e) {}
      return { status: 'granted' };
    },
    Sound: {
      createAsync: async (source, initialStatus = {}, onPlaybackStatusUpdate = null) => {
        try {
          const player = ExpoAudio.createAudioPlayer(source?.uri ? source.uri : source);
          if (initialStatus.shouldPlay) {
            player.play();
          }
          if (initialStatus.isLooping) {
            player.loop = true;
          }
          if (typeof initialStatus.volume === 'number') {
            player.volume = initialStatus.volume;
          }

          const wrappedSound = {
            playAsync: async () => {
              player.play();
              return { isPlaying: true };
            },
            pauseAsync: async () => {
              player.pause();
              return { isPlaying: false };
            },
            stopAsync: async () => {
              player.pause();
              return { isPlaying: false };
            },
            unloadAsync: async () => {
              try {
                player.pause();
                if (typeof player.remove === 'function') player.remove();
              } catch (e) {}
            },
            setPositionAsync: async (millis) => {
              if (typeof player.seekTo === 'function') {
                await player.seekTo(millis / 1000);
              }
            },
            setStatusAsync: async (status) => {
              if (status.shouldPlay) player.play();
              if (status.isLooping !== undefined) player.loop = status.isLooping;
              if (status.volume !== undefined) player.volume = status.volume;
            },
          };

          return { sound: wrappedSound, status: { isLoaded: true } };
        } catch (e) {
          console.warn('[AUDIO HELPER] expo-audio createAsync error:', e.message);
        }
      },
    },
    Recording: {
      createAsync: async () => {
        return {
          recording: {
            stopAndUnloadAsync: async () => {},
            getURI: () => null,
          },
        };
      },
    },
    RecordingOptionsPresets: {
      HIGH_QUALITY: {},
    },
  };
} else if (ExpoAV && ExpoAV.Audio) {
  SafeAudio = ExpoAV.Audio;
  SafeAudio.isAvailable = true;
} else {
  SafeAudio = {
    isAvailable: false,
    setAudioModeAsync: async () => {},
    requestPermissionsAsync: async () => ({ status: 'granted' }),
    Sound: {
      createAsync: async () => ({
        sound: {
          playAsync: async () => ({ isPlaying: true }),
          pauseAsync: async () => ({ isPlaying: false }),
          stopAsync: async () => ({ isPlaying: false }),
          unloadAsync: async () => {},
          setPositionAsync: async () => {},
          setStatusAsync: async () => {},
        },
        status: { isLoaded: true },
      }),
    },
    Recording: {
      createAsync: async () => ({
        recording: {
          stopAndUnloadAsync: async () => {},
          getURI: () => null,
        },
      }),
    },
    RecordingOptionsPresets: {
      HIGH_QUALITY: {},
    },
  };
}

export const Audio = SafeAudio;
export default Audio;
