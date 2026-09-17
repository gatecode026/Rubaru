import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationRow({ item, onFollowPress, onPress }) {
  const {
    avatarUri,
    secondaryAvatarUri,
    hasRing,
    titleParts = [],
    layout = 'none',
    thumbnails = [],
    singleThumbnail,
    isFollowType,
    followState, // 'FOLLOW', 'FOLLOWING', 'FOLLOW_BACK', 'REQUESTED'
    isFollowLoading,
    isCallType,
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
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.ringAvatarImage} />
          ) : (
            <View style={[styles.ringAvatarImage, styles.placeholderBg]}>
              <Ionicons name="person" size={20} color="#9CA3AF" />
            </View>
          )}
        </LinearGradient>
      );
    }

    return avatarUri ? (
      <Image source={{ uri: avatarUri }} style={styles.plainAvatarImage} />
    ) : (
      <View style={[styles.plainAvatarImage, styles.placeholderBg]}>
        <Ionicons name="person" size={20} color="#9CA3AF" />
      </View>
    );
  };

  const renderRightAction = () => {
    if (isFollowType) {
      const isFollowing = followState === 'FOLLOWING';
      const isRequested = followState === 'REQUESTED';
      const isFollowBack = followState === 'FOLLOW_BACK';

      let btnText = 'Follow';
      if (isFollowing) btnText = 'Following';
      else if (isRequested) btnText = 'Requested';
      else if (isFollowBack) btnText = 'Follow Back';

      return (
        <TouchableOpacity
          style={[
            styles.followBtn,
            isFollowing && styles.followingBtn,
            isRequested && styles.followingBtn,
          ]}
          activeOpacity={0.8}
          onPress={() => onFollowPress && onFollowPress(item)}
          disabled={isFollowLoading}
        >
          <Text
            style={[
              styles.followBtnText,
              (isFollowing || isRequested) && styles.followingBtnText,
            ]}
          >
            {btnText}
          </Text>
        </TouchableOpacity>
      );
    }

    if (layout === 'single-thumb' && singleThumbnail) {
      return (
        <Image
          source={{ uri: singleThumbnail }}
          style={styles.singleThumbnail}
          resizeMode="cover"
        />
      );
    }

    if (isCallType) {
      return (
        <View style={styles.callIconBtn}>
          <Ionicons name="call" size={16} color="#0095F6" />
        </View>
      );
    }

    return null;
  };

  return (
    <TouchableOpacity
      style={[styles.rowContainer, hasRing && styles.unreadRowContainer]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {/* Left Avatar Container */}
      <View style={styles.avatarWrapper}>{renderAvatar()}</View>

      {/* Main Content Area */}
      <View style={styles.contentWrapper}>
        <View style={styles.textAndActionRow}>
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

          {/* Right Action: Follow Button or Content Thumbnail */}
          {renderRightAction()}
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  unreadRowContainer: {
    backgroundColor: '#FAFBFF',
  },
  avatarWrapper: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plainAvatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F3F4F6',
  },
  placeholderBg: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarGradientRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: '#F3F4F6',
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
  textAndActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  richTextContainer: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    color: '#111827',
    marginRight: 10,
  },
  regularText: {
    fontWeight: '400',
    color: '#111827',
  },
  boldText: {
    fontWeight: '700',
    color: '#111827',
  },
  mentionText: {
    fontWeight: '600',
    color: '#0095F6',
  },
  timeText: {
    color: '#9CA3AF',
    fontWeight: '400',
    fontSize: 13,
  },
  singleThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  followBtn: {
    backgroundColor: '#0095F6',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingBtn: {
    backgroundColor: '#EFEFEF',
  },
  followBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  followingBtnText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
  },
  callIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  multiThumbnailsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  multiThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 6,
    backgroundColor: '#F3F4F6',
  },
});
