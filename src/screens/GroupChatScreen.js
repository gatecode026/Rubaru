import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ImageBackground,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const initialGroupMessages = [
  {
    id: 'sys-1',
    type: 'system',
    text: 'Priya added Raj to the group',
  },
  {
    id: '1',
    type: 'user',
    senderName: 'Raj Singh',
    senderInitials: 'RS',
    avatarBg: '#6366F1',
    text: 'Can we push the review call to 4pm? Stuck in another meeting.',
    time: '10:24 AM',
    isOnline: true,
    isSentByMe: false,
  },
  {
    id: '2',
    type: 'image',
    senderName: 'Raj Singh',
    senderInitials: 'RS',
    avatarBg: '#6366F1',
    imageBgGradient: ['#FFE4E8', '#FFD1DC'],
    time: '10:25 AM',
    isSentByMe: false,
  },
  {
    id: '3',
    type: 'user',
    senderName: 'Me',
    text: "Works for me, I'll update the invite.",
    time: '10:26 AM',
    isSentByMe: true,
  },
  {
    id: '4',
    type: 'user',
    senderName: 'Sara Kapoor',
    senderInitials: 'SK',
    avatarBg: '#F59E0B',
    text: "Sounds good, I'll send the updated deck before then.",
    time: '10:28 AM',
    isSentByMe: false,
  },
];

