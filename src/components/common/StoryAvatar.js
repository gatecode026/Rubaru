import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';

export default function StoryAvatar({
  name,
  imageUrl,
  isFirst,
  isSelf,
  hasActiveStories,
  hasUnviewed,
  onPress,
  onAddPress,
}) {
  const { colors, isDarkMode } = useTheme();

  // If isSelf or isFirst is passed, treat as current user
  const isCurrentUser = Boolean(isSelf || isFirst);
  const showUnviewedRing = hasActiveStories && hasUnviewed;
  const showViewedRing = hasActiveStories && !hasUnviewed;

  const renderAvatarContent = () => (
    imageUrl && !imageUrl.includes('empty') && imageUrl.startsWith('http') ? (
      <Image
        source={{ uri: imageUrl }}
        style={styles.avatarImage}
      />
    ) : (
      <View style={[styles.avatarImage, { backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="person" size={20} color="#9CA3AF" />
      </View>
    )
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={isCurrentUser && !hasActiveStories ? onAddPress || onPress : onPress}
        style={styles.avatarWrapper}
      >
        {showUnviewedRing ? (
          <LinearGradient
            colors={['#CA1D7E', '#E052A0', '#F15F79', '#F99B4A']}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientRing}
          >
            <View style={[styles.innerRingPad, { backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }]}>
              {renderAvatarContent()}
            </View>
          </LinearGradient>
        ) : showViewedRing ? (
          <View style={[styles.viewedRing, { borderColor: isDarkMode ? '#636366' : '#C7C7CC' }]}>
            <View style={[styles.innerRingPad, { backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }]}>
              {renderAvatarContent()}
            </View>
          </View>
        ) : (
          <View style={[styles.plainRing, { borderColor: 'transparent' }]}>
            {renderAvatarContent()}
          </View>
        )}

        {/* Plus Badge for Current User */}
        {isCurrentUser && (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.plusBadgeTouch}
            onPress={onAddPress || onPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={styles.plusBadge}>
              <Ionicons name="add" size={13} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <Text
        style={[styles.nameText, { color: isDarkMode ? '#E5E7EB' : '#262626' }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {isCurrentUser ? 'Your story' : name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginRight: 14,
    width: 72,
  },
  avatarWrapper: {
    position: 'relative',
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2.5,
  },
  innerRingPad: {
    width: 63,
    height: 63,
    borderRadius: 31.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewedRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2.5,
  },
  plainRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2.5,
  },
  avatarImage: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#E1E1E1',
  },
  plusBadgeTouch: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    zIndex: 10,
  },
  plusBadge: {
    backgroundColor: '#0095F6', // Authentic Instagram blue plus
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  nameText: {
    marginTop: 5,
    fontSize: 11,
    textAlign: 'center',
    width: '100%',
    fontWeight: '500',
  },
});
