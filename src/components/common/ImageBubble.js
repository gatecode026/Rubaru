import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_IMAGE_WIDTH = SCREEN_WIDTH * 0.7;

export default function ImageBubble({ imageUri, time, isSent, isRead, onLongPress }) {
  const [lightboxVisible, setLightboxVisible] = useState(false);

  return (
    <View style={isSent ? styles.sentContainer : styles.receivedContainer}>
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={onLongPress}
        onPress={() => setLightboxVisible(true)}
        style={styles.imageWrapper}
      >
        <Image
          source={{ uri: imageUri }}
          style={[
            styles.chatImage,
            isSent ? styles.sentImageBorder : styles.receivedImageBorder,
          ]}
          resizeMode="cover"
        />

        {isSent && (
          <View style={styles.sentTimeOverlay}>
            <Text style={styles.sentTimeText}>{time}</Text>
            {isRead && (
              <Ionicons
                name="checkmark-done"
                size={16}
                color="#34C759"
                style={styles.checkIcon}
              />
            )}
          </View>
        )}
      </TouchableOpacity>

      {!isSent && <Text style={styles.receivedTimeText}>{time}</Text>}

      {/* Full Screen Image Lightbox */}
      <Modal
        visible={lightboxVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setLightboxVisible(false)}
      >
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setLightboxVisible(false)}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableWithoutFeedback onPress={() => setLightboxVisible(false)}>
            <View style={styles.lightboxImageContainer}>
              <Image
                source={{ uri: imageUri }}
                style={styles.lightboxImage}
                resizeMode="contain"
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sentContainer: {
    alignSelf: 'flex-end',
    maxWidth: MAX_IMAGE_WIDTH,
    marginBottom: 10,
    marginRight: 16,
  },
  receivedContainer: {
    alignSelf: 'flex-start',
    maxWidth: MAX_IMAGE_WIDTH,
    marginBottom: 10,
    marginLeft: 16,
  },
  imageWrapper: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  chatImage: {
    width: MAX_IMAGE_WIDTH,
    height: MAX_IMAGE_WIDTH * 1.1, // Portrait orientation aspect ratio matching screenshot
  },
  sentImageBorder: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  receivedImageBorder: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 18,
  },
  sentTimeOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)', // Translucent dark background for legibility
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  sentTimeText: {
    color: '#FFFFFF',
    fontSize: 10,
    marginRight: 2,
  },
  checkIcon: {
    marginLeft: 2,
  },
  receivedTimeText: {
    alignSelf: 'flex-end',
    color: '#8E8E93',
    fontSize: 10,
    marginTop: 4,
    marginRight: 4,
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImage: {
    width: '100%',
    height: '80%',
  },
});
