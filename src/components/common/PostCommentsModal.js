import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Dimensions,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import interactionService from '../../services/interactionService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const QUICK_EMOJIS = ['❤️', '🔥', '😍', '🙌', '👏', '😂', '✨', '💯'];

const INITIAL_COMMENTS = [
  {
    id: 'c1',
    user: 'rohit_sharma',
    name: 'Rohit Sharma',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    isVerified: true,
    text: 'This looks absolutely breathtaking! Where exactly is this spot? 😍🌴',
    time: '2h ago',
    likesCount: 14,
    isLiked: false,
    replies: [
      {
        id: 'r1',
        user: 'travel_junkie',
        name: 'Alex Rivera',
        avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
        text: '@rohit_sharma It looks like Palolem Beach in South Goa! Truly magical during sunsets.',
        time: '1h ago',
        likesCount: 4,
        isLiked: true,
      },
    ],
  },
  {
    id: 'c2',
    user: 'ananya_vibe',
    name: 'Ananya Verma',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    isVerified: false,
    text: 'Vibes are immaculate ✨ Definitely adding this to my weekend bucket list!',
    time: '1h ago',
    likesCount: 8,
    isLiked: true,
    replies: [],
  },
  {
    id: 'c3',
    user: 'kabir_travels',
    name: 'Kabir Mehta',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    isVerified: true,
    text: 'Great composition on this photo! What camera or phone did you use? 📷🙌',
    time: '45m ago',
    likesCount: 5,
    isLiked: false,
    replies: [],
  },
  {
    id: 'c4',
    user: 'meera_singh',
    name: 'Meera Singh',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    isVerified: false,
    text: 'Such positive energy in this picture! Hope you had the most amazing time ❤️',
    time: '20m ago',
    likesCount: 3,
    isLiked: false,
    replies: [],
  },
  {
    id: 'c5',
    user: 'aarav_fitness',
    name: 'Aarav Patel',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    isVerified: false,
    text: 'Incredible shot brother! Keep sharing more of these 🔥',
    time: '5m ago',
    likesCount: 1,
    isLiked: false,
    replies: [],
  },
];

