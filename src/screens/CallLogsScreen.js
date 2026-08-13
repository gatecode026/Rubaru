import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import SegmentedNotifCallsHeader from '../components/common/SegmentedNotifCallsHeader';
import EmptyCallLogsView from '../components/common/EmptyCallLogsView';
import { INITIAL_CALL_LOGS } from '../constants/mockCallData';
import { useIncomingCall } from '../components/common/IncomingCallContext';
import BottomTabBar from '../components/common/BottomTabBar';

export default function CallLogsScreen() {
  const router = useRouter();
  const { triggerIncomingCall } = useIncomingCall();
  const [callLogs, setCallLogs] = useState(INITIAL_CALL_LOGS);
  const [showEmpty, setShowEmpty] = useState(false);

  const displayData = showEmpty ? [] : callLogs;

  const handlePressRow = (item) => {
    router.push({
      pathname: `/call-info/${item.id}`,
      params: {
        contactId: item.id,
        contactName: item.name,
        avatarUri: item.avatarUri || '',
        initials: item.initials || '',
      },
    });
  };

  const handlePressCallIcon = (item) => {
    router.push({
      pathname: '/active-call',
      params: {
        contactName: item.name,
        avatarUri: item.avatarUri || '',
        callType: item.callIconType || 'voice',
        initialStatus: 'calling',
      },
    });
  };

  const renderCallRow = ({ item }) => {
    const isMissed = item.callType === 'missed' || item.isMissed;
    const isMissedX = item.callType === 'missed-x';

    return (
      <TouchableOpacity
        style={styles.rowContainer}
        activeOpacity={0.7}
        onPress={() => handlePressRow(item)}
      >
        {/* Avatar / Initials */}
        {item.avatarUri ? (
          <Image source={{ uri: item.avatarUri }} style={styles.avatarImage} />
        ) : (
          <View
            style={[
              styles.initialsAvatar,
              { backgroundColor: item.initialsColor || '#A288E3' },
            ]}
          >
            <Text style={styles.initialsText}>{item.initials}</Text>
          </View>
        )}

        {/* Middle Details */}
        <View style={styles.middleColumn}>
          <Text
            style={[
              styles.contactNameText,
              isMissed && styles.missedNameText,
            ]}
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

            <Text style={styles.dateText}>{item.date}</Text>
          </View>
        </View>

        {/* Right Icon Button */}
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
    <SafeAreaView style={styles.safeContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <SegmentedNotifCallsHeader activeTab="calls" />

      {/* Dev / Testing Controls Sub-bar */}
      <View style={styles.devBar}>
        <TouchableOpacity
          style={styles.devBtn}
          onPress={() => triggerIncomingCall({ contactName: 'Rahul Kumawat', callType: 'voice' })}
        >
          <Text style={styles.devBtnText}>⚡ Incoming Call Demo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.devBtn}
          onPress={() => setShowEmpty(!showEmpty)}
        >
          <Text style={styles.devBtnText}>
            {showEmpty ? 'Show List State' : 'Show Empty State'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {displayData.length === 0 ? (
        <EmptyCallLogsView />
      ) : (
        <FlatList
          data={displayData}
          keyExtractor={(item) => item.id}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  devBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#F9F9FB',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFF4',
  },
  devBtn: {
    backgroundColor: '#EFEFF4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  devBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#000000',
  },
  listContainer: {
    paddingTop: 8,
    paddingBottom: 90,
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 14,
    backgroundColor: '#E5E5EA',
  },
  initialsAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  initialsText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  middleColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  contactNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  missedNameText: {
    color: '#FF3B30',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dirIcon: {
    marginRight: 6,
  },
  dateText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  callIconButton: {
    padding: 6,
    marginLeft: 10,
  },
});
