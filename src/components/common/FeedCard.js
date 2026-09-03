import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import PostCommentsModal from './PostCommentsModal';
import interactionService from '../../services/interactionService';
import safetyService from '../../services/safetyService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;

export default function FeedCard({ item }) {
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(item.isLiked || false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const postId = item.postId || item.id;
  const imageUri =
    item.imageUri ||
    item.mediaItems?.[0]?.variants?.[0]?.url ||
    item.mediaItems?.[0]?.thumbnail?.url ||
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800';
  const caption = item.caption || '';
  const userName = item.userName || item.author?.displayName || item.author?.username || 'Rubaru User';
  const userAvatar = item.userAvatar || item.author?.avatarUri || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500';
  const location = item.location || '';

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleInterested = () => {
    setMenuVisible(false);
    showToast('✨ Marked as Interested! We’ll show more posts like this.');
  };

  const handleNotInterested = async () => {
    setMenuVisible(false);
    showToast('👍 Not-Interested recorded. We’ll show fewer posts like this.');
    if (postId) {
      try {
        await interactionService.recordFeedback(postId, 'NOT_INTERESTED');
      } catch (err) {
        console.log('[NOT INTERESTED ERROR]:', err.message);
      }
    }
  };

  const handleLikeToggle = async () => {
    const prev = isLiked;
    setIsLiked(!prev);
    if (postId) {
      try {
        await interactionService.toggleLike(postId, 'POST');
      } catch (err) {
        console.log('[LIKE TOGGLE ERROR]:', err.message);
        setIsLiked(prev);
      }
    }
  };

  const handleReport = () => {
    setMenuVisible(false);
    router.push('/report-violations');
  };

  return (
    <View style={styles.cardContainer}>
      {/* Background Image */}
      <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="cover" />

      {/* Category Pill Badge (Top Left Overlay) */}
      <View style={styles.categoryBadge}>
        <Text style={styles.categoryEmoji}>{categoryEmoji || '🌴'}</Text>
        <Text style={styles.categoryText}>{category}</Text>
      </View>

      {/* Toast Notification Banner Overlay */}
      {toastMessage && (
        <View style={styles.toastBanner}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

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
            onPress={handleLikeToggle}
          >
            <Ionicons
              name="thumbs-up"
              size={20}
              color={isLiked ? '#FFFFFF' : '#444444'}
            />
          </TouchableOpacity>

          {/* Comment Bubble Button */}
          <TouchableOpacity
            style={[styles.actionButton, styles.unlikedBtn]}
            activeOpacity={0.8}
            onPress={() => setCommentsVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="View comments"
          >
            <Ionicons name="chatbubble" size={19} color="#444444" />
          </TouchableOpacity>

          {/* More Ellipsis Button (Three-Dot) */}
          <TouchableOpacity
            style={[styles.actionButton, styles.unlikedBtn]}
            activeOpacity={0.8}
            onPress={() => setMenuVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="More post options"
          >
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

      {/* Three-Dot Post Options Bottom Sheet Modal */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setMenuVisible(false)}
        >
          <Pressable style={styles.modalSheetContainer} onPress={(e) => e.stopPropagation()}>
            {/* Top Drag Indicator */}
            <View style={styles.dragHandle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Post Options</Text>
              <Text style={styles.modalSubtitle}>Manage your preferences for this post</Text>
            </View>

            {/* Options List */}
            <View style={styles.optionsList}>
              {/* Option 1: Interested */}
              <TouchableOpacity
                style={styles.optionRow}
                activeOpacity={0.7}
                onPress={handleInterested}
              >
                <View style={[styles.optionIconCircle, { backgroundColor: 'rgba(255, 46, 99, 0.1)' }]}>
                  <Ionicons name="heart" size={22} color="#FF2E63" />
                </View>
                <View style={styles.optionTextWrapper}>
                  <Text style={styles.optionLabel}>Interested</Text>
                  <Text style={styles.optionDescription}>Show more posts and topics like this</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>

              {/* Option 2: Not-Interested */}
              <TouchableOpacity
                style={styles.optionRow}
                activeOpacity={0.7}
                onPress={handleNotInterested}
              >
                <View style={[styles.optionIconCircle, { backgroundColor: 'rgba(107, 114, 128, 0.12)' }]}>
                  <Ionicons name="eye-off" size={22} color="#4B5563" />
                </View>
                <View style={styles.optionTextWrapper}>
                  <Text style={styles.optionLabel}>Not-Interested</Text>
                  <Text style={styles.optionDescription}>Show fewer recommendations like this</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>

              {/* Option 3: Report */}
              <TouchableOpacity
                style={[styles.optionRow, styles.lastOptionRow]}
                activeOpacity={0.7}
                onPress={handleReport}
              >
                <View style={[styles.optionIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                  <Ionicons name="flag" size={22} color="#EF4444" />
                </View>
                <View style={styles.optionTextWrapper}>
                  <Text style={[styles.optionLabel, { color: '#EF4444' }]}>Report</Text>
                  <Text style={styles.optionDescription}>Report spam, abuse, or community violations</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.cancelButton}
              activeOpacity={0.8}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Post Comments Bottom Sheet Modal */}
      <PostCommentsModal
        visible={commentsVisible}
        onClose={() => setCommentsVisible(false)}
        postId={postId}
        postAuthor={userName}
        postAuthorAvatar={userAvatar}
        postCaption={caption}
        postImageUri={imageUri}
      />
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
  toastBanner: {
    position: 'absolute',
    top: 16,
    right: 16,
    left: 16,
    zIndex: 20,
    backgroundColor: 'rgba(17, 24, 39, 0.92)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    alignItems: 'center',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  optionsList: {
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  lastOptionRow: {
    borderBottomWidth: 0,
  },
  optionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionTextWrapper: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  optionDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  cancelButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
});