export default function PostCommentsModal({
  visible,
  onClose,
  postId,
  postAuthor = 'Priya Sharma',
  postAuthorAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  postCaption = 'What is your favorite travel destination?',
  postImageUri,
}) {
  const [comments, setComments] = useState(INITIAL_COMMENTS);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null); // { id, user }
  const [expandedReplies, setExpandedReplies] = useState({});
  const [filterSort, setFilterSort] = useState('top'); // 'top' | 'newest'
  const scrollViewRef = useRef(null);

  useEffect(() => {
    if (visible && postId) {
      const fetchComments = async () => {
        try {
          const res = await interactionService.getComments(postId);
          const items = res.items || res.data?.items || [];
          if (items.length > 0) {
            setComments(
              items.map((c) => ({
                id: c._id || c.id,
                user: c.author?.username || 'user',
                name: c.author?.displayName || 'User',
                avatar: c.author?.avatarUri || 'https://i.pravatar.cc/150?img=33',
                isVerified: Boolean(c.author?.isVerified),
                text: c.text,
                time: c.createdAt
                  ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Just now',
                likesCount: c.likesCount || 0,
                isLiked: Boolean(c.viewerInteractions?.isLiked),
                replies: (c.replies || []).map((r) => ({
                  id: r._id || r.id,
                  user: r.author?.username || 'user',
                  name: r.author?.displayName || 'User',
                  avatar: r.author?.avatarUri || 'https://i.pravatar.cc/150?img=33',
                  text: r.text,
                  time: r.createdAt
                    ? new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Just now',
                  likesCount: r.likesCount || 0,
                  isLiked: Boolean(r.viewerInteractions?.isLiked),
                })),
              }))
            );
          }
        } catch (err) {
          console.log('[FETCH COMMENTS ERROR]:', err.message);
        }
      };
      fetchComments();
    }
  }, [visible, postId]);

  // Swipe-down-to-dismiss PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 40 || gestureState.vy > 0.4) {
          onClose();
        }
      },
    })
  ).current;

  // Toggle Like on Comment
  const toggleLikeComment = async (commentId) => {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          const nextLiked = !c.isLiked;
          return {
            ...c,
            isLiked: nextLiked,
            likesCount: nextLiked ? c.likesCount + 1 : c.likesCount - 1,
          };
        }
        return c;
      })
    );
    try {
      await interactionService.toggleCommentLike(commentId);
    } catch (err) {
      console.log('[COMMENT LIKE TOGGLE ERROR]:', err.message);
    }
  };

  // Toggle Like on Reply
  const toggleLikeReply = async (commentId, replyId) => {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          const updatedReplies = c.replies.map((r) => {
            if (r.id === replyId) {
              const nextLiked = !r.isLiked;
              return {
                ...r,
                isLiked: nextLiked,
                likesCount: nextLiked ? r.likesCount + 1 : r.likesCount - 1,
              };
            }
            return r;
          });
          return { ...c, replies: updatedReplies };
        }
        return c;
      })
    );
    try {
      await interactionService.toggleCommentLike(replyId);
    } catch (err) {
      console.log('[REPLY LIKE TOGGLE ERROR]:', err.message);
    }
  };

  // Toggle expand/collapse replies
  const toggleExpandReplies = (commentId) => {
    setExpandedReplies((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  // Handle Post Comment or Reply
  const handleSendComment = async () => {
    if (!inputText.trim()) return;
    const textToSend = inputText.trim();
    setInputText('');
    const targetParentId = replyingTo?.id || null;

    if (replyingTo) {
      // Adding as reply
      const newReply = {
        id: `r_${Date.now()}`,
        user: 'you',
        name: 'You',
        avatar: 'https://i.pravatar.cc/150?img=60',
        text: `@${replyingTo.user} ${textToSend}`,
        time: 'Just now',
        likesCount: 0,
        isLiked: false,
      };
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === replyingTo.id) {
            return {
              ...c,
              replies: [...c.replies, newReply],
            };
          }
          return c;
        })
      );
      setExpandedReplies((prev) => ({
        ...prev,
        [replyingTo.id]: true,
      }));
      setReplyingTo(null);
    } else {
      // Adding as main comment
      const newComment = {
        id: `c_${Date.now()}`,
        user: 'you',
        name: 'You',
        avatar: 'https://i.pravatar.cc/150?img=60',
        isVerified: false,
        text: textToSend,
        time: 'Just now',
        likesCount: 0,
        isLiked: false,
        replies: [],
      };
      setComments((prev) => [newComment, ...prev]);
    }

    if (postId) {
      try {
        await interactionService.createComment(postId, textToSend, targetParentId);
      } catch (err) {
        console.log('[CREATE COMMENT API ERROR]:', err.message);
      }
    }
  };

  const handleEmojiPress = (emoji) => {
    setInputText((prev) => prev + emoji);
  };

  // Sorted comments
  const sortedComments = [...comments].sort((a, b) => {
    if (filterSort === 'top') {
      return b.likesCount - a.likesCount;
    }
    return 0; // keeps newest first
  });

  const totalCommentsCount = comments.reduce(
    (acc, c) => acc + 1 + (c.replies ? c.replies.length : 0),
    0
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.backdropPressable} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrapper}
        >
          <View style={styles.sheetContainer}>
            {/* Top Drag & Header Area with Swipe Down PanResponder */}
            <View {...panResponder.panHandlers}>
              {/* Drag Bar */}
              <View style={styles.dragHandleContainer}>
                <View style={styles.dragHandle} />
              </View>

              {/* Header */}
              <View style={styles.headerRow}>
                <View style={styles.headerTitleCol}>
                  <View style={styles.titleWithBadge}>
                    <Text style={styles.headerTitle}>Comments</Text>
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{totalCommentsCount}</Text>
                    </View>
                  </View>
                </View>

                {/* Sort Switcher */}
                <View style={styles.sortFilterWrap}>
                  <TouchableOpacity
                    style={[styles.sortBtn, filterSort === 'top' && styles.sortBtnActive]}
                    onPress={() => setFilterSort('top')}
                  >
                    <Text style={[styles.sortBtnText, filterSort === 'top' && styles.sortBtnTextActive]}>
                      Top
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sortBtn, filterSort === 'newest' && styles.sortBtnActive]}
                    onPress={() => setFilterSort('newest')}
                  >
                    <Text style={[styles.sortBtnText, filterSort === 'newest' && styles.sortBtnTextActive]}>
                      Newest
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color="#4B5563" />
                </TouchableOpacity>
              </View>

              {/* Post Snippet Box */}
              <View style={styles.postSnippetBox}>
                <Image source={{ uri: postAuthorAvatar }} style={styles.authorAvatar} />
                <View style={styles.snippetCol}>
                  <Text style={styles.authorNameText}>{postAuthor}</Text>
                  <Text style={styles.snippetCaptionText} numberOfLines={1}>
                    {postCaption}
                  </Text>
                </View>
              </View>
            </View>

            {/* Comments Scroll View */}
            <ScrollView
              ref={scrollViewRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.commentsListContent}
              scrollEventThrottle={16}
              onScrollEndDrag={(e) => {
                if (e.nativeEvent.contentOffset.y < -30) {
                  onClose();
                }
              }}
            >
              {sortedComments.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyTitle}>No comments yet</Text>
                  <Text style={styles.emptySubtitle}>Be the first to share your thoughts!</Text>
                </View>
              ) : (
                sortedComments.map((comment) => {
                  const hasReplies = comment.replies && comment.replies.length > 0;
                  const isExpanded = !!expandedReplies[comment.id];

                  return (
                    <View key={comment.id} style={styles.commentItem}>
                      <Image source={{ uri: comment.avatar }} style={styles.commentAvatar} />

                      <View style={styles.commentBodyCol}>
                        {/* User & Time Row */}
                        <View style={styles.commentUserRow}>
                          <Text style={styles.commentUserName}>{comment.name}</Text>
                          {comment.isVerified && (
                            <Ionicons
                              name="checkmark-circle"
                              size={14}
                              color="#3B82F6"
                              style={{ marginLeft: 3 }}
                            />
                          )}
                          <Text style={styles.commentTimeDot}>•</Text>
                          <Text style={styles.commentTimeText}>{comment.time}</Text>
                        </View>

                        {/* Comment Text */}
                        <Text style={styles.commentContentText}>{comment.text}</Text>

                        {/* Reply Action */}
                        <View style={styles.commentActionsRow}>
                          <TouchableOpacity
                            onPress={() =>
                              setReplyingTo({ id: comment.id, user: comment.user })
                            }
                            hitSlop={6}
                          >
                            <Text style={styles.replyActionText}>Reply</Text>
                          </TouchableOpacity>

                          {hasReplies && (
                            <TouchableOpacity
                              onPress={() => toggleExpandReplies(comment.id)}
                              style={styles.viewRepliesBtn}
                              hitSlop={6}
                            >
                              <View style={styles.replyLineDash} />
                              <Text style={styles.viewRepliesText}>
                                {isExpanded
                                  ? 'Hide replies'
                                  : `View ${comment.replies.length} ${
                                      comment.replies.length === 1 ? 'reply' : 'replies'
                                    }`}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Nested Replies */}
                        {hasReplies && isExpanded && (
                          <View style={styles.nestedRepliesContainer}>
                            {comment.replies.map((reply) => (
                              <View key={reply.id} style={styles.replyItem}>
                                <Image
                                  source={{ uri: reply.avatar }}
                                  style={styles.replyAvatar}
                                />
                                <View style={styles.replyBodyCol}>
                                  <View style={styles.commentUserRow}>
                                    <Text style={styles.replyUserName}>{reply.name}</Text>
                                    <Text style={styles.commentTimeDot}>•</Text>
                                    <Text style={styles.commentTimeText}>{reply.time}</Text>
                                  </View>
                                  <Text style={styles.replyContentText}>{reply.text}</Text>
                                </View>

                                {/* Like on Reply */}
                                <TouchableOpacity
                                  style={styles.likeBtn}
                                  onPress={() => toggleLikeReply(comment.id, reply.id)}
                                  hitSlop={6}
                                >
                                  <Ionicons
                                    name={reply.isLiked ? 'heart' : 'heart-outline'}
                                    size={15}
                                    color={reply.isLiked ? '#FF2E63' : '#9CA3AF'}
                                  />
                                  {reply.likesCount > 0 && (
                                    <Text
                                      style={[
                                        styles.likeCountText,
                                        reply.isLiked && styles.likeCountTextActive,
                                      ]}
                                    >
                                      {reply.likesCount}
                                    </Text>
                                  )}
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* Like on Comment */}
                      <TouchableOpacity
                        style={styles.likeBtn}
                        onPress={() => toggleLikeComment(comment.id)}
                        hitSlop={8}
                      >
                        <Ionicons
                          name={comment.isLiked ? 'heart' : 'heart-outline'}
                          size={18}
                          color={comment.isLiked ? '#FF2E63' : '#9CA3AF'}
                        />
                        {comment.likesCount > 0 && (
                          <Text
                            style={[
                              styles.likeCountText,
                              comment.isLiked && styles.likeCountTextActive,
                            ]}
                          >
                            {comment.likesCount}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* Replying Banner */}
            {replyingTo && (
              <View style={styles.replyingBanner}>
                <Text style={styles.replyingBannerText}>
                  Replying to <Text style={{ fontWeight: '800' }}>@{replyingTo.user}</Text>
                </Text>
                <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={8}>
                  <Ionicons name="close" size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>
            )}

            {/* Quick Emoji Bar */}
            <View style={styles.quickEmojiBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickEmojiContent}
              >
                {QUICK_EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => handleEmojiPress(emoji)}
                    style={styles.emojiPill}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.emojiPillText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Bottom Comment Input Bar */}
            <View style={styles.inputBarContainer}>
              <Image
                source={{ uri: 'https://i.pravatar.cc/150?img=60' }}
                style={styles.myInputAvatar}
              />
              <View style={styles.inputWrap}>
                <TextInput
                  placeholder={
                    replyingTo
                      ? `Reply to @${replyingTo.user}...`
                      : 'Add a comment...'
                  }
                  placeholderTextColor="#9CA3AF"
                  style={styles.textInput}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline={false}
                  returnKeyType="send"
                  onSubmitEditing={handleSendComment}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.sendButton,
                  inputText.trim().length > 0 && styles.sendButtonActive,
                ]}
                activeOpacity={0.8}
                onPress={handleSendComment}
                disabled={inputText.trim().length === 0}
              >
                <LinearGradient
                  colors={
                    inputText.trim().length > 0
                      ? ['#FF527B', '#FF2E63']
                      : ['#E5E7EB', '#D1D5DB']
                  }
                  style={styles.sendGradient}
                >
                  <Ionicons
                    name="arrow-up"
                    size={18}
                    color={inputText.trim().length > 0 ? '#FFFFFF' : '#9CA3AF'}
                  />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdropPressable: {
    flex: 1,
  },
  sheetWrapper: {
    width: '100%',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SCREEN_HEIGHT * 0.88,
    minHeight: SCREEN_HEIGHT * 0.55,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
  },
  dragHandleContainer: {
    width: '100%',
    paddingVertical: 4,
    alignItems: 'center',
  },
  dragHandle: {
    width: 44,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: '#D1D5DB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitleCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: 'rgba(255, 46, 99, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FF2E63',
  },
  sortFilterWrap: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 2,
  },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  sortBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  sortBtnTextActive: {
    color: '#111827',
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  postSnippetBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  authorAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
  },
  snippetCol: {
    flex: 1,
  },
  authorNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  snippetCaptionText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  commentsListContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
  },
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  commentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 12,
  },
  commentBodyCol: {
    flex: 1,
    marginRight: 8,
  },
  commentUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  commentUserName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  commentTimeDot: {
    fontSize: 12,
    color: '#9CA3AF',
    marginHorizontal: 5,
  },
  commentTimeText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  commentContentText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#374151',
  },
  commentActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  replyActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  viewRepliesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  replyLineDash: {
    width: 14,
    height: 1,
    backgroundColor: '#D1D5DB',
    marginRight: 6,
  },
  viewRepliesText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF2E63',
  },
  nestedRepliesContainer: {
    marginTop: 10,
    paddingLeft: 4,
  },
  replyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
  },
  replyBodyCol: {
    flex: 1,
    marginRight: 8,
  },
  replyUserName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  replyContentText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#374151',
  },
  likeBtn: {
    alignItems: 'center',
    paddingLeft: 4,
  },
  likeCountText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 2,
  },
  likeCountTextActive: {
    color: '#FF2E63',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  replyingBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 46, 99, 0.08)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 46, 99, 0.15)',
  },
  replyingBannerText: {
    fontSize: 12,
    color: '#FF2E63',
  },
  quickEmojiBar: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
  },
  quickEmojiContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  emojiPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emojiPillText: {
    fontSize: 16,
  },
  inputBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  myInputAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 40,
    justifyContent: 'center',
    marginRight: 8,
  },
  textInput: {
    fontSize: 13,
    color: '#111827',
    paddingVertical: 0,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  sendButtonActive: {
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
