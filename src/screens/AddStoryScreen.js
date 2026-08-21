import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Animated,
  PanResponder,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

import StoryModeTab from '../components/common/StoryModeTab';
import GalleryThumbnail from '../components/common/GalleryThumbnail';

// const MODES = ['POST', 'STORY', 'REEL', 'LIVE'];

const PLACEHOLDER_IMAGES = [
  { id: 'p1', uri: 'https://picsum.photos/300/400?random=1' },
  { id: 'p2', uri: 'https://picsum.photos/300/400?random=2', duration: '0:12' },
  { id: 'p3', uri: 'https://picsum.photos/300/400?random=3' },
  { id: 'p4', uri: 'https://picsum.photos/300/400?random=4', duration: '0:08' },
  { id: 'p5', uri: 'https://picsum.photos/300/400?random=5' },
  { id: 'p6', uri: 'https://picsum.photos/300/400?random=6' },
  { id: 'p7', uri: 'https://picsum.photos/300/400?random=7', duration: '0:15' },
  { id: 'p8', uri: 'https://picsum.photos/300/400?random=8' },
  { id: 'p9', uri: 'https://picsum.photos/300/400?random=9' },
];

const PREVIEW_TOOLS = [
  { id: 'text', label: 'Text', icon: 'text', type: 'custom' },
  { id: 'stickers', label: 'Stickers', icon: 'happy-outline', type: 'ion' },
  { id: 'music', label: 'Music', icon: 'musical-notes-outline', type: 'ion' },
  { id: 'restyle', label: 'Restyle', icon: 'brush-outline', type: 'ion' },
  { id: 'save_draft', label: 'Save', icon: 'bookmark-outline', type: 'ion' },
  { id: 'effects', label: 'Effects', icon: 'sparkles-outline', type: 'ion' },
  { id: 'mention', label: 'Mention', icon: 'at-outline', type: 'ion' },
  { id: 'draw', label: 'Draw', icon: 'create-outline', type: 'ion' },
  { id: 'save_gallery', label: 'Save', icon: 'download-outline', type: 'ion' },
  { id: 'label_ai', label: 'Label AI', icon: 'color-wand-outline', type: 'ion' },
  { id: 'more', label: 'More', icon: 'ellipsis-horizontal', type: 'ion' },
];

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AddStoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [activeMode, setActiveMode] = useState('STORY');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [cameraFacing, setCameraFacing] = useState('back');
  const [galleryItems, setGalleryItems] = useState(PLACEHOLDER_IMAGES);
  const [isGalleryExpanded, setIsGalleryExpanded] = useState(true);

  // Camera attributes / overlay states
  const [flashMode, setFlashMode] = useState('off');
  const [filterActive, setFilterActive] = useState(false);
  const [boomerangActive, setBoomerangActive] = useState(false);
  const [layoutActive, setLayoutActive] = useState(false);

  // Inline story preview editor states
  const [capturedImage, setCapturedImage] = useState(null);
  const [textOverlay, setTextOverlay] = useState('');
  const [isAddingText, setIsAddingText] = useState(false);
  const [textPosition, setTextPosition] = useState({ x: SCREEN_WIDTH / 2 - 100, y: SCREEN_HEIGHT / 2 - 50 });
  const [loadingImage, setLoadingImage] = useState(false);
  const [captionText, setCaptionText] = useState('');

  // Dynamic math layouts for a full-screen camera layout
  const SNAP_TOP = insets.top + 60; 
  const SNAP_BOTTOM = SCREEN_HEIGHT - insets.bottom - 15; // Bottom sheet sits at the very bottom edge of the screen
  const VIEWFINDER_HEIGHT = SCREEN_HEIGHT; // Camera fills the entire screen

  // Animated sheet state
  const translateY = useRef(new Animated.Value(SNAP_TOP)).current;
  const lastAppliedY = useRef(SNAP_TOP);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const isScrollAtTop = listScrollY.current <= 0;
        const isDraggingDown = gestureState.dy > 0;

        if (isGalleryExpanded) {
          // If expanded, only drag sheet down when scroll is at top and user swipes down
          return isScrollAtTop && isDraggingDown && Math.abs(gestureState.dy) > 10;
        } else {
          // If collapsed, capture vertical drag up to expand sheet
          return Math.abs(gestureState.dy) > 8 && Math.abs(gestureState.dx) < 10;
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        let newY = lastAppliedY.current + gestureState.dy;
        if (newY < SNAP_TOP) newY = SNAP_TOP;
        if (newY > SNAP_BOTTOM) newY = SNAP_BOTTOM;
        translateY.setValue(newY);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const movedUp = gestureState.dy < 0;
        const velocityY = gestureState.vy;
        
        let targetY = SNAP_BOTTOM;
        
        if (velocityY < -0.3 || (movedUp && gestureState.dy < -50)) {
          targetY = SNAP_TOP;
        } else if (velocityY > 0.3 || (!movedUp && gestureState.dy > 50)) {
          targetY = SNAP_BOTTOM;
        } else {
          const distToTop = Math.abs(lastAppliedY.current + gestureState.dy - SNAP_TOP);
          const distToBottom = Math.abs(lastAppliedY.current + gestureState.dy - SNAP_BOTTOM);
          targetY = distToTop < distToBottom ? SNAP_TOP : SNAP_BOTTOM;
        }

        animateTo(targetY);
      },
    })
  ).current;

  const animateTo = (targetY) => {
    Animated.spring(translateY, {
      toValue: targetY,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start(() => {
      lastAppliedY.current = targetY;
      setIsGalleryExpanded(targetY === SNAP_TOP);
    });
  };

  const toggleGallery = () => {
    const targetY = isGalleryExpanded ? SNAP_BOTTOM : SNAP_TOP;
    animateTo(targetY);
  };

  const listScrollY = useRef(0);

  // Active Camera & Image Picker Flow
  const cameraRef = useRef(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    if (cameraPermission && !cameraPermission.granted) {
      requestCameraPermission();
    }
  }, [cameraPermission]);

  const handleOpenLibrary = async () => {
    // Request media library permissions (supported natively in Expo Go)
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need access to your photos to add them to your story.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setCapturedImage(result.assets[0].uri);
      }
    } catch (err) {
      console.warn('Error launching image library picker:', err);
    }
  };

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const toggleSelection = (id) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(itemId => itemId !== id));
      if (selectedItems.length === 1) setSelectionMode(false);
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const handleThumbnailPress = (id) => {
    if (selectionMode) {
      toggleSelection(id);
    } else {
      const selectedItem = galleryItems.find(item => item.id === id);
      if (selectedItem) {
        setCapturedImage(selectedItem.uri);
      }
    }
  };

  const handleCapture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.85,
          skipProcessing: true,
        });
        if (photo && photo.uri) {
          setCapturedImage(photo.uri);
        }
      } catch (err) {
        console.warn('Error taking native photo, using mock fallback:', err);
        fallbackCapture();
      }
    } else {
      fallbackCapture();
    }
  };

  const fallbackCapture = () => {
    const mockCaptureUri = `https://picsum.photos/1080/1920?random=${Math.floor(Math.random() * 100)}`;
    setCapturedImage(mockCaptureUri);
  };

  const handleShare = () => {
    Alert.alert('Success', 'Shared to Your Story! 🩷');
    router.back();
  };

  const toggleCameraFacing = () => {
    setCameraFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  if (capturedImage) {
    return (
      <View style={styles.previewRootContainer}>
        <Image 
          source={{ uri: capturedImage }} 
          style={styles.fullscreenImage} 
        />

        <SafeAreaView style={styles.previewSafeContainer} edges={['top', 'bottom']}>
          <View style={styles.previewTopHeader}>
            <TouchableOpacity style={styles.previewBackCircle} onPress={() => {
              setCapturedImage(null);
              setTextOverlay('');
              setCaptionText('');
            }}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            
            <Text style={styles.previewHeaderTitle}>Add to story</Text>
            
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.previewRightToolbar}>
            {PREVIEW_TOOLS.map(tool => (
              <TouchableOpacity 
                key={tool.id} 
                style={styles.previewToolRow}
                onPress={() => {
                  if (tool.id === 'text') {
                    setIsAddingText(true);
                  } else {
                    Alert.alert(tool.label, `${tool.label} mode selected!`);
                  }
                }}
              >
                <Text style={styles.previewToolLabel}>{tool.label}</Text>
                <View style={styles.previewToolCircle}>
                  {tool.id === 'text' ? (
                    <Text style={styles.previewToolTextAa}>Aa</Text>
                  ) : (
                    <Ionicons name={tool.icon} size={16} color="#FFFFFF" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {textOverlay !== '' && !isAddingText && (
            <View style={[styles.textOverlayContainer, { top: textPosition.y, left: textPosition.x }]}>
              <Text style={styles.textOverlayText}>{textOverlay}</Text>
            </View>
          )}

          {isAddingText && (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.keyboardContainer}
            >
              <View style={styles.textInputWrapper}>
                <TextInput
                  style={styles.textInput}
                  autoFocus
                  multiline
                  value={textOverlay}
                  onChangeText={setTextOverlay}
                  placeholder="Start typing..."
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  onSubmitEditing={() => setIsAddingText(false)}
                />
                <TouchableOpacity style={styles.doneButton} onPress={() => setIsAddingText(false)}>
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          )}

          {!isAddingText && (
            <View style={styles.previewBottomContainer}>
              <View style={styles.captionContainer}>
                <TextInput 
                  style={styles.captionInput}
                  placeholder="Add a caption..."
                  placeholderTextColor="rgba(255,255,255,0.7)"
                  value={captionText}
                  onChangeText={setCaptionText}
                />
              </View>

              <View style={styles.shareRowContainer}>
                <TouchableOpacity style={styles.shareCapsule} onPress={handleShare}>
                  <Image source={{ uri: 'https://i.pravatar.cc/150?img=60' }} style={styles.capsuleAvatar} />
                  <View style={styles.capsuleTextWrapper}>
                    <Text style={styles.capsuleTitle}>Your story</Text>
                    <Text style={styles.capsuleSub}>Share now</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.shareCapsule} onPress={handleShare}>
                  <View style={styles.closeFriendsIconWrapper}>
                    <Ionicons name="star" size={12} color="#FFFFFF" />
                  </View>
                  <View style={styles.capsuleTextWrapper}>
                    <Text style={styles.capsuleTitle}>Close Friends</Text>
                    <Text style={styles.capsuleSub}>Share now</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.blueCircleButton} onPress={handleShare}>
                  <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.safeContainer}>
      {/* Camera Viewfinder (Absolute Top Background Card) */}
      <View style={[styles.cameraContainer, { height: VIEWFINDER_HEIGHT }]}>
        {cameraPermission?.granted ? (
          <CameraView ref={cameraRef} style={styles.camera} facing={cameraFacing} />
        ) : (
          <View style={styles.cameraFallback}>
             <LinearGradient colors={['#2A1D24', '#1A1414']} style={StyleSheet.absoluteFillObject} />
          </View>
        )}

{/* 
        {!isGalleryExpanded && (
          // <View style={styles.messagingContainer}>
          //   <Text style={styles.messagingTitle}>Share your moment 🩷</Text>
          //   <Text style={styles.messagingSubtext}>
          //     Photos, videos and memories{'\n'}disappear after 24 hours
          //   </Text>
          // </View>
        )} */}
      </View>

      {/* Main Header Overlay (Translucent and absolutely positioned on top of the viewfinder) */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.iconCircle} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add to story</Text>
        <TouchableOpacity style={styles.iconCircle} onPress={() => {}}>
          <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Capture Controls & Tabs Container (Floating at the bottom) */}
      <View style={[styles.controlsContainer, { bottom: insets.bottom + 15 }]}>
        {/* Capture Row */}
        <View style={styles.captureRow}>
          <TouchableOpacity style={styles.iconCircleLarge} onPress={toggleGallery}>
            <Ionicons name="images-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleCapture} activeOpacity={0.8}>
            <LinearGradient
              colors={['#F04452', '#C13584']}
              style={styles.captureRing}
            >
              <View style={styles.captureButtonInner} />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconCircleLarge} onPress={toggleCameraFacing}>
            <Ionicons name="sync-outline" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Mode Selector */}
        {/* <View style={styles.modeSelector}>
          {MODES.map(mode => (
            <StoryModeTab
              key={mode}
              title={mode}
              isActive={activeMode === mode}
              onPress={() => setActiveMode(mode)}
            />
          ))}
        </View> */}
      </View>

      {/* Gallery Bottom Sheet Area (Draggable) */}
      <Animated.View 
        style={[
          styles.galleryContainer, 
          { 
            transform: [{ translateY }],
            height: SCREEN_HEIGHT - SNAP_TOP,
            zIndex: isGalleryExpanded ? 10 : 2,
          }
        ]}
        {...panResponder.panHandlers}
      >
        {/* Header / drag handle area */}
        <View style={styles.galleryHeaderWrapper}>
          <View style={styles.dragHandle} />
          
          <View style={styles.galleryHeader}>
            <TouchableOpacity style={styles.recentsButton} onPress={handleOpenLibrary}>
              <Text style={styles.recentsText}>Recents</Text>
              <Ionicons name="chevron-down" size={16} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.selectButton}
              onPress={handleOpenLibrary}
            >
              <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
              <Text style={styles.selectButtonText}>Select</Text>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={[{ id: 'camera_card', isCamera: true }, ...galleryItems]}
          keyExtractor={item => item.id}
          numColumns={3}
          showsVerticalScrollIndicator={false}
          scrollEnabled={isGalleryExpanded}
          onScroll={(event) => {
            // Track scroll position to decide when to delegate swipe down to sheet drag
            listScrollY.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          ListHeaderComponent={
            isGalleryExpanded ? (
              <View style={styles.chipsContainer}>
                <TouchableOpacity style={styles.chipCard} onPress={() => Alert.alert('Templates', 'Templates tool is coming soon!')}>
                  <LinearGradient colors={['#FF007F', '#7F00FF']} style={styles.chipIconWrapper}>
                    <Ionicons name="layers" size={24} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.chipText}>Templates</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.chipCard} onPress={() => Alert.alert('Music', 'Music tool is coming soon!')}>
                  <LinearGradient colors={['#FF8C00', '#FF007F']} style={styles.chipIconWrapper}>
                    <Ionicons name="musical-notes" size={24} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.chipText}>Music</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.chipCard} onPress={() => Alert.alert('Collage', 'Collage tool is coming soon!')}>
                  <LinearGradient colors={['#00C9FF', '#92FE9D']} style={styles.chipIconWrapper}>
                    <Ionicons name="grid" size={24} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.chipText}>Collage</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            if (item.isCamera) {
              return (
                <TouchableOpacity 
                  style={styles.gridCameraCard}
                  onPress={() => {
                    // Collapse bottom sheet to return to live camera feed
                    setIsGalleryExpanded(false);
                    lastAppliedY.current = SNAP_BOTTOM;
                    Animated.spring(translateY, {
                      toValue: SNAP_BOTTOM,
                      friction: 8,
                      tension: 40,
                      useNativeDriver: true,
                    }).start();
                  }}
                >
                  <Ionicons name="camera" size={32} color="#FFFFFF" />
                </TouchableOpacity>
              );
            }

            return (
              <GalleryThumbnail
                imageUri={item.uri}
                duration={item.duration}
                isSelected={selectedItems.includes(item.id)}
                selectionMode={selectionMode}
                onPress={() => handleThumbnailPress(item.id)}
              />
            );
          }}
          contentContainerStyle={styles.galleryGrid}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#000000ff',
    position: 'relative',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 18,
    zIndex: 2,
    marginTop:12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    
  },
  cameraContainer: {
    position: 'absolute',
    top: 1,
    left: 0,
    right: 0,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraFallback: {
    flex: 1,
  },
  cameraOverlayRight: {
    position: 'absolute',
    top: 100, // Safe distance below header
    right: 16,
    gap: 12,
  },
  iconCircleSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeOverlayIcon: {
    backgroundColor: '#E63956', // Rubaru pink active state indicator
  },
  cameraOverlayLeft: {
    position: 'absolute',
    top: '25%',
    left: 16,
    alignItems: 'center',
    gap: 20,
  },
  leftToolItem: {
    alignItems: 'center',
    gap: 4,
  },
  leftToolIconWrapper: {
    shadowColor: '#000000ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
  shadowIcon: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
  textIconAa: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -1,
  },
  textAaSmall: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  leftToolLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  messagingContainer: {
    position: 'absolute',
    bottom: 140, // Positioned above the lowered capture buttons overlay
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  messagingTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  messagingSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  controlsContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    zIndex: 3, // Overlays on top of the camera viewfinder
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
  },
  iconCircleLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureRing: {
    width: 86,
    height: 86,
    borderRadius: 43,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom:20,
  },
  captureButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
  },
  modeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    width: '100%',
  },
  galleryContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1A1414',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 15,
  },
  galleryHeaderWrapper: {
    width: '100%',
    paddingBottom: 4,
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#8E8E93',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    opacity: 0.5,
  },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  recentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  selectButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  chipsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginVertical: 16,
    width: '100%',
  },
  chipCard: {
    width: (SCREEN_WIDTH - 48) / 3,
    height: 100,
    backgroundColor: '#261D1D',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  chipIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  gridCameraCard: {
    flex: 1,
    aspectRatio: 3 / 4,
    margin: 1.5,
    backgroundColor: '#261D1D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryGrid: {
    paddingHorizontal: 1.5,
    paddingBottom: 40,
  },
  previewRootContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  previewSafeContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  fullscreenImage: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },
  previewTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 12,
    paddingBottom: 8,
    zIndex: 10,
  },
  previewBackCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  previewRightToolbar: {
    position: 'absolute',
    top: 90, // Below header
    right: 12,
    alignItems: 'flex-end',
    gap: 7,
    zIndex: 10,
  },
  previewToolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewToolLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  previewToolCircle: {
    width: 36,
    height: 38,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewToolTextAa: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  previewBottomContainer: {
    position: 'absolute',
    bottom: 24,
    left: 12,
    right: 12,
    zIndex: 10,
    gap: 12,
  },
  captionContainer: {
    width: '100%',
    paddingHorizontal: 8,
  },
  captionInput: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  shareRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  shareCapsule: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
  },
  capsuleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 12,
  },
  capsuleTextWrapper: {
 
    justifyContent: 'center',
  },
  capsuleTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  capsuleSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: '500',
  },
  closeFriendsIconWrapper: {
    width: 26,
    height: 26,
    borderRadius: 12,
    backgroundColor: '#27AE60', // Close friends green
    justifyContent: 'center',
    alignItems: 'center',
  },
  blueCircleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0095F6', // IG Blue
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  textOverlayContainer: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    maxWidth: SCREEN_WIDTH - 60,
    alignSelf: 'center',
    zIndex: 5,
  },
  textOverlayText: {
    color: '#ffffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  keyboardContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  textInputWrapper: {
    width: '80%',
    alignItems: 'center',
  },
  textInput: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
    padding: 10,
  },
  doneButton: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  doneButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
});


