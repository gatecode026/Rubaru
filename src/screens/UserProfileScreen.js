import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  Image,
  ScrollView,
  Dimensions,
  Modal,
  Switch,
  PanResponder,
  Animated,
  Platform,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import BottomTabBar from '../components/common/BottomTabBar';
import { useTheme } from '../theme';
import { useLanguage } from '../localization/LanguageContext';
import QuoteCard from '../components/common/QuoteCard';
import StatsBar from '../components/common/StatsBar';
import InfoPill from '../components/common/InfoPill';
import PhotoThumbnail from '../components/common/PhotoThumbnail';
import InterestPill from '../components/common/InterestPill';
import PostCommentsModal from '../components/common/PostCommentsModal';
import api from '@services/api';
import followService from '@services/followService';
import reelService from '@services/reelService';
import interactionService from '@services/interactionService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSocket, disconnectSocket } from '@services/socket';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - 60) / 3;

const ALL_INTERESTS = [
  { id: 'photography', name: 'Photography', icon: 'camera-outline' },
  { id: 'shopping', name: 'Shopping', icon: 'bag-handle-outline' },
  { id: 'karaoke', name: 'Karaoke', icon: 'mic-outline' },
  { id: 'yoga', name: 'Yoga', icon: 'flower-outline' },
  { id: 'cooking', name: 'Cooking', icon: 'restaurant-outline' },
  { id: 'tennis', name: 'Tennis', icon: 'tennisball-outline' },
  { id: 'run', name: 'Run', icon: 'walk-outline' },
  { id: 'swimming', name: 'Swimming', icon: 'water-outline' },
  { id: 'art', name: 'Art', icon: 'color-palette-outline' },
  { id: 'traveling', name: 'Traveling', icon: 'airplane-outline' },
  { id: 'extreme', name: 'Extreme', icon: 'diamond-outline' },
  { id: 'music', name: 'Music', icon: 'musical-notes-outline' },
  { id: 'drink', name: 'Drink', icon: 'wine-outline' },
  { id: 'videogames', name: 'Video games', icon: 'game-controller-outline' },
];

