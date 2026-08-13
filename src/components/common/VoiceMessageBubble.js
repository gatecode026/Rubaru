import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
let Audio;
try {
  Audio = require('expo-av').Audio;
} catch (e) {
  Audio = {
    Sound: {
      createAsync: async () => {
        console.warn('Audio playback is not supported in this environment.');
        return { sound: { playAsync: async () => {}, pauseAsync: async () => {}, unloadAsync: async () => {} } };
      }
    }
  };
}

export default function VoiceMessageBubble({ uri, duration = '00:32', time, isSent, isRead, onLongPress }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sound, setSound] = useState(null);
  const [playProgress, setPlayProgress] = useState(0);

  // Clean up sound on unmount
  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const handlePlayPause = async () => {
    if (sound) {
      if (isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        await sound.playAsync();
        setIsPlaying(true);
      }
      return;
    }

    if (!uri) {
      // Mock playing animation if no real URI (fallback simulation)
      setIsPlaying(true);
      const interval = setInterval(() => {
        setPlayProgress((prev) => {
          if (prev >= 1) {
            clearInterval(interval);
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.05;
        });
      }, 300);
      return;
    }

    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );
      setSound(newSound);
      setIsPlaying(true);
    } catch (error) {
      console.log('Error playing voice note', error);
    }
  };

  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      if (status.durationMillis) {
        setPlayProgress(status.positionMillis / status.durationMillis);
      }
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPlayProgress(0);
        if (sound) {
          sound.setPositionAsync(0);
        }
      }
    }
  };

  // Mock waveform bars count and heights
  const bars = [8, 14, 20, 12, 18, 26, 14, 22, 16, 28, 10, 18, 24, 12, 20, 14, 26, 18, 10, 16, 22, 12, 18, 8];

  // Format current position time string e.g. 00:00 / 00:32
  const currentSecs = Math.floor(playProgress * 32);
  const formattedPosition = `00:${currentSecs < 10 ? '0' : ''}${currentSecs}/${duration.includes(':') ? duration : '00:' + duration}`;

  return (
    <View style={isSent ? styles.sentContainer : styles.receivedContainer}>
      <TouchableOpacity
        style={[isSent ? styles.sentBubble : styles.receivedBubble]}
        activeOpacity={0.9}
        onLongPress={onLongPress}
      >
        <View style={styles.contentRow}>
          {/* Play/Pause Button */}
          <TouchableOpacity
            style={[styles.playButton, isSent ? styles.sentPlay : styles.receivedPlay]}
            onPress={handlePlayPause}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={18}
              color={isSent ? '#000000' : '#000000'}
              style={!isPlaying && { marginLeft: 2 }}
            />
          </TouchableOpacity>

          {/* Waveform Bars */}
          <View style={styles.waveformContainer}>
            {bars.map((height, i) => {
              const barProgress = i / bars.length;
              const isActive = playProgress > barProgress || isPlaying;
              const activeColor = isSent ? '#FFFFFF' : '#000000';
              const idleColor = isSent ? 'rgba(255, 255, 255, 0.35)' : '#D1D1D6';

              return (
                <View
                  key={i}
                  style={[
                    styles.waveformBar,
                    {
                      height: height,
                      backgroundColor: isActive ? activeColor : idleColor,
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Download icon for received messages */}
          {!isSent && (
            <TouchableOpacity style={styles.downloadBtn} onPress={() => alert('Downloading audio file...')}>
              <Ionicons name="download-outline" size={18} color="#000000" />
            </TouchableOpacity>
          )}
        </View>

        {/* Footer info (duration & timestamp) */}
        <View style={styles.footerRow}>
          <Text style={[styles.durationText, isSent ? styles.sentText : styles.receivedText]}>
            {formattedPosition}
          </Text>
          <View style={styles.timeAndStatus}>
            <Text style={[styles.timeText, isSent ? styles.sentText : styles.receivedText]}>
              {time}
            </Text>
            {isSent && (
              <Ionicons
                name="checkmark-done"
                size={14}
                color={isRead ? '#34C759' : '#AEAEB2'}
                style={styles.checkIcon}
              />
            )}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  sentContainer: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    marginBottom: 10,
    marginRight: 16,
  },
  receivedContainer: {
    alignSelf: 'flex-start',
    maxWidth: '82%',
    marginBottom: 10,
    marginLeft: 16,
  },
  sentBubble: {
    backgroundColor: '#000000', // Pure black background matching screenshot
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
    width: 240,
  },
  receivedBubble: {
    backgroundColor: '#FFFFFF', // Pure white background matching screenshot
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 18,
    width: 240,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sentPlay: {
    backgroundColor: '#FFFFFF', // White circular button with black play icon
  },
  receivedPlay: {
    backgroundColor: '#F2F2F7', // Translucent light button with black play icon
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    marginHorizontal: 10,
    height: 32,
  },
  waveformBar: {
    width: 2.5,
    borderRadius: 1.5,
  },
  downloadBtn: {
    padding: 4,
    marginLeft: 4,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  durationText: {
    fontSize: 10,
    fontWeight: '500',
  },
  timeAndStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 10,
  },
  sentText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  receivedText: {
    color: '#8E8E93',
  },
  checkIcon: {
    marginLeft: 4,
  },
});
