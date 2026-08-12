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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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

  // 2. Posts, Stories Sub-Option Switch States
  const [likesOff, setLikesOff] = useState(false);
  const [likesProfiles, setLikesProfiles] = useState(false);
  const [likesEveryone, setLikesEveryone] = useState(true);

  const [milestonesOff, setMilestonesOff] = useState(false);
  const [milestonesOn, setMilestonesOn] = useState(true);

  const [photosOff, setPhotosOff] = useState(false);
  const [photosProfiles, setPhotosProfiles] = useState(false);
  const [photosEveryone, setPhotosEveryone] = useState(true);

  const [suggestedOff, setSuggestedOff] = useState(false);
  const [suggestedOn, setSuggestedOn] = useState(true);

  // 3. Following and Followers Sub-Option Switch States
  const [followersReqOff, setFollowersReqOff] = useState(false);
  const [followersReqOn, setFollowersReqOn] = useState(true);

  const [acceptedReqOff, setAcceptedReqOff] = useState(false);
  const [acceptedReqOn, setAcceptedReqOn] = useState(true);

  const [accountSuggOff, setAccountSuggOff] = useState(false);
  const [accountSuggOn, setAccountSuggOn] = useState(true);

  const [mentionsOff, setMentionsOff] = useState(false);
  const [mentionsProfiles, setMentionsProfiles] = useState(false);
  const [mentionsEveryone, setMentionsEveryone] = useState(true);

  // 4. Messages Sub-Option Switch States
  const [msgReqOff, setMsgReqOff] = useState(false);
  const [msgReqOn, setMsgReqOn] = useState(true);

  const [indGroupOff, setIndGroupOff] = useState(false);
  const [indGroupOn, setIndGroupOn] = useState(true);

  const [remindersOff, setRemindersOff] = useState(false);
  const [remindersProfiles, setRemindersProfiles] = useState(false);
  const [remindersEveryone, setRemindersEveryone] = useState(true);

  const [groupReqOff, setGroupReqOff] = useState(false);
  const [groupReqOn, setGroupReqOn] = useState(true);

  // 5. Calls Sub-Option Switch States
  const [callOff, setCallOff] = useState(false);
  const [callProfiles, setCallProfiles] = useState(false);
  const [callEveryone, setCallEveryone] = useState(true);

  const [videoOff, setVideoOff] = useState(false);
  const [videoProfiles, setVideoProfiles] = useState(false);
  const [videoEveryone, setVideoEveryone] = useState(true);

  // 6. Reels Sub-Option Switch States
  const [origAudioOff, setOrigAudioOff] = useState(false);
  const [origAudioOn, setOrigAudioOn] = useState(true);

  const [remixesOff, setRemixesOff] = useState(false);
  const [remixesOn, setRemixesOn] = useState(true);

  const [liveOff, setLiveOff] = useState(false);
  const [liveOn, setLiveOn] = useState(true);

  const [recentReelsOff, setRecentReelsOff] = useState(false);
  const [recentReelsOn, setRecentReelsOn] = useState(true);

  const [mostWatchedOff, setMostWatchedOff] = useState(false);
  const [mostWatchedOn, setMostWatchedOn] = useState(true);

  const [addYoursOff, setAddYoursOff] = useState(false);
  const [addYoursOn, setAddYoursOn] = useState(true);

  const [reelsForYouOff, setReelsForYouOff] = useState(false);
  const [reelsForYouOn, setReelsForYouOn] = useState(true);

  // 7. Birthdays Sub-Option Switch States
  const [birthdaysOff, setBirthdaysOff] = useState(false);
  const [birthdaysOn, setBirthdaysOn] = useState(true);

  // 8. Map Sub-Option Switch States
  const [locSharingOff, setLocSharingOff] = useState(false);
  const [locSharingOn, setLocSharingOn] = useState(true);

  const [locReminderOff, setLocReminderOff] = useState(false);
  const [locReminderOn, setLocReminderOn] = useState(true);

  const [locLikesOff, setLocLikesOff] = useState(false);
  const [locLikesOn, setLocLikesOn] = useState(true);

  // 9. Email Notifications Sub-Option Switch States
  const [feedbackEmailOff, setFeedbackEmailOff] = useState(false);
  const [feedbackEmailOn, setFeedbackEmailOn] = useState(true);

  const [reminderEmailOff, setReminderEmailOff] = useState(false);
  const [reminderEmailOn, setReminderEmailOn] = useState(true);

  const [productEmailOff, setProductEmailOff] = useState(false);
  const [productEmailOn, setProductEmailOn] = useState(true);

  const [newsEmailOff, setNewsEmailOff] = useState(false);
  const [newsEmailOn, setNewsEmailOn] = useState(true);

  const [supportEmailOff, setSupportEmailOff] = useState(false);
  const [supportEmailOn, setSupportEmailOn] = useState(true);

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

          {/* Top Grab Handle Bar */}
          <View style={styles.grabHandle} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {/* Section 1: Push Notifications (Expandable Dropdown Header) */}
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
                <Ionicons name="settings-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>Push Notifications</Text>
              </View>

              <Ionicons
                name={isPushExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#6B7280"
              />
            </Pressable>

            {/* Push Notifications Expanded Content */}
            {isPushExpanded && (
              <View style={styles.dropdownBodyWrapper}>
                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Pause All</Text>
                  </View>
                  <Switch
                    value={pauseAll}
                    onValueChange={setPauseAll}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Sleep Mode</Text>
                  </View>
                  <Switch
                    value={sleepMode}
                    onValueChange={setSleepMode}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Messages Only</Text>
                  </View>
                  <Switch
                    value={messagesOnly}
                    onValueChange={setMessagesOnly}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
            )}

            {/* Section 2: Posts, Stories (Expandable Dropdown Header) */}
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
                <Ionicons name="settings-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>Posts, Stories</Text>
              </View>

              <Ionicons
                name={isPostsStoriesExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#6B7280"
              />
            </Pressable>

            {/* Posts, Stories Expanded Content */}
            {isPostsStoriesExpanded && (
              <View style={styles.dropdownBodyWrapper}>
                
                {/* Likes Sub-Group */}
                <View style={styles.groupHeaderRow}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Likes</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={likesOff}
                    onValueChange={(val) => {
                      setLikesOff(val);
                      if (val) { setLikesProfiles(false); setLikesEveryone(false); }
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Profiles I follow</Text>
                  </View>
                  <Switch
                    value={likesProfiles}
                    onValueChange={(val) => {
                      setLikesProfiles(val);
                      if (val) { setLikesOff(false); setLikesEveryone(false); }
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Everyone</Text>
                  </View>
                  <Switch
                    value={likesEveryone}
                    onValueChange={(val) => {
                      setLikesEveryone(val);
                      if (val) { setLikesOff(false); setLikesProfiles(false); }
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Like Milestones Sub-Group */}
                <View style={[styles.groupHeaderRow, { marginTop: 6 }]}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Like Milestones</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={milestonesOff}
                    onValueChange={(val) => {
                      setMilestonesOff(val);
                      if (val) setMilestonesOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={milestonesOn}
                    onValueChange={(val) => {
                      setMilestonesOn(val);
                      if (val) setMilestonesOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Photos of you Sub-Group */}
                <View style={[styles.groupHeaderRow, { marginTop: 6 }]}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Photos of you</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={photosOff}
                    onValueChange={(val) => {
                      setPhotosOff(val);
                      if (val) { setPhotosProfiles(false); setPhotosEveryone(false); }
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Profiles I Follow</Text>
                  </View>
                  <Switch
                    value={photosProfiles}
                    onValueChange={(val) => {
                      setPhotosProfiles(val);
                      if (val) { setPhotosOff(false); setPhotosEveryone(false); }
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Everyone</Text>
                  </View>
                  <Switch
                    value={photosEveryone}
                    onValueChange={(val) => {
                      setPhotosEveryone(val);
                      if (val) { setPhotosOff(false); setPhotosProfiles(false); }
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Posts Suggested for you Sub-Group */}
                <View style={[styles.groupHeaderRow, { marginTop: 6 }]}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Posts Suggested for you</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={suggestedOff}
                    onValueChange={(val) => {
                      setSuggestedOff(val);
                      if (val) setSuggestedOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={suggestedOn}
                    onValueChange={(val) => {
                      setSuggestedOn(val);
                      if (val) setSuggestedOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

              </View>
            )}

            {/* Section 3: Following and Followers (Expandable Dropdown Header) */}
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
                <Ionicons name="settings-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>Following and Followers</Text>
              </View>

              <Ionicons
                name={isFollowingExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#6B7280"
              />
            </Pressable>

            {/* Following and Followers Expanded Content */}
            {isFollowingExpanded && (
              <View style={styles.dropdownBodyWrapper}>
                
                {/* Followers Requests Sub-Group */}
                <View style={styles.groupHeaderRow}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Followers Requests</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={followersReqOff}
                    onValueChange={(val) => {
                      setFollowersReqOff(val);
                      if (val) setFollowersReqOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={followersReqOn}
                    onValueChange={(val) => {
                      setFollowersReqOn(val);
                      if (val) setFollowersReqOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Accepted Follow Requests Sub-Group */}
                <View style={[styles.groupHeaderRow, { marginTop: 6 }]}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Accepted Follow Requests</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={acceptedReqOff}
                    onValueChange={(val) => {
                      setAcceptedReqOff(val);
                      if (val) setAcceptedReqOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={acceptedReqOn}
                    onValueChange={(val) => {
                      setAcceptedReqOn(val);
                      if (val) setAcceptedReqOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Account Suggestions Sub-Group */}
                <View style={[styles.groupHeaderRow, { marginTop: 6 }]}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Account Suggestions</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={accountSuggOff}
                    onValueChange={(val) => {
                      setAccountSuggOff(val);
                      if (val) setAccountSuggOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={accountSuggOn}
                    onValueChange={(val) => {
                      setAccountSuggOn(val);
                      if (val) setAccountSuggOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Mentions in Bio Sub-Group */}
                <View style={[styles.groupHeaderRow, { marginTop: 6 }]}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Mentions in Bio</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={mentionsOff}
                    onValueChange={(val) => {
                      setMentionsOff(val);
                      if (val) { setMentionsProfiles(false); setMentionsEveryone(false); }
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Profiles I Follow</Text>
                  </View>
                  <Switch
                    value={mentionsProfiles}
                    onValueChange={(val) => {
                      setMentionsProfiles(val);
                      if (val) { setMentionsOff(false); setMentionsEveryone(false); }
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Everyone</Text>
                  </View>
                  <Switch
                    value={mentionsEveryone}
                    onValueChange={(val) => {
                      setMentionsEveryone(val);
                      if (val) { setMentionsOff(false); setMentionsProfiles(false); }
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

              </View>
            )}

            {/* Section 4: Messages (Expandable Dropdown Header) */}
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
                <Ionicons name="settings-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>Messages</Text>
              </View>

              <Ionicons
                name={isMessagesExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#6B7280"
              />
            </Pressable>

            {/* Messages Expanded Content */}
            {isMessagesExpanded && (
              <View style={styles.dropdownBodyWrapper}>
                
                {/* Message Requests Sub-Group */}
                <View style={styles.groupHeaderRow}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Message Requests</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={msgReqOff}
                    onValueChange={(val) => {
                      setMsgReqOff(val);
                      if (val) setMsgReqOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={msgReqOn}
                    onValueChange={(val) => {
                      setMsgReqOn(val);
                      if (val) setMsgReqOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Messages from Individual and Group Chats Sub-Group */}
                <View style={[styles.groupHeaderRow, { marginTop: 6 }]}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Messages from Individual and Group Chats</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={indGroupOff}
                    onValueChange={(val) => {
                      setIndGroupOff(val);
                      if (val) setIndGroupOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={indGroupOn}
                    onValueChange={(val) => {
                      setIndGroupOn(val);
                      if (val) setIndGroupOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Message Reminders Sub-Group */}
                <View style={[styles.groupHeaderRow, { marginTop: 6 }]}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Message Reminders</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={remindersOff}
                    onValueChange={(val) => {
                      setRemindersOff(val);
                      if (val) { setRemindersProfiles(false); setRemindersEveryone(false); }
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Profiles I Follow</Text>
                  </View>
                  <Switch
                    value={remindersProfiles}
                    onValueChange={(val) => {
                      setRemindersProfiles(val);
                      if (val) { setRemindersOff(false); setRemindersEveryone(false); }
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Everyone</Text>
                  </View>
                  <Switch
                    value={remindersEveryone}
                    onValueChange={(val) => {
                      setRemindersEveryone(val);
                      if (val) { setRemindersOff(false); setRemindersProfiles(false); }
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Group Requests Sub-Group */}
                <View style={[styles.groupHeaderRow, { marginTop: 6 }]}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Group Requests</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={groupReqOff}
                    onValueChange={(val) => {
                      setGroupReqOff(val);
                      if (val) setGroupReqOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={groupReqOn}
                    onValueChange={(val) => {
                      setGroupReqOn(val);
                      if (val) setGroupReqOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

              </View>
            )}

            {/* Section 5: Calls (Expandable Dropdown Header) */}
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
                <Ionicons name="settings-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>Calls</Text>
              </View>

              <Ionicons
                name={isCallsExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#6B7280"
              />
            </Pressable>

            {/* Calls Expanded Content */}
            {isCallsExpanded && (
              <View style={styles.dropdownBodyWrapper}>
                
                {/* Call Sub-Group */}
                <View style={styles.groupHeaderRow}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Call</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={callOff}
                    onValueChange={(val) => {
                      setCallOff(val);
                      if (val) { setCallProfiles(false); setCallEveryone(false); }
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Profiles I Follow</Text>
                  </View>
                  <Switch
                    value={callProfiles}
                    onValueChange={(val) => {
                      setCallProfiles(val);
                      if (val) { setCallOff(false); setCallEveryone(false); }
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Everyone</Text>
                  </View>
                  <Switch
                    value={callEveryone}
                    onValueChange={(val) => {
                      setCallEveryone(val);
                      if (val) { setCallOff(false); setCallProfiles(false); }
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Video Chats Sub-Group */}
                <View style={[styles.groupHeaderRow, { marginTop: 6 }]}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Video Chats</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={videoOff}
                    onValueChange={(val) => {
                      setVideoOff(val);
                      if (val) { setVideoProfiles(false); setVideoEveryone(false); }
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Profiles I Follow</Text>
                  </View>
                  <Switch
                    value={videoProfiles}
                    onValueChange={(val) => {
                      setVideoProfiles(val);
                      if (val) { setVideoOff(false); setVideoEveryone(false); }
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>From Everyone</Text>
                  </View>
                  <Switch
                    value={videoEveryone}
                    onValueChange={(val) => {
                      setVideoEveryone(val);
                      if (val) { setVideoOff(false); setVideoProfiles(false); }
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

              </View>
            )}

            {/* Section 6: Reels (Expandable Dropdown Header) */}
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
                <Ionicons name="settings-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>Reels</Text>
              </View>

              <Ionicons
                name={isReelsExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#6B7280"
              />
            </Pressable>

            {/* Reels Expanded Content */}
            {isReelsExpanded && (
              <View style={styles.dropdownBodyWrapper}>
                
                {/* 1. Original Audio */}
                <View style={styles.groupHeaderRow}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Original Audio</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={origAudioOff}
                    onValueChange={(val) => {
                      setOrigAudioOff(val);
                      if (val) setOrigAudioOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={origAudioOn}
                    onValueChange={(val) => {
                      setOrigAudioOn(val);
                      if (val) setOrigAudioOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 2. Remixes */}
                <View style={[styles.groupHeaderRow, { marginTop: 6 }]}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Remixes</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={remixesOff}
                    onValueChange={(val) => {
                      setRemixesOff(val);
                      if (val) setRemixesOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={remixesOn}
                    onValueChange={(val) => {
                      setRemixesOn(val);
                      if (val) setRemixesOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 3. Live Videos */}
                <View style={[styles.groupHeaderRow, { marginTop: 6 }]}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Live Videos</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={liveOff}
                    onValueChange={(val) => {
                      setLiveOff(val);
                      if (val) setLiveOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={liveOn}
                    onValueChange={(val) => {
                      setLiveOn(val);
                      if (val) setLiveOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 4. Recently Uploaded Reels */}
                <View style={[styles.groupHeaderRow, { marginTop: 6 }]}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Recently Uploaded Reels</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={recentReelsOff}
                    onValueChange={(val) => {
                      setRecentReelsOff(val);
                      if (val) setRecentReelsOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={recentReelsOn}
                    onValueChange={(val) => {
                      setRecentReelsOn(val);
                      if (val) setRecentReelsOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 5. Most Watched Reels */}
                <View style={[styles.groupHeaderRow, { marginTop: 6 }]}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Most Watched Reels</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={mostWatchedOff}
                    onValueChange={(val) => {
                      setMostWatchedOff(val);
                      if (val) setMostWatchedOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={mostWatchedOn}
                    onValueChange={(val) => {
                      setMostWatchedOn(val);
                      if (val) setMostWatchedOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 6. Add Yours */}
                <View style={[styles.groupHeaderRow, { marginTop: 6 }]}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Add Yours</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={addYoursOff}
                    onValueChange={(val) => {
                      setAddYoursOff(val);
                      if (val) setAddYoursOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={addYoursOn}
                    onValueChange={(val) => {
                      setAddYoursOn(val);
                      if (val) setAddYoursOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 7. Reels Made for You */}
                <View style={[styles.groupHeaderRow, { marginTop: 6 }]}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Reels Made for You</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={reelsForYouOff}
                    onValueChange={(val) => {
                      setReelsForYouOff(val);
                      if (val) setReelsForYouOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={reelsForYouOn}
                    onValueChange={(val) => {
                      setReelsForYouOn(val);
                      if (val) setReelsForYouOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

              </View>
            )}

            {/* Section 7: Birthdays (Expandable Dropdown Header) */}
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
                <Ionicons name="settings-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>Birthdays</Text>
              </View>

              <Ionicons
                name={isBirthdaysExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#6B7280"
              />
            </Pressable>

            {/* Birthdays Expanded Content */}
            {isBirthdaysExpanded && (
              <View style={styles.dropdownBodyWrapper}>
                
                {/* Birthdays Sub-Group */}
                <View style={styles.groupHeaderRow}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Birthdays</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={birthdaysOff}
                    onValueChange={(val) => {
                      setBirthdaysOff(val);
                      if (val) setBirthdaysOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={birthdaysOn}
                    onValueChange={(val) => {
                      setBirthdaysOn(val);
                      if (val) setBirthdaysOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

              </View>
            )}

            {/* Section 8: Map (Expandable Dropdown Header) */}
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
                <Ionicons name="settings-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>Map</Text>
              </View>

              <Ionicons
                name={isMapExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#6B7280"
              />
            </Pressable>

            {/* Map Expanded Content */}
            {isMapExpanded && (
              <View style={styles.dropdownBodyWrapper}>
                
                {/* 1. Location Sharing Request */}
                <View style={styles.groupHeaderRow}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Location Sharing Request</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={locSharingOff}
                    onValueChange={(val) => {
                      setLocSharingOff(val);
                      if (val) setLocSharingOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={locSharingOn}
                    onValueChange={(val) => {
                      setLocSharingOn(val);
                      if (val) setLocSharingOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 2. Location sharing Reminder */}
                <View style={[styles.groupHeaderRow, { marginTop: 6 }]}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Location sharing Reminder</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={locReminderOff}
                    onValueChange={(val) => {
                      setLocReminderOff(val);
                      if (val) setLocReminderOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={locReminderOn}
                    onValueChange={(val) => {
                      setLocReminderOn(val);
                      if (val) setLocReminderOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 3. Location Likes */}
                <View style={[styles.groupHeaderRow, { marginTop: 6 }]}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Location Likes</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={locLikesOff}
                    onValueChange={(val) => {
                      setLocLikesOff(val);
                      if (val) setLocLikesOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={locLikesOn}
                    onValueChange={(val) => {
                      setLocLikesOn(val);
                      if (val) setLocLikesOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

              </View>
            )}

            {/* Section 9: Email Notifications (Expandable Dropdown Header) */}
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
                <Ionicons name="settings-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>Email Notifications</Text>
              </View>

              <Ionicons
                name={isEmailExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#6B7280"
              />
            </Pressable>

            {/* Email Notifications Expanded Content */}
            {isEmailExpanded && (
              <View style={styles.dropdownBodyWrapper}>
                
                {/* 1. Feedback Emails */}
                <View style={styles.groupHeaderRow}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Feedback Emails</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={feedbackEmailOff}
                    onValueChange={(val) => {
                      setFeedbackEmailOff(val);
                      if (val) setFeedbackEmailOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={feedbackEmailOn}
                    onValueChange={(val) => {
                      setFeedbackEmailOn(val);
                      if (val) setFeedbackEmailOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 2. Reminder Emails */}
                <View style={[styles.groupHeaderRow, { marginTop: 6 }]}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Reminder Emails</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={reminderEmailOff}
                    onValueChange={(val) => {
                      setReminderEmailOff(val);
                      if (val) setReminderEmailOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={reminderEmailOn}
                    onValueChange={(val) => {
                      setReminderEmailOn(val);
                      if (val) setReminderEmailOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 3. Product Emails */}
                <View style={[styles.groupHeaderRow, { marginTop: 6 }]}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Product Emails</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={productEmailOff}
                    onValueChange={(val) => {
                      setProductEmailOff(val);
                      if (val) setProductEmailOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={productEmailOn}
                    onValueChange={(val) => {
                      setProductEmailOn(val);
                      if (val) setProductEmailOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 4. News Email */}
                <View style={[styles.groupHeaderRow, { marginTop: 6 }]}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>News Email</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={newsEmailOff}
                    onValueChange={(val) => {
                      setNewsEmailOff(val);
                      if (val) setNewsEmailOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={newsEmailOn}
                    onValueChange={(val) => {
                      setNewsEmailOn(val);
                      if (val) setNewsEmailOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 5. Support Emails */}
                <View style={[styles.groupHeaderRow, { marginTop: 6 }]}>
                  <Ionicons name="settings-outline" size={18} color="#111827" style={{ marginRight: 8 }} />
                  <Text style={styles.groupHeaderTitle}>Support Emails</Text>
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>Off</Text>
                  </View>
                  <Switch
                    value={supportEmailOff}
                    onValueChange={(val) => {
                      setSupportEmailOff(val);
                      if (val) setSupportEmailOn(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.subItemRow}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.subItemText}>On</Text>
                  </View>
                  <Switch
                    value={supportEmailOn}
                    onValueChange={(val) => {
                      setSupportEmailOn(val);
                      if (val) setSupportEmailOff(false);
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#F44649' }}
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
    fontWeight: '700',
    color: '#111827',
  },
  subItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
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
