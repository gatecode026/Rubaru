import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import BottomTabBar from '../components/common/BottomTabBar';

export default function ViolationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.rootContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF0F3" />
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
            },
          ]}
        >
          {/* Header Row */}
          <View style={styles.topHeaderRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              hitSlop={12}
            >
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Warnings</Text>

            <View style={styles.headerRightIcon}>
              <Ionicons name="shield-outline" size={24} color="#F04452" />
              <View style={styles.headerAlertDot}>
                <Text style={styles.headerAlertText}>!</Text>
              </View>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Active Warning Card */}
            <View style={styles.activeWarningCard}>
              <View style={styles.warningIconCircle}>
                <Ionicons name="warning" size={32} color="#D97706" />
              </View>
              
              <View style={styles.activeWarningContent}>
                <Text style={styles.activeWarningTitle}>You have 1 Active Warning</Text>
                <Text style={styles.activeWarningDesc}>
                  Follow our Community Guidelines to avoid more actions.
                </Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.viewGuidelinesButton}
                  onPress={() => router.push('/community-standards')}
                >
                  <Text style={styles.viewGuidelinesText}>View Guidelines</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.progressRingContainer}>
                <View style={styles.progressCircle}>
                  <Text style={styles.progressText}>1/3</Text>
                  <Text style={styles.progressSubtext}>Warnings</Text>
                </View>
                <Text style={styles.progressBottomText}>Before action is taken</Text>
              </View>
            </View>

            {/* Warning History Section Header */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Warning History</Text>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.viewDetailsLink}>View Details</Text>
              </TouchableOpacity>
            </View>

            {/* Warning History Grouped List */}
            <View style={styles.historyListContainer}>
              {/* Item 1: Inappropriate Messages */}
              <View style={styles.historyItemRow}>
                <View style={styles.historyItemHeader}>
                  <View style={[styles.statusBadge, styles.statusBadgeActive]}>
                    <Text style={[styles.statusBadgeText, styles.statusBadgeTextActive]}>Active</Text>
                  </View>
                  <View style={[styles.levelBadge, styles.levelBadgeActive]}>
                    <Text style={[styles.levelBadgeText, styles.levelBadgeTextActive]}>Level 1</Text>
                  </View>
                </View>
                
                <View style={styles.historyItemContent}>
                  <View style={[styles.historyIconCircle, { backgroundColor: '#FFEBF0' }]}>
                    <Ionicons name="chatbubble" size={16} color="#F43F5E" />
                  </View>
                  <View style={styles.historyTextContainer}>
                    <Text style={styles.historyItemTitle}>Inappropriate Messages</Text>
                    <Text style={styles.historyItemDesc}>
                      Your message was reported for violating our community guidelines.
                    </Text>
                    <View style={styles.historyDateRow}>
                      <Ionicons name="calendar-outline" size={12} color="#8E8E93" style={{ marginRight: 4 }} />
                      <Text style={styles.historyDateText}>17 Aug 2026  •  10:30 AM</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
                </View>
              </View>

              <View style={styles.historyDivider} />

              {/* Item 2: Profile Information */}
              <View style={styles.historyItemRow}>
                <View style={styles.historyItemHeader}>
                  <View style={[styles.statusBadge, styles.statusBadgeExpired]}>
                    <Text style={[styles.statusBadgeText, styles.statusBadgeTextExpired]}>Expired</Text>
                  </View>
                  <View style={[styles.levelBadge, styles.levelBadgeExpired]}>
                    <Text style={[styles.levelBadgeText, styles.levelBadgeTextExpired]}>Level 1</Text>
                  </View>
                </View>
                
                <View style={styles.historyItemContent}>
                  <View style={[styles.historyIconCircle, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="person" size={16} color="#D97706" />
                  </View>
                  <View style={styles.historyTextContainer}>
                    <Text style={styles.historyItemTitle}>Profile Information</Text>
                    <Text style={styles.historyItemDesc}>
                      Your profile information was reported as misleading.
                    </Text>
                    <View style={styles.historyDateRow}>
                      <Ionicons name="calendar-outline" size={12} color="#8E8E93" style={{ marginRight: 4 }} />
                      <Text style={styles.historyDateText}>10 Aug 2026  •  02:15 PM</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
                </View>
              </View>

              <View style={styles.historyDivider} />

              {/* Item 3: Inappropriate Photo */}
              <View style={styles.historyItemRow}>
                <View style={styles.historyItemHeader}>
                  <View style={[styles.statusBadge, styles.statusBadgeResolved]}>
                    <Text style={[styles.statusBadgeText, styles.statusBadgeTextResolved]}>Resolved</Text>
                  </View>
                  <View style={[styles.levelBadge, styles.levelBadgeResolved]}>
                    <Text style={[styles.levelBadgeText, styles.levelBadgeTextResolved]}>Level 1</Text>
                  </View>
                </View>
                
                <View style={styles.historyItemContent}>
                  <View style={[styles.historyIconCircle, { backgroundColor: '#D1FAE5' }]}>
                    <Ionicons name="image" size={16} color="#10B981" />
                  </View>
                  <View style={styles.historyTextContainer}>
                    <Text style={styles.historyItemTitle}>Inappropriate Photo</Text>
                    <Text style={styles.historyItemDesc}>
                      Your photo was reported for violating our community guidelines.
                    </Text>
                    <View style={styles.historyDateRow}>
                      <Ionicons name="calendar-outline" size={12} color="#8E8E93" style={{ marginRight: 4 }} />
                      <Text style={styles.historyDateText}>05 Aug 2026  •  09:20 PM</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
                </View>
              </View>
            </View>

            {/* About Warnings Info Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoIconCircle}>
                <Ionicons name="information-circle" size={20} color="#F04452" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>About Warnings</Text>
                <Text style={styles.infoBullet}>• Warnings are issued when you violate our Community Guidelines.</Text>
                <Text style={styles.infoBullet}>• You will receive up to 3 warnings before strict action is taken.</Text>
                <Text style={styles.infoBullet}>• More severe violations may result in immediate action.</Text>
                <Text style={styles.infoBullet}>• Expired warnings will not affect your account.</Text>
                <Text style={styles.infoBullet}>• Follow the guidelines to keep your account safe.</Text>
              </View>
            </View>

            {/* Need Help Card */}
            <View style={styles.helpCard}>
              <View style={styles.helpLeft}>
                <View style={styles.helpIconCircle}>
                  <Ionicons name="headset" size={22} color="#F04452" />
                </View>
                <View style={styles.helpTextContainer}>
                  <Text style={styles.helpTitle}>Need Help?</Text>
                  <Text style={styles.helpDesc}>
                    If you think this was a mistake, you can appeal or contact our support team.
                  </Text>
                </View>
              </View>
              <TouchableOpacity activeOpacity={0.8} style={styles.contactButton}>
                <Text style={styles.contactButtonText}>Contact Support</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </ImageBackground>

      {/* Bottom Navigation Tab Bar (Profile Active) */}
      <BottomTabBar
        activeTab="profile"
        onTabPress={(tabKey) => {
          router.push(tabKey === 'index' ? '/(tabs)' : `/(tabs)/${tabKey}`);
        }}
      />
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
    height: 48,
    marginBottom: 20,

  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.8)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  headerRightIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAlertDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#F04452',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  headerAlertText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 11,
  },
  scrollContent: {
    paddingBottom: 110, // Safe offset above bottom tab bar
  },
  activeWarningCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFE1E8',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 20,
  },
  warningIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activeWarningContent: {
    flex: 1,
    paddingRight: 6,
  },
  activeWarningTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  activeWarningDesc: {
    fontSize: 11,
    color: '#4B5563',
    lineHeight: 16,
    marginTop: 4,
  },
  viewGuidelinesButton: {
    borderWidth: 1,
    borderColor: '#F04452',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  viewGuidelinesText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F04452',
  },
  progressRingContainer: {
    alignItems: 'center',
    width: 80,
  },
  progressCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: '#FFE1E8',
    borderTopColor: '#F04452',
    borderRightColor: '#F04452',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  progressSubtext: {
    fontSize: 8,
    color: '#6B7280',
    marginTop: 1,
  },
  progressBottomText: {
    fontSize: 8,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 11,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  viewDetailsLink: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F04452',
  },
  historyListContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFE1E8',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 20,
    paddingVertical: 4,
  },
  historyItemRow: {
    padding: 16,
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeActive: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeExpired: {
    backgroundColor: '#FFFBEB',
  },
  statusBadgeResolved: {
    backgroundColor: '#E8FDF5',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  statusBadgeTextActive: {
    color: '#EF4444',
  },
  statusBadgeTextExpired: {
    color: '#D97706',
  },
  statusBadgeTextResolved: {
    color: '#10B981',
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  levelBadgeActive: {
    backgroundColor: '#FFEBF0',
  },
  levelBadgeExpired: {
    backgroundColor: '#FEF3C7',
  },
  levelBadgeResolved: {
    backgroundColor: '#D1FAE5',
  },
  levelBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  levelBadgeTextActive: {
    color: '#F43F5E',
  },
  levelBadgeTextExpired: {
    color: '#D97706',
  },
  levelBadgeTextResolved: {
    color: '#10B981',
  },
  historyItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  historyItemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  historyItemDesc: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 16,
    marginTop: 4,
  },
  historyDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  historyDateText: {
    fontSize: 10,
    color: '#8E8E93',
  },
  historyDivider: {
    height: 1,
    backgroundColor: '#F5F5F5',
    marginHorizontal: 16,
  },
  infoCard: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFEBEF',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  infoIconCircle: {
    marginRight: 10,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  infoBullet: {
    fontSize: 11,
    color: '#4B5563',
    lineHeight: 18,
    marginTop: 2,
  },
  helpCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFE1E8',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  helpLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  helpIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFE1E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  helpTextContainer: {
    flex: 1,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  helpDesc: {
    fontSize: 10,
    color: '#6B7280',
    lineHeight: 14,
    marginTop: 2,
  },
  contactButton: {
    borderWidth: 1,
    borderColor: '#F04452',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  contactButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F04452',
  },
});
