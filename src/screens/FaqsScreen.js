import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const FAQ_SECTIONS = [
  {
    id: 'account',
    title: 'Account',
    icon: 'person-outline',
    questions: [
      {
        q: 'How do I create a Rubaru account?',
        a: 'Sign up using your mobile number or email address and complete your profile to start connecting with people.',
      },
      {
        q: 'How can I edit my profile?',
        a: 'Go to Profile > Edit Profile to update your photos, bio, interests, and personal information.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Go to Profile > Settings > Delete Account and follow the confirmation steps.',
      },
    ],
  },
  {
    id: 'chat-calls',
    title: 'Chat & Calls',
    icon: 'chatbubbles-outline',
    questions: [
      {
        q: 'Is chatting free?',
        a: 'Yes, chatting on Rubaru is free unless stated otherwise.',
      },
      {
        q: 'How do voice and video calls work?',
        a: 'Voice and video calls are charged using Rubaru Coins. The required coins are deducted automatically during the call.',
      },
      {
        q: 'Why can’t I make a call?',
        a: 'Possible reasons include:\n• Insufficient coin balance\n• Internet connection issues\n• The other user is unavailable\n• Temporary account restrictions',
      },
    ],
  },
  {
    id: 'wallet',
    title: 'Wallet & Coins',
    icon: 'wallet-outline',
    questions: [
      {
        q: 'How do I buy coins?',
        a: 'Open Wallet and tap Recharge Coins to purchase coin packages.',
      },
      {
        q: 'Can I get a refund for purchased coins?',
        a: 'Purchased coins are generally non-refundable unless required by applicable law or stated in our Refund Policy.',
      },
      {
        q: 'Where can I see my transactions?',
        a: 'Go to Wallet > Transactions to view your purchase and usage history.',
      },
    ],
  },
  {
    id: 'payments',
    title: 'Payments',
    icon: 'card-outline',
    questions: [
      {
        q: 'Which payment methods are supported?',
        a: 'You can pay using UPI, Debit/Credit Cards, Net Banking, and other supported payment methods.',
      },
      {
        q: 'My payment failed but money was deducted. What should I do?',
        a: 'Please wait a few minutes. If the issue isn’t resolved, contact Customer Support with your transaction ID.',
      },
    ],
  },
  {
    id: 'safety',
    title: 'Safety & Privacy',
    icon: 'shield-checkmark-outline',
    questions: [
      {
        q: 'How do I report a user?',
        a: 'Open the user’s profile or chat, tap the : menu, and select Report User.',
      },
      {
        q: 'How do I block someone?',
        a: 'Open the user’s profile, tap the : menu, and choose Block User.',
      },
      {
        q: 'Is my personal information safe?',
        a: 'Rubaru takes reasonable measures to protect your information. Never share passwords, OTPs, bank details, or personal identification documents with anyone.',
      },
    ],
  },
  {
    id: 'technical',
    title: 'Technical Support',
    icon: 'hardware-chip-outline',
    questions: [
      {
        q: 'The app is not working properly. What should I do?',
        a: '• Restart the app.\n• Check your internet connection.\n• Update the app to the latest version.\n• Contact Customer Support if the issue continues.',
      },
      {
        q: 'Why am I not receiving notifications?',
        a: 'Check your device notification settings and make sure notifications are enabled for Rubaru.',
      },
    ],
  },
  {
    id: 'support',
    title: 'Customer Support',
    icon: 'call-outline',
    questions: [
      {
        q: 'How can I contact Rubaru Support?',
        a: 'Visit Help & Support > Customer Support to chat with us, email us, or submit a support request.',
      },
      {
        q: 'How long does it take to receive a response?',
        a: 'Most support requests are reviewed within 24-48 hours, depending on the nature of the issue.',
      },
    ],
  },
];

export default function FaqsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
              paddingTop: Math.max(insets.top + 12, 40),
              paddingBottom: Math.max(insets.bottom + 16, 24),
            },
          ]}
        >
          {/* Header Row */}
          <View style={styles.topHeaderRow}>
            <Pressable
              onPress={() => router.push('/user-profile?openSettings=true')}
              style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
              hitSlop={12}
              accessibilityLabel="Go back to sidebar"
            >
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </Pressable>

            <Text style={styles.headerTitle}>Frequently Asked Questions (FAQs)</Text>

            <View style={{ width: 40 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {FAQ_SECTIONS.map((sec) => (
              <View key={sec.id} style={styles.sectionBlock}>
                {/* Category Header */}
                <View style={styles.categoryTitleRow}>
                  <Ionicons name={sec.icon} size={20} color="#111827" style={styles.categoryIcon} />
                  <Text style={styles.categoryTitle}>{sec.title}</Text>
                </View>

                {/* Questions List */}
                <View style={styles.qaList}>
                  {sec.questions.map((item, index) => (
                    <View key={index} style={styles.qaItem}>
                      <Text style={styles.questionText}>{item.q}</Text>
                      <Text style={styles.answerText}>{item.a}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}

            {/* Still Need Help Section */}
            <View style={styles.stillNeedHelpSection}>
              <View style={styles.stillNeedHelpTitleRow}>
                <Ionicons name="search-outline" size={20} color="#111827" style={{ marginRight: 6 }} />
                <Text style={styles.stillNeedHelpTitle}>Still Need Help?</Text>
              </View>

              <Text style={styles.stillNeedHelpSubtitle}>
                Can’t find the answer you’re looking for?
              </Text>

              <Pressable
                onPress={() => router.push('/customer-support-flow')}
                style={({ pressed }) => [styles.customerSupportButton, pressed && styles.buttonPressed]}
              >
                <Text style={styles.customerSupportButtonText}>Customer Support</Text>
              </Pressable>
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
    paddingHorizontal: 16,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.8)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  sectionBlock: {
    marginBottom: 20,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryIcon: {
    marginRight: 8,
  },
  categoryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  qaList: {
    gap: 12,
    paddingLeft: 4,
  },
  qaItem: {
    marginBottom: 4,
  },
  questionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  answerText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#4B5563',
  },
  stillNeedHelpSection: {
    marginTop: 16,
    paddingTop: 16,
  },
  stillNeedHelpTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  stillNeedHelpTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  stillNeedHelpSubtitle: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 16,
  },
  customerSupportButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#111827',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 3,
  },
  customerSupportButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
