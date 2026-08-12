import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  StatusBar,
  StatusBar as RNStatusBar,
} from 'react-native';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 0;
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
let Audio;
try {
  Audio = require('expo-av').Audio;
} catch (e) {
  Audio = {
    requestPermissionsAsync: async () => ({ status: 'granted' }),
    setAudioModeAsync: async () => {},
    Recording: {
      createAsync: async () => {
        console.warn('Audio recording is not supported in this environment.');
        return { recording: { stopAndUnloadAsync: async () => {}, getURI: () => null } };
      }
    },
    RecordingOptionsPresets: {
      HIGH_QUALITY: {}
    }
  };
}
import MessageBubble from '../../src/components/common/MessageBubble';
import MessageOptionsMenu from '../../src/components/common/MessageOptionsMenu';
import EmojiPickerSheet from '../../src/components/common/EmojiPickerSheet';
import ImageBubble from '../../src/components/common/ImageBubble';
import VoiceMessageBubble from '../../src/components/common/VoiceMessageBubble';
import AttachmentSheet from '../../src/components/common/AttachmentSheet';
import StickerPicker from '../../src/components/common/StickerPicker';
import AIAssistMenu from '../../src/components/common/AIAssistMenu';
import PollBubble from '../../src/components/common/PollBubble';
import PollResultsModal from '../../src/components/common/PollResultsModal';
import CreatePollModal from '../../src/components/common/CreatePollModal';
import ReplyPreviewBar from '../../src/components/common/ReplyPreviewBar';

const initialMessages = [
  { id: '1', text: 'Hi ! Rahul', time: '4:56 pm', isSent: true, isRead: true, type: 'text' },
  { id: '2', text: 'Pooja this side.', time: '4:56 pm', isSent: true, isRead: true, type: 'text' },
  {
    id: '3',
    text: 'I saw your profile and wanted to say hello. You look amazing!',
    time: '4:56 pm',
    isSent: false,
    type: 'text',
  },
  {
    id: '4',
    text: "Hi Rahul! Thank you, that's really sweet of you. 🙂",
    time: '4:56 pm',
    isSent: true,
    isRead: true,
    type: 'text',
  },
  { id: '5', text: 'Thank you!', time: '4:56 pm', isSent: false, type: 'text' },
  {
    id: '6',
    type: 'image',
    imageUri: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop',
    time: '4:56 pm',
    isSent: true,
    isRead: true,
  },
  {
    id: '7',
    type: 'image',
    imageUri: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop',
    time: '4:56 pm',
    isSent: true,
    isRead: false,
  },
  {
    id: 'poll-sent-1',
    type: 'poll',
    question: 'Are you available for a call?',
    options: [
      {
        id: 'opt-1',
        label: 'Morning (4am-12pm)',
        votes: 3,
        voters: [
          { id: 'v1', name: 'Rahul Kumawat', avatarUri: 'https://i.pravatar.cc/150?img=11' },
          { id: 'v2', name: 'Pooja', avatarUri: 'https://i.pravatar.cc/150?img=5' },
          { id: 'v3', name: 'Amit', avatarUri: 'https://i.pravatar.cc/150?img=12' },
        ],
        isSelected: false,
      },
      {
        id: 'opt-2',
        label: 'Day Time (12pm-6pm)',
        votes: 7,
        voters: [
          { id: 'v1', name: 'Rahul Kumawat', avatarUri: 'https://i.pravatar.cc/150?img=11' },
          { id: 'v2', name: 'Pooja', avatarUri: 'https://i.pravatar.cc/150?img=5' },
          { id: 'v3', name: 'Amit', avatarUri: 'https://i.pravatar.cc/150?img=12' },
        ],
        isSelected: true,
      },
      {
        id: 'opt-3',
        label: 'Night Time (7pm-3pm)',
        votes: 2,
        voters: [
          { id: 'v8', name: 'Neha', avatarUri: 'https://i.pravatar.cc/150?img=20' },
          { id: 'v9', name: 'Karan', avatarUri: 'https://i.pravatar.cc/150?img=21' },
        ],
        isSelected: false,
      },
    ],
    time: '4:56 pm',
    isSent: true,
    isRead: true,
  },
  {
    id: 'poll-rec-1',
    type: 'poll',
    question: 'Are you available for a call?',
    options: [
      {
        id: 'opt-1',
        label: 'Morning (4am-12pm)',
        votes: 3,
        voters: [
          { id: 'v1', name: 'Rahul Kumawat', avatarUri: 'https://i.pravatar.cc/150?img=11' },
          { id: 'v2', name: 'Pooja', avatarUri: 'https://i.pravatar.cc/150?img=5' },
          { id: 'v3', name: 'Amit', avatarUri: 'https://i.pravatar.cc/150?img=12' },
        ],
        isSelected: false,
      },
      {
        id: 'opt-2',
        label: 'Day Time (12pm-6pm)',
        votes: 7,
        voters: [
          { id: 'v1', name: 'Rahul Kumawat', avatarUri: 'https://i.pravatar.cc/150?img=11' },
          { id: 'v2', name: 'Pooja', avatarUri: 'https://i.pravatar.cc/150?img=5' },
          { id: 'v3', name: 'Amit', avatarUri: 'https://i.pravatar.cc/150?img=12' },
        ],
        isSelected: true,
      },
      {
        id: 'opt-3',
        label: 'Night Time (7pm-3pm)',
        votes: 2,
        voters: [
          { id: 'v8', name: 'Neha', avatarUri: 'https://i.pravatar.cc/150?img=20' },
          { id: 'v9', name: 'Karan', avatarUri: 'https://i.pravatar.cc/150?img=21' },
        ],
        isSelected: false,
      },
    ],
    time: '4:56 pm',
    isSent: false,
  },
  {
    id: 'voice-sent-1',
    type: 'voice',
    duration: '00:32',
    time: '4:56 pm',
    isSent: true,
    isRead: true,
  },
  {
    id: 'voice-rec-1',
    type: 'voice',
    duration: '00:32',
    time: '4:55 pm',
    isSent: false,
  },
  {
    id: 'reply-sample-1',
    type: 'text',
    text: 'Sounds great! I will call you during Day Time.',
    time: '4:57 pm',
    isSent: true,
    isRead: true,
    replyTo: {
      senderName: 'Rahul Kumawat',
      text: 'Are you available for a call?',
    },
  },
];

