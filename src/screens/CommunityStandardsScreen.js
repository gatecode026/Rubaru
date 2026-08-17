import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  ScrollView,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../localization/LanguageContext';

const GUIDELINE_SECTIONS = [
  {
    number: '1',
    title: 'Be Respectful',
    intro: 'Treat others with kindness, consideration, and empathy.',
    doList: [
      'Communicate politely and positively.',
      'Respect different opinions, backgrounds, cultures, and choices.',
      'Accept rejection gracefully without anger or harassment.',
      'Give other users the space they need if they stop responding.',
    ],
    dontList: [
      'Do not insult, demean, harass, or verbally attack anyone.',
      'Hate speech, racism, sexism, or discrimination of any kind is strictly forbidden.',
    ],
  },
  {
    number: '2',
    title: 'Be Authentic',
    intro: 'My Dating App is built on honesty and genuine connections.',
    doList: [
      'Use real and current photos of yourself.',
      'Provide accurate information about your age and interests.',
      'Be transparent about your intentions.',
    ],
    dontList: [
      'Do not impersonate other people or use celebrity photos.',
      'Do not create fake, deceptive, or duplicate accounts.',
      'Do not upload stock images, AI-generated avatars, or unauthorized photos of others.',
    ],
  },
  {
    number: '3',
    title: 'Clear Communication Rules',
    intro: 'Maintain respectful, safe, and consensual conversations at all times.',
    doList: [
      'Keep interactions comfortable and mutually engaging.',
      'Obtain explicit consent before sharing personal topics.',
    ],
    dontList: [
      'Do not send abusive, offensive, threatening, or unsolicited explicit messages.',
      'Do not spam other users or send bulk copy-pasted messages.',
      'Do not pressure anyone into sharing their social media, phone number, or meeting up.',
    ],
  },
  {
    number: '4',
    title: 'Dating & Romantic Connections',
    intro: 'Foster authentic, meaningful romantic journeys with trust and respect.',
    doList: [
      'Be clear about your dating intentions and relationship preferences.',
      'Respect mutual compatibility and personal boundaries.',
    ],
    dontList: [
      'Do not mislead others regarding your relationship or marital status.',
      'Do not engage in emotional manipulation, catfishing, or gaslighting.',
    ],
  },
  {
    number: '5',
    title: 'Safety & Consent Rules',
    intro: 'Your safety and personal boundaries are our utmost priority.',
    doList: [
      'Always obtain explicit mutual consent before any intimate discussion.',
      'Report any behavior that makes you feel uncomfortable or unsafe.',
    ],
    dontList: [
      'Non-consensual sexual content, explicit imagery, or harassment is strictly prohibited.',
      'Blackmail, sextortion, or coerced communication will result in an immediate permanent ban and law enforcement reporting.',
    ],
  },
  {
    number: '6',
    title: 'Zero Tolerance for Toxicity',
    intro: 'We maintain zero tolerance for any form of toxicity, abuse, or hostility.',
    doList: [
      'Maintain positive, uplifting, and safe interactions.',
      'Block and report toxic or hostile behavior immediately.',
    ],
    dontList: [
      'Do not bully, stalk, intimidate, or threaten any user.',
      'Do not engage in trolling, body shaming, or aggressive behavior.',
    ],
  },
  {
    number: '7',
    title: 'Photos, Videos & Media',
    intro: 'Ensure all visual content complies with our community media standards.',
    doList: [
      'Upload high-quality, clear photos showing your face.',
      'Share moments that reflect your true lifestyle and interests.',
    ],
    dontList: [
      'Nudity, pornography, sexually suggestive poses, or explicit media are strictly banned.',
      'Do not upload violent, graphic, copyrighted, or weapons-related media.',
    ],
  },
  {
    number: '8',
    title: 'Respect & Communities',
    intro: 'Contribute positively to group chats, discussions, and open communities.',
    doList: [
      'Follow specific group guidelines and topics.',
      'Encourage inclusive, warm, and friendly conversations.',
    ],
    dontList: [
      'Do not derail group chats with spam, hate speech, or offensive content.',
      'Do not harass community moderators or group members.',
    ],
  },
  {
    number: '9',
    title: 'User Privacy Protection',
    intro: 'Protect your own personal data and respect the privacy of others.',
    doList: [
      'Keep your sensitive credentials, passwords, and OTPs confidential.',
      'Communicate securely within the app until trust is established.',
    ],
    dontList: [
      'Never share personal identification, banking details, home address, or private documents.',
      'Do not post screenshots of private conversations without explicit consent.',
    ],
  },
  {
    number: '10',
    title: 'No Spam or Fraud',
    intro: 'My Dating App is strictly for personal, genuine dating and social connections.',
    doList: [
      'Use the platform only for personal dating, friendships, and networking.',
    ],
    dontList: [
      'Commercial advertising, affiliate links, and promotional sales are prohibited.',
      'Financial scams, crypto solicitations, begging, and pyramid schemes are forbidden.',
    ],
  },
  {
    number: '11',
    title: 'Protect Minors',
    intro: 'Strict age-restriction policy for child protection.',
    doList: [
      'You must be 18 years or older to register and use My Dating App.',
    ],
    dontList: [
      'Minors (under 18) are strictly prohibited from using the platform.',
      'Any child sexual exploitation, abuse material, or endangerment will result in instant termination and immediate referral to law enforcement.',
    ],
  },
  {
    number: '12',
    title: 'No Illegal Activity or Promotion',
    intro: 'All illegal acts and criminal activities are strictly banned.',
    doList: [
      'Comply with all applicable local, national, and international laws.',
    ],
    dontList: [
      'Do not promote, facilitate, or engage in drug trafficking, prostitution, human trafficking, weapons sales, or money laundering.',
    ],
  },
  {
    number: '13',
    title: 'Encourage Inclusivity',
    intro: 'We welcome people of all gender identities, sexual orientations, religions, and backgrounds.',
    doList: [
      'Celebrate diversity and treat every community member with dignity.',
      'Use preferred pronouns and embrace authentic expression.',
    ],
    dontList: [
      'Discriminatory behavior, hate groups, or exclusionary rhetoric will not be tolerated.',
    ],
  },
  {
    number: '14',
    title: 'Keep Personal Data Safe',
    intro: 'Take active precautions to safeguard your privacy and digital identity.',
    doList: [
      'Use in-app audio and video calls for your safety before sharing direct phone numbers.',
      'Report suspicious requests for money or personal data.',
    ],
    dontList: [
      'Do not send money, gift cards, or crypto to anyone you meet online.',
    ],
  },
  {
    number: '15',
    title: 'Fair & Constructive Feedback',
    intro: 'Help us maintain a safe community by providing honest feedback and reporting issues.',
    doList: [
      'Submit constructive suggestions through the in-app Feedback form.',
      'Report bugs or security vulnerabilities to Customer Support.',
    ],
    dontList: [
      'Do not submit false, malicious, or retaliatory reports against innocent users.',
    ],
  },
  {
    number: '16',
    title: 'Report & Block System',
    intro: 'Take immediate action whenever you encounter inappropriate behavior.',
    doList: [
      'Use the in-app "Report" and "Block" buttons on any profile or chat instantly.',
      'Provide detailed information and screenshots when submitting a violation report.',
    ],
    dontList: [
      'Do not hesitate to protect your peace of mind and report bad actors.',
    ],
  },
  {
    number: '17',
    title: 'Consequences',
    intro: 'Violating these Community Guidelines will lead to enforced moderation actions.',
    doList: [
      'Review these guidelines regularly to ensure your account remains in good standing.',
    ],
    dontList: [
      'Repeated violations may lead to formal warnings, temporary account suspension, or permanent device and IP bans without refund.',
    ],
  },
  {
    number: '18',
    title: 'Our Commitment',
    intro: 'We are committed to building the safest, most authentic, and enjoyable dating platform.',
    doList: [
      'Our dedicated moderation team and AI safety algorithms work 24/7 to protect our community.',
    ],
    dontList: [],
  },
  {
    number: '19',
    title: 'Need Help?',
    intro: 'If you have questions or require safety support, please contact our support team.',
    doList: [
      'Reach out via Help & Support in the app settings or email support@mydatingapp.com.',
    ],
    dontList: [],
  },
];

