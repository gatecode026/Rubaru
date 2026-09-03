import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Image,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProfileDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState(params.firstName || '');
  const [lastName, setLastName] = useState(params.lastName || '');
  const [birthday, setBirthday] = useState('');
  const [location, setLocation] = useState(params.location || '');
  const [avatarUri, setAvatarUri] = useState(params.avatarUri || '');

  const displayDob = params.selectedDob || birthday || 'Choose birthday date';

  const handlePickAvatar = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      alert("Permission to access camera roll is required!");
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
      setAvatarUri(pickerResult.assets[0].uri);
    }
  };

  const handleConfirm = () => {
    if (!firstName.trim() || !lastName.trim()) {
      alert('Please enter your first and last name.');
      return;
    }
    if (displayDob === 'Choose birthday date') {
      alert('Please select your birthday.');
      return;
    }

    router.push({
      pathname: '/gender-selection',
      params: {
        ...params,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dob: displayDob,
        location: location.trim(),
        avatarUri,
      }
    });
  };

  return (
    <View style={styles.rootContainer}>
      {/* Full-Screen Blush Hearts Background Image */}
      <ImageBackground
        source={require('@assets/images/app_background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={[styles.mainWrapper, { paddingTop: Math.max(insets.top + 76, 108), paddingBottom: Math.max(insets.bottom + 16, 32) }]}>

          {/* Centered Main Form Container */}
          <View style={styles.formContainer}>
            {/* Page Header Title */}
            <Text style={styles.titleText}>Profile details</Text>

            {/* Avatar Photo Section with Camera Badge Overlay */}
            <Pressable onPress={handlePickAvatar} style={styles.avatarSection}>
              <View style={styles.avatarWrapper}>
                <Image
                  source={avatarUri ? { uri: avatarUri } : require('@assets/images/onboarding2.jpg')}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              </View>
              {/* Camera Badge Overlay */}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={18} color="#FFFFFF" />
              </View>
            </Pressable>

            {/* First Name Input Field Card */}
            <View style={styles.inputCard}>
              <View style={styles.floatingLabelWrapper}>
                <Text style={styles.floatingLabelText}>First name</Text>
              </View>
              <TextInput
                style={styles.textInput}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Last Name Input Field Card */}
            <View style={styles.inputCard}>
              <View style={styles.floatingLabelWrapper}>
                <Text style={styles.floatingLabelText}>Last name</Text>
              </View>
              <TextInput
                style={styles.textInput}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Location Input Field Card */}
            <View style={styles.inputCard}>
              <View style={styles.floatingLabelWrapper}>
                <Text style={styles.floatingLabelText}>Location</Text>
              </View>
              <TextInput
                style={styles.textInput}
                value={location}
                onChangeText={setLocation}
                placeholder="Location (e.g. Jaipur)"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Choose Birthday Date Field Card */}
            <Pressable
              onPress={() => router.push({
                pathname: '/birthday-picker',
                params: {
                  ...params,
                  firstName,
                  lastName,
                  location,
                }
              })}
              style={({ pressed }) => [styles.birthdayCard, pressed && styles.buttonPressed]}
              accessibilityLabel="Choose birthday date"
            >
              <Ionicons name="calendar-outline" size={22} color="#111827" />
              <Text style={[styles.birthdayText, params.selectedDob && styles.birthdayTextActive]}>{displayDob}</Text>
            </Pressable>

            {/* Confirm Button */}
            <Pressable
              onPress={handleConfirm}
              style={({ pressed }) => [styles.confirmButton, pressed && styles.buttonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Confirm profile details"
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </Pressable>
          </View>

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
  formContainer: {
    width: Math.min(SCREEN_WIDTH - 48, 340),
    alignSelf: 'center',
  },
  titleText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 44,
    letterSpacing: -0.5,
    alignSelf: 'flex-start',
  },
  avatarSection: {
    alignSelf: 'center',
    marginBottom: 36,
    position: 'relative',
  },
  avatarWrapper: {
    width: 114,
    height: 114,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF2E63',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  inputCard: {
    width: '100%',
    height: 58,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.9)',
    marginBottom: 24,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  floatingLabelWrapper: {
    position: 'absolute',
    top: -9,
    left: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(229, 231, 235, 0.8)',
  },
  floatingLabelText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  textInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    paddingVertical: 0,
  },
  birthdayCard: {
    width: '100%',
    height: 58,
    borderRadius: 16,
    backgroundColor: 'rgba(235, 215, 218, 0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 68,
  },
  birthdayText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF2E63',
    marginLeft: 12,
  },
  birthdayTextActive: {
    fontWeight: '700',
    color: '#FF2E63',
  },
  confirmButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#FF2E63',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});