export default function GroupChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();

  const groupName = params.name || 'Product Team';
  const groupInitials = params.initials || 'PT';
  const onlineText = params.onlineText || '3 of 8 online';

  const [messages, setMessages] = useState(initialGroupMessages);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef(null);

  // Dark mode button and gradient adaptations
  const headerAvatarColors = isDarkMode ? ['#3A3A3C', '#1C1C1E'] : ['#FF6584', '#FF2E63'];
  const sentBubbleColors = isDarkMode ? ['#1C1C1E', '#3A3A3C'] : ['#FF2E63', '#E63956'];
  const sendBtnActiveBg = isDarkMode ? '#1C1C1E' : '#FF2E63';
  const actionIconColor = isDarkMode ? '#1C1C1E' : '#6B7280';

  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    const newMessage = {
      id: Date.now().toString(),
      type: 'user',
      senderName: 'Me',
      text: inputText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSentByMe: true,
    };
    setMessages((prev) => [...prev, newMessage]);
    setInputText('');
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleHeaderPress = () => {
    router.push({
      pathname: '/group-settings',
      params: {
        name: groupName,
        initials: groupInitials,
      },
    });
  };

  const renderMessageItem = ({ item }) => {
    if (item.type === 'system') {
      return (
        <View style={styles.systemMsgContainer}>
          <Text style={styles.systemMsgText}>{item.text}</Text>
        </View>
      );
    }

    if (item.isSentByMe) {
      return (
        <View style={styles.sentMsgContainer}>
          <LinearGradient
            colors={sentBubbleColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.sentBubble, isDarkMode && styles.sentBubbleDarkShadow]}
          >
            <Text style={styles.sentMsgText}>{item.text}</Text>
            <View style={styles.sentMetaRow}>
              <Text style={styles.sentTimeText}>{item.time}</Text>
              <Ionicons name="checkmark-done" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
            </View>
          </LinearGradient>
        </View>
      );
    }

    return (
      <View style={styles.receivedMsgWrapper}>
        <Text style={styles.senderNameText}>{item.senderName}</Text>

        <View style={styles.receivedMsgRow}>
          {/* Avatar with online dot */}
          <View style={[styles.avatarCircle, { backgroundColor: item.avatarBg || '#6366F1' }]}>
            <Text style={styles.avatarInitialsText}>{item.senderInitials}</Text>
            {item.isOnline && <View style={styles.onlineDot} />}
          </View>

          {item.type === 'image' ? (
            <View style={styles.receivedContentBox}>
              <LinearGradient
                colors={item.imageBgGradient || ['#FFE4E8', '#FFD1DC']}
                style={styles.imageCardPlaceholder}
              >
                <Ionicons name="image-outline" size={32} color={isDarkMode ? '#1C1C1E' : '#FF2E63'} />
              </LinearGradient>
              <Text style={styles.receivedTimeText}>{item.time}</Text>
            </View>
          ) : (
            <View style={styles.receivedContentBox}>
              <View style={styles.receivedBubble}>
                <Text style={styles.receivedMsgText}>{item.text}</Text>
              </View>
              <Text style={styles.receivedTimeText}>{item.time}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.rootContainer}>
      {/* Main Soft Pink Gradient Background (Preserved) */}
      <LinearGradient
        colors={['#FFF0F3', '#FFEBF0', '#FFFFFF']}
        style={styles.gradientBg}
      >
        {/* Top Header Matching Image 1 */}
        <View style={[styles.headerRow, { paddingTop: Math.max(insets.top + 6, 20) }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </Pressable>

          {/* Group Profile Header Touch Target */}
          <Pressable
            onPress={handleHeaderPress}
            style={({ pressed }) => [styles.headerProfileRow, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={headerAvatarColors}
              style={styles.headerAvatar}
            >
              <Text style={styles.headerAvatarText}>{groupInitials}</Text>
            </LinearGradient>

            <View style={styles.headerTitleCol}>
              <Text style={styles.groupTitleText} numberOfLines={1}>
                {groupName}
              </Text>
              <Text style={styles.groupSubtitleText}>{onlineText}</Text>
            </View>
          </Pressable>

          {/* Right Header Action Icons */}
          <View style={styles.rightHeaderActions}>
            <Pressable style={styles.headerActionBtn}>
              <Ionicons name="videocam-outline" size={22} color="#111827" />
            </Pressable>
            <Pressable style={styles.headerActionBtn}>
              <Ionicons name="call-outline" size={20} color="#111827" />
            </Pressable>

            {/* Menu options navigates to Group Settings */}
            <Pressable onPress={handleHeaderPress} style={styles.headerActionBtn}>
              <Ionicons name="ellipsis-vertical" size={20} color="#111827" />
            </Pressable>
          </View>
        </View>

        {/* Chat Body Scrollable Container */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={styles.dateHeaderContainer}>
                <View style={styles.datePill}>
                  <Text style={styles.datePillText}>Today</Text>
                </View>
              </View>
            }
          />

          {/* Bottom Group Input Bar Matching Image 1 */}
          <View style={[styles.bottomInputContainer, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}>
            <View style={styles.inputBarWrapper}>
              <Pressable style={styles.inputActionIcon}>
                <Ionicons name="add" size={22} color={actionIconColor} />
              </Pressable>
              <Pressable style={styles.inputActionIcon}>
                <Ionicons name="mic-outline" size={20} color={actionIconColor} />
              </Pressable>
              <Pressable style={styles.inputActionIcon}>
                <Ionicons name="happy-outline" size={20} color={actionIconColor} />
              </Pressable>
              <Pressable style={styles.inputActionIcon}>
                <Ionicons name="flash-outline" size={18} color={actionIconColor} />
              </Pressable>

              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Message the group..."
                placeholderTextColor="#9CA3AF"
                returnKeyType="send"
                onSubmitEditing={handleSendMessage}
              />

              <Pressable
                onPress={handleSendMessage}
                style={({ pressed }) => [
                  styles.sendBtn,
                  inputText.trim() ? { backgroundColor: sendBtnActiveBg } : null,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="send"
                  size={16}
                  color="#FFFFFF"
                  style={{ marginLeft: 2 }}
                />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#FFF0F3',
  },
  gradientBg: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderBottomWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.6)',
    zIndex: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  headerProfileRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  headerAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  headerTitleCol: {
    justifyContent: 'center',
  },
  groupTitleText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  groupSubtitleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
    marginTop: 1,
  },
  rightHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionBtn: {
    padding: 6,
    marginLeft: 6,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  dateHeaderContainer: {
    alignItems: 'center',
    marginVertical: 14,
  },
  datePill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1.5,
  },
  datePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  systemMsgContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  systemMsgText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  sentMsgContainer: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    maxWidth: '82%',
  },
  sentBubble: {
    borderRadius: 20,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  sentBubbleDarkShadow: {
    shadowColor: '#1C1C1E',
  },
  sentMsgText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
  },
  sentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  sentTimeText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '500',
  },
  receivedMsgWrapper: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    maxWidth: '84%',
  },
  senderNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
    marginLeft: 44,
    marginBottom: 4,
  },
  receivedMsgRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    position: 'relative',
  },
  avatarInitialsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  receivedContentBox: {
    flexDirection: 'column',
  },
  receivedBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderTopLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  receivedMsgText: {
    color: '#1F2937',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
  },
  receivedTimeText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
    marginLeft: 4,
  },
  imageCardPlaceholder: {
    width: 170,
    height: 120,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  bottomInputContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.7)',
  },
  inputBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F3',
    borderRadius: 26,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inputActionIcon: {
    padding: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
