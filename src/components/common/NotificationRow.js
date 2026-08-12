import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function NotificationRow({ item }) {
  const {
    avatarUri,
    secondaryAvatarUri,
    hasRing,
    titleParts = [],
    layout = 'none',
    thumbnails = [],
    singleThumbnail,
  } = item;

  const renderAvatar = () => {
    if (secondaryAvatarUri) {
      return (
        <View style={styles.dualAvatarContainer}>
          <Image source={{ uri: secondaryAvatarUri }} style={styles.backAvatar} />
          <Image source={{ uri: avatarUri }} style={styles.frontAvatar} />
        </View>
      );
    }

    if (hasRing) {
      return (
        <LinearGradient
          colors={['#FF2A55', '#FF7A00', '#D82098']}
          style={styles.avatarGradientRing}
        >
          <Image source={{ uri: avatarUri }} style={styles.ringAvatarImage} />
        </LinearGradient>
      );
    }

    return <Image source={{ uri: avatarUri }} style={styles.plainAvatarImage} />;
  };

  return (
    <TouchableOpacity style={styles.rowContainer} activeOpacity={0.7}>
      {/* Left Avatar Container */}
      <View style={styles.avatarWrapper}>{renderAvatar()}</View>

      {/* Main Content Area */}
      <View style={styles.contentWrapper}>
        <View style={styles.textAndSingleThumbRow}>
          {/* Rich Text Line */}
          <Text style={styles.richTextContainer}>
            {titleParts.map((part, index) => {
              let textStyle = styles.regularText;
              if (part.bold) textStyle = styles.boldText;
              if (part.isMention) textStyle = styles.mentionText;
              if (part.isTime) textStyle = styles.timeText;

              return (
                <Text key={index} style={textStyle}>
                  {part.text}
                </Text>
              );
            })}
          </Text>

          {/* Single Right-Aligned Thumbnail if layout === 'single-thumb' */}
          {layout === 'single-thumb' && singleThumbnail && (
            <Image source={{ uri: singleThumbnail }} style={styles.singleThumbnail} />
          )}
        </View>

        {/* Multi-Thumbnails Grid below text if layout === 'multi-thumb' */}
        {layout === 'multi-thumb' && thumbnails && thumbnails.length > 0 && (
          <View style={styles.multiThumbnailsWrapper}>
            {thumbnails.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={styles.multiThumbnail} />
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  avatarWrapper: {
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plainAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E1E1E1',
  },
  avatarGradientRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringAvatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: '#E1E1E1',
  },
  dualAvatarContainer: {
    width: 48,
    height: 44,
    position: 'relative',
  },
  backAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: '#E1E1E1',
  },
  frontAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: '#E1E1E1',
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  textAndSingleThumbRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  richTextContainer: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#000000',
    marginRight: 8,
  },
  regularText: {
    fontWeight: '400',
    color: '#1C1C1E',
  },
  boldText: {
    fontWeight: '700',
    color: '#000000',
  },
  mentionText: {
    fontWeight: '600',
    color: '#4A90E2', // Blue mention handle style
  },
  timeText: {
    color: '#8E8E93',
    fontWeight: '400',
    fontSize: 13,
  },
  singleThumbnail: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#E1E1E1',
  },
  multiThumbnailsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  multiThumbnail: {
    width: 54,
    height: 54,
    borderRadius: 8,
    marginRight: 6,
    marginBottom: 6,
    backgroundColor: '#E1E1E1',
  },
});
