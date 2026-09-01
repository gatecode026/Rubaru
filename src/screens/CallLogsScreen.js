import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import SegmentedNotifCallsHeader from '../components/common/SegmentedNotifCallsHeader';
import EmptyCallLogsView from '../components/common/EmptyCallLogsView';
import BottomTabBar from '../components/common/BottomTabBar';
import api from '../services/api';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || '';

function getAvatarUrl(uri) {
  if (!uri) return '';
  if (uri.startsWith('http')) return uri;
  return `${BASE_URL}${uri}`;
}

export default function CallLogsScreen() {
  const router = useRouter();
  const [callLogs, setCallLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCallLogs = useCallback(() => {
    async function load() {
      try {
        const res = await api.get('/calls/logs');
        setCallLogs(res.data || []);
      } catch (e) {
        console.log('[CALL LOGS FETCH ERROR]', e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useFocusEffect(fetchCallLogs);

  const handlePressRow = (item) => {
    router.push({
      pathname: `/call-info/${item.id}`,
      params: {
        contactId: item.id,
        contactName: item.name,
        avatarUri: item.avatarUri || '',
      },
    });
  };

  const handlePressCallIcon = (item) => {
    router.push({
      pathname: '/active-call',
      params: {
        contactName: item.name,
        avatarUri: getAvatarUrl(item.avatarUri) || '',
        callType: item.callIconType || 'voice',
        receiverId: item.otherUserId || '',
        initialStatus: 'calling',
      },
    });
  };

  const renderCallRow = ({ item }) => {
    const isMissed = item.callType === 'missed' || item.isMissed;
    const isMissedX = item.callType === 'missed-x';
    const avatarUrl = getAvatarUrl(item.avatarUri);
    const dateStr = item.date
      ? new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' }) +
        ', ' +
        new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <TouchableOpacity
        style={styles.rowContainer}
        activeOpacity={0.7}
        onPress={() => handlePressRow(item)}
      >
        {/* Avatar */}
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={[styles.initialsAvatar, { backgroundColor: '#A288E3' }]}>
            <Text style={styles.initialsText}>
              {item.name ? item.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : '?'}
            </Text>
          </View>
        )}

        {/* Middle Details */}
        <View style={styles.middleColumn}>
          <Text
            style={[styles.contactNameText, isMissed && styles.missedNameText]}
            numberOfLines={1}
          >
            {item.name}
          </Text>

          <View style={styles.statusRow}>
            {item.callType === 'outgoing' && (
              <Feather name="arrow-up-right" size={16} color="#34C759" style={styles.dirIcon} />
            )}
            {item.callType === 'incoming' && (
              <Feather name="arrow-down-left" size={16} color="#34C759" style={styles.dirIcon} />
            )}
            {isMissed && (
              <Feather name="arrow-down-left" size={16} color="#FF3B30" style={styles.dirIcon} />
            )}
            {isMissedX && (
              <Ionicons name="close" size={16} color="#FF3B30" style={styles.dirIcon} />
            )}
            <Text style={styles.dateText}>{dateStr}</Text>
          </View>
        </View>

        {/* Right Call Icon */}
        <TouchableOpacity
          style={styles.callIconButton}
          activeOpacity={0.7}
          onPress={() => handlePressCallIcon(item)}
        >
          {item.callIconType === 'video' ? (
            <Ionicons name="videocam-outline" size={20} color="#000000" />
          ) : (
            <Ionicons name="call-outline" size={19} color="#000000" />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.safeContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <SegmentedNotifCallsHeader activeTab="calls" />

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#FF2E63" />
        </View>
      ) : callLogs.length === 0 ? (
        <EmptyCallLogsView />
      ) : (
        <FlatList
          data={callLogs}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCallRow}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

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
  safeContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContainer: { paddingTop: 8, paddingBottom: 90 },
  rowContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  avatarImage: { width: 44, height: 44, borderRadius: 22, marginRight: 14, backgroundColor: '#E5E5EA' },
  initialsAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  initialsText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  middleColumn: { flex: 1, justifyContent: 'center' },
  contactNameText: { fontSize: 16, fontWeight: '700', color: '#000000', marginBottom: 4 },
  missedNameText: { color: '#FF3B30' },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  dirIcon: { marginRight: 6 },
  dateText: { fontSize: 13, color: '#8E8E93' },
  callIconButton: { padding: 6, marginLeft: 10 },
});
