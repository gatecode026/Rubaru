import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../../localization/LanguageContext';
import { useTheme } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 52) / 2; // 2 columns, 16px side padding + 20px gap
const CARD_HEIGHT = 270;

export default function GroupCard({ item, onGroupPress }) {
  const router = useRouter();
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();
  const [isJoined, setIsJoined] = useState(item?.isJoined || false);

  const {
    badgeLabel = 'Gaming Group',
    imageUri,
    name,
    statusColor = '#34C759',
    adminName,
    membersCount = '1.4k',
  } = item || {};

  const handleCardPress = () => {
    if (onGroupPress) {
      onGroupPress();
    } else {
      router.push({
        pathname: '/group-chat',
        params: {
          id: item?.id || '1',
          name: name || 'Product Team',
          adminName: adminName || 'Priya Shah',
          badgeLabel: badgeLabel,
        },
      });
    }
  };

  // Badge icon & gradient colors based on group type
  const getBadgeMeta = (label) => {
    const lower = (label || '').toLowerCase();
    if (lower.includes('gaming')) {
      return {
        icon: 'game-controller',
        colors: isDarkMode ? ['#4C1D95', '#3B0764'] : ['#8B5CF6', '#6D28D9'],
        text: 'Gaming',
      };
    }
    if (lower.includes('gossip') || lower.includes('talk')) {
      return {
        icon: 'chatbubbles',
        colors: isDarkMode ? ['#1C1C1E', '#3A3A3C'] : ['#FF2E63', '#FF477E'],
        text: 'Gossip',
      };
    }
    if (lower.includes('bollywood') || lower.includes('music')) {
      return {
        icon: 'musical-notes',
        colors: isDarkMode ? ['#78350F', '#451A03'] : ['#F59E0B', '#D97706'],
        text: 'Entertainment',
      };
    }
    return {
      icon: 'sparkles',
      colors: isDarkMode ? ['#831843', '#500724'] : ['#EC4899', '#DB2777'],
      text: label || 'Community',
    };
  };

  const badgeMeta = getBadgeMeta(badgeLabel);

  const handleToggleJoin = () => {
    setIsJoined((prev) => !prev);
  };

  // Button gradient colors for dark mode vs light mode
  const joinColors = isDarkMode ? ['#1C1C1E', '#3A3A3C'] : ['#FF2E63', '#FF477E'];
  const joinedColors = isDarkMode ? ['#047857', '#065F46'] : ['#10B981', '#059669'];

  return (
    <TouchableOpacity
      style={styles.cardWrapper}
      activeOpacity={0.92}
      onPress={handleCardPress}
    >
      <View style={styles.cardContainer}>
        {/* Background Image */}
        <Image
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />

        {/* Subtle Top Glass Shadow overlay for top badges */}
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.1)', 'transparent']}
          style={styles.topScrim}
        />

        {/* Top Header Badge Row */}
        <View style={styles.topBadgeRow}>
          {/* Category Tag with Icon */}
          <LinearGradient
            colors={badgeMeta.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.categoryBadge}
          >
            <Ionicons name={badgeMeta.icon} size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.categoryBadgeText}>{badgeMeta.text}</Text>
          </LinearGradient>

          {/* Member Count Pill */}
          <View style={styles.memberPill}>
            <Ionicons name="people" size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
            <Text style={styles.memberPillText}>{membersCount}</Text>
          </View>
        </View>

        {/* Bottom Rich Multi-Stop Scrim */}
        <LinearGradient
          colors={[
            'transparent',
            'rgba(15, 23, 42, 0.25)',
            'rgba(15, 23, 42, 0.75)',
            'rgba(15, 23, 42, 0.96)',
          ]}
          style={styles.bottomScrim}
        >
          {/* Action Join Button */}
          <TouchableOpacity
            style={[
              styles.joinBtn,
              isDarkMode && styles.joinBtnDark,
              isJoined && (isDarkMode ? styles.joinedBtnDark : styles.joinedBtn),
            ]}
            activeOpacity={0.82}
            onPress={handleToggleJoin}
          >
            {isJoined ? (
              <LinearGradient
                colors={joinedColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.joinBtnGradient}
              >
                <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.joinBtnText}>{t('joined', 'Joined')}</Text>
              </LinearGradient>
            ) : (
              <LinearGradient
                colors={joinColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.joinBtnGradient}
              >
                <Ionicons name="add" size={14} color="#FFFFFF" style={{ marginRight: 3 }} />
                <Text style={styles.joinBtnText}>{t('joinGroup', 'Join Group')}</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>

          {/* Group Name + Status Indicator */}
          <View style={styles.nameRow}>
            <Text style={styles.nameText} numberOfLines={1}>
              {name}
            </Text>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          </View>

          {/* Admin Tag */}
          <View style={styles.adminRow}>
            <Ionicons name="shield-checkmark" size={10} color="#FBBF24" style={{ marginRight: 3 }} />
            <Text style={styles.adminText} numberOfLines={1}>
              {adminName}
            </Text>
          </View>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    width: CARD_WIDTH,
    marginBottom: 20,
    shadowColor: '#340E1B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 7,
  },
  cardContainer: {
    width: '100%',
    height: CARD_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.65)',
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 70,
    zIndex: 2,
  },
  topBadgeRow: {
    position: 'absolute',
    top: 12,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  memberPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  bottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 40,
    paddingBottom: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  joinBtn: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
    width: '92%',
  },
  joinBtnDark: {
    shadowColor: '#000000',
  },
  joinedBtn: {
    shadowColor: '#10B981',
  },
  joinedBtnDark: {
    shadowColor: '#047857',
  },
  joinBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  joinBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  nameText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminText: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
