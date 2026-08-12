import React from 'react';
import {
  SafeAreaView,
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
import { MOCK_CALL_HISTORY_DETAILS } from '../constants/mockCallData';

export default function CallInfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const contactName = params.contactName || MOCK_CALL_HISTORY_DETAILS.name;
  const avatarUri = params.avatarUri || MOCK_CALL_HISTORY_DETAILS.avatarUri;

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
    <SafeAreaView style={styles.safeContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <SegmentedNotifCallsHeader activeTab="calls" />

      <FlatList
        data={MOCK_CALL_HISTORY_DETAILS.history}
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
                <Text style={styles.contactStatus}>{MOCK_CALL_HISTORY_DETAILS.status}</Text>
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

            {/* Last Call Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryLeft}>
                <Feather
                  name="arrow-up-right"
                  size={20}
                  color="#34C759"
                  style={styles.summaryIcon}
                />
                <View>
                  <Text style={styles.summaryTitle}>
                    {MOCK_CALL_HISTORY_DETAILS.lastCallSummary.type}
                  </Text>
                  <Text style={styles.summaryDate}>
                    {MOCK_CALL_HISTORY_DETAILS.lastCallSummary.date}
                  </Text>
                </View>
              </View>

              <Text style={styles.summaryDuration}>
                {MOCK_CALL_HISTORY_DETAILS.lastCallSummary.duration}
              </Text>
            </View>

            {/* Centered History Header with Accent Horizontal Line */}
            <View style={styles.historyHeaderContainer}>
              <Text style={styles.historyHeaderText}>History</Text>
              <View style={styles.redDividerLine} />
            </View>
          </View>
        }
      />

      {/* Fixed Pinned Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          activeOpacity={0.6}
          onPress={() => router.push('/explore')}
        >
          <Ionicons name="home-outline" size={24} color="#000000" />
          <Text style={styles.tabLabel}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          activeOpacity={0.6}
          onPress={() => router.push('/connection')}
        >
          <Ionicons name="pulse-outline" size={24} color="#000000" />
          <Text style={styles.tabLabel}>Connection</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          activeOpacity={0.6}
          onPress={() => router.push('/reels')}
        >
          <Ionicons name="play-circle-outline" size={24} color="#000000" />
          <Text style={styles.tabLabel}>Reels</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} activeOpacity={0.6}>
          <Ionicons name="notifications" size={24} color="#F04452" />
          <Text style={[styles.tabLabel, styles.activeTabLabel]}>Notification</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          activeOpacity={0.6}
          onPress={() => router.push('/groups')}
        >
          <Ionicons name="people-outline" size={24} color="#000000" />
          <Text style={styles.tabLabel}>Groups</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 90,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
    backgroundColor: '#E5E5EA',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 2,
  },
  contactStatus: {
    fontSize: 13,
    color: '#8E8E93',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  outlineIconButton: {
    width: 48,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    backgroundColor: '#FFFFFF',
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F2F2F7',
    marginHorizontal: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginVertical: 8,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIcon: {
    marginRight: 14,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 2,
  },
  summaryDate: {
    fontSize: 13,
    color: '#8E8E93',
  },
  summaryDuration: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '600',
  },
  historyHeaderContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  historyHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F04452',
    marginBottom: 8,
  },
  redDividerLine: {
    width: '100%',
    height: 2,
    backgroundColor: '#F04452',
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EFEFF4',
    paddingTop: 8,
    paddingBottom: 16,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    zIndex: 20,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabLabel: {
    fontSize: 10,
    color: '#000000',
    marginTop: 4,
  },
  activeTabLabel: {
    color: '#F04452',
    fontWeight: '700',
  },
});
