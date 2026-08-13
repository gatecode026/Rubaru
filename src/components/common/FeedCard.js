import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;

export default function FeedCard({ item }) {
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(item.isLiked || false);

  const { category, categoryEmoji, imageUri, caption, userName, userAvatar, location } = item;

  return (
    <View style={styles.cardContainer}>
      {/* Background Image */}
      <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="cover" />

      {/* Category Pill Badge (Top Left Overlay) */}
      <View style={styles.categoryBadge}>
        <Text style={styles.categoryEmoji}>{categoryEmoji || '🌴'}</Text>
        <Text style={styles.categoryText}>{category}</Text>
      </View>

      {/* Floating Right-Side Action Column */}
      <View style={styles.actionColumnWrapper}>
        <View style={styles.actionColumn}>
          {/* Thumbs-up / Like Button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              isLiked ? styles.likedBtn : styles.unlikedBtn,
            ]}
            activeOpacity={0.8}
            onPress={() => setIsLiked(!isLiked)}
          >
            <Ionicons
              name="thumbs-up"
              size={20}
              color={isLiked ? '#FFFFFF' : '#444444'}
            />
          </TouchableOpacity>

          {/* Comment Bubble Button */}
          <TouchableOpacity style={[styles.actionButton, styles.unlikedBtn]} activeOpacity={0.8}>
            <Ionicons name="chatbubble" size={19} color="#444444" />
          </TouchableOpacity>

          {/* More Ellipsis Button */}
          <TouchableOpacity style={[styles.actionButton, styles.unlikedBtn]} activeOpacity={0.8}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#444444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Content Scrim Overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.85)']}
        style={styles.gradientScrim}
      >
        {/* Caption Question */}
        <Text style={styles.captionText}>{caption}</Text>

        {/* User Info Row */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/user-profile')}
          style={styles.userRow}
        >
          <Image source={{ uri: userAvatar }} style={styles.avatarImage} />
          <View style={styles.userMeta}>
            <Text style={styles.userNameText}>{userName}</Text>
            <Text style={styles.locationText}>{location}</Text>
          </View>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: CARD_WIDTH,
    height: 480,
    borderRadius: 28,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: 20,
    backgroundColor: '#E1E1E1',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  categoryBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  categoryEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  actionColumnWrapper: {
    position: 'absolute',
    right: 14,
    bottom: 50,
    zIndex: 10,
  },
  actionColumn: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  actionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  unlikedBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
  likedBtn: {
    backgroundColor: '#F04452',
  },
  gradientScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 60,
    justifyContent: 'flex-end',
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 25,
    marginBottom: 14,
    maxWidth: '82%',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    marginRight: 10,
  },
  userMeta: {
    justifyContent: 'center',
  },
  userNameText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  locationText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginTop: 2,
  },
});
