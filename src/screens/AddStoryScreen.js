import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

import mediaService from '../services/mediaService';
import storyService from '../services/storyService';
import postService from '../services/postService';
import reelService from '../services/reelService';
import api from '../services/api';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Instagram-style Create Mode Gradients
const CREATE_GRADIENTS = [
  ['#833AB4', '#FD1D1D', '#FCB045'], // Classic IG Sunset
  ['#FA709A', '#FEE140'],             // Warm Pink Sunrise
  ['#4158D0', '#C850C0', '#FFCC70'], // Cyber Purple
  ['#0093E9', '#80D0C7'],             // Ocean Breeze
  ['#11998E', '#38EF7D'],             // Emerald Glow
  ['#232526', '#414345'],             // Midnight Dark
];

// Instagram Story Photo Filters
const STORY_FILTERS = [
  { id: 'normal', name: 'Normal', tint: 'transparent' },
  { id: 'clarendon', name: 'Clarendon', tint: 'rgba(0, 100, 255, 0.12)' },
  { id: 'juno', name: 'Juno', tint: 'rgba(255, 100, 50, 0.15)' },
  { id: 'valencia', name: 'Valencia', tint: 'rgba(255, 220, 150, 0.18)' },
  { id: 'moon', name: 'Moon', tint: 'rgba(0, 0, 0, 0.35)' },
  { id: 'vintage', name: 'Vintage', tint: 'rgba(180, 140, 80, 0.2)' },
];

// Instagram Stickers Library
const STICKER_LIST = [
  { id: 'loc', label: '📍 Location', value: 'Rubaru Live' },
  { id: 'time', label: '🕒 Time', isDynamicTime: true },
  { id: 'temp', label: '🌡️ 28°C', value: '28°C Sunny' },
  { id: 'mention', label: '@ MENTION', value: '@rubaru' },
  { id: 'fire', label: '🔥 Fire', value: '🔥' },
  { id: 'heart', label: '🩷 Love', value: '🩷' },
  { id: 'hundred', label: '💯 100', value: '💯' },
  { id: 'sparkles', label: '✨ Vibes', value: '✨ Vibes' },
];

// Instagram Music Tracks
const MUSIC_TRACKS = [
  { id: 'm1', title: 'Rubaru Beats (Original)', artist: 'Rubaru Studio', duration: '0:30' },
  { id: 'm2', title: 'Kesariya (Lo-Fi)', artist: 'Arijit Singh', duration: '0:30' },
  { id: 'm3', title: 'Starboy', artist: 'The Weeknd', duration: '0:30' },
  { id: 'm4', title: 'Levitating', artist: 'Dua Lipa', duration: '0:30' },
  { id: 'm5', title: 'Pasoori', artist: 'Ali Sethi x Shae Gill', duration: '0:30' },
];

// Text Editor Colors
const TEXT_COLORS = ['#FFFFFF', '#000000', '#FFFC00', '#FF2D55', '#00DF89', '#00A3FF', '#AF52DE'];

