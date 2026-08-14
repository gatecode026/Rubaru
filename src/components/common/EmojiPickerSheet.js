import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  PanResponder,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMOJI_CATEGORIES, EMOJI_DATA, EMOJI_KEYWORDS } from '../../utils/emojiData';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.6; // Covers ~60% of screen height

const CATEGORY_MAP = {
  smileys: 'Smileys & Emotion',
  people: 'People & Body',
  animals: 'Animals & Nature',
  food: 'Food & Drink',
  activities: 'Activities',
  travel: 'Travel & Places',
  objects: 'Objects',
  symbols: 'Symbols',
  flags: 'Flags',
};

export default function EmojiPickerSheet({ visible, onClose, onSelectEmoji }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentEmojis, setRecentEmojis] = useState([]);
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [filteredEmojis, setFilteredEmojis] = useState([]);

  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const flatListRef = useRef(null);

  // Load recently used emojis from AsyncStorage
  const loadRecentEmojis = async () => {
    try {
      const stored = await AsyncStorage.getItem('@recent_emojis');
      if (stored) {
        setRecentEmojis(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load recent emojis', e);
    }
  };

  useEffect(() => {
    if (visible) {
      loadRecentEmojis();
      // Slide up transition
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      translateY.setValue(SHEET_HEIGHT);
      setSearchQuery('');
    }
  }, [visible]);

  // Handle dismiss transition
  const handleDismiss = () => {
    Animated.timing(translateY, {
      toValue: SHEET_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  // Add selected emoji to recently used and save to storage
  const handleSelectEmoji = async (emoji) => {
    // Dedup and prepend
    const updated = [emoji, ...recentEmojis.filter((e) => e !== emoji)].slice(0, 30);
    setRecentEmojis(updated);
    try {
      await AsyncStorage.setItem('@recent_emojis', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save recent emojis', e);
    }
    onSelectEmoji(emoji);
    handleDismiss();
  };

  // Search logic
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredEmojis([]);
      return;
    }
    const query = searchQuery.toLowerCase().trim();
    const matches = [];

    // Search across all emoji data
    Object.keys(EMOJI_DATA).forEach((catKey) => {
      EMOJI_DATA[catKey].forEach((emoji) => {
        const keywords = EMOJI_KEYWORDS[emoji] || '';
        if (keywords.includes(query)) {
          matches.push(emoji);
        }
      });
    });

    setFilteredEmojis(matches);
  }, [searchQuery]);

  // Category scrolling action
  const handleCategoryPress = (categoryKey, index) => {
    if (searchQuery !== '') {
      setSearchQuery(''); // clear search first
    }
    setActiveCategory(categoryKey);

    // Scroll flatlist to correct index
    if (flatListRef.current) {
      flatListRef.current.scrollToIndex({ index, animated: true });
    }
  };

  // Build items array for sectioned rendering
  const sectionsData = [];
  if (recentEmojis.length > 0) {
    sectionsData.push({ key: 'recent', title: 'Recently Used', data: recentEmojis });
  }
  Object.keys(EMOJI_DATA).forEach((catKey) => {
    sectionsData.push({ key: catKey, title: CATEGORY_MAP[catKey], data: EMOJI_DATA[catKey] });
  });

  // PanResponder to handle drag-down gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > SHEET_HEIGHT * 0.25 || gestureState.vy > 0.5) {
          handleDismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const renderEmojiGrid = (emojis) => (
    <View style={styles.gridContainer}>
      {emojis.map((emoji, index) => (
        <TouchableOpacity
          key={`${emoji}-${index}`}
          style={styles.emojiCell}
          onPress={() => handleSelectEmoji(emoji)}
          activeOpacity={0.6}
        >
          <Text style={styles.emojiText}>{emoji}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleDismiss}>
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={handleDismiss}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[styles.sheetContainer, { transform: [{ translateY }] }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Drag Handle Bar */}
          <View style={styles.dragHandleArea} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
          </View>

          {/* Search bar */}
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={18} color="#8E8E93" style={styles.searchIcon} />
            <TextInput
              placeholder="Search emoji"
              placeholderTextColor="#8E8E93"
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#8E8E93" />
              </TouchableOpacity>
            )}
          </View>

          {/* Category Tabs (Icons) */}
          {searchQuery === '' && (
            <View style={styles.categoryTabs}>
              {EMOJI_CATEGORIES.map((cat, index) => {
                if (cat.key === 'recent' && recentEmojis.length === 0) return null;
                const isActive = activeCategory === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[styles.categoryTab, isActive && styles.activeCategoryTab]}
                    onPress={() => handleCategoryPress(cat.key, index)}
                  >
                    <Ionicons
                      name={cat.icon}
                      size={20}
                      color={isActive ? '#000000' : '#8E8E93'}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Emoji List */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardContainer}
          >
            {searchQuery !== '' ? (
              <FlatList
                data={['search_results']}
                keyExtractor={(item) => item}
                renderItem={() =>
                  filteredEmojis.length > 0 ? (
                    renderEmojiGrid(filteredEmojis)
                  ) : (
                    <View style={styles.noResultsContainer}>
                      <Text style={styles.noResultsText}>No emojis found</Text>
                    </View>
                  )
                }
                contentContainerStyle={styles.scrollList}
                keyboardShouldPersistTaps="handled"
              />
            ) : (
              <FlatList
                ref={flatListRef}
                data={sectionsData}
                keyExtractor={(item) => item.key}
                renderItem={({ item }) => (
                  <View style={styles.sectionContainer}>
                    <Text style={styles.sectionHeader}>{item.title}</Text>
                    {renderEmojiGrid(item.data)}
                  </View>
                )}
                contentContainerStyle={styles.scrollList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              />
            )}
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Dim background overlay
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    height: SHEET_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  dragHandleArea: {
    width: '100%',
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragHandle: {
    width: 38,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: '#D1D1D6',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 38,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#000000',
    padding: 0,
  },
  categoryTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
    paddingBottom: 4,
    marginHorizontal: 8,
  },
  categoryTab: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  activeCategoryTab: {
    backgroundColor: '#E5E5EA',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  emojiCell: {
    width: `${100 / 8}%`, // 8 items per row
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  emojiText: {
    fontSize: 28,
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  noResultsText: {
    color: '#8E8E93',
    fontSize: 15,
  },
});
