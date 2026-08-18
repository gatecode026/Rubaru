import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  ScrollView,
  Switch,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const switchTrackColor = { false: '#E5E7EB', true: isDarkMode ? '#000000' : '#F44649' };

  // Section Expansion States (Default closed when opening page)
  const [isPushExpanded, setIsPushExpanded] = useState(false);
  const [isPostsStoriesExpanded, setIsPostsStoriesExpanded] = useState(false);
  const [isFollowingExpanded, setIsFollowingExpanded] = useState(false);
  const [isMessagesExpanded, setIsMessagesExpanded] = useState(false);
  const [isCallsExpanded, setIsCallsExpanded] = useState(false);
  const [isReelsExpanded, setIsReelsExpanded] = useState(false);
  const [isBirthdaysExpanded, setIsBirthdaysExpanded] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isEmailExpanded, setIsEmailExpanded] = useState(false);

  // 1. Push Notifications Toggle States
  const [pauseAll, setPauseAll] = useState(false);
  const [sleepMode, setSleepMode] = useState(false);
  const [messagesOnly, setMessagesOnly] = useState(false);

  // 2. Posts, Stories States
  const [likesOption, setLikesOption] = useState('everyone'); // 'off' | 'profiles' | 'everyone'
  const [milestones, setMilestones] = useState(true);
  const [photosOption, setPhotosOption] = useState('everyone'); // 'off' | 'profiles' | 'everyone'
  const [suggestedForYou, setSuggestedForYou] = useState(true);

  // 3. Following and Followers States
  const [followersReq, setFollowersReq] = useState(true);
  const [acceptedReq, setAcceptedReq] = useState(true);
  const [accountSugg, setAccountSugg] = useState(true);
  const [mentionsOption, setMentionsOption] = useState('everyone'); // 'off' | 'profiles' | 'everyone'

  // 4. Messages States
  const [msgReq, setMsgReq] = useState(true);
  const [indGroupChats, setIndGroupChats] = useState(true);
  const [remindersOption, setRemindersOption] = useState('everyone'); // 'off' | 'profiles' | 'everyone'
  const [groupReq, setGroupReq] = useState(true);

  // 5. Calls States
  const [callsOption, setCallsOption] = useState('everyone'); // 'off' | 'profiles' | 'everyone'
  const [videoOption, setVideoOption] = useState('everyone'); // 'off' | 'profiles' | 'everyone'

  // 6. Reels States (Single clean toggles)
  const [origAudio, setOrigAudio] = useState(true);
  const [remixes, setRemixes] = useState(true);
  const [liveVideos, setLiveVideos] = useState(true);
  const [recentReels, setRecentReels] = useState(true);
  const [mostWatchedReels, setMostWatchedReels] = useState(true);
  const [addYours, setAddYours] = useState(true);
  const [reelsForYou, setReelsForYou] = useState(true);

  // 7. Birthdays State
  const [birthdays, setBirthdays] = useState(true);

  // 8. Map States
  const [locSharing, setLocSharing] = useState(true);
  const [locReminder, setLocReminder] = useState(true);
  const [locLikes, setLocLikes] = useState(true);

  // 9. Email Notifications States
  const [feedbackEmail, setFeedbackEmail] = useState(true);
  const [reminderEmail, setReminderEmail] = useState(true);
  const [productEmail, setProductEmail] = useState(true);
  const [newsEmail, setNewsEmail] = useState(true);
  const [supportEmail, setSupportEmail] = useState(true);

  return (
    <View style={styles.rootContainer}>
      {/* Full-Screen Blush Hearts Background Image */}
      <ImageBackground
        source={require('@assets/images/app_background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={[styles.mainWrapper, { paddingTop: Math.max(insets.top + 16, 44), paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
          
          {/* Top Header Row with Back Button */}
          <View style={styles.topHeaderRow}>
            <Pressable
              onPress={() => router.push('/user-profile?openSettings=true')}
              style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
              hitSlop={12}
              accessibilityLabel="Go back to profile settings"
            >
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {/* Section 1: Push Notifications */}
            <Pressable
              onPress={() => setIsPushExpanded(!isPushExpanded)}
              style={({ pressed }) => [
                styles.sectionHeaderRow,
                styles.dropdownHeaderRow,
                pressed && styles.buttonPressed,
              ]}
              hitSlop={8}
            >
              <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="notifications-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>Push Notifications</Text>
              </View>
            </Pressable>

            {/* Push Notifications Expanded Content */}
            {isPushExpanded && (
              <View style={styles.dropdownBodyWrapper}>
                <View style={styles.subItemRow}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="pause-circle-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Pause All</Text>
                  </View>
                  <Switch
                    value={pauseAll}
                    onValueChange={setPauseAll}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={[styles.subItemRow, { marginTop: 6 }]}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="moon-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Sleep Mode</Text>
                  </View>
                  <Switch
                    value={sleepMode}
                    onValueChange={setSleepMode}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={[styles.subItemRow, { marginTop: 6 }]}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="chatbubble-ellipses-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Messages Only</Text>
                  </View>
                  <Switch
                    value={messagesOnly}
                    onValueChange={setMessagesOnly}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
            )}

            {/* Section 2: Posts, Stories */}
            <Pressable
              onPress={() => setIsPostsStoriesExpanded(!isPostsStoriesExpanded)}
              style={({ pressed }) => [
                styles.sectionHeaderRow,
                styles.dropdownHeaderRow,
                pressed && styles.buttonPressed,
              ]}
              hitSlop={8}
            >
              <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="images-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>Posts, Stories</Text>
              </View>
            </Pressable>

            {/* Posts, Stories Expanded Content */}
            {isPostsStoriesExpanded && (
              <View style={styles.dropdownBodyWrapper}>
                
                {/* Likes Multi-Option */}
                <View style={styles.groupHeaderRow}>
                  <Ionicons name="heart-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Likes</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={likesOption === 'off'}
                    onValueChange={(val) => setLikesOption(val ? 'off' : 'everyone')}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Profiles I Follow</Text>
                  </View>
                  <Switch
                    value={likesOption === 'profiles'}
                    onValueChange={(val) => setLikesOption(val ? 'profiles' : 'off')}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Everyone</Text>
                  </View>
                  <Switch
                    value={likesOption === 'everyone'}
                    onValueChange={(val) => setLikesOption(val ? 'everyone' : 'off')}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Milestones Single Toggle */}
                <View style={[styles.subItemRow, { marginTop: 6 }]}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="trophy-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Milestones</Text>
                  </View>
                  <Switch
                    value={milestones}
                    onValueChange={setMilestones}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Photos of You Multi-Option */}
                <View style={[styles.groupHeaderRow, { marginTop: 10 }]}>
                  <Ionicons name="person-circle-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Photos of You</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={photosOption === 'off'}
                    onValueChange={(val) => setPhotosOption(val ? 'off' : 'everyone')}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Profiles I Follow</Text>
                  </View>
                  <Switch
                    value={photosOption === 'profiles'}
                    onValueChange={(val) => setPhotosOption(val ? 'profiles' : 'off')}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Everyone</Text>
                  </View>
                  <Switch
                    value={photosOption === 'everyone'}
                    onValueChange={(val) => setPhotosOption(val ? 'everyone' : 'off')}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Suggested for You Single Toggle */}
                <View style={[styles.subItemRow, { marginTop: 6 }]}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="sparkles-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Suggested for You</Text>
                  </View>
                  <Switch
                    value={suggestedForYou}
                    onValueChange={setSuggestedForYou}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

              </View>
            )}

            {/* Section 3: Following and Followers */}
            <Pressable
              onPress={() => setIsFollowingExpanded(!isFollowingExpanded)}
              style={({ pressed }) => [
                styles.sectionHeaderRow,
                styles.dropdownHeaderRow,
                pressed && styles.buttonPressed,
              ]}
              hitSlop={8}
            >
              <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="people-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>Following and Followers</Text>
              </View>
            </Pressable>

            {/* Following and Followers Expanded Content */}
            {isFollowingExpanded && (
              <View style={styles.dropdownBodyWrapper}>
                
                {/* 1. Follow Requests Single Toggle */}
                <View style={styles.subItemRow}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="person-add-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Follow Requests</Text>
                  </View>
                  <Switch
                    value={followersReq}
                    onValueChange={setFollowersReq}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 2. Accepted Follow Requests Single Toggle */}
                <View style={[styles.subItemRow, { marginTop: 6 }]}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Accepted Follow Requests</Text>
                  </View>
                  <Switch
                    value={acceptedReq}
                    onValueChange={setAcceptedReq}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 3. Account Suggestions Single Toggle */}
                <View style={[styles.subItemRow, { marginTop: 6 }]}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="people-circle-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Account Suggestions</Text>
                  </View>
                  <Switch
                    value={accountSugg}
                    onValueChange={setAccountSugg}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 4. Mentions Multi-Option */}
                <View style={[styles.groupHeaderRow, { marginTop: 10 }]}>
                  <Ionicons name="at-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Mentions</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={mentionsOption === 'off'}
                    onValueChange={(val) => setMentionsOption(val ? 'off' : 'everyone')}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Profiles I Follow</Text>
                  </View>
                  <Switch
                    value={mentionsOption === 'profiles'}
                    onValueChange={(val) => setMentionsOption(val ? 'profiles' : 'off')}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Everyone</Text>
                  </View>
                  <Switch
                    value={mentionsOption === 'everyone'}
                    onValueChange={(val) => setMentionsOption(val ? 'everyone' : 'off')}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

              </View>
            )}

            {/* Section 4: Messages */}
            <Pressable
              onPress={() => setIsMessagesExpanded(!isMessagesExpanded)}
              style={({ pressed }) => [
                styles.sectionHeaderRow,
                styles.dropdownHeaderRow,
                pressed && styles.buttonPressed,
              ]}
              hitSlop={8}
            >
              <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="chatbubbles-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>Messages</Text>
              </View>
            </Pressable>

            {/* Messages Expanded Content */}
            {isMessagesExpanded && (
              <View style={styles.dropdownBodyWrapper}>
                
                {/* 1. Message Requests Single Toggle */}
                <View style={styles.subItemRow}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="mail-unread-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Message Requests</Text>
                  </View>
                  <Switch
                    value={msgReq}
                    onValueChange={setMsgReq}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 2. Individual and Group Chats Single Toggle */}
                <View style={[styles.subItemRow, { marginTop: 6 }]}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="chatbox-ellipses-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Individual and Group Chats</Text>
                  </View>
                  <Switch
                    value={indGroupChats}
                    onValueChange={setIndGroupChats}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 3. Reminders Multi-Option */}
                <View style={[styles.groupHeaderRow, { marginTop: 10 }]}>
                  <Ionicons name="alarm-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Reminders</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={remindersOption === 'off'}
                    onValueChange={(val) => setRemindersOption(val ? 'off' : 'everyone')}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Profiles I Follow</Text>
                  </View>
                  <Switch
                    value={remindersOption === 'profiles'}
                    onValueChange={(val) => setRemindersOption(val ? 'profiles' : 'off')}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Everyone</Text>
                  </View>
                  <Switch
                    value={remindersOption === 'everyone'}
                    onValueChange={(val) => setRemindersOption(val ? 'everyone' : 'off')}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 4. Group Requests Single Toggle */}
                <View style={[styles.subItemRow, { marginTop: 6 }]}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="duplicate-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Group Requests</Text>
                  </View>
                  <Switch
                    value={groupReq}
                    onValueChange={setGroupReq}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

              </View>
            )}

            {/* Section 5: Calls */}
            <Pressable
              onPress={() => setIsCallsExpanded(!isCallsExpanded)}
              style={({ pressed }) => [
                styles.sectionHeaderRow,
                styles.dropdownHeaderRow,
                pressed && styles.buttonPressed,
              ]}
              hitSlop={8}
            >
              <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="call-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>Calls</Text>
              </View>
            </Pressable>

            {/* Calls Expanded Content */}
            {isCallsExpanded && (
              <View style={styles.dropdownBodyWrapper}>
                
                {/* 1. Voice Calls Multi-Option */}
                <View style={styles.groupHeaderRow}>
                  <Ionicons name="call-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Voice Calls</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={callsOption === 'off'}
                    onValueChange={(val) => setCallsOption(val ? 'off' : 'everyone')}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Profiles I Follow</Text>
                  </View>
                  <Switch
                    value={callsOption === 'profiles'}
                    onValueChange={(val) => setCallsOption(val ? 'profiles' : 'off')}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Everyone</Text>
                  </View>
                  <Switch
                    value={callsOption === 'everyone'}
                    onValueChange={(val) => setCallsOption(val ? 'everyone' : 'off')}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 2. Video Chats Multi-Option */}
                <View style={[styles.groupHeaderRow, { marginTop: 10 }]}>
                  <Ionicons name="videocam-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Video Chats</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={videoOption === 'off'}
                    onValueChange={(val) => setVideoOption(val ? 'off' : 'everyone')}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Profiles I Follow</Text>
                  </View>
                  <Switch
                    value={videoOption === 'profiles'}
                    onValueChange={(val) => setVideoOption(val ? 'profiles' : 'off')}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Everyone</Text>
                  </View>
                  <Switch
                    value={videoOption === 'everyone'}
                    onValueChange={(val) => setVideoOption(val ? 'everyone' : 'off')}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

              </View>
            )}

            {/* Section 6: Reels */}
            <Pressable
              onPress={() => setIsReelsExpanded(!isReelsExpanded)}
              style={({ pressed }) => [
                styles.sectionHeaderRow,
                styles.dropdownHeaderRow,
                pressed && styles.buttonPressed,
              ]}
              hitSlop={8}
            >
              <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="film-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>Reels</Text>
              </View>
            </Pressable>

            {/* Reels Expanded Content - Clean Single Toggle Per Item */}
            {isReelsExpanded && (
              <View style={styles.dropdownBodyWrapper}>
                
                {/* 1. Original Audio */}
                <View style={styles.subItemRow}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="musical-notes-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Original Audio</Text>
                  </View>
                  <Switch
                    value={origAudio}
                    onValueChange={setOrigAudio}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 2. Remixes */}
                <View style={[styles.subItemRow, { marginTop: 6 }]}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="color-wand-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Remixes</Text>
                  </View>
                  <Switch
                    value={remixes}
                    onValueChange={setRemixes}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 3. Live Videos */}
                <View style={[styles.subItemRow, { marginTop: 6 }]}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="radio-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Live Videos</Text>
                  </View>
                  <Switch
                    value={liveVideos}
                    onValueChange={setLiveVideos}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 4. Recently Uploaded Reels */}
                <View style={[styles.subItemRow, { marginTop: 6 }]}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="time-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Recently Uploaded Reels</Text>
                  </View>
                  <Switch
                    value={recentReels}
                    onValueChange={setRecentReels}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 5. Most Watched Reels */}
                <View style={[styles.subItemRow, { marginTop: 6 }]}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="trending-up-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Most Watched Reels</Text>
                  </View>
                  <Switch
                    value={mostWatchedReels}
                    onValueChange={setMostWatchedReels}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 6. Add Yours */}
                <View style={[styles.subItemRow, { marginTop: 6 }]}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="add-circle-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Add Yours</Text>
                  </View>
                  <Switch
                    value={addYours}
                    onValueChange={setAddYours}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 7. Reels For You */}
                <View style={[styles.subItemRow, { marginTop: 6 }]}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="heart-circle-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Reels For You</Text>
                  </View>
                  <Switch
                    value={reelsForYou}
                    onValueChange={setReelsForYou}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

              </View>
            )}

            {/* Section 7: Birthdays */}
            <Pressable
              onPress={() => setIsBirthdaysExpanded(!isBirthdaysExpanded)}
              style={({ pressed }) => [
                styles.sectionHeaderRow,
                styles.dropdownHeaderRow,
                pressed && styles.buttonPressed,
              ]}
              hitSlop={8}
            >
              <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="gift-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>Birthdays</Text>
              </View>
            </Pressable>

            {/* Birthdays Expanded Content - Single Clean Toggle */}
            {isBirthdaysExpanded && (
              <View style={styles.dropdownBodyWrapper}>
                <View style={styles.subItemRow}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="gift-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Birthdays Notifications</Text>
                  </View>
                  <Switch
                    value={birthdays}
                    onValueChange={setBirthdays}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
            )}

            {/* Section 8: Map */}
            <Pressable
              onPress={() => setIsMapExpanded(!isMapExpanded)}
              style={({ pressed }) => [
                styles.sectionHeaderRow,
                styles.dropdownHeaderRow,
                pressed && styles.buttonPressed,
              ]}
              hitSlop={8}
            >
              <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="map-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>Map</Text>
              </View>
            </Pressable>

            {/* Map Expanded Content - Single Clean Toggles */}
            {isMapExpanded && (
              <View style={styles.dropdownBodyWrapper}>
                
                {/* 1. Location Sharing */}
                <View style={styles.subItemRow}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="location-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Location Sharing</Text>
                  </View>
                  <Switch
                    value={locSharing}
                    onValueChange={setLocSharing}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 2. Location-Based Reminders */}
                <View style={[styles.subItemRow, { marginTop: 6 }]}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="navigate-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Location-Based Reminders</Text>
                  </View>
                  <Switch
                    value={locReminder}
                    onValueChange={setLocReminder}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 3. Location Likes & Activity */}
                <View style={[styles.subItemRow, { marginTop: 6 }]}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="trail-sign-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Location Likes & Activity</Text>
                  </View>
                  <Switch
                    value={locLikes}
                    onValueChange={setLocLikes}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

              </View>
            )}

            {/* Section 9: Email Notifications */}
            <Pressable
              onPress={() => setIsEmailExpanded(!isEmailExpanded)}
              style={({ pressed }) => [
                styles.sectionHeaderRow,
                styles.dropdownHeaderRow,
                pressed && styles.buttonPressed,
              ]}
              hitSlop={8}
            >
              <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="mail-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>Email Notifications</Text>
              </View>
            </Pressable>

            {/* Email Notifications Expanded Content - Single Clean Toggles */}
            {isEmailExpanded && (
              <View style={styles.dropdownBodyWrapper}>
                
                {/* 1. Feedback Emails */}
                <View style={styles.subItemRow}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="chatbubble-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Feedback Emails</Text>
                  </View>
                  <Switch
                    value={feedbackEmail}
                    onValueChange={setFeedbackEmail}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 2. Reminder Emails */}
                <View style={[styles.subItemRow, { marginTop: 6 }]}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="timer-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Reminder Emails</Text>
                  </View>
                  <Switch
                    value={reminderEmail}
                    onValueChange={setReminderEmail}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 3. Product Emails */}
                <View style={[styles.subItemRow, { marginTop: 6 }]}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="cube-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Product Emails</Text>
                  </View>
                  <Switch
                    value={productEmail}
                    onValueChange={setProductEmail}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 4. News Emails */}
                <View style={[styles.subItemRow, { marginTop: 6 }]}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="newspaper-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>News Emails</Text>
                  </View>
                  <Switch
                    value={newsEmail}
                    onValueChange={setNewsEmail}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 5. Support Emails */}
                <View style={[styles.subItemRow, { marginTop: 6 }]}>
                  <View style={styles.groupHeaderRow}>
                    <Ionicons name="help-buoy-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.groupHeaderTitle}>Support Emails</Text>
                  </View>
                  <Switch
                    value={supportEmail}
                    onValueChange={setSupportEmail}
                    trackColor={switchTrackColor}
                    thumbColor="#FFFFFF"
                  />
                </View>

              </View>
            )}

          </ScrollView>

        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#FFF0F3',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mainWrapper: {
    flex: 1,
    paddingHorizontal: 24,
  },
  topHeaderRow: {
    width: '100%',
    height: 44,
    justifyContent: 'center',
    marginBottom: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.8)',
  },
  grabHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#9CA3AF',
    alignSelf: 'center',
    marginBottom: 24,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginVertical: 4,
    width: '100%',
  },
  dropdownHeaderRow: {
    justifyContent: 'space-between',
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  dropdownBodyWrapper: {
    paddingLeft: 8,
    marginBottom: 4,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  groupHeaderTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  subItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingLeft: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#4B5563',
    marginRight: 12,
  },
  subItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});
