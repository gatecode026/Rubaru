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
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme';
import api from '@services/api';

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
  const accentColor = isDarkMode ? '#111827' : '#FF2E63';

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [avatarUri, setAvatarUri] = useState('');
  const [avatarAsset, setAvatarAsset] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [newPhotos, setNewPhotos] = useState([]);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onBackPress = () => {
      router.push('/user-profile?openSettings=true');
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get('/profiles/me');
        const data = response.data;
        setName(data.displayName || '');
        setBio(data.bio || '');
        setAvatarUri(data.avatarUri || '');
        setPhone(data.user?.phone || '');
        setEmail(data.user?.email || '');
        setLocation(data.locationName || '');
        setExistingPhotos(data.photos || []);
        setRemoveAvatar(false);
        
        if (data.dateOfBirth) {
          const d = new Date(data.dateOfBirth);
          const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
          ];
          setDob(`${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`);
        }

        if (data.interests) {
          const matchedIds = data.interests.map(label => 
            ALL_INTERESTS.find(item => item.name.toLowerCase() === label.toLowerCase())?.id
          ).filter(Boolean);
          setSelectedInterests(matchedIds);
        }
        setLoading(false);
      } catch (error) {
        console.log('[EDIT PROFILE FETCH ERROR]', error.message || error);
        if (error.response?.status !== 401) {
          alert('Failed to load profile details.');
        }
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handlePickAvatar = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      alert("Permission to access camera roll is required!");
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
      const selected = pickerResult.assets[0];
      setAvatarAsset(selected);
      setAvatarUri(selected.uri);
      setRemoveAvatar(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarAsset(null);
    setAvatarUri('https://i.pravatar.cc/150?img=60');
    setRemoveAvatar(true);
  };

  const handlePickPhoto = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      alert("Permission to access camera roll is required!");
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 9,
      quality: 0.8,
    });

    if (!pickerResult.canceled && pickerResult.assets) {
      setNewPhotos([...newPhotos, ...pickerResult.assets]);
    }
  };

  const handleRemoveExistingPhoto = (indexToRemove) => {
    setExistingPhotos(existingPhotos.filter((_, idx) => idx !== indexToRemove));
  };

  const handleRemoveNewPhoto = (indexToRemove) => {
    setNewPhotos(newPhotos.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Display Name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      const interestsToSave = selectedInterests
        .map(id => ALL_INTERESTS.find(item => item.id === id)?.name)
        .filter(Boolean);

      const hasFiles = !!avatarAsset || newPhotos.length > 0;

      if (!hasFiles) {
        // Send a simple JSON payload
        const payload = {
          displayName: name.trim(),
          bio: bio.trim(),
          locationName: location.trim(),
          dateOfBirth: dob.trim(),
          interests: interestsToSave,
          existingPhotos,
          removeAvatar,
        };
        await api.put('/profiles/edit', payload);
      } else {
        // Send as FormData for multipart file uploads
        const formData = new FormData();
        formData.append('displayName', name.trim());
        formData.append('bio', bio.trim());
        formData.append('locationName', location.trim());
        formData.append('dateOfBirth', dob.trim());
        formData.append('interests', JSON.stringify(interestsToSave));
        formData.append('existingPhotos', JSON.stringify(existingPhotos));
        formData.append('removeAvatar', String(removeAvatar));

        if (avatarAsset) {
          const localUri = avatarAsset.uri;
          const filename = localUri.split('/').pop() || 'avatar.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : 'image/jpeg';
          
          formData.append('avatar', {
            uri: localUri,
            name: filename,
            type,
          });
        }

        newPhotos.forEach((photoAsset, index) => {
          const localUri = photoAsset.uri;
          const filename = localUri.split('/').pop() || `photo_${index}.jpg`;
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : 'image/jpeg';

          formData.append('photos', {
            uri: localUri,
            name: filename,
            type,
          });
        });

        await api.put('/profiles/edit', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          transformRequest: (data, headers) => {
            if (headers && headers.delete) {
              headers.delete('Content-Type');
            } else if (headers) {
              delete headers['Content-Type'];
            }
            return data;
          },
        });
      }
      setSaving(false);
      alert('Profile updated successfully!');
      router.push('/user-profile?openSettings=true');
    } catch (error) {
      setSaving(false);
      console.log('[EDIT PROFILE SAVE ERROR]', error.message || error);
      const errMsg = error.response?.data?.message || 'Failed to update profile. Please try again.';
      alert(errMsg);
    }
  };

  const toggleInterest = (id) => {
    if (selectedInterests.includes(id)) {
      setSelectedInterests(selectedInterests.filter((item) => item !== id));
    } else {
      setSelectedInterests([...selectedInterests, id]);
    }
  };

  const getFullUrl = (uri) => {
    if (!uri) return 'https://i.pravatar.cc/150?img=60';
    if (uri.startsWith('http') || uri.startsWith('file://') || uri.startsWith('content://')) return uri;
    const apiBase = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.70:5000/api';
    const host = apiBase.replace('/api', '');
    return `${host}${uri}`;
  };

  const renderIcon = (item, isSelected) => {
    const iconColor = isSelected ? '#FFFFFF' : '#111827';
    const size = 16;

    if (item.lib === 'MaterialCommunityIcons') {
      return <MaterialCommunityIcons name={item.icon} size={size} color={iconColor} style={styles.iconStyle} />;
    }
    return <Ionicons name={item.icon} size={size} color={iconColor} style={styles.iconStyle} />;
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
                {(!avatarUri || avatarUri.includes('pravatar.cc')) ? (
                  <View style={[styles.avatarImage, { backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="person-outline" size={32} color="#9CA3AF" />
                  </View>
                ) : (
                  <Image
                    source={{ uri: getFullUrl(avatarUri) }}
                    style={styles.avatarImage}
                  />
                )}
              </View>
              <View style={styles.avatarActionsRow}>
                <Pressable 
                  onPress={handlePickAvatar}
                  style={({ pressed }) => [styles.avatarActionBtn, pressed && styles.buttonPressed]}
                  accessibilityLabel="Replace avatar picture"
                >
                  <Ionicons name="image-outline" size={16} color="#FF2E63" style={{ marginRight: 6 }} />
                  <Text style={styles.avatarActionTextReplace}>Replace</Text>
                </Pressable>

                <View style={styles.avatarActionDivider} />

                <Pressable 
                  onPress={handleRemoveAvatar}
                  style={({ pressed }) => [styles.avatarActionBtn, pressed && styles.buttonPressed]}
                  accessibilityLabel="Remove avatar picture"
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                  <Text style={styles.avatarActionTextRemove}>Remove</Text>
                </Pressable>
              </View>
            </View>

            {/* Personal Details List */}
            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Name</Text>
                <TextInput
                  style={styles.detailValueInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter name"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Bio</Text>
                <TextInput
                  style={[styles.detailValueInput, { flex: 1.8 }]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Enter bio"
                  placeholderTextColor="#9CA3AF"
                  multiline
                />
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Location</Text>
                <TextInput
                  style={styles.detailValueInput}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Enter location"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>DOB</Text>
                <TextInput
                  style={styles.detailValueInput}
                  value={dob}
                  onChangeText={setDob}
                  placeholder="e.g. 19 April 1995"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone Number</Text>
                <Text style={styles.detailValueReadOnly}>{phone || 'N/A'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email Address</Text>
                <Text style={styles.detailValueReadOnly}>{email || 'N/A'}</Text>
              </View>
            </View>

            {/* Captured Moments Section Header */}
            <View style={styles.interestsSectionHeader}>
              <Text style={styles.interestsMainTitle}>Captured Moments</Text>
              
              <Text style={styles.interestsSubtitle}>
                Add or remove photos in your profile gallery.
              </Text>
              
              {/* Photo thumbnails grid */}
              <View style={styles.photosEditGrid}>
                {/* Render Existing Photos */}
                {existingPhotos.map((photo, index) => (
                  <View key={`existing-${index}`} style={styles.photoEditWrapper}>
                    <Image source={{ uri: getFullUrl(photo) }} style={styles.photoEditThumbnail} />
                    <Pressable 
                      style={styles.deletePhotoBadge} 
                      onPress={() => handleRemoveExistingPhoto(index)}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={14} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ))}

                {/* Render New Selected Photos */}
                {newPhotos.map((photo, index) => (
                  <View key={`new-${index}`} style={styles.photoEditWrapper}>
                    <Image source={{ uri: photo.uri }} style={styles.photoEditThumbnail} />
                    <Pressable 
                      style={styles.deletePhotoBadge} 
                      onPress={() => handleRemoveNewPhoto(index)}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={14} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ))}

                {/* Add Photo Button (plus icon card) */}
                <Pressable 
                  style={styles.addPhotoCard} 
                  onPress={handlePickPhoto}
                  accessibilityLabel="Add moments photo"
                >
                  <Ionicons name="add" size={24} color="#FF2E63" />
                  <Text style={styles.addPhotoText}>Add Photo</Text>
                </Pressable>
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

            {/* Bottom Save Button */}
            <Pressable
              onPress={saving ? null : handleSave}
              style={({ pressed }) => [styles.continueButton, { backgroundColor: accentColor }, (pressed || saving) && styles.buttonPressed]}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.continueButtonText}>Save changes</Text>
              )}
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
  detailValueReadOnly: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  detailValueInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
    paddingVertical: 4,
    minWidth: 160,
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
  photosEditGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  photoEditWrapper: {
    position: 'relative',
    width: (SCREEN_WIDTH - 72) / 3,
    height: 100,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  photoEditThumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  deletePhotoBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoCard: {
    width: (SCREEN_WIDTH - 72) / 3,
    height: 100,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 46, 99, 0.3)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255, 46, 99, 0.02)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    fontSize: 12,
    color: '#FF2E63',
    fontWeight: '700',
    marginTop: 4,
  },
  avatarActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  avatarActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  avatarActionDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
  },
  avatarActionTextReplace: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF2E63',
  },
  avatarActionTextRemove: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
});
