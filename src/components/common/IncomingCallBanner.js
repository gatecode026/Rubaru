import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 44;

export default function IncomingCallBanner({
  visible,
  contactName = 'Rahul Kumawat',
  avatarUri = 'https://i.pravatar.cc/150?img=11',
  callType = 'voice',
  onAccept,
  onDecline,
}) {
  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onDecline}
    >
      <View style={styles.overlay}>
        <View style={styles.bannerCard}>
          <Image
            source={{ uri: avatarUri || 'https://i.pravatar.cc/150?img=11' }}
            style={styles.avatar}
          />

          <View style={styles.infoColumn}>
            <Text style={styles.callTypeLabel}>
              {callType === 'video' ? 'Video Call' : 'Voice Call'}
            </Text>
            <Text style={styles.contactName} numberOfLines={1}>
              {contactName}
            </Text>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.declineButton]}
              activeOpacity={0.8}
              onPress={onDecline}
            >
              <Ionicons
                name="call"
                size={22}
                color="#FFFFFF"
                style={{ transform: [{ rotate: '135deg' }] }}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              activeOpacity={0.8}
              onPress={onAccept}
            >
              <Ionicons name="call" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingTop: STATUSBAR_HEIGHT + 10,
    alignItems: 'center',
  },
  bannerCard: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#E5E5EA',
  },
  infoColumn: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 10,
  },
  callTypeLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 2,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButton: {
    backgroundColor: '#FF3B30',
    marginRight: 10,
  },
  acceptButton: {
    backgroundColor: '#34C759',
  },
});
