import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  Image,
  ScrollView,
  Dimensions,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ALL_INTERESTS = [
  { id: 'photography', name: 'Photography', icon: 'camera-outline', lib: 'Ionicons' },
  { id: 'shopping', name: 'Shopping', icon: 'bag-handle-outline', lib: 'Ionicons' },
  { id: 'karaoke', name: 'Karaoke', icon: 'mic-outline', lib: 'Ionicons' },
  { id: 'yoga', name: 'Yoga', icon: 'yoga', lib: 'MaterialCommunityIcons' },
  { id: 'cooking', name: 'Cooking', icon: 'silverware-fork-knife', lib: 'MaterialCommunityIcons' },
  { id: 'tennis', name: 'Tennis', icon: 'tennisball-outline', lib: 'Ionicons' },
  { id: 'run', name: 'Run', icon: 'walk-outline', lib: 'Ionicons' },
  { id: 'swimming', name: 'Swimming', icon: 'water-outline', lib: 'Ionicons' },
  { id: 'art', name: 'Art', icon: 'color-palette-outline', lib: 'Ionicons' },
  { id: 'traveling', name: 'Traveling', icon: 'airplane-outline', lib: 'Ionicons' },
  { id: 'extreme', name: 'Extreme', icon: 'diamond-outline', lib: 'Ionicons' },
  { id: 'music', name: 'Music', icon: 'musical-notes-outline', lib: 'Ionicons' },
  { id: 'drink', name: 'Drink', icon: 'wine-outline', lib: 'Ionicons' },
  { id: 'videogames', name: 'Video games', icon: 'game-controller-outline', lib: 'Ionicons' },
];

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  // Pink in default/light mode, black in dark mode
  const accentColor = isDarkMode ? '#111827' : '#FF2E63';

  useEffect(() => {
    const onBackPress = () => {
      router.push('/user-profile?openSettings=true');
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [router]);

  const [name, setName] = useState('Geeta Bisht');
  const [dob, setDob] = useState('19 April 1995');
  const [contactNumber, setContactNumber] = useState('+91 XXXXXXXXXX');

  const [selectedInterests, setSelectedInterests] = useState([
    'shopping',
    'run',
    'traveling',
  ]);

  const toggleInterest = (id) => {
    if (selectedInterests.includes(id)) {
      setSelectedInterests(selectedInterests.filter((item) => item !== id));
    } else {
      setSelectedInterests([...selectedInterests, id]);
    }
  };

  const renderIcon = (item, isSelected) => {
    const iconColor = isSelected ? '#FFFFFF' : '#111827';
    const size = 16;

    if (item.lib === 'MaterialCommunityIcons') {
      return <MaterialCommunityIcons name={item.icon} size={size} color={iconColor} style={styles.iconStyle} />;
    }
    return <Ionicons name={item.icon} size={size} color={iconColor} style={styles.iconStyle} />;
  };

  return (
    <View style={styles.rootContainer}>
      <ImageBackground
        source={require('@assets/images/app_background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View
          style={[
            styles.mainWrapper,
            {
              paddingTop: Math.max(insets.top + 12, 40),
              paddingBottom: Math.max(insets.bottom + 16, 24),
            },
          ]}
        >
          {/* Top Header Row */}
          <View style={styles.topHeaderRow}>
            <Pressable
              onPress={() => router.push('/user-profile?openSettings=true')}
              style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
              hitSlop={12}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </Pressable>

            <Text style={styles.headerTitle}>Edit Profile</Text>
            
            {/* Empty placeholder for flex alignment */}
            <View style={{ width: 40 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {/* Profile Picture Avatar Section */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarRing}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80' }}
                  style={styles.avatarImage}
                />
              </View>
              <Pressable style={({ pressed }) => [pressed && styles.buttonPressed]}>
                <Text style={styles.editAvatarText}>Edit Picture or avatar</Text>
              </Pressable>
            </View>

            {/* Personal Details List */}
            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Name</Text>
                <Text style={styles.detailValue}>{name}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>DOB</Text>
                <Text style={styles.detailValue}>{dob}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Contact Number</Text>
                <Text style={styles.detailValue}>{contactNumber}</Text>
              </View>
            </View>

            {/* Your Interests Section Header */}
            <View style={styles.interestsSectionHeader}>
              <Text style={styles.interestsMainTitle}>Your interests</Text>

              {/* Top Selected Interests Chips (1 or 2 rows) */}
              <View style={styles.selectedChipsRow}>
                {selectedInterests.map((id) => {
                  const item = ALL_INTERESTS.find((interest) => interest.id === id);
                  if (!item) return null;
                  return (
                    <View key={id} style={[styles.selectedChipPill, { backgroundColor: accentColor }]}>
                      {renderIcon(item, true)}
                      <Text style={styles.selectedChipText}>{item.name}</Text>
                    </View>
                  );
                })}
              </View>

              <Text style={styles.interestsSubtitle}>
                Select a few of your interests and let everyone know what you’re passionate about.
              </Text>
            </View>

            {/* Interests Grid (2 Columns) */}
            <View style={styles.interestsGrid}>
              {ALL_INTERESTS.map((item) => {
                const isSelected = selectedInterests.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggleInterest(item.id)}
                    style={({ pressed }) => [
                      styles.interestCard,
                      isSelected ? [styles.interestCardSelected, { backgroundColor: accentColor }] : styles.interestCardUnselected,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    {renderIcon(item, isSelected)}
                    <Text
                      style={[
                        styles.interestText,
                        isSelected ? styles.interestTextSelected : styles.interestTextUnselected,
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Bottom Continue Button */}
            <Pressable
              onPress={() => router.push('/user-profile?openSettings=true')}
              style={({ pressed }) => [styles.continueButton, { backgroundColor: accentColor }, pressed && styles.buttonPressed]}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </Pressable>

          </ScrollView>
        </View>
      </ImageBackground>
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
    paddingHorizontal: 24,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    marginBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.8)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#3B82F6',
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  editAvatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
    marginTop: 12,
  },
  detailsContainer: {
    marginBottom: 28,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229, 231, 235, 0.5)',
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4B5563',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  interestsSectionHeader: {
    marginBottom: 16,
  },
  interestsMainTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
  },
  selectedChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  selectedChipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor applied inline (dynamic)
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  interestsSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    marginBottom: 16,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 28,
  },
  interestCard: {
    width: (SCREEN_WIDTH - 58) / 2,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  interestCardUnselected: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  interestCardSelected: {
    // backgroundColor applied inline (dynamic)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
    elevation: 3,
  },
  iconStyle: {
    marginRight: 8,
  },
  interestText: {
    fontSize: 13,
    fontWeight: '600',
  },
  interestTextUnselected: {
    color: '#111827',
  },
  interestTextSelected: {
    color: '#FFFFFF',
  },
  continueButton: {
    width: '100%',
    height: 52,
    // backgroundColor applied inline (dynamic)
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