export default function CommunityStandardsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const handleBack = () => {
    router.push('/user-profile?openSettings=true');
  };

  useEffect(() => {
    const onBackPress = () => {
      router.push('/user-profile?openSettings=true');
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [router]);

  return (
    <View style={styles.rootContainer}>
      <ImageBackground
        source={require('@assets/images/app_background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View
          style={[
            styles.mainWrapper,
            {
              paddingTop: Math.max(insets.top + 10, 36),
              paddingBottom: Math.max(insets.bottom, 6),
            },
          ]}
        >
          {/* Header Row */}
          <View style={styles.topHeaderRow}>
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
              hitSlop={12}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </Pressable>

            <Text style={styles.headerTitle}>Community Guidelines</Text>

            <View style={{ width: 40 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Top Overview Section */}
            <View style={styles.introSection}>
              <Text style={styles.introHeading}>Welcome to Our Community</Text>
              <Text style={styles.introBody}>
                Our mission is to create a safe, authentic, and respectful space where people can connect, date, and build meaningful relationships.
              </Text>
              <Text style={[styles.introBody, { marginTop: 8 }]}>
                To protect our community, every member is expected to adhere to these Community Guidelines. By using the app, you agree to uphold these standards.
              </Text>
            </View>

            {/* 19 Numbered Guidelines */}
            {GUIDELINE_SECTIONS.map((sec) => (
              <View key={sec.number} style={styles.guidelineBlock}>
                {/* Section Title */}
                <Text style={styles.sectionHeaderTitle}>
                  {sec.number}. {sec.title}
                </Text>

                {/* Intro Body */}
                <Text style={styles.sectionIntroText}>{sec.intro}</Text>

                {/* Do List */}
                {sec.doList && sec.doList.length > 0 && (
                  <View style={styles.listContainer}>
                    <Text style={styles.listSubheader}>Do's:</Text>
                    {sec.doList.map((item, i) => (
                      <View key={i} style={styles.bulletRow}>
                        <Ionicons name="checkmark-circle" size={16} color="#10B981" style={styles.bulletIcon} />
                        <Text style={styles.bulletText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Don't List */}
                {sec.dontList && sec.dontList.length > 0 && (
                  <View style={[styles.listContainer, { marginTop: 6 }]}>
                    <Text style={styles.listSubheader}>Don'ts:</Text>
                    {sec.dontList.map((item, i) => (
                      <View key={i} style={styles.bulletRow}>
                        <Ionicons name="close-circle" size={16} color="#EF4444" style={styles.bulletIcon} />
                        <Text style={styles.bulletText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}

            {/* Closing Footer Banner */}
            <View style={styles.closingBanner}>
              <Text style={styles.closingTagline}>My Dating App — Where Connections Begin.</Text>
            </View>
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
    paddingHorizontal: 20,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: 8,
  },
  introSection: {
    marginBottom: 18,
  },
  introHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  introBody: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 19,
    fontWeight: '400',
  },
  guidelineBlock: {
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  sectionIntroText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 6,
  },
  listContainer: {
    paddingLeft: 4,
    marginVertical: 3,
  },
  listSubheader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  bulletIcon: {
    marginTop: 2,
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  closingBanner: {
    marginTop: 8,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  closingTagline: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FF2E63',
    textAlign: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
