import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AttachmentSheet({ visible, onClose, onSelectImage, onOpenPoll }) {
  
  const handlePhotoLibrary = async () => {
    // Request permission first
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission to access library was denied');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      onSelectImage(result.assets[0].uri);
    }
    onClose();
  };

  const handleCamera = async () => {
    // Request permission first
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission to access camera was denied');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      onSelectImage(result.assets[0].uri);
    }
    onClose();
  };

  const handleStubPress = (optionName) => {
    alert(`${optionName} feature integration coming soon!`);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              <View style={styles.dragHandle} />
              
              <Text style={styles.sheetTitle}>Share Content</Text>
              
              <View style={styles.optionsGrid}>
                {/* Poll Option */}
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={() => {
                    onClose();
                    if (onOpenPoll) onOpenPoll();
                  }}
                >
                  <View style={[styles.iconWrapper, { backgroundColor: '#AF52DE' }]}>
                    <Ionicons name="bar-chart" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={styles.optionLabel}>Poll</Text>
                </TouchableOpacity>

                {/* Photo Library */}
                <TouchableOpacity style={styles.optionButton} onPress={handlePhotoLibrary}>
                  <View style={[styles.iconWrapper, { backgroundColor: '#34C759' }]}>
                    <Ionicons name="images" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={styles.optionLabel}>Photo Library</Text>
                </TouchableOpacity>

                {/* Camera */}
                <TouchableOpacity style={styles.optionButton} onPress={handleCamera}>
                  <View style={[styles.iconWrapper, { backgroundColor: '#FF9500' }]}>
                    <Ionicons name="camera" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={styles.optionLabel}>Camera</Text>
                </TouchableOpacity>

                {/* Document */}
                <TouchableOpacity style={styles.optionButton} onPress={() => handleStubPress('Document')}>
                  <View style={[styles.iconWrapper, { backgroundColor: '#5856D6' }]}>
                    <Ionicons name="document-text" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={styles.optionLabel}>Document</Text>
                </TouchableOpacity>

                {/* Location */}
                <TouchableOpacity style={styles.optionButton} onPress={() => handleStubPress('Location')}>
                  <View style={[styles.iconWrapper, { backgroundColor: '#FF2D55' }]}>
                    <Ionicons name="location" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={styles.optionLabel}>Location</Text>
                </TouchableOpacity>

                {/* Contact */}
                <TouchableOpacity style={styles.optionButton} onPress={() => handleStubPress('Contact')}>
                  <View style={[styles.iconWrapper, { backgroundColor: '#007AFF' }]}>
                    <Ionicons name="person" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={styles.optionLabel}>Contact</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E5EA',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 20,
    textAlign: 'center',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  optionButton: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  optionLabel: {
    fontSize: 12,
    color: '#3A3A3C',
    fontWeight: '500',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
});