export default function AddStoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Mode: STORY | REEL | POST
  const [activeMode, setActiveMode] = useState('STORY');

  // Camera & Shutter states
  const cameraRef = useRef(null);
  const [cameraFacing, setCameraFacing] = useState('back');
  const [flashMode, setFlashMode] = useState('off'); // 'off' | 'on'
  const [isGridActive, setIsGridActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0); // 0 | 3 | 10
  const [countdown, setCountdown] = useState(null);
  const [cameraActiveFilter, setCameraActiveFilter] = useState(0);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [createGradientIndex, setCreateGradientIndex] = useState(0);

  // Real-time Device Gallery Photos
  const [recentPhotos, setRecentPhotos] = useState([]);
  const [lastPickedThumbnail, setLastPickedThumbnail] = useState(null);

  // Story Media & Preview states
  const [capturedImage, setCapturedImage] = useState(null);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [previewFilterIndex, setPreviewFilterIndex] = useState(0);

  // Text Sticker state
  const [textOverlay, setTextOverlay] = useState('');
  const [isAddingText, setIsAddingText] = useState(false);
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [textBgActive, setTextBgActive] = useState(true);

  // Additional Instagram Story Tools
  const [selectedSticker, setSelectedSticker] = useState(null);
  const [isStickerModalVisible, setIsStickerModalVisible] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState(null);
  const [isMusicModalVisible, setIsMusicModalVisible] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [captionText, setCaptionText] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Fetch logged in profile for the story capsule avatar
  useEffect(() => {
    let isMounted = true;
    api
      .get('/profiles/me')
      .then((res) => {
        if (isMounted && res.data) setUserProfile(res.data);
      })
      .catch(() => null);

    return () => {
      isMounted = false;
    };
  }, []);

  // Safe camera permission trigger
  useEffect(() => {
    if (cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain) {
      requestCameraPermission();
    }
  }, [cameraPermission?.granted]);

  // Flash Toast helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Real-time Gallery Picker (Opens native device album / camera roll)
  const handleOpenDeviceGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Rubaru needs gallery access to share your photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false, // Prevents Android native crop crashes
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const pickedUri = result.assets[0].uri;
        console.log('[REAL-TIME GALLERY PICKED]:', pickedUri);
        setLastPickedThumbnail(pickedUri);
        setRecentPhotos((prev) => [pickedUri, ...prev.filter((p) => p !== pickedUri)].slice(0, 10));
        setCapturedImage(pickedUri);
        setIsCreateMode(false);
      }
    } catch (err) {
      console.warn('Error picking image from device gallery:', err);
      Alert.alert('Gallery Error', 'Could not open device gallery. Please try again.');
    }
  };

  // Camera Capture with Countdown support
  const handleCapture = async () => {
    if (isCreateMode) {
      // In create mode, user is already creating a text story
      return;
    }

    if (!cameraRef.current) {
      Alert.alert('Camera Not Ready', 'Please grant camera access or choose a photo from your gallery.');
      return;
    }

    if (timerSeconds > 0) {
      let count = timerSeconds;
      setCountdown(count);
      const timerInterval = setInterval(async () => {
        count -= 1;
        if (count > 0) {
          setCountdown(count);
        } else {
          clearInterval(timerInterval);
          setCountdown(null);
          await executeCameraShot();
        }
      }, 1000);
    } else {
      await executeCameraShot();
    }
  };

  const executeCameraShot = async () => {
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false, // Ensures full JPEG decoding on Android
      });

      if (photo && photo.uri) {
        console.log('[PHOTO CAPTURED]:', photo.uri);
        setLastPickedThumbnail(photo.uri);
        setRecentPhotos((prev) => [photo.uri, ...prev].slice(0, 10));
        setCapturedImage(photo.uri);
      }
    } catch (err) {
      console.warn('Error taking photo:', err);
      Alert.alert('Capture Error', 'Could not capture photo. Please check permissions or choose from gallery.');
    }
  };

  // Switch between front and back cameras
  const toggleCameraFacing = () => {
    setCameraFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  // Toggle Torch / Flash
  const toggleFlash = () => {
    setFlashMode((prev) => (prev === 'off' ? 'on' : 'off'));
  };

  // Toggle Composition Grid
  const toggleGrid = () => {
    setIsGridActive((prev) => !prev);
    showToast(isGridActive ? 'Grid Off' : 'Grid On');
  };

  // Toggle Shutter Timer
  const toggleTimer = () => {
    const next = timerSeconds === 0 ? 3 : timerSeconds === 3 ? 10 : 0;
    setTimerSeconds(next);
    showToast(next === 0 ? 'Timer Off' : `Timer: ${next}s`);
  };

  // Cycle Camera / Story Filter
  const cycleFilter = () => {
    const nextIndex = (previewFilterIndex + 1) % STORY_FILTERS.length;
    setPreviewFilterIndex(nextIndex);
    setCameraActiveFilter(nextIndex);
    showToast(`Filter: ${STORY_FILTERS[nextIndex].name}`);
  };

  // Toggle Instagram "Create / Text" Mode
  const toggleCreateMode = () => {
    if (!isCreateMode) {
      setIsCreateMode(true);
      setCapturedImage('CREATE_CANVAS');
      setIsAddingText(true);
    } else {
      setIsCreateMode(false);
      setCapturedImage(null);
    }
  };

  // Cycle Create Mode Background Gradient
  const cycleCreateGradient = () => {
    setCreateGradientIndex((prev) => (prev + 1) % CREATE_GRADIENTS.length);
  };

  // Discard & Reset Media
  const handleDiscard = () => {
    Alert.alert('Discard story?', 'If you go back now, your edits will be discarded.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          setCapturedImage(null);
          setIsCreateMode(false);
          setTextOverlay('');
          setCaptionText('');
          setSelectedSticker(null);
          setSelectedMusic(null);
          setPreviewFilterIndex(0);
        },
      },
    ]);
  };

  // Save to Device Gallery
  const handleSaveToDevice = () => {
    showToast('Saved to your device gallery! 📥');
  };

  // Add Sticker to Story
  const handleSelectSticker = (sticker) => {
    if (sticker.isDynamicTime) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSelectedSticker(`🕒 ${timeStr}`);
    } else {
      setSelectedSticker(sticker.value || sticker.label);
    }
    setIsStickerModalVisible(false);
  };

  // Add Music to Story
  const handleSelectMusic = (track) => {
    setSelectedMusic(track);
    setIsMusicModalVisible(false);
    showToast(`Added: ${track.title} 🎵`);
  };

  // Share & Publish Story to Backend
  const handlePublishStory = async (audience = 'PUBLIC') => {
    if (!capturedImage || isPublishing) return;

    try {
      setIsPublishing(true);

      const isStory = activeMode === 'STORY';
      const purpose = isStory ? 'STORY_MEDIA' : activeMode === 'REEL' ? 'REEL_VIDEO' : 'POST_MEDIA';
      let mediaAssetId = null;

      if (isCreateMode) {
        // Create mode text-only story uses fallback canvas asset or direct story upload
        mediaAssetId = 'create_canvas_' + Date.now();
      } else {
        const filename = `${purpose.toLowerCase()}_${Date.now()}.jpg`;
        const uploadRes = await mediaService.uploadMedia(
          {
            uri: capturedImage,
            name: filename,
            type: 'image/jpeg',
          },
          purpose
        );

        mediaAssetId =
          uploadRes.mediaAssetId ||
          uploadRes.data?.mediaAssetId ||
          uploadRes._id ||
          uploadRes.data?._id;
      }

      const combinedCaptionParts = [];
      if (captionText.trim()) combinedCaptionParts.push(captionText.trim());
      if (textOverlay.trim()) combinedCaptionParts.push(textOverlay.trim());
      if (selectedSticker) combinedCaptionParts.push(`[${selectedSticker}]`);
      if (selectedMusic) combinedCaptionParts.push(`🎵 ${selectedMusic.title}`);
      const finalCaption = combinedCaptionParts.join(' • ');

      if (isStory) {
        await storyService.createStory({
          mediaAssetId: mediaAssetId || 'story_asset_fallback',
          caption: finalCaption,
          audience,
        });
        Alert.alert('Shared', audience === 'CLOSE_FRIENDS' ? 'Story shared with Close Friends! 💚' : 'Added to Your Story! 🩷');
      } else if (activeMode === 'REEL') {
        await reelService.createReel({
          mediaAssetId: mediaAssetId || 'reel_asset_fallback',
          caption: finalCaption,
        });
        Alert.alert('Success', 'Reel published! ✨');
      } else {
        await postService.createPost({
          mediaAssetIds: [mediaAssetId || 'post_asset_fallback'],
          caption: finalCaption,
        });
        Alert.alert('Success', 'Post published to feed! 📸');
      }

      router.back();
    } catch (err) {
      console.log('[PUBLISH ERROR]:', err);
      const errMsg = err.response?.data?.message || err.message || 'Media publication failed. Please try again.';
      Alert.alert('Upload Failed', errMsg);
    } finally {
      setIsPublishing(false);
    }
  };

  // =========================================================================
  // PREVIEW / STORY EDITOR SCREEN (RENDERED WHEN PHOTO IS TAKEN OR PICKED)
  // =========================================================================
  if (capturedImage) {
    const isCanvas = capturedImage === 'CREATE_CANVAS';
    const activeFilter = STORY_FILTERS[previewFilterIndex];

    return (
      <View style={styles.previewRootContainer}>
        <StatusBar hidden />

        {/* 1. Base Media / Canvas Background */}
        {isCanvas ? (
          <LinearGradient
            colors={CREATE_GRADIENTS[createGradientIndex]}
            style={styles.fullscreenBackground}
          >
            <TouchableOpacity style={styles.colorPaletteButton} onPress={cycleCreateGradient}>
              <Ionicons name="color-palette-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>
        ) : (
          <View style={styles.fullscreenBackground}>
            <Image
              key={capturedImage}
              source={{ uri: capturedImage }}
              style={styles.fullscreenImage}
              resizeMode="cover"
              onLoadStart={() => setIsImageLoading(true)}
              onLoadEnd={() => setIsImageLoading(false)}
            />

            {/* Live Filter Tint Overlay */}
            {activeFilter.tint !== 'transparent' && (
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  { backgroundColor: activeFilter.tint },
                ]}
              />
            )}

            {isImageLoading && (
              <View style={styles.imageLoadingOverlay}>
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            )}
          </View>
        )}

        {/* 2. Overlaid Interactive Elements (Sticker, Music, Text) */}
        {/* Placed Sticker */}
        {selectedSticker && (
          <View style={styles.placedStickerPill}>
            <Text style={styles.placedStickerText}>{selectedSticker}</Text>
            <TouchableOpacity onPress={() => setSelectedSticker(null)} style={styles.stickerCloseBtn}>
              <Ionicons name="close" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Placed Music Badge */}
        {selectedMusic && (
          <View style={styles.placedMusicPill}>
            <Ionicons name="musical-notes" size={16} color="#FFFFFF" />
            <Text style={styles.placedMusicText} numberOfLines={1}>
              {selectedMusic.title} • {selectedMusic.artist}
            </Text>
            <TouchableOpacity onPress={() => setSelectedMusic(null)} style={styles.stickerCloseBtn}>
              <Ionicons name="close" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Placed Text Overlay */}
        {textOverlay !== '' && !isAddingText && (
          <TouchableOpacity
            style={[
              styles.placedTextWrapper,
              textBgActive && styles.placedTextBackground,
            ]}
            onPress={() => setIsAddingText(true)}
          >
            <Text style={[styles.placedTextContent, { color: textColor }]}>
              {textOverlay}
            </Text>
          </TouchableOpacity>
        )}

        {/* 3. Toast Message Alert Overlay */}
        {toastMessage && (
          <View style={styles.toastContainer}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        )}

        {/* 4. Top Header & Instagram Action Icons */}
        {!isAddingText && (
          <SafeAreaView style={styles.previewTopHeaderSafeArea} edges={['top']}>
            <View style={styles.previewTopHeader}>
              <TouchableOpacity style={styles.headerIconButton} onPress={handleDiscard}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Instagram Story Top Action Tools */}
              <View style={styles.previewToolsRow}>
                {/* Text Aa Tool */}
                <TouchableOpacity style={styles.headerIconButton} onPress={() => setIsAddingText(true)}>
                  <Text style={styles.aaIconText}>Aa</Text>
                </TouchableOpacity>

                {/* Stickers Tool */}
                <TouchableOpacity style={styles.headerIconButton} onPress={() => setIsStickerModalVisible(true)}>
                  <Ionicons name="happy-outline" size={24} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Filter / Sparkles Tool */}
                <TouchableOpacity style={styles.headerIconButton} onPress={cycleFilter}>
                  <Ionicons name="sparkles-outline" size={24} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Music Tool */}
                <TouchableOpacity style={styles.headerIconButton} onPress={() => setIsMusicModalVisible(true)}>
                  <Ionicons name="musical-notes-outline" size={24} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Save / Download Tool */}
                <TouchableOpacity style={styles.headerIconButton} onPress={handleSaveToDevice}>
                  <Feather name="download" size={22} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Sound Mute Toggle */}
                <TouchableOpacity style={styles.headerIconButton} onPress={() => setIsMuted((p) => !p)}>
                  <Ionicons name={isMuted ? 'volume-mute-outline' : 'volume-high-outline'} size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        )}

        {/* 5. Fullscreen Instagram Text Editor Overlay */}
        {isAddingText && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.textEditorFullscreen}
          >
            <View style={styles.textEditorTopBar}>
              <TouchableOpacity
                style={styles.textBgToggleBtn}
                onPress={() => setTextBgActive((prev) => !prev)}
              >
                <Ionicons name={textBgActive ? 'square' : 'square-outline'} size={20} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Color Palette Bubbles */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorPaletteScroll}>
                {TEXT_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorBubble, { backgroundColor: c }, textColor === c && styles.colorBubbleActive]}
                    onPress={() => setTextColor(c)}
                  />
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.doneBtn} onPress={() => setIsAddingText(false)}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.textEditorCenter}>
              <TextInput
                style={[
                  styles.textEditorInput,
                  { color: textColor },
                  textBgActive && styles.textEditorInputBg,
                ]}
                autoFocus
                multiline
                value={textOverlay}
                onChangeText={setTextOverlay}
                placeholder="Start typing..."
                placeholderTextColor="rgba(255,255,255,0.6)"
              />
            </View>
          </KeyboardAvoidingView>
        )}

        {/* 6. Bottom Story Share Bar */}
        {!isAddingText && (
          <SafeAreaView style={styles.previewBottomSafeArea} edges={['bottom']}>
            <View style={styles.previewBottomContainer}>
              {/* Optional Caption Input */}
              <View style={styles.captionInputWrapper}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="rgba(255,255,255,0.8)" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.captionInput}
                  placeholder="Add a caption..."
                  placeholderTextColor="rgba(255,255,255,0.7)"
                  value={captionText}
                  onChangeText={setCaptionText}
                />
              </View>

              {/* Instagram Share Capsules */}
              <View style={styles.shareRow}>
                {/* Your Story Capsule */}
                <TouchableOpacity
                  style={styles.shareCapsule}
                  onPress={() => handlePublishStory('PUBLIC')}
                  disabled={isPublishing}
                >
                  <Image
                    source={{
                      uri:
                        userProfile?.avatarUri && !userProfile.avatarUri.includes('empty')
                          ? userProfile.avatarUri
                          : 'https://i.pravatar.cc/150?img=60',
                    }}
                    style={styles.capsuleAvatar}
                  />
                  <View>
                    <Text style={styles.capsuleTitle}>Your story</Text>
                    <Text style={styles.capsuleSub}>Share now</Text>
                  </View>
                </TouchableOpacity>

                {/* Close Friends Capsule */}
                <TouchableOpacity
                  style={styles.shareCapsule}
                  onPress={() => handlePublishStory('CLOSE_FRIENDS')}
                  disabled={isPublishing}
                >
                  <View style={styles.closeFriendsBadge}>
                    <Ionicons name="star" size={14} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={styles.capsuleTitle}>Close Friends</Text>
                    <Text style={styles.capsuleSub}>Private</Text>
                  </View>
                </TouchableOpacity>

                {/* Send Button */}
                <TouchableOpacity
                  style={styles.sendCircleButton}
                  onPress={() => handlePublishStory('PUBLIC')}
                  disabled={isPublishing}
                >
                  <Ionicons name="arrow-forward" size={22} color="#000000" />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        )}

        {/* 7. Publishing Overlay */}
        {isPublishing && (
          <View style={styles.publishingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.publishingText}>Sharing to Your Story...</Text>
          </View>
        )}

        {/* 8. Stickers Modal */}
        <Modal visible={isStickerModalVisible} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Sticker</Text>
                <TouchableOpacity onPress={() => setIsStickerModalVisible(false)}>
                  <Ionicons name="close-circle" size={24} color="#8E8E93" />
                </TouchableOpacity>
              </View>
              <View style={styles.stickersGrid}>
                {STICKER_LIST.map((sticker) => (
                  <TouchableOpacity
                    key={sticker.id}
                    style={styles.stickerGridItem}
                    onPress={() => handleSelectSticker(sticker)}
                  >
                    <Text style={styles.stickerGridItemText}>{sticker.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>

        {/* 9. Music Modal */}
        <Modal visible={isMusicModalVisible} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Choose Music</Text>
                <TouchableOpacity onPress={() => setIsMusicModalVisible(false)}>
                  <Ionicons name="close-circle" size={24} color="#8E8E93" />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 300 }}>
                {MUSIC_TRACKS.map((track) => (
                  <TouchableOpacity
                    key={track.id}
                    style={styles.musicRow}
                    onPress={() => handleSelectMusic(track)}
                  >
                    <View style={styles.musicIconCircle}>
                      <Ionicons name="musical-note" size={20} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.musicTitle}>{track.title}</Text>
                      <Text style={styles.musicArtist}>{track.artist}</Text>
                    </View>
                    <Text style={styles.musicDuration}>{track.duration}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // =========================================================================
  // CAMERA VIEW & STORY CREATION (RENDERED BEFORE PHOTO IS TAKEN)
  // =========================================================================
  return (
    <View style={styles.cameraRootContainer}>
      <StatusBar barStyle="light-content" translucent />

      {/* 1. Live Camera Viewfinder */}
      {cameraPermission?.granted ? (
        <CameraView
          ref={cameraRef}
          style={styles.cameraViewfinder}
          facing={cameraFacing}
          enableTorch={flashMode === 'on'}
          mode="picture"
        />
      ) : (
        <View style={styles.cameraFallbackView}>
          <Ionicons name="camera-reverse-outline" size={60} color="#666666" />
          <Text style={styles.cameraFallbackText}>Camera permission needed</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestCameraPermission}>
            <Text style={styles.permissionButtonText}>Enable Camera</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2. Composition Grid Overlay (If toggled on) */}
      {isGridActive && (
        <View style={styles.gridOverlay} pointerEvents="none">
          <View style={[styles.gridLineHorizontal, { top: '33%' }]} />
          <View style={[styles.gridLineHorizontal, { top: '66%' }]} />
          <View style={[styles.gridLineVertical, { left: '33%' }]} />
          <View style={[styles.gridLineVertical, { left: '66%' }]} />
        </View>
      )}

      {/* 3. Live Countdown Timer Overlay */}
      {countdown !== null && (
        <View style={styles.countdownOverlay} pointerEvents="none">
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>
      )}

      {/* 4. Toast Message */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* 5. Top Bar Overlay */}
      <SafeAreaView style={styles.cameraTopHeaderSafeArea} edges={['top']}>
        <View style={styles.cameraTopHeader}>
          {/* Close Screen */}
          <TouchableOpacity style={styles.headerIconButton} onPress={() => router.back()}>
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Flash Toggle Button */}
          <TouchableOpacity
            style={[styles.headerIconButton, flashMode === 'on' && styles.headerIconButtonActive]}
            onPress={toggleFlash}
          >
            <Ionicons name={flashMode === 'on' ? 'flash' : 'flash-off'} size={22} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Active Mode Pill */}
          <View style={styles.modeBadgePill}>
            <Text style={styles.modeBadgeText}>{activeMode}</Text>
          </View>

          {/* Settings / Options */}
          <TouchableOpacity style={styles.headerIconButton} onPress={toggleGrid}>
            <Ionicons name={isGridActive ? 'grid' : 'grid-outline'} size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* 6. Instagram Left Sidebar Camera Tools */}
      <View style={styles.leftToolbar}>
        {/* Aa Create Mode */}
        <TouchableOpacity style={styles.leftToolItem} onPress={toggleCreateMode}>
          <View style={styles.leftToolCircle}>
            <Text style={styles.aaToolText}>Aa</Text>
          </View>
          <Text style={styles.leftToolLabel}>Create</Text>
        </TouchableOpacity>

        {/* Boomerang */}
        <TouchableOpacity
          style={styles.leftToolItem}
          onPress={() => showToast('Boomerang enabled ♾️')}
        >
          <View style={styles.leftToolCircle}>
            <Ionicons name="infinite" size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.leftToolLabel}>Boomerang</Text>
        </TouchableOpacity>

        {/* Grid / Layout */}
        <TouchableOpacity style={styles.leftToolItem} onPress={toggleGrid}>
          <View style={[styles.leftToolCircle, isGridActive && styles.leftToolCircleActive]}>
            <Ionicons name="grid-outline" size={18} color="#FFFFFF" />
          </View>
          <Text style={styles.leftToolLabel}>Layout</Text>
        </TouchableOpacity>

        {/* Shutter Timer */}
        <TouchableOpacity style={styles.leftToolItem} onPress={toggleTimer}>
          <View style={[styles.leftToolCircle, timerSeconds > 0 && styles.leftToolCircleActive]}>
            <Ionicons name="timer-outline" size={18} color="#FFFFFF" />
          </View>
          <Text style={styles.leftToolLabel}>{timerSeconds > 0 ? `${timerSeconds}s` : 'Timer'}</Text>
        </TouchableOpacity>

        {/* Sparkles / Live Filters */}
        <TouchableOpacity style={styles.leftToolItem} onPress={cycleFilter}>
          <View style={styles.leftToolCircle}>
            <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" />
          </View>
          <Text style={styles.leftToolLabel}>Filters</Text>
        </TouchableOpacity>
      </View>

      {/* 7. Bottom Shutter & Controls Area */}
      <SafeAreaView style={styles.cameraBottomSafeArea} edges={['bottom']}>
        <View style={styles.cameraBottomContainer}>
          {/* Quick Real-Time Gallery Bar (No dummy photos) */}
          <TouchableOpacity style={styles.openGalleryPrompt} onPress={handleOpenDeviceGallery}>
            <Ionicons name="images" size={18} color="#FFFFFF" />
            <Text style={styles.openGalleryPromptText}>Open Device Gallery</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          {/* Shutter Row */}
          <View style={styles.shutterRow}>
            {/* Gallery Thumbnail Button (Bottom Left) */}
            <TouchableOpacity style={styles.gallerySquareButton} onPress={handleOpenDeviceGallery}>
              {lastPickedThumbnail ? (
                <Image source={{ uri: lastPickedThumbnail }} style={styles.gallerySquareImage} />
              ) : (
                <LinearGradient colors={['#333333', '#1C1C1E']} style={styles.gallerySquareImage}>
                  <Ionicons name="images-outline" size={24} color="#FFFFFF" />
                </LinearGradient>
              )}
              <View style={styles.galleryPlusBadge}>
                <Ionicons name="add" size={12} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            {/* Shutter Capture Button (Center Ring) */}
            <TouchableOpacity style={styles.shutterRingOuter} onPress={handleCapture} activeOpacity={0.85}>
              <LinearGradient colors={['#FF007A', '#7928CA']} style={styles.shutterRingGradient}>
                <View style={styles.shutterInnerCircle} />
              </LinearGradient>
            </TouchableOpacity>

            {/* Flip Camera Button (Bottom Right) */}
            <TouchableOpacity style={styles.flipCameraCircle} onPress={toggleCameraFacing}>
              <Ionicons name="camera-reverse" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Mode Selector Tabs (POST, STORY, REEL) */}
          <View style={styles.modeTabsRow}>
            {['POST', 'STORY', 'REEL'].map((m) => (
              <TouchableOpacity key={m} onPress={() => setActiveMode(m)} style={styles.modeTabItem}>
                <Text style={[styles.modeTabText, activeMode === m && styles.modeTabTextActive]}>
                  {m}
                </Text>
                {activeMode === m && <View style={styles.modeTabIndicator} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Root Containers
  cameraRootContainer: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
  },
  previewRootContainer: {
    flex: 1,
    backgroundColor: '#000000',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  cameraViewfinder: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  cameraFallbackView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
    gap: 16,
  },
  cameraFallbackText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionButton: {
    backgroundColor: '#E63956',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  // Viewfinder Composition Grid
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },

  // Countdown Overlay
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  countdownText: {
    fontSize: 120,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },

  // Toast Notification
  toastContainer: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 99,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Camera Header
  cameraTopHeaderSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  cameraTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 6,
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconButtonActive: {
    backgroundColor: '#FFCC00',
  },
  modeBadgePill: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modeBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Instagram Left Toolbar
  leftToolbar: {
    position: 'absolute',
    left: 14,
    top: 110,
    gap: 16,
    alignItems: 'center',
    zIndex: 10,
  },
  leftToolItem: {
    alignItems: 'center',
    gap: 4,
  },
  leftToolCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  leftToolCircleActive: {
    backgroundColor: '#E63956',
  },
  aaToolText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  leftToolLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Camera Bottom Area
  cameraBottomSafeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  cameraBottomContainer: {
    paddingBottom: 8,
    alignItems: 'center',
    gap: 14,
  },
  openGalleryPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  openGalleryPromptText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 28,
  },
  gallerySquareButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    position: 'relative',
    overflow: 'visible',
  },
  gallerySquareImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryPlusBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0095F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  shutterRingOuter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterRingGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 41,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInnerCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
  },
  flipCameraCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeTabsRow: {
    flexDirection: 'row',
    gap: 20,
  },
  modeTabItem: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  modeTabText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modeTabTextActive: {
    color: '#FFFFFF',
  },
  modeTabIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    marginTop: 4,
  },

  // =========================================================================
  // PREVIEW / STORY EDITOR STYLES
  // =========================================================================
  fullscreenBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorPaletteButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Placed Stickers / Music on Story
  placedStickerPill: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.28,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  placedStickerText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  stickerCloseBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placedMusicPill: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.36,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  placedMusicText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    maxWidth: 220,
  },
  placedTextWrapper: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.44,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  placedTextBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  placedTextContent: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },

  // Preview Top Header
  previewTopHeaderSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  previewTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 6,
  },
  previewToolsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  aaIconText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },

  // Text Editor Fullscreen
  textEditorFullscreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    zIndex: 50,
  },
  textEditorTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 36 : 56,
    gap: 12,
  },
  textBgToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorPaletteScroll: {
    gap: 10,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  colorBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  colorBubbleActive: {
    transform: [{ scale: 1.25 }],
    borderColor: '#FFCC00',
  },
  doneBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
  },
  doneBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  textEditorCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  textEditorInput: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
  },
  textEditorInputBg: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },

  // Preview Bottom Container
  previewBottomSafeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  previewBottomContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  captionInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  captionInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shareCapsule: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    gap: 10,
  },
  capsuleAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  closeFriendsBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  capsuleTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  capsuleSub: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    fontWeight: '500',
  },
  sendCircleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Publishing Loader
  publishingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
    gap: 14,
  },
  publishingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Stickers & Music Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#545458',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  stickersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  stickerGridItem: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  stickerGridItemText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2C2C2E',
    gap: 14,
  },
  musicIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E63956',
    justifyContent: 'center',
    alignItems: 'center',
  },
  musicTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  musicArtist: {
    color: '#8E8E93',
    fontSize: 13,
  },
  musicDuration: {
    color: '#8E8E93',
    fontSize: 12,
  },
});
