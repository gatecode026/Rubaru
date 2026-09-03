import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  StatusBar,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import SegmentedNotifCallsHeader from '../components/common/SegmentedNotifCallsHeader';
import HistoryRow from '../components/common/HistoryRow';
import BottomTabBar from '../components/common/BottomTabBar';
import api from '../services/api';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || '';

function getAvatarUrl(uri) {
  if (!uri) return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500';
  if (uri.startsWith('http') || uri.startsWith('file://')) return uri;
  return `${BASE_URL}${uri}`;
}

export default function CallInfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const contactName = params.contactName || 'Rubaru User';
  const avatarUri = getAvatarUrl(params.avatarUri);
  const [history, setHistory] = useState([]);
  const [lastCall, setLastCall] = useState(null);

  useEffect(() => {
    async function loadCallDetails() {
      try {
        const res = await api.get('/calls/logs');
        const logs = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        // Find logs for this contact
        const contactLogs = logs.filter(
          (l) => l.name === contactName || (params.contactId && l.id === params.contactId)
        );

        if (contactLogs.length > 0) {
          const mappedHistory = contactLogs.map((l, idx) => ({
            id: l.id || String(idx),
            type: l.callType === 'video' ? 'Outgoing Video Call' : 'Outgoing Audio Call',
            date: l.time || 'Recently',
            duration: l.duration || '00:00',
            icon: 'arrow-up-right',
            iconColor: '#34C759',
          }));
          setHistory(mappedHistory);
          setLastCall(mappedHistory[0]);
        }
      } catch (err) {
        console.log('[CALL INFO FETCH ERROR]', err.message);
      }
    }
    loadCallDetails();
  }, [contactName, params.contactId]);

  const handlePressCall = (callType) => {
    router.push({
      pathname: '/active-call',
      params: {
        contactName,
        avatarUri,
        callType,
        initialStatus: 'calling',
      },
    });
  };

  return (
    <View style={styles.safeContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <SegmentedNotifCallsHeader activeTab="calls" showBack={true} />

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <HistoryRow item={item} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={
          <View>
            {/* Contact Header Row */}
            <View style={styles.contactRow}>
              <Image source={{ uri: avatarUri }} style={styles.contactAvatar} />

              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{contactName}</Text>
                <Text style={styles.contactStatus}>Rubaru Member</Text>
              </View>

              <View style={styles.actionButtonsRow}>
                <TouchableOpacity
                  style={styles.outlineIconButton}
                  activeOpacity={0.7}
                  onPress={() => handlePressCall('voice')}
                >
                  <Ionicons name="call-outline" size={20} color="#000000" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.outlineIconButton}
                  activeOpacity={0.7}
                  onPress={() => handlePressCall('video')}
                >
                  <Ionicons name="videocam-outline" size={20} color="#000000" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Last Call Summary Card (if available) */}
            {lastCall ? (
              <View style={styles.summaryCard}>
                <View style={styles.summaryLeft}>
                  <Feather
                    name="arrow-up-right"
                    size={20}
                    color="#34C759"
                    style={styles.summaryIcon}
                  />
                  <View>
                    <Text style={styles.summaryTitle}>{lastCall.type}</Text>
                    <Text style={styles.summaryDate}>{lastCall.date}</Text>
                  </View>
                </View>

                <Text style={styles.summaryDuration}>{lastCall.duration}</Text>
              </View>
            ) : null}

            {/* Centered History Header with Accent Horizontal Line */}
            <View style={styles.historyHeaderContainer}>
              <Text style={styles.historyHeaderText}>Call History</Text>
              <View style={styles.redDividerLine} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="call-outline" size={40} color="#9CA3AF" />
            <Text style={styles.emptyText}>No previous call logs with this user.</Text>
          </View>
        }
      />

      <BottomTabBar
        activeTab="Notification"
        onTabPress={(tabKey) => {
          router.push(tabKey === 'index' ? '/(tabs)' : `/(tabs)/${tabKey}`);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 90,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  contactAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 14,
    backgroundColor: '#F3F4F6',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#000000',
    marginBottom: 2,
  },
  contactStatus: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#8E8E93',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  outlineIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF5F6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginVertical: 12,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIcon: {
    marginRight: 12,
  },
  summaryTitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#000000',
    marginBottom: 2,
  },
  summaryDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#8E8E93',
  },
  summaryDuration: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#666666',
  },
  historyHeaderContainer: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 12,
  },
  historyHeaderText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#000000',
    marginBottom: 6,
  },
  redDividerLine: {
    width: 40,
    height: 2,
    backgroundColor: '#FF2E63',
    borderRadius: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
});
