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
  isPaid = false,
  ratePerMinute = 5,
  communicationType = 'AUDIO',
  onAccept,
  onDecline,
}) {
  if (!visible) return null;

  const isMsg = communicationType === 'MESSAGE' || callType === 'message';
  const isVid = communicationType === 'VIDEO' || callType === 'video';
  const typeTitle = isMsg ? 'Paid Chat Request' : isVid ? 'Incoming Video Call' : 'Incoming Voice Call';
  const typeIcon = isMsg ? 'chatbubbles' : isVid ? 'videocam' : 'call';

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
            <View style={styles.titleRow}>
              <Ionicons name={typeIcon} size={14} color="#FF2E63" style={{ marginRight: 4 }} />
              <Text style={styles.callTypeLabel}>{typeTitle}</Text>
            </View>
            <Text style={styles.contactName} numberOfLines={1}>
              {contactName}
            </Text>
            {isPaid && (
              <Text style={styles.earningBadge}>
                Earn +{ratePerMinute} Coins / started min
              </Text>
            )}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.declineButton]}
              activeOpacity={0.8}
              onPress={onDecline}
              accessibilityLabel="Decline incoming request"
            >
              <Ionicons
                name="close"
                size={22}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              activeOpacity={0.8}
              onPress={onAccept}
              accessibilityLabel="Accept incoming request"
            >
              <Ionicons name={isMsg ? 'checkmark' : 'call'} size={22} color="#FFFFFF" />
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  callTypeLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
  },
  contactName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  earningBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 2,
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