export default function UserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('top');
  const [isFollowing, setIsFollowing] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userReels, setUserReels] = useState([]);
  const [showCreateReelPicker, setShowCreateReelPicker] = useState(false);
  const [showUploadPreviewModal, setShowUploadPreviewModal] = useState(false);
  const [selectedVideoAsset, setSelectedVideoAsset] = useState(null);
  const [reelCaptionText, setReelCaptionText] = useState('');
  const [isPublishingReel, setIsPublishingReel] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState(null);
  const [selectedPhotoItem, setSelectedPhotoItem] = useState(null);
  const [photoLiked, setPhotoLiked] = useState(false);
  const [photoLikeCount, setPhotoLikeCount] = useState(0);
  const [photoCommentCount, setPhotoCommentCount] = useState(0);
  const [photoCommentsVisible, setPhotoCommentsVisible] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  const selectedPhotoItemRef = useRef(null);
  const lastTapRef = useRef(0);

  useEffect(() => {
    selectedPhotoItemRef.current = selectedPhotoItem;
  }, [selectedPhotoItem]);

  useEffect(() => {
    async function loadCurrentUserId() {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (!token) return;
        const parts = token.split('.');
        if (parts.length >= 2) {
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          let decodedStr = '';
          if (typeof atob === 'function') {
            decodedStr = atob(base64);
          } else if (typeof Buffer !== 'undefined') {
            decodedStr = Buffer.from(base64, 'base64').toString('utf8');
          }
          if (decodedStr) {
            const data = JSON.parse(decodedStr);
            if (data.id || data.userId) {
              setCurrentUserId(String(data.id || data.userId));
            }
          }
        }
      } catch (e) {}
    }
    loadCurrentUserId();
  }, []);

  const isOwnProfile = Boolean(
    !params.userId ||
    (currentUserId && String(params.userId) === String(currentUserId)) ||
    (currentUserId && profile?.user?._id && String(profile.user._id) === String(currentUserId))
  );

  const scrollOffsetRef = useRef(0);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const handleOpenMediaItem = (item) => {
    const isReel =
      typeof item === 'object' &&
      (item.videoUri ||
        item.contentType === 'REEL' ||
        item.mediaType === 'VIDEO' ||
        item.mediaItems?.[0]?.mediaType === 'VIDEO' ||
        item.mediaItems?.[0]?.variants?.[0]?.url);
    if (isReel) {
      const targetId = item.id || item.postId || item._id;
      router.push({
        pathname: '/reels',
        params: { initialReelId: String(targetId) },
      });
    } else {
      const url = typeof item === 'string' ? getFullUrl(item) : getFullUrl(item?.thumbnailUri || item?.url || item);
      const rawUrl = typeof item === 'string' ? item : (item?.url || item?.thumbnailUri || url);
      let photoId = typeof item === 'object' ? (item.id || item._id || item.postId) : null;
      if (photoId && !/^[0-9a-fA-F]{24}$/.test(String(photoId))) {
        photoId = null;
      }

      const isLiked = typeof item === 'object' ? Boolean(item.isLiked) : false;
      const likesCount = typeof item === 'object' ? Number(item.likesCount) || 0 : 0;
      const commentsCount = typeof item === 'object' ? Number(item.commentsCount) || 0 : 0;

      const photoObj = {
        uri: url,
        rawUrl,
        id: photoId,
        likesCount,
        commentsCount,
        isLiked,
      };

      setSelectedPhotoItem(photoObj);
      setPhotoLiked(isLiked);
      setPhotoLikeCount(likesCount);
      setPhotoCommentCount(commentsCount);
      setSelectedPhotoPreview(url);

      // Asynchronously resolve or auto-create Content ObjectId for photo
      const authorId = profile?.user?._id || profile?.user || params.userId;
      interactionService.resolvePhoto({ photoUrl: rawUrl, authorId })
        .then((res) => {
          if (res?.contentId) {
            setSelectedPhotoItem((prev) => (prev ? { ...prev, id: res.contentId } : prev));
            if (res.likesCount !== undefined) setPhotoLikeCount(res.likesCount);
            if (res.commentsCount !== undefined) setPhotoCommentCount(res.commentsCount);
            if (res.isLiked !== undefined) setPhotoLiked(res.isLiked);
          }
        })
        .catch((err) => {
          console.log('[RESOLVE PHOTO WARNING]', err.message);
        });
    }
  };

  const handleOpenCreateOptions = () => {
    setShowCreateReelPicker(true);
  };

  const handleRecordWithCamera = () => {
    setShowCreateReelPicker(false);
    router.push('/add-story');
  };

  const handlePickFromGallery = async () => {
    setShowCreateReelPicker(false);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        alert('Permission to access photos and videos is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 90,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedVideoAsset(result.assets[0]);
        setShowUploadPreviewModal(true);
      }
    } catch (err) {
      console.log('[PICK VIDEO ERROR]', err.message);
      alert('Could not pick video: ' + err.message);
    }
  };

  const handlePublishSelectedReel = async () => {
    if (!selectedVideoAsset?.uri) return;
    try {
      setIsPublishingReel(true);
      const rawDur = selectedVideoAsset.duration || 15;
      const durationMs = rawDur > 1000 ? Math.min(Math.round(rawDur), 90000) : Math.min(Math.round(rawDur * 1000), 90000);

      await reelService.createReel({
        videoUri: selectedVideoAsset.uri,
        caption: reelCaptionText.trim() || 'My short video ✨',
        durationMs,
      });

      setShowUploadPreviewModal(false);
      setSelectedVideoAsset(null);
      setReelCaptionText('');
      showToast('🎉 Short video posted successfully!');
      fetchProfileData();
    } catch (err) {
      console.log('[PUBLISH REEL ERROR]', err.message);
      alert('Failed to post video: ' + (err.message || 'Please try again.'));
    } finally {
      setIsPublishingReel(false);
    }
  };

  const fetchProfileData = async () => {
    try {
      let myId = currentUserId;
      if (!myId) {
        try {
          const token = await AsyncStorage.getItem('userToken');
          if (token) {
            const parts = token.split('.');
            if (parts.length >= 2) {
              const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
              const dec = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf8');
              const d = JSON.parse(dec);
              myId = d.id || d.userId;
              if (myId) setCurrentUserId(String(myId));
            }
          }
        } catch (e) {}
      }

      const isTargetingOther = Boolean(params.userId && myId && String(params.userId) !== String(myId));

      let response;
      if (isTargetingOther) {
        response = await api.get(`/profiles/${params.userId}`);
      } else {
        response = await api.get('/profiles/me');
      }
      setProfile(response.data);
      setLoading(false);

      // Check follow status if viewing someone else
      if (isTargetingOther) {
        try {
          const followStatusRes = await followService.getFollowStatus(params.userId);
          const status = followStatusRes.status || followStatusRes.data?.status;
          setIsFollowing(status === 'ACCEPTED');
        } catch (fErr) {
          console.log('[FETCH FOLLOW STATUS ERROR]', fErr.message);
        }
      } else {
        setIsFollowing(false);
      }

      // Also fetch user's reels / short videos
      try {
        const reelEndpoint = isTargetingOther
          ? `/reels/user/${params.userId}`
          : '/reels/user/me';
        const reelRes = await api.get(reelEndpoint);
        const raw = reelRes.data;
        const list = Array.isArray(raw)
          ? raw
          : (Array.isArray(raw?.data)
            ? raw.data
            : (Array.isArray(raw?.items)
              ? raw.items
              : (Array.isArray(raw?.data?.items) ? raw.data.items : [])));
        setUserReels(list);
      } catch (reelErr) {
        console.log('[FETCH USER REELS ERROR]', reelErr.message);
        setUserReels([]);
      }
    } catch (error) {
      console.log('[FETCH PROFILE ERROR]', error.message || error);
      setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!params.userId || isOwnProfile) return;
    const prev = isFollowing;
    setIsFollowing(!prev);
    try {
      if (prev) {
        await followService.unfollowUser(params.userId);
      } else {
        await followService.followUser(params.userId);
      }
    } catch (err) {
      console.log('[FOLLOW TOGGLE ERROR]', err.message);
      setIsFollowing(prev);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchProfileData();
    }, [params.userId])
  );

  // Real-time socket sync for profile stats and active photo preview
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleSocialLike = (data) => {
      if (data && data.likesCount !== undefined) {
        setProfile((prev) => {
          if (!prev) return prev;
          const currentLikes = Number(prev.likesCount) || 0;
          return {
            ...prev,
            likesCount: data.isLiked ? currentLikes + 1 : Math.max(0, currentLikes - 1),
          };
        });

        // Sync live photo likes if viewing this photo
        const activePhoto = selectedPhotoItemRef.current;
        if (activePhoto && (String(data.contentId) === String(activePhoto.id) || String(data.reelId) === String(activePhoto.id))) {
          setPhotoLikeCount(Number(data.likesCount) || 0);
        }
      }
    };

    const handleSocialComment = (data) => {
      if (data && data.commentsCount !== undefined) {
        const activePhoto = selectedPhotoItemRef.current;
        if (activePhoto && (String(data.contentId) === String(activePhoto.id) || String(data.reelId) === String(activePhoto.id))) {
          setPhotoCommentCount(Number(data.commentsCount) || 0);
        }
      }
    };

    socket.on('reel_like_updated', handleSocialLike);
    socket.on('content_like_updated', handleSocialLike);
    socket.on('reel_comment_added', handleSocialComment);
    socket.on('post_comment_added', handleSocialComment);
    socket.on('reel_comment_deleted', handleSocialComment);
    socket.on('post_comment_deleted', handleSocialComment);

    return () => {
      socket.off('reel_like_updated', handleSocialLike);
      socket.off('content_like_updated', handleSocialLike);
      socket.off('reel_comment_added', handleSocialComment);
      socket.off('post_comment_added', handleSocialComment);
      socket.off('reel_comment_deleted', handleSocialComment);
      socket.off('post_comment_deleted', handleSocialComment);
    };
  }, []);

  const handlePhotoLikeToggle = async () => {
    if (!selectedPhotoItem || isOwnProfile) return;

    let contentId = selectedPhotoItem.id;
    if (!contentId || !/^[0-9a-fA-F]{24}$/.test(String(contentId))) {
      try {
        const rawUrl = selectedPhotoItem.rawUrl || selectedPhotoItem.uri;
        const authorId = profile?.user?._id || profile?.user || params.userId;
        const res = await interactionService.resolvePhoto({ photoUrl: rawUrl, authorId });
        if (res?.contentId) {
          contentId = res.contentId;
          setSelectedPhotoItem((prev) => (prev ? { ...prev, id: contentId } : prev));
        }
      } catch (err) {
        console.log('[RESOLVE PHOTO BEFORE LIKE ERROR]', err.message);
      }
    }

    if (!contentId || !/^[0-9a-fA-F]{24}$/.test(String(contentId))) {
      return;
    }

    const nextLiked = !photoLiked;
    setPhotoLiked(nextLiked);
    setPhotoLikeCount((prev) => (nextLiked ? prev + 1 : Math.max(0, prev - 1)));

    try {
      if (nextLiked) {
        const res = await interactionService.likeContent(contentId);
        if (res?.data?.likesCount !== undefined) {
          setPhotoLikeCount(res.data.likesCount);
        }
      } else {
        const res = await interactionService.unlikeContent(contentId);
        if (res?.data?.likesCount !== undefined) {
          setPhotoLikeCount(res.data.likesCount);
        }
      }
    } catch (err) {
      console.log('[PHOTO LIKE ERROR]', err.message);
      setPhotoLiked(!nextLiked);
      setPhotoLikeCount((prev) => (!nextLiked ? prev + 1 : Math.max(0, prev - 1)));
    }
  };

  const handleOpenPhotoComments = async () => {
    if (!selectedPhotoItem) return;

    let contentId = selectedPhotoItem.id;
    if (!contentId || !/^[0-9a-fA-F]{24}$/.test(String(contentId))) {
      try {
        const rawUrl = selectedPhotoItem.rawUrl || selectedPhotoItem.uri;
        const authorId = profile?.user?._id || profile?.user || params.userId;
        const res = await interactionService.resolvePhoto({ photoUrl: rawUrl, authorId });
        if (res?.contentId) {
          contentId = res.contentId;
          setSelectedPhotoItem((prev) => (prev ? { ...prev, id: contentId } : prev));
          if (res.commentsCount !== undefined) setPhotoCommentCount(res.commentsCount);
          if (res.likesCount !== undefined) setPhotoLikeCount(res.likesCount);
          if (res.isLiked !== undefined) setPhotoLiked(res.isLiked);
        }
      } catch (err) {
        console.log('[RESOLVE PHOTO BEFORE COMMENTS ERROR]', err.message);
      }
    }

    setPhotoCommentsVisible(true);
  };

  const handlePhotoShare = async () => {
    if (!selectedPhotoItem) return;
    try {
      await Share.share({
        message: `Check out this photo by ${profile?.displayName || 'User'} on Rubaru! ✨ ${selectedPhotoItem.uri}`,
        title: 'Rubaru Photo',
      });
    } catch (e) {}
  };

  const handleImageTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 320;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Instagram double-tap heart animation and like
      if (!isOwnProfile && !photoLiked) {
        handlePhotoLikeToggle();
      }
      setShowHeartAnimation(true);
      setTimeout(() => setShowHeartAnimation(false), 900);
    }
    lastTapRef.current = now;
  };

  const getFullUrl = (uri) => {
    if (!uri) return 'https://i.pravatar.cc/150?img=60';
    let target = uri;
    if (typeof target === 'object') {
      target = target.url || target.thumbnailUri || target.originalUrl || target.uri || '';
    }
    if (typeof target !== 'string' || !target) return 'https://i.pravatar.cc/150?img=60';
    if (target.startsWith('http') || target.startsWith('file://') || target.startsWith('content://')) return target;
    const apiBase = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.70:5000/api';
    const host = apiBase.replace('/api', '');
    return `${host}${target.startsWith('/') ? '' : '/'}${target}`;
  };

  const getAge = (dobString) => {
    if (!dobString) return 22;
    const birthDate = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Swipe-to-dismiss & Tap-to-dismiss for Settings Bottom Sheet Handle
  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 15 || gestureState.vy > 0.15) {
          setShowSettingsModal(false);
        } else if (Math.abs(gestureState.dy) < 15 && Math.abs(gestureState.dx) < 15) {
          // Tap on handle also closes
          setShowSettingsModal(false);
        }
      },
    })
  ).current;

  useFocusEffect(
    React.useCallback(() => {
      if (params?.openSettings === 'true') {
        setShowSettingsModal(true);
        router.setParams({ openSettings: undefined });
      }
    }, [params?.openSettings])
  );

  // 3-Step Delete Account Modal States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1); // 1, 2, or 3
  const [selectedReason, setSelectedReason] = useState('Other');

  // Settings Toggles
  const { isDarkMode, toggleTheme, setDarkMode } = useTheme();
  const isHindi = language === 'hi';

  // Language flag slider animation (0 = English/Left, 1 = Hindi/Right)
  const langAnim = useRef(new Animated.Value(isHindi ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(langAnim, {
      toValue: isHindi ? 1 : 0,
      friction: 7,
      tension: 60,
      useNativeDriver: false,
    }).start();
  }, [isHindi]);

  const toggleLanguage = () => {
    if (language === 'en') {
      setLanguage('hi');
    } else {
      setLanguage('en');
    }
  };

  if (loading) {
    return (
      <View style={[styles.rootContainer, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF2E63" />
      </View>
    );
  }

  return (
    <View style={styles.rootContainer}>
      {/* Full-Screen Blush Hearts Background Image */}
      <ImageBackground
        source={require('@assets/images/app_background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
        blurRadius={showSettingsModal || showDeleteModal ? 4 : 0}
      >
        <View style={[styles.mainWrapper, { paddingTop: Math.max(insets.top + 12, 40) }]}>

          {/* Top Header Row */}
          <View style={styles.topHeaderRow}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
              hitSlop={12}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={26} color="#111827" />
            </Pressable>

            <Text numberOfLines={1} style={styles.headerTitle}>
              {profile?.displayName || 'Profile'}
            </Text>

            {/* 3 Dots Menu Button - Opens Settings Bottom Sheet Sidebar */}
            <Pressable
              onPress={() => setShowSettingsModal(true)}
              style={({ pressed }) => [styles.menuButton, pressed && styles.buttonPressed]}
              hitSlop={12}
              accessibilityLabel="More settings options"
            >
              <Ionicons name="ellipsis-horizontal" size={20} color="#111827" />
            </Pressable>
          </View>

          {/* Main Scrollable Content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 }]}
          >
            {/* Avatar Photo Section */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarRingOuter}>
                {(!profile?.avatarUri || profile.avatarUri.includes('pravatar.cc')) ? (
                  <View style={[styles.avatarImage, { backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="person-outline" size={36} color="#9CA3AF" />
                  </View>
                ) : (
                  <Image
                    source={{ uri: getFullUrl(profile.avatarUri) }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                )}
              </View>
              <Text style={styles.followersText}>
                {profile?.followersCount !== undefined ? `${profile.followersCount} Followers` : '0 Followers'}
              </Text>
            </View>

            {/* Action Buttons Row - Instagram Reference: Edit/Share for Own Profile, Follow/Message/Call for Other Profile */}
            {isOwnProfile ? (
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => router.push('/edit-profile')}
                  style={({ pressed }) => [
                    styles.ownProfilePill,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Ionicons name="create-outline" size={16} color="#111827" style={{ marginRight: 6 }} />
                  <Text style={styles.actionPillText}>{t('editProfile', 'Edit Profile')}</Text>
                </Pressable>

                <Pressable
                  onPress={async () => {
                    try {
                      await Share.share({
                        message: `Check out ${profile?.displayName || 'my'} profile on Rubaru! ✨`,
                        title: 'Rubaru Profile',
                      });
                    } catch (e) {}
                  }}
                  style={({ pressed }) => [
                    styles.ownProfilePill,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Ionicons name="share-social-outline" size={16} color="#111827" style={{ marginRight: 6 }} />
                  <Text style={styles.actionPillText}>{t('shareProfile', 'Share Profile')}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.actionRow}>
                <Pressable
                  onPress={handleFollowToggle}
                  style={({ pressed }) => [
                    styles.actionPill,
                    isFollowing && styles.actionPillActive,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={[styles.actionPillText, isFollowing && styles.actionPillTextActive]}>
                    {isFollowing ? t('following', 'Following') : t('follow', 'Follow')}
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.actionPill, pressed && styles.buttonPressed]}
                  onPress={() => {
                    // Open or create a private chat with this user
                    router.push({
                      pathname: `/chat/${params.userId}`,
                      params: {
                        recipientId: params.userId,
                        name: profile?.displayName || 'User',
                        avatarUrl: profile?.avatarUri || '',
                      },
                    });
                  }}
                >
                  <Text style={styles.actionPillText}>{t('message', 'Message')}</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.actionPill, pressed && styles.buttonPressed]}
                  onPress={() => router.push({
                    pathname: '/active-call',
                    params: {
                      contactName: profile?.displayName || 'User',
                      avatarUri: profile?.avatarUri || '',
                      callType: 'voice',
                      receiverId: params.userId,
                      initialStatus: 'calling',
                    },
                  })}
                >
                  <Text style={styles.actionPillText}>{t('call', 'Call')}</Text>
                </Pressable>
              </View>
            )}

            {/* Tabs Filter Bar Header (Top & About Me options) */}
            <View style={styles.tabsHeaderContainer}>
              <View style={styles.tabsRow}>
                <Pressable
                  onPress={() => setActiveTab('top')}
                  style={styles.tabItem}
                >
                  <Text style={[styles.tabText, activeTab === 'top' && styles.tabTextActive]}>
                    {t('top', 'Top')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setActiveTab('about')}
                  style={styles.tabItem}
                >
                  <Text style={[styles.tabText, activeTab === 'about' && styles.tabTextActive]}>
                    {params.userId
                      ? `About ${profile?.displayName?.split(' ')[0] || 'User'}`
                      : t('aboutMe', 'About Me')}
                  </Text>
                </Pressable>
              </View>

              {/* Dual Underline Indicators (Red for Active, Grey for Inactive) */}
              <View style={styles.tabTrackContainer}>
                <View style={styles.tabTrackHalf}>
                  <View
                    style={[
                      styles.tabIndicatorBar,
                      activeTab === 'top' ? styles.indicatorActive : styles.indicatorInactive,
                    ]}
                  />
                </View>
                <View style={styles.tabTrackHalf}>
                  <View
                    style={[
                      styles.tabIndicatorBar,
                      activeTab === 'about' ? styles.indicatorActive : styles.indicatorInactive,
                    ]}
                  />
                </View>
              </View>
            </View>

            {activeTab === 'top' ? (() => {
              const reelsArr = Array.isArray(userReels) ? userReels : [];
              const photosArr = Array.isArray(profile?.photosDetailed) && profile.photosDetailed.length > 0
                ? profile.photosDetailed
                : (Array.isArray(profile?.photos) ? profile.photos : []);
              const mediaItems = [...reelsArr, ...photosArr];

              return (
                <View style={{ paddingHorizontal: 4, marginTop: 12 }}>
                  {/* Instagram-style Creator Bar for Owner */}
                  {!params.userId && (
                    <View style={styles.topCreatorRow}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={handleOpenCreateOptions}
                        style={styles.topCreateReelPill}
                      >
                        <LinearGradient
                          colors={['#FF2E63', '#FF4E79']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.topCreateReelGradient}
                        >
                          <Ionicons name="videocam" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.topCreateReelText}>+ Upload Short Video</Text>
                        </LinearGradient>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => router.push('/edit-profile')}
                        style={styles.topAddPhotoPill}
                      >
                        <Ionicons name="images-outline" size={16} color="#111827" style={{ marginRight: 5 }} />
                        <Text style={styles.topAddPhotoText}>Add Photos</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {mediaItems.length === 0 ? (
                    /* Empty state */
                    <Pressable
                      onPress={() => !params.userId && handleOpenCreateOptions()}
                      style={styles.emptyInterestsContainer}
                    >
                      <Ionicons name="videocam-outline" size={22} color="#FF2E63" />
                      <Text style={styles.emptyInterestsText}>
                        {params.userId
                          ? `${profile?.displayName?.split(' ')[0] || 'This user'} hasn't posted anything yet`
                          : 'No posts yet — tap to upload your first short video'}
                      </Text>
                    </Pressable>
                  ) : (
                    /* 3-column masonry grid */
                    <View style={styles.masonryGrid}>
                      {/* Column 1 */}
                      <View style={styles.masonryColumn}>
                        {mediaItems
                          .filter((_, i) => i % 3 === 0)
                          .map((item, idx) => {
                            const isReel = typeof item === 'object' && (item.videoUri || item.contentType === 'REEL');
                            const rawUri = isReel
                              ? item.thumbnailUri
                              : (typeof item === 'object' ? (item.url || item.thumbnailUri || item.uri) : item);
                            const uri = rawUri ? getFullUrl(rawUri) : null;
                            const cardHeight = idx % 2 === 0 ? 200 : 130;
                            return (
                              <Pressable
                                key={`col1-${idx}`}
                                onPress={() => handleOpenMediaItem(item)}
                                style={[styles.mediaCard, { height: cardHeight }]}
                              >
                                {uri ? (
                                  <Image source={{ uri }} style={styles.mediaImage} resizeMode="cover" />
                                ) : (
                                  <View style={[styles.mediaImage, { backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }]}>
                                    <Ionicons name="videocam-outline" size={28} color="#9CA3AF" />
                                  </View>
                                )}
                                {isReel && (
                                  <LinearGradient
                                    colors={['transparent', 'rgba(0,0,0,0.65)']}
                                    style={styles.mediaCardGradientOverlay}
                                  >
                                    <View style={styles.reelCardStatsRow}>
                                      <Ionicons name="play" size={12} color="#FFFFFF" style={{ marginRight: 3 }} />
                                      <Text style={styles.reelCardPlayText}>
                                        {item.viewsCount ? (item.viewsCount > 999 ? `${(item.viewsCount/1000).toFixed(1)}k` : item.viewsCount) : '0'}
                                      </Text>
                                    </View>
                                  </LinearGradient>
                                )}
                              </Pressable>
                            );
                          })}
                      </View>

                      {/* Column 2 */}
                      <View style={styles.masonryColumn}>
                        {mediaItems
                          .filter((_, i) => i % 3 === 1)
                          .map((item, idx) => {
                            const isReel = typeof item === 'object' && (item.videoUri || item.contentType === 'REEL');
                            const rawUri = isReel
                              ? item.thumbnailUri
                              : (typeof item === 'object' ? (item.url || item.thumbnailUri || item.uri) : item);
                            const uri = rawUri ? getFullUrl(rawUri) : null;
                            const cardHeight = idx % 2 === 0 ? 130 : 170;
                            return (
                              <Pressable
                                key={`col2-${idx}`}
                                onPress={() => handleOpenMediaItem(item)}
                                style={[styles.mediaCard, { height: cardHeight }]}
                              >
                                {uri ? (
                                  <Image source={{ uri }} style={styles.mediaImage} resizeMode="cover" />
                                ) : (
                                  <View style={[styles.mediaImage, { backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }]}>
                                    <Ionicons name="videocam-outline" size={28} color="#9CA3AF" />
                                  </View>
                                )}
                                {isReel && (
                                  <LinearGradient
                                    colors={['transparent', 'rgba(0,0,0,0.65)']}
                                    style={styles.mediaCardGradientOverlay}
                                  >
                                    <View style={styles.reelCardStatsRow}>
                                      <Ionicons name="play" size={12} color="#FFFFFF" style={{ marginRight: 3 }} />
                                      <Text style={styles.reelCardPlayText}>
                                        {item.viewsCount ? (item.viewsCount > 999 ? `${(item.viewsCount/1000).toFixed(1)}k` : item.viewsCount) : '0'}
                                      </Text>
                                    </View>
                                  </LinearGradient>
                                )}
                              </Pressable>
                            );
                          })}
                      </View>

                      {/* Column 3 */}
                      <View style={styles.masonryColumn}>
                        {mediaItems
                          .filter((_, i) => i % 3 === 2)
                          .map((item, idx) => {
                            const isReel = typeof item === 'object' && (item.videoUri || item.contentType === 'REEL');
                            const rawUri = isReel
                              ? item.thumbnailUri
                              : (typeof item === 'object' ? (item.url || item.thumbnailUri || item.uri) : item);
                            const uri = rawUri ? getFullUrl(rawUri) : null;
                            const cardHeight = idx % 2 === 0 ? 150 : 120;
                            return (
                              <Pressable
                                key={`col3-${idx}`}
                                onPress={() => handleOpenMediaItem(item)}
                                style={[styles.mediaCard, { height: cardHeight }]}
                              >
                                {uri ? (
                                  <Image source={{ uri }} style={styles.mediaImage} resizeMode="cover" />
                                ) : (
                                  <View style={[styles.mediaImage, { backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }]}>
                                    <Ionicons name="videocam-outline" size={28} color="#9CA3AF" />
                                  </View>
                                )}
                                {isReel && (
                                  <LinearGradient
                                    colors={['transparent', 'rgba(0,0,0,0.65)']}
                                    style={styles.mediaCardGradientOverlay}
                                  >
                                    <View style={styles.reelCardStatsRow}>
                                      <Ionicons name="play" size={12} color="#FFFFFF" style={{ marginRight: 3 }} />
                                      <Text style={styles.reelCardPlayText}>
                                        {item.viewsCount ? (item.viewsCount > 999 ? `${(item.viewsCount/1000).toFixed(1)}k` : item.viewsCount) : '0'}
                                      </Text>
                                    </View>
                                  </LinearGradient>
                                )}
                              </Pressable>
                            );
                          })}
                      </View>
                    </View>
                  )}
                </View>
              );
            })() : (
              /* Inline About Me Content */
              <View style={styles.aboutMeInlineContainer}>
                {/* 2. Bio Quote Card */}
                <QuoteCard
                  quoteStart={profile?.bio || 'Hello, I am new on Rubaru!'}
                  quoteEmphasis=""
                  width={SCREEN_WIDTH - 36}
                />

                {/* 3. Stats Bar - Dynamic Likes, Connections, and Profile Views */}
                <StatsBar
                  likes={profile?.likesCount !== undefined ? profile.likesCount : (profile?.followersCount || 0)}
                  connections={profile?.connectionsCount !== undefined ? profile.connectionsCount : (profile?.followingCount || 0)}
                  views={profile?.profileViews !== undefined ? profile.profileViews : 0}
                  onLikesPress={() => {
                    showToast(`❤️ ${profile?.likesCount || 0} Total Likes received`);
                  }}
                  onConnectionsPress={() => {
                    showToast(`👥 ${profile?.connectionsCount || 0} Active Connections`);
                  }}
                  onViewsPress={() => {
                    showToast(`👀 ${profile?.profileViews || 0} Total Profile Views`);
                  }}
                />

                {/* 4. About Section */}
                <View style={styles.aboutSectionContainer}>
                  <View style={styles.aboutTitleRow}>
                    <Text style={styles.aboutSerifTitle}>{t('about', 'About')}</Text>
                    <View style={styles.dashedAccentRow}>
                      <View style={styles.dashLine} />
                      <View style={styles.dashDot} />
                    </View>
                  </View>
                  <View style={styles.detailsGrid}>
                    <InfoPill icon="gift-outline" label={`${getAge(profile?.dateOfBirth)} Yrs`} />
                    <InfoPill icon="transgender-outline" label={profile?.gender || 'N/A'} />
                    <InfoPill icon="location-outline" label={profile?.locationName || 'India'} />
                    <InfoPill icon="call-outline" label={profile?.user?.phone || 'N/A'}  />
                  </View>
                </View>

                {/* 5. Short Videos & Reels Section (Instagram Reference) */}
                <View style={styles.aboutSectionContainer}>
                  <View style={styles.momentsHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="videocam" size={20} color="#FF2E63" style={{ marginRight: 8 }} />
                      <Text style={styles.aboutSerifTitle}>Short Videos & Reels</Text>
                      {userReels.length > 0 && (
                        <View style={styles.reelsCountBadge}>
                          <Text style={styles.reelsCountBadgeText}>{userReels.length}</Text>
                        </View>
                      )}
                    </View>
                    {!params.userId && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleOpenCreateOptions}
                        style={styles.createReelSmallBtn}
                      >
                        <Ionicons name="add" size={15} color="#FFFFFF" style={{ marginRight: 2 }} />
                        <Text style={styles.createReelSmallText}>Create</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {userReels.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.reelsHorizontalScrollContent}
                    >
                      {!params.userId && (
                        /* Instagram Add Reel Card */
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={handleOpenCreateOptions}
                          style={styles.addReelInlineCard}
                        >
                          <LinearGradient
                            colors={['rgba(255, 46, 99, 0.08)', 'rgba(255, 46, 99, 0.15)']}
                            style={styles.addReelInlineGradient}
                          >
                            <View style={styles.addReelPlusCircle}>
                              <Ionicons name="add" size={26} color="#FF2E63" />
                            </View>
                            <Text style={styles.addReelInlineTitle}>New Reel</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      )}

                      {userReels.map((reel, index) => {
                        const thumbUri = reel.thumbnailUri ? getFullUrl(reel.thumbnailUri) : null;
                        return (
                          <TouchableOpacity
                            key={reel.id || reel.postId || index}
                            activeOpacity={0.88}
                            onPress={() => handleOpenMediaItem(reel)}
                            style={styles.reelStoryCard}
                          >
                            {thumbUri ? (
                              <Image source={{ uri: thumbUri }} style={styles.reelStoryImage} resizeMode="cover" />
                            ) : (
                              <View style={[styles.reelStoryImage, styles.reelPlaceholderBg]}>
                                <Ionicons name="videocam-outline" size={30} color="#9CA3AF" />
                              </View>
                            )}
                            <LinearGradient
                              colors={['transparent', 'rgba(0,0,0,0.8)']}
                              style={styles.reelStoryGradient}
                            >
                              <View style={styles.reelPlayRow}>
                                <Ionicons name="play" size={12} color="#FFFFFF" style={{ marginRight: 3 }} />
                                <Text style={styles.reelPlayText}>
                                  {reel.viewsCount ? (reel.viewsCount > 999 ? `${(reel.viewsCount/1000).toFixed(1)}k` : reel.viewsCount) : '0'}
                                </Text>
                              </View>
                              {reel.caption ? (
                                <Text style={styles.reelCaptionSmall} numberOfLines={1}>
                                  {reel.caption}
                                </Text>
                              ) : null}
                            </LinearGradient>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => !params.userId && handleOpenCreateOptions()}
                      style={styles.emptyReelBanner}
                    >
                      <View style={styles.emptyReelIconCircle}>
                        <Ionicons name="film-outline" size={24} color="#FF2E63" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.emptyReelBannerTitle}>
                          {params.userId
                            ? 'No short videos posted yet'
                            : 'Upload your first short video'}
                        </Text>
                        <Text style={styles.emptyReelBannerSubtitle}>
                          {params.userId
                            ? 'Check back later for new reels'
                            : 'Share short video clips to showcase on your profile'}
                        </Text>
                      </View>
                      {!params.userId && (
                        <View style={styles.addReelPillSmall}>
                          <Text style={styles.addReelPillSmallText}>+ Add</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                {/* 6. Captured Moments Section */}
                <View style={styles.aboutSectionContainer}>
                  <View style={styles.momentsHeaderRow}>
                    <Text style={styles.aboutSerifTitle}>{t('capturedMoments', 'Captured Moments')}</Text>
                    {!params.userId && (
                      <Pressable onPress={() => router.push('/edit-profile')} style={styles.viewAllBtn}>
                        <Text style={styles.viewAllText}>{t('viewAll', 'View All')}</Text>
                        <Ionicons name="chevron-forward" size={14} color="#F04452" style={{ marginLeft: 2 }} />
                      </Pressable>
                    )}
                  </View>
                  {((profile?.photosDetailed && profile.photosDetailed.length > 0) || (profile?.photos && profile.photos.length > 0)) ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.momentsScrollContent}>
                      {(profile?.photosDetailed && profile.photosDetailed.length > 0 ? profile.photosDetailed : profile.photos).map((photo, index) => (
                        <PhotoThumbnail
                          key={index}
                          uri={getFullUrl(typeof photo === 'object' ? (photo.url || photo.thumbnailUri) : photo)}
                          fallback={require('@assets/images/onboarding2.jpg')}
                          onPress={() => handleOpenMediaItem(photo)}
                        />
                      ))}
                    </ScrollView>
                  ) : (
                    <Pressable
                      onPress={() => !params.userId && router.push('/edit-profile')}
                      style={styles.emptyInterestsContainer}
                    >
                      <Ionicons name="image-outline" size={20} color="#FF2E63" />
                      <Text style={styles.emptyInterestsText}>
                        {params.userId
                          ? 'No photos shared yet'
                          : 'Add photos to showcase your moments'}
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* 7. Things I Love Section */}
                <View style={styles.aboutSectionContainer}>
                  <Text style={[styles.aboutSerifTitle, { marginBottom: 14 }]}>{t('thingsILove', 'Things I Love')}</Text>
                  {profile?.interests && profile.interests.length > 0 ? (
                    <View style={styles.interestsWrappedGrid}>
                      {profile.interests.map((interest, index) => {
                        const matchingInterest = ALL_INTERESTS.find(i => i.name.toLowerCase() === interest.toLowerCase());
                        const icon = matchingInterest ? matchingInterest.icon : 'heart-outline';
                        return (
                          <InterestPill key={index} icon={icon} label={interest} />
                        );
                      })}
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => !params.userId && router.push('/edit-profile')}
                      style={styles.emptyInterestsContainer}
                    >
                      <Ionicons name={params.userId ? 'heart-outline' : 'add-circle-outline'} size={20} color="#FF2E63" />
                      <Text style={styles.emptyInterestsText}>
                        {params.userId
                          ? `${profile?.displayName?.split(' ')[0] || 'This user'} hasn't added interests yet`
                          : 'Add interests to show what you love'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}

          </ScrollView>

          {/* Integrated Bottom Navigation Tab Bar */}
          <BottomTabBar
            activeTab="groups"
            onTabPress={(tabKey) => {
              router.push(tabKey === 'index' ? '/(tabs)' : `/(tabs)/${tabKey}`);
            }}
          />

        </View>
      </ImageBackground>

      {/* Settings & Profile Options Sidebar Bottom Sheet Modal */}
      <Modal
        visible={showSettingsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          {/* Frosted Glass Blur Backdrop */}
          <BlurView
            intensity={25}
            tint="dark"
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* Full Touch Backdrop to Close */}
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowSettingsModal(false)}
          />

          {/* Dedicated Top Area Above Sheet - Clicking anywhere on the top profile closes sidebar */}
          <Pressable
            style={{ flex: 1, width: '100%' }}
            onPress={() => setShowSettingsModal(false)}
            accessibilityLabel="Close sidebar"
          />

          {/* Sidebar Sheet Container */}
          <View
            style={[styles.sidebarSheetContent, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}
          >
            {/* Top Grab Handle Indicator Bar Area - Touch or Swipe down to lower/close sidebar */}
            <View
              {...handlePanResponder.panHandlers}
              style={styles.grabHandleArea}
              accessibilityLabel="Swipe down or tap to close settings sidebar"
            >
              <View style={styles.sidebarGrabHandle} />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
              scrollEventThrottle={16}
              bounces={true}
              overScrollMode="never"
              keyboardShouldPersistTaps="handled"
              onScroll={(e) => {
                scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
              }}
              onScrollEndDrag={(e) => {
                if (e.nativeEvent.contentOffset.y < -25 || (scrollOffsetRef.current <= 0 && e.nativeEvent.velocity && e.nativeEvent.velocity.y < -0.3)) {
                  setShowSettingsModal(false);
                }
              }}
              style={{ maxHeight: Dimensions.get('window').height * 0.74 }}
              contentContainerStyle={{ paddingBottom: 24 }}
            >

              {/* Group 1: Profile */}
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="time-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>{t('profile', 'Profile')}</Text>
              </View>
              {/* Only show Edit Profile when on own profile */}
              {!params.userId && (
                <Pressable
                  onPress={() => {
                    setShowSettingsModal(false);
                    router.push('/edit-profile');
                  }}
                  style={styles.settingItemRow}
                >
                  <View style={styles.bulletDot} />
                  <Text style={styles.settingItemText}>{t('editProfile', 'Edit Profile')}</Text>
                </Pressable>
              )}

              {/* Group 2: Quick Links */}
              <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
                <Ionicons name="globe-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>{t('quickLinks', 'Quick Links')}</Text>
              </View>
              <Pressable
                onPress={() => {
                  setShowSettingsModal(false);
                  router.push('/my-points');
                }}
                style={styles.settingItemRow}
              >
                <View style={styles.bulletDot} />
                <Text style={styles.settingItemText}>{t('wallet', 'Wallet')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowSettingsModal(false);
                  router.push('/transactions?from=sidebar');
                }}
                style={styles.settingItemRow}
              >
                <View style={styles.bulletDot} />
                <Text style={styles.settingItemText}>{t('transactions', 'Transactions')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowSettingsModal(false);
                  router.push('/violations');
                }}
                style={styles.settingItemRow}
              >
                <View style={styles.bulletDot} />
                <Text style={styles.settingItemText}>{t('warnings', 'Warnings')}</Text>
              </Pressable>

              {/* Group 3: Help & Support */}
              <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
                <Ionicons name="people-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>{t('helpAndSupport', 'Help & Support')}</Text>
              </View>
              <Pressable
                onPress={() => {
                  setShowSettingsModal(false);
                  router.push('/help-support');
                }}
                style={styles.settingItemRow}
              >
                <View style={styles.bulletDot} />
                <Text style={styles.settingItemText}>{t('helpAndSupport', 'Help & Support')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowSettingsModal(false);
                  router.push('/feedback');
                }}
                style={styles.settingItemRow}
              >
                <View style={styles.bulletDot} />
                <Text style={styles.settingItemText}>{t('feedback', 'Feedback')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowSettingsModal(false);
                  router.push('/faqs');
                }}
                style={styles.settingItemRow}
              >
                <View style={styles.bulletDot} />
                <Text style={styles.settingItemText}>{t('faqs', 'FAQs')}</Text>
              </Pressable>

              {/* Group 4: Others */}
              <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
                <Ionicons name="star-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>{t('others', 'Others')}</Text>
              </View>
              {[
                { key: 'blockedChats', label: 'Blocked Chats', route: '/blocked-chats' },
                { key: 'privacyPolicy', label: 'Privacy Policy', route: '/privacy-policy' },
                { key: 'termsOfUse', label: 'Terms of Use', route: '/terms-of-use' },
                { key: 'communityGuidelines', label: 'Community Guidelines', route: '/community-standards' },
                { key: 'permissionGrantKey', label: 'Permission Grant Key', route: '/permission-grant' },
                { key: 'aboutUs', label: 'About Us', route: '/about-us' },
              ].map((item, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => {
                    setShowSettingsModal(false);
                    if (item.route) {
                      router.push(item.route);
                    }
                  }}
                  style={styles.settingItemRow}
                >
                  <View style={styles.bulletDot} />
                  <Text style={styles.settingItemText}>{t(item.key, item.label)}</Text>
                </Pressable>
              ))}

              {/* Group 5: Settings */}
              <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
                <Ionicons name="settings-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>{t('settings', 'Settings')}</Text>
              </View>

              {/* Notification Settings Option */}
              <Pressable
                onPress={() => {
                  setShowSettingsModal(false);
                  router.push('/notification-settings');
                }}
                style={styles.settingItemRow}
              >
                <View style={styles.bulletDot} />
                <Text style={styles.settingItemText}>{t('notificationSettings', 'Notification Settings')}</Text>
              </Pressable>

              {/* Delete Account Option -> Opens 3-Step Delete Modal */}
              <Pressable
                onPress={() => {
                  setShowSettingsModal(false);
                  setTimeout(() => {
                    setDeleteStep(1);
                    setShowDeleteModal(true);
                  }, 150);
                }}
                style={styles.settingItemRow}
              >
                <View style={styles.bulletDot} />
                <Text style={styles.settingItemText}>{t('deleteAccount', 'Delete Account')}</Text>
              </Pressable>

              {/* Sign Out Option */}
              <Pressable
                onPress={async () => {
                  setShowSettingsModal(false);
                  try {
                    await AsyncStorage.removeItem('userToken');
                    disconnectSocket();
                    router.replace('/sign-in');
                  } catch (e) {
                    console.log('Logout error:', e.message);
                  }
                }}
                style={styles.settingItemRow}
              >
                <View style={styles.bulletDot} />
                <Text style={[styles.settingItemText, { color: '#FF2E63', fontWeight: '700' }]}>
                  {t('signOut', 'Sign Out')}
                </Text>
              </Pressable>

              {/* Group 6: App Language — Segmented Pill Control */}
              <View style={[styles.sectionHeaderRow, { marginTop: 18, marginBottom: 10 }]}>
                <Text style={styles.langSectionIcon}>文A</Text>
                <Text style={[styles.sectionHeaderTitle, { marginLeft: 6 }]}>{t('appLanguage', 'App Language')}</Text>
              </View>

              {/* Segmented pill — EN / हिंदी */}
              <View style={styles.langSegmentTrack}>
                {/* English pill */}
                <Pressable
                  onPress={() => setLanguage('en')}
                  style={[styles.langSegmentBtn, !isHindi && styles.langSegmentBtnActive]}
                >
                  <Text style={[styles.langSegmentCode, !isHindi && styles.langSegmentCodeActive]}>EN</Text>
                  <Text style={[styles.langSegmentName, !isHindi && styles.langSegmentNameActive]}>English</Text>
                </Pressable>

                {/* Hindi pill */}
                <Pressable
                  onPress={() => setLanguage('hi')}
                  style={[styles.langSegmentBtn, isHindi && styles.langSegmentBtnActive]}
                >
                  <Text style={[styles.langSegmentCode, isHindi && styles.langSegmentCodeActive]}>हि</Text>
                  <Text style={[styles.langSegmentName, isHindi && styles.langSegmentNameActive]}>हिंदी</Text>
                </Pressable>
              </View>

              {/* Group 7: Mode */}
              <View style={[styles.settingSwitchRow, { marginTop: 18 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="options-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                  <Text style={styles.sectionHeaderTitle}>{t('mode', 'Mode')}</Text>
                </View>
                <Switch
                  value={isDarkMode}
                  onValueChange={toggleTheme}
                  trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Group 8: Log out */}
              <Pressable
                onPress={() => {
                  setShowSettingsModal(false);
                  router.replace('/sign-in');
                }}
                style={[styles.sectionHeaderRow, { marginTop: 24, marginBottom: 16 }]}
              >
                <Ionicons name="log-out-outline" size={22} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>{t('logout', 'Log out')}</Text>
              </Pressable>

            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 3-Step Delete Account Card Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <Pressable style={styles.modalOverlayCenter} onPress={() => setShowDeleteModal(false)}>
          <BlurView
            intensity={30}
            tint="dark"
            style={StyleSheet.absoluteFillObject}
          />
          <Pressable style={styles.deleteCardBox} onPress={(e) => e.stopPropagation()}>

            {/* Top Close 'X' Button */}
            <Pressable
              onPress={() => setShowDeleteModal(false)}
              style={styles.closeXButton}
              hitSlop={12}
            >
              <Ionicons name="close" size={22} color="#111827" />
            </Pressable>

            {/* Step 1: Warning Confirmation Card */}
            {deleteStep === 1 && (
              <View style={styles.deleteStepContent}>
                <Text style={styles.deleteWarningText}>
                  {t('deleteAccountWarning', 'Are you sure you want to delete your account? This action is permanent and cannot be undone. Your profile, chats, matches, wallet history, and other account data will be permanently removed.')}
                </Text>

                <View style={styles.deleteButtonRow}>
                  <Pressable
                    onPress={() => setShowDeleteModal(false)}
                    style={[styles.deleteActionButton, { backgroundColor: '#EF4444' }]}
                  >
                    <Text style={styles.deleteButtonText}>{t('cancel', 'Cancel')}</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setDeleteStep(2)}
                    style={[styles.deleteActionButton, { backgroundColor: '#10B981' }]}
                  >
                    <Text style={styles.deleteButtonText}>{t('confirm', 'Confirm')}</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Step 2: Reason Selection Options Card */}
            {deleteStep === 2 && (
              <View style={styles.deleteStepContent}>
                <Text style={styles.deleteReasonHeader}>{t('reasonForDeleting', 'Reason for deleting (Optional)')}</Text>

                <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                  {[
                    { key: 'foundSomeone', label: 'I found someone ♥' },
                    { key: 'privacyConcerns', label: 'Privacy concerns' },
                    { key: 'tooManyNotifications', label: 'Too many notifications' },
                    { key: 'notUsingApp', label: 'Not using the app anymore' },
                    { key: 'createdAnotherAccount', label: 'Created another account' },
                    { key: 'poorExperience', label: 'Poor experience' },
                    { key: 'other', label: 'Other' },
                  ].map((reasonItem, idx) => {
                    const isSelected = selectedReason === reasonItem.key;
                    return (
                      <Pressable
                        key={idx}
                        onPress={() => setSelectedReason(reasonItem.key)}
                        style={styles.reasonOptionRow}
                      >
                        <View style={styles.reasonBulletRow}>
                          <View style={styles.bulletDot} />
                          <Text style={styles.reasonOptionText}>{t(reasonItem.key, reasonItem.label)}</Text>
                        </View>

                        <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                          {isSelected && <View style={styles.radioInnerDot} />}
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Pressable
                  onPress={() => setDeleteStep(3)}
                  style={styles.nextLinkButton}
                  hitSlop={12}
                >
                  <Text style={styles.nextLinkText}>{t('next', 'Next')} →</Text>
                </Pressable>
              </View>
            )}

            {/* Step 3: Final Permanent Profile Deletion Confirmation */}
            {deleteStep === 3 && (
              <View style={styles.deleteStepContent}>
                <Text style={styles.deleteFinalTitle}>{t('deleteAccountFinalTitle', 'Delete my profile permanently.')}</Text>

                <View style={[styles.deleteButtonRow, { marginTop: 28 }]}>
                  <Pressable
                    onPress={() => setShowDeleteModal(false)}
                    style={[styles.deleteActionButton, { backgroundColor: '#EF4444' }]}
                  >
                    <Text style={styles.deleteButtonText}>{t('cancel', 'Cancel')}</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setShowDeleteModal(false);
                      router.replace('/sign-in');
                    }}
                    style={[styles.deleteActionButton, { backgroundColor: '#10B981' }]}
                  >
                    <Text style={styles.deleteButtonText}>{t('confirm', 'Confirm')}</Text>
                  </Pressable>
                </View>
              </View>
            )}

          </Pressable>
        </Pressable>
      </Modal>

      {/* 1. Instagram-Style Create Reel Source Picker Modal */}
      <Modal
        visible={showCreateReelPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateReelPicker(false)}
      >
        <Pressable
          style={styles.reelPickerModalOverlay}
          onPress={() => setShowCreateReelPicker(false)}
        >
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} pointerEvents="none" />
          <Pressable style={styles.reelPickerSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandleBar} />
            <Text style={styles.reelPickerTitle}>Create Short Video</Text>
            <Text style={styles.reelPickerSubtitle}>Share authentic moments with your community</Text>

            {/* Option A: Camera */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.reelOptionCard}
              onPress={handleRecordWithCamera}
            >
              <LinearGradient
                colors={['#FF2E63', '#FF4E79']}
                style={styles.reelOptionIconCircle}
              >
                <Ionicons name="camera" size={24} color="#FFFFFF" />
              </LinearGradient>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.reelOptionTitle}>Record with Camera</Text>
                <Text style={styles.reelOptionDesc}>Record video clips up to 90s with filters</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Option B: Gallery */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.reelOptionCard}
              onPress={handlePickFromGallery}
            >
              <LinearGradient
                colors={['#8B5CF6', '#EC4899']}
                style={styles.reelOptionIconCircle}
              >
                <Ionicons name="images" size={24} color="#FFFFFF" />
              </LinearGradient>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.reelOptionTitle}>Upload from Gallery</Text>
                <Text style={styles.reelOptionDesc}>Choose an existing video from your device</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.reelPickerCancelBtn}
              onPress={() => setShowCreateReelPicker(false)}
            >
              <Text style={styles.reelPickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 2. Instagram-Style Reel Caption & Publish Modal */}
      <Modal
        visible={showUploadPreviewModal}
        transparent
        animationType="slide"
        onRequestClose={() => !isPublishingReel && setShowUploadPreviewModal(false)}
      >
        <View style={styles.uploadModalOverlay}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} pointerEvents="none" />
          <View style={[styles.uploadModalContent, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
            <View style={styles.uploadModalHeader}>
              <Text style={styles.uploadModalTitle}>New Short Video</Text>
              <TouchableOpacity
                disabled={isPublishingReel}
                onPress={() => setShowUploadPreviewModal(false)}
                style={styles.uploadModalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Video preview summary card */}
            <View style={styles.uploadVideoPreviewBox}>
              <View style={styles.uploadVideoPreviewThumb}>
                <Ionicons name="videocam" size={28} color="#FF2E63" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.uploadVideoPreviewText} numberOfLines={1}>
                  {selectedVideoAsset?.fileName || 'Selected Video Clip'}
                </Text>
                <Text style={styles.uploadVideoDurationText}>
                  {selectedVideoAsset?.duration ? `${Math.round(selectedVideoAsset.duration)}s • Ready to publish` : 'Video Ready to publish'}
                </Text>
              </View>
            </View>

            {/* Caption Input */}
            <Text style={styles.uploadInputLabel}>Caption</Text>
            <TextInput
              style={styles.uploadCaptionInput}
              placeholder="Write a catchy caption, #hashtags, or mentions..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              maxLength={300}
              value={reelCaptionText}
              onChangeText={setReelCaptionText}
              editable={!isPublishingReel}
            />
            <Text style={styles.uploadCharCountText}>{reelCaptionText.length}/300</Text>

            {/* Action buttons */}
            <TouchableOpacity
              activeOpacity={0.88}
              disabled={isPublishingReel}
              onPress={handlePublishSelectedReel}
              style={styles.uploadPublishBtn}
            >
              <LinearGradient
                colors={['#FF2E63', '#FF4E79']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.uploadPublishGradient}
              >
                {isPublishingReel ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.uploadPublishBtnText}>Share Reel</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 3. Floating Toast Banner */}
      {toastMessage && (
        <View style={[styles.toastContainer, { top: insets.top + 16 }]}>
          <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginRight: 8 }} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* 4. Instagram-Style Full-Screen Photo Viewer Modal */}
      <Modal
        visible={Boolean(selectedPhotoPreview)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhotoPreview(null)}
      >
        <View style={styles.photoViewerOverlay}>
          <BlurView intensity={85} tint="dark" style={StyleSheet.absoluteFillObject} pointerEvents="none" />

          {/* Top Bar */}
          <View style={[styles.photoViewerTopBar, { paddingTop: Math.max(insets.top + 8, 20) }]}>
            <View style={styles.photoViewerUserRow}>
              <Image
                source={{ uri: profile?.avatarUri ? getFullUrl(profile.avatarUri) : 'https://i.pravatar.cc/150?img=60' }}
                style={styles.photoViewerAvatar}
              />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.photoViewerUserName}>{profile?.displayName || 'Rubaru User'}</Text>
                <Text style={styles.photoViewerSubtitle}>{profile?.locationName || 'Moments'}</Text>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setSelectedPhotoPreview(null)}
              style={styles.photoViewerCloseBtn}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Center Image Area with Instagram Double-Tap to Like */}
          <Pressable
            style={styles.photoViewerCenterArea}
            onPress={handleImageTap}
          >
            {selectedPhotoPreview ? (
              <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                <Image
                  source={{ uri: selectedPhotoPreview }}
                  style={styles.photoViewerMainImage}
                  resizeMode="contain"
                />
                {showHeartAnimation && (
                  <View style={styles.photoViewerHeartAnim} pointerEvents="none">
                    <Ionicons name="heart" size={100} color="#FF2E63" />
                  </View>
                )}
              </View>
            ) : null}
          </Pressable>

          {/* Bottom Actions Row - Removed for owner, only visible to other users (Instagram behavior) */}
          {!isOwnProfile && (
            <View style={[styles.photoViewerBottomBar, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
              <View style={styles.photoViewerActionsRow}>
                {/* Like Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.photoViewerActionItem}
                  onPress={handlePhotoLikeToggle}
                >
                  <Ionicons
                    name={photoLiked ? 'heart' : 'heart-outline'}
                    size={28}
                    color={photoLiked ? '#FF2E63' : '#FFFFFF'}
                  />
                  <Text style={[styles.photoViewerCountText, photoLiked && { color: '#FF2E63' }]}>
                    {photoLikeCount}
                  </Text>
                </TouchableOpacity>

                {/* Comment Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.photoViewerActionItem}
                  onPress={handleOpenPhotoComments}
                >
                  <Ionicons name="chatbubble-outline" size={26} color="#FFFFFF" />
                  <Text style={styles.photoViewerCountText}>{photoCommentCount}</Text>
                </TouchableOpacity>

                {/* Share Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.photoViewerActionItem}
                  onPress={handlePhotoShare}
                >
                  <Ionicons name="paper-plane-outline" size={26} color="#FFFFFF" />
                  <Text style={styles.photoViewerActionLabel}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* 5. Photo Comments Bottom Sheet Modal */}
      {selectedPhotoItem && selectedPhotoItem.id && /^[0-9a-fA-F]{24}$/.test(String(selectedPhotoItem.id)) && (
        <PostCommentsModal
          visible={photoCommentsVisible}
          onClose={() => setPhotoCommentsVisible(false)}
          postId={selectedPhotoItem.id}
          postAuthor={profile?.displayName || 'Rubaru User'}
          postAuthorAvatar={profile?.avatarUri ? getFullUrl(profile.avatarUri) : undefined}
          postImageUri={selectedPhotoItem.uri}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#FFF0F3',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mainWrapper: {
    flex: 1,
  },
  topHeaderRow: {
    width: '100%',
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 26,
    color: '#111827',
    flex: 1,
    marginLeft: 8,
    letterSpacing: -0.5,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  avatarRingOuter: {
    width: 104,
    height: 104,
    borderRadius: 52,
    padding: 3,
    backgroundColor: '#FFFFFF',
    shadowColor: '#F44649',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
  followersText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 18,
    color: '#111827',
    marginTop: 12,
    letterSpacing: -0.3,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  actionPill: {
    width: (SCREEN_WIDTH - 68) / 3,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.8)',
  },
  ownProfilePill: {
    width: (SCREEN_WIDTH - 60) / 2,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionPillActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  actionPillText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  actionPillTextActive: {
    color: '#FFFFFF',
  },
  tabsHeaderContainer: {
    width: '100%',
    marginBottom: 20,
  },
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  tabTextActive: {
    fontWeight: '800',
    color: '#111827',
  },
  tabTrackContainer: {
    width: '100%',
    flexDirection: 'row',
    height: 4,
  },
  tabTrackHalf: {
    flex: 1,
    paddingHorizontal: 8,
  },
  tabIndicatorBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
  },
  indicatorActive: {
    backgroundColor: '#FF2D55',
  },
  indicatorInactive: {
    backgroundColor: '#E5E7EB',
  },
  masonryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  masonryColumn: {
    width: COLUMN_WIDTH,
  },
  mediaCard: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#E5E7EB',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  playButtonOverlayCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -17,
    marginLeft: -17,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  playButtonOverlayBottom: {
    position: 'absolute',
    bottom: 14,
    left: '50%',
    marginLeft: -17,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitleCenter: {
    textAlign: 'center',
    marginLeft: -26,
    fontSize: 20,
    fontWeight: '800',
  },
  menuButtonClean: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  /* About Me Section */
  aboutContainer: {
    width: '100%',
    gap: 16,
  },
  aboutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.6)',
  },
  aboutCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  aboutBioText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
    fontWeight: '500',
  },
  aboutDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  aboutDetailLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
    marginRight: 6,
  },
  aboutDetailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
  },
  interestsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFE0E6',
  },
  interestChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF2D55',
  },
  aboutProfileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(235, 238, 242, 0.8)',
  },
  aboutProfileImage: {
    width: 120,
    height: 120,
    borderRadius: 22,
  },
  aboutProfileInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  aboutProfileName: {
    fontSize: 21,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.3,
  },
  aboutProfileSub: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
    marginTop: 2,
  },
  aboutDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  aboutDistanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF2D55',
    marginLeft: 3,
  },
  aboutQuoteText: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 17,
    marginTop: 6,
    fontWeight: '400',
  },
  aboutBadgesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  aboutBadgePill: {
    backgroundColor: '#FFEAEF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  aboutBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF2D55',
  },
  /* Stats Card */
  aboutStatsCard: {
    backgroundColor: '#FFDCE2',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  aboutStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aboutStatIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFAEC0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aboutStatTextCol: {
    marginLeft: 8,
  },
  aboutStatNum: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
  },
  aboutStatLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#4B5563',
    marginTop: 1,
  },
  /* Details List Card */
  aboutDetailsListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(243, 244, 246, 0.8)',
  },
  aboutMetricsScrollView: {
    marginHorizontal: -4,
  },
  aboutMetricsScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  aboutMetricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  aboutMetricValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  aboutMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  aboutCardHorizontalLine: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 14,
  },
  aboutListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  aboutListRowText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 16,
  },
  aboutRowLine: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  /* Photos Card */
  aboutPhotosCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(243, 244, 246, 0.8)',
  },
  aboutSectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },
  aboutPhotosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  aboutPhotoSlot: {
    width: (SCREEN_WIDTH - 48 - 36 - 32) / 5,
    height: (SCREEN_WIDTH - 48 - 36 - 32) / 5,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  aboutSlotImage: {
    width: '100%',
    height: '100%',
  },
  /* Interests Card */
  aboutInterestsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(243, 244, 246, 0.8)',
  },
  aboutInterestsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aboutInterestItem: {
    alignItems: 'center',
  },
  aboutInterestIconSquare: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aboutInterestLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'flex-end',
  },
  sidebarSheetContent: {
    width: '100%',
    backgroundColor: '#FFF0F3',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 14,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  grabHandleArea: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 6,
  },
  sidebarGrabHandle: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#9CA3AF',
    alignSelf: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  settingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 8,
  },
  settingSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    paddingLeft: 8,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#4B5563',
    marginRight: 12,
  },
  settingItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  /* ─── App Language Segmented Pill ─── */
  langSectionIcon: {
    fontSize: 18,
    color: '#111827',
  },
  langSegmentTrack: {
    flexDirection: 'row',
    backgroundColor: '#F3E8ED',
    borderRadius: 14,
    padding: 4,
    marginVertical: 4,
  },
  langSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  langSegmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#E63956',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  langSegmentCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  langSegmentCodeActive: {
    color: '#E63956',
  },
  langSegmentName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  langSegmentNameActive: {
    color: '#374151',
    fontWeight: '700',
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  deleteCardBox: {
    width: Math.min(SCREEN_WIDTH - 48, 340),
    backgroundColor: '#FFF0F3',
    borderRadius: 24,
    padding: 24,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  closeXButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  deleteStepContent: {
    width: '100%',
    paddingTop: 12,
  },
  deleteWarningText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 28,
  },
  deleteButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deleteActionButton: {
    width: '46%',
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteReasonHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  reasonOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  reasonBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reasonOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: '#10B981',
  },
  radioInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  nextLinkButton: {
    alignSelf: 'flex-end',
    marginTop: 20,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  nextLinkText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3B82F6',
  },
  deleteFinalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginVertical: 16,
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  aboutMeInlineContainer: {
    paddingHorizontal: 4,
    marginTop: 45,
  },
  aboutSectionContainer: {
    marginBottom: 20,
  },
  aboutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aboutSerifTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  dashedAccentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    marginTop: 4,
  },
  dashLine: {
    width: 30,
    height: 1.5,
    backgroundColor: '#F4A9B5',
  },
  dashDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#F04452',
    marginLeft: 3,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  momentsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F04452',
  },
  momentsScrollContent: {
    paddingRight: 10,
  },
  interestsWrappedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyInterestsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 46, 99, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 46, 99, 0.15)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    width: '100%',
  },
  emptyInterestsText: {
    fontSize: 14,
    color: '#FF2E63',
    fontWeight: '600',
    marginLeft: 8,
  },
  // --- Instagram-Style Reels & Short Videos ---
  topCreatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  topCreateReelPill: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  topCreateReelGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  topCreateReelText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  topAddPhotoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  topAddPhotoText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
  },
  mediaCardGradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  reelCardStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reelCardPlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  reelsCountBadge: {
    backgroundColor: 'rgba(255, 46, 99, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  reelsCountBadgeText: {
    color: '#FF2E63',
    fontSize: 12,
    fontWeight: '700',
  },
  createReelSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF2E63',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  createReelSmallText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  reelsHorizontalScrollContent: {
    paddingRight: 12,
    gap: 12,
  },
  addReelInlineCard: {
    width: 105,
    height: 165,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 46, 99, 0.3)',
    borderStyle: 'dashed',
  },
  addReelInlineGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  addReelPlusCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 2,
    marginBottom: 8,
  },
  addReelInlineTitle: {
    color: '#FF2E63',
    fontSize: 12,
    fontWeight: '700',
  },
  reelStoryCard: {
    width: 105,
    height: 165,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111827',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  reelStoryImage: {
    width: '100%',
    height: '100%',
  },
  reelPlaceholderBg: {
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelStoryGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    justifyContent: 'flex-end',
    padding: 8,
  },
  reelPlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  reelPlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  reelCaptionSmall: {
    color: '#F3F4F6',
    fontSize: 10,
    fontWeight: '500',
  },
  emptyReelBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyReelIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 46, 99, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyReelBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  emptyReelBannerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  addReelPillSmall: {
    backgroundColor: '#FF2E63',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  addReelPillSmallText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  // --- Modals Styles ---
  reelPickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  reelPickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  sheetHandleBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  reelPickerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  reelPickerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  reelOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reelOptionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  reelOptionDesc: {
    fontSize: 12,
    color: '#6B7280',
  },
  reelPickerCancelBtn: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelPickerCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  uploadModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  uploadModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 18,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  uploadModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  uploadModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  uploadModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadVideoPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  uploadVideoPreviewThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 46, 99, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadVideoPreviewText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  uploadVideoDurationText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  uploadInputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  uploadCaptionInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
    minHeight: 85,
  },
  uploadCharCountText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 18,
  },
  uploadPublishBtn: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadPublishGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  uploadPublishBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  toastContainer: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 9999,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  // --- Full-Screen Instagram Photo Viewer ---
  photoViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'space-between',
  },
  photoViewerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  photoViewerUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoViewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FF2E63',
  },
  photoViewerUserName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  photoViewerSubtitle: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  photoViewerCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerCenterArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  photoViewerMainImage: {
    width: SCREEN_WIDTH - 16,
    height: SCREEN_WIDTH * 1.25,
    maxHeight: '85%',
    borderRadius: 12,
  },
  photoViewerBottomBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  photoViewerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  photoViewerActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  photoViewerCountText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  photoViewerActionLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  photoViewerHeartAnim: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  photoViewerActionIcon: {
    padding: 6,
  },
});