export default function ChatConversationScreen() {
  const { name, avatarUrl } = useLocalSearchParams();
  const router = useRouter();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState(initialMessages);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const [attachmentVisible, setAttachmentVisible] = useState(false);
  const [stickerVisible, setStickerVisible] = useState(false);
  const [aiMenuVisible, setAiMenuVisible] = useState(false);
  const [isReactionMode, setIsReactionMode] = useState(false);
  const [createPollVisible, setCreatePollVisible] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);

  // Audio Recording States
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef(null);
  const flatListRef = useRef(null);

  const displayName = name || 'Rahul Kumawat';
  const displayAvatar = avatarUrl || 'https://i.pravatar.cc/150?img=11';

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/explore');
    }
  };

  // Auto-scroll when messages update
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Clean up recording timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleSend = () => {
    if (inputText.trim() === '') return;

    const replyData = replyingTo
      ? {
          senderName: replyingTo.isSent ? 'You' : displayName,
          text:
            replyingTo.text ||
            replyingTo.question ||
            (replyingTo.type === 'image'
              ? '📷 Photo'
              : replyingTo.type === 'voice'
              ? '🎤 Voice message'
              : 'Message'),
        }
      : null;

    const newMsg = {
      id: Date.now().toString(),
      type: 'text',
      text: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase(),
      isSent: true,
      isRead: false,
      replyTo: replyData,
    };
    setMessages((prev) => [...prev, newMsg]);
    setInputText('');
    setReplyingTo(null);
  };

  const handleSendImage = (uri) => {
    const newMsg = {
      id: Date.now().toString(),
      type: 'image',
      imageUri: uri,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase(),
      isSent: true,
      isRead: false,
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  const handleSendSticker = (emoji) => {
    const newMsg = {
      id: Date.now().toString(),
      type: 'sticker',
      sticker: emoji,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase(),
      isSent: true,
      isRead: false,
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  const handleCreatePoll = (pollData) => {
    const newMsg = {
      id: `poll-${Date.now()}`,
      type: 'poll',
      question: pollData.question,
      options: pollData.options,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase(),
      isSent: true,
      isRead: false,
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access microphone was denied');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    clearInterval(timerRef.current);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      };

      const newMsg = {
        id: Date.now().toString(),
        type: 'voice',
        voiceUri: uri,
        duration: formatTime(recordingTime),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase(),
        isSent: true,
        isRead: false,
      };
      setMessages((prev) => [...prev, newMsg]);
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  };

  const handleLongPressMessage = (msg) => {
    setSelectedMessage(msg);
    setOptionsVisible(true);
  };

  const handleSelectReaction = (emoji) => {
    if (!selectedMessage) return;
    setMessages(
      messages.map((m) =>
        m.id === selectedMessage.id ? { ...m, reaction: emoji } : m
      )
    );
    setOptionsVisible(false);
    setPickerVisible(false);
    setSelectedMessage(null);
  };

  const handleTextEmojiSelect = (emoji) => {
    if (isReactionMode) {
      handleSelectReaction(emoji);
    } else {
      setInputText((prev) => prev + emoji);
    }
  };

  const handlePressSmileyInInput = () => {
    setIsReactionMode(false);
    setPickerVisible(true);
  };

  const handlePressPlus = () => {
    setIsReactionMode(true);
    setOptionsVisible(false);
    setTimeout(() => {
      setPickerVisible(true);
    }, 100);
  };

  const [selectedPollForResults, setSelectedPollForResults] = useState(null);
  const [pollResultsVisible, setPollResultsVisible] = useState(false);

  const handleVote = (messageId, optionId) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg) => {
        if (msg.id !== messageId || msg.type !== 'poll') return msg;

        const updatedOptions = msg.options.map((opt) => {
          const wasSelected = opt.isSelected;
          const isNowSelected = opt.id === optionId;

          if (wasSelected && !isNowSelected) {
            return {
              ...opt,
              isSelected: false,
              votes: Math.max(0, opt.votes - 1),
              voters: opt.voters.filter((v) => v.id !== 'current-user'),
            };
          } else if (!wasSelected && isNowSelected) {
            return {
              ...opt,
              isSelected: true,
              votes: opt.votes + 1,
              voters: [
                ...opt.voters,
                { id: 'current-user', name: 'You', avatarUri: displayAvatar },
              ],
            };
          }
          return opt;
        });

        return { ...msg, options: updatedOptions };
      })
    );
  };

  const handleViewAllPoll = (poll) => {
    setSelectedPollForResults(poll);
    setPollResultsVisible(true);
  };

  const handleSelectOption = (option) => {
    if (!selectedMessage) return;

    if (option === 'delete') {
      setMessages((prev) => prev.filter((m) => m.id !== selectedMessage.id));
    } else if (option === 'copy') {
      const copyText =
        selectedMessage.text ||
        selectedMessage.question ||
        (selectedMessage.type === 'image' ? '[Image Message]' : '[Media Message]');
      setInputText(copyText);
      alert(`Copied: "${copyText}"`);
    } else if (option === 'info') {
      alert(`Message Info\n• Status: ${selectedMessage.isRead ? 'Read' : 'Delivered'}\n• Sent: ${selectedMessage.time || '4:56 pm'}\n• Type: ${selectedMessage.type || 'text'}`);
    } else if (option === 'edit') {
      if (selectedMessage.isSent && selectedMessage.text) {
        setInputText(selectedMessage.text);
        setMessages((prev) => prev.filter((m) => m.id !== selectedMessage.id));
      } else {
        alert('You can only edit text messages sent by you.');
      }
    } else if (option === 'reply') {
      setReplyingTo(selectedMessage);
    }

    setOptionsVisible(false);
    setSelectedMessage(null);
  };



  const renderMessageItem = (item) => {
    switch (item.type) {
      case 'image':
        return (
          <ImageBubble
            imageUri={item.imageUri}
            time={item.time}
            isSent={item.isSent}
            isRead={item.isRead}
            reaction={item.reaction}
            onLongPress={() => handleLongPressMessage(item)}
          />
        );
      case 'voice':
        return (
          <VoiceMessageBubble
            uri={item.voiceUri}
            duration={item.duration}
            time={item.time}
            isSent={item.isSent}
            isRead={item.isRead}
            reaction={item.reaction}
            onLongPress={() => handleLongPressMessage(item)}
          />
        );
      case 'sticker':
        return (
          <View style={item.isSent ? styles.sentStickerContainer : styles.receivedStickerContainer}>
            <Text style={styles.stickerEmojiText}>{item.sticker}</Text>
            <Text style={styles.stickerTimeText}>{item.time}</Text>
          </View>
        );
      case 'poll':
        return (
          <PollBubble
            poll={item}
            onVote={(optionId) => handleVote(item.id, optionId)}
            onViewAll={() => handleViewAllPoll(item)}
            onLongPress={() => handleLongPressMessage(item)}
          />
        );
      default:
        return (
          <MessageBubble
            text={item.text}
            time={item.time}
            isSent={item.isSent}
            isRead={item.isRead}
            reaction={item.reaction}
            replyTo={item.replyTo}
            onLongPress={() => handleLongPressMessage(item)}
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={['#FFF5F5', '#FFD9E0']}
        style={styles.gradientBackground}
      >
        {/* Scattered faint watermark hearts */}
        <View style={styles.watermarkContainer} pointerEvents="none">
          <Ionicons
            name="heart"
            size={48}
            color="#FFC9D4"
            style={[styles.heart, { top: 60, left: 10, transform: [{ rotate: '-15deg' }], opacity: 0.15 }]}
          />
          <Ionicons
            name="heart"
            size={24}
            color="#FFC9D4"
            style={[styles.heart, { top: 120, left: 8, transform: [{ rotate: '20deg' }], opacity: 0.1 }]}
          />
          <Ionicons
            name="heart"
            size={32}
            color="#FFC9D4"
            style={[styles.heart, { top: 80, left: 80, transform: [{ rotate: '-5deg' }], opacity: 0.12 }]}
          />
          <Ionicons
            name="heart"
            size={16}
            color="#FFC9D4"
            style={[styles.heart, { top: 180, left: 60, transform: [{ rotate: '45deg' }], opacity: 0.08 }]}
          />
        </View>

        {/* Custom Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color="#000000" />
            </TouchableOpacity>
            <Image source={{ uri: displayAvatar }} style={styles.avatar} />
            <View style={styles.headerMeta}>
              <Text style={styles.nameText} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.statusText}>Online</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerIcon}
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname: '/active-call',
                  params: {
                    contactName: displayName,
                    avatarUri: displayAvatar,
                    callType: 'video',
                    initialStatus: 'calling',
                  },
                })
              }
            >
              <Ionicons name="videocam-outline" size={24} color="#000000" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIcon}
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname: '/active-call',
                  params: {
                    contactName: displayName,
                    avatarUri: displayAvatar,
                    callType: 'voice',
                    initialStatus: 'calling',
                  },
                })
              }
            >
              <Ionicons name="call-outline" size={22} color="#000000" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIcon}
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname: '/call-info/1',
                  params: {
                    contactId: '1',
                    contactName: displayName,
                    avatarUri: displayAvatar,
                  },
                })
              }
            >
              <Ionicons name="information-circle-outline" size={24} color="#000000" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Message Thread */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => renderMessageItem(item)}
            ListHeaderComponent={
              <View style={styles.dateSeparatorContainer}>
                <View style={styles.dateSeparator}>
                  <Text style={styles.dateSeparatorText}>Today</Text>
                </View>
              </View>
            }
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
          />

          {/* AIAssistMenu Popover */}
          <AIAssistMenu
            visible={aiMenuVisible}
            onClose={() => setAiMenuVisible(false)}
          />

          {/* Recording indicator panel */}
          {isRecording && (
            <View style={styles.recordingOverlay}>
              <View style={styles.redDot} />
              <Text style={styles.recordingText}>Recording: {recordingTime}s</Text>
              <Text style={styles.recordingCancel}>Release to send</Text>
            </View>
          )}

          {/* WhatsApp-style Quoted Reply Preview Bar */}
          {replyingTo && (
            <ReplyPreviewBar
              replyingTo={replyingTo}
              displayName={displayName}
              onClose={() => setReplyingTo(null)}
            />
          )}

          {/* Bottom Chat Input Bar */}
          <View style={styles.inputArea}>
            <View style={styles.inputContainer}>
              <View style={styles.inputLeftColumn}>
                <TextInput
                  placeholder="Type your message..."
                  placeholderTextColor="#AEAEB2"
                  style={styles.textInput}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxHeight={100}
                />
                <View style={styles.iconRow}>
                  <TouchableOpacity style={styles.inputIcon} onPress={() => setAttachmentVisible(true)}>
                    <Ionicons name="add-circle-outline" size={22} color="#8E8E93" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.inputIcon}
                    onPressIn={startRecording}
                    onPressOut={stopRecording}
                  >
                    <Ionicons name="mic-outline" size={22} color="#8E8E93" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.inputIcon} onPress={handlePressSmileyInInput}>
                    <Ionicons name="happy-outline" size={22} color="#8E8E93" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.inputIcon} onPress={() => setStickerVisible(true)}>
                    <Ionicons name="copy-outline" size={20} color="#8E8E93" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.inputIcon} onPress={() => setAiMenuVisible(true)}>
                    <Ionicons name="sparkles" size={18} color="#8E8E93" />
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  { backgroundColor: inputText.trim() === '' ? '#F2F2F7' : '#1C1C1E' }
                ]}
                activeOpacity={0.8}
                onPress={handleSend}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={inputText.trim() === '' ? '#8E8E93' : '#FFFFFF'}
                />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>

        {/* Message Options Overlay Menu */}
        <MessageOptionsMenu
          visible={optionsVisible}
          onClose={() => {
            setOptionsVisible(false);
            setSelectedMessage(null);
          }}
          onSelectReaction={handleSelectReaction}
          onPressPlus={handlePressPlus}
          onSelectOption={handleSelectOption}
          message={selectedMessage}
        />
      </LinearGradient>

      {/* Full Emoji Picker Sheet */}
      <EmojiPickerSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelectEmoji={isReactionMode ? handleSelectReaction : handleTextEmojiSelect}
      />

      {/* Attachment Bottom Sheet picker */}
      <AttachmentSheet
        visible={attachmentVisible}
        onClose={() => setAttachmentVisible(false)}
        onSelectImage={handleSendImage}
        onOpenPoll={() => setCreatePollVisible(true)}
      />

      {/* Create Poll Modal */}
      <CreatePollModal
        visible={createPollVisible}
        onClose={() => setCreatePollVisible(false)}
        onCreatePoll={handleCreatePoll}
      />

      {/* Sticker Bottom Sheet grid */}
      <StickerPicker
        visible={stickerVisible}
        onClose={() => setStickerVisible(false)}
        onSelectSticker={handleSendSticker}
      />

      {/* Poll Results Modal */}
      <PollResultsModal
        visible={pollResultsVisible}
        onClose={() => {
          setPollResultsVisible(false);
          setSelectedPollForResults(null);
        }}
        poll={selectedPollForResults}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFF5F5',
  },
  gradientBackground: {
    flex: 1,
  },
  watermarkContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  heart: {
    position: 'absolute',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: STATUSBAR_HEIGHT + 6,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    zIndex: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 3,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    paddingRight: 8,
    marginLeft: -4,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E1E1E1',
  },
  headerMeta: {
    marginLeft: 12,
    justifyContent: 'center',
    flex: 1,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  statusText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    padding: 8,
    marginLeft: 8,
  },
  keyboardView: {
    flex: 1,
    zIndex: 1,
  },
  messageList: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  dateSeparatorContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparator: {
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  inputArea: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  inputLeftColumn: {
    flex: 1,
    marginRight: 12,
  },
  textInput: {
    fontSize: 15,
    color: '#000000',
    minHeight: 24,
    padding: 0, // clears standard android padding
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#E5E5EA',
    paddingTop: 8,
  },
  inputIcon: {
    padding: 4,
    marginRight: 16,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E5EA', // Very light grey / off-white matching reference image
    justifyContent: 'center',
    alignItems: 'center',
  },
  sentStickerContainer: {
    alignSelf: 'flex-end',
    marginBottom: 10,
    marginRight: 16,
    alignItems: 'flex-end',
  },
  receivedStickerContainer: {
    alignSelf: 'flex-start',
    marginBottom: 10,
    marginLeft: 16,
    alignItems: 'flex-start',
  },
  stickerEmojiText: {
    fontSize: 72,
  },
  stickerTimeText: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 2,
  },
  recordingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginRight: 8,
  },
  recordingText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  recordingCancel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
});
