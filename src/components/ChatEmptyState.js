import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@theme';

export default function ChatEmptyState() {
  return (
    <View style={styles.container}>
      {/* Empty Chat Cards Stack Illustration */}
      <View style={styles.illustrationContainer}>
        {/* Card 1 - Top (SF) */}
        <View style={[styles.chatCard, styles.cardTop]}>
          <View style={[styles.avatarCircle, { backgroundColor: '#5A5E6B' }]}>
            <Text style={styles.avatarText}>SF</Text>
          </View>
          <View style={styles.linesContainer}>
            <View style={[styles.skeletonLine, { width: 60, height: 7 }]} />
            <View style={[styles.skeletonLine, { width: 140, height: 9, marginTop: 6 }]} />
          </View>
        </View>

        {/* Card 2 - Middle (VN) */}
        <View style={[styles.chatCard, styles.cardMiddle]}>
          <View style={[styles.avatarCircle, { backgroundColor: '#5D666E' }]}>
            <Text style={styles.avatarText}>VN</Text>
          </View>
          <View style={styles.linesContainer}>
            <View style={[styles.skeletonLine, { width: 65, height: 7 }]} />
            <View style={[styles.skeletonLine, { width: 150, height: 9, marginTop: 6 }]} />
          </View>
        </View>

        {/* Card 3 - Bottom (MS) */}
        <View style={[styles.chatCard, styles.cardBottom]}>
          <View style={[styles.avatarCircle, { backgroundColor: '#5E6068' }]}>
            <Text style={styles.avatarText}>MS</Text>
          </View>
          <View style={styles.linesContainer}>
            <View style={[styles.skeletonLine, { width: 70, height: 7 }]} />
            <View style={[styles.skeletonLine, { width: 155, height: 9, marginTop: 6 }]} />
          </View>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title}>No Conversations Yet</Text>

      {/* Subtitle */}
      <Text style={styles.subtitle}>
        Start a new chat or invite others to join{'\n'}the conversation.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    width: '100%',
  },
  illustrationContainer: {
    width: 280,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 9,
    width: 220,
    // Soft subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTop: {
    transform: [{ translateX: -20 }, { translateY: -10 }],
    zIndex: 3,
  },
  cardMiddle: {
    transform: [{ translateX: 20 }, { translateY: 0 }],
    zIndex: 2,
    marginTop: -4,
  },
  cardBottom: {
    transform: [{ translateX: -30 }, { translateY: 10 }],
    zIndex: 1,
    marginTop: -4,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  linesContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  skeletonLine: {
    backgroundColor: '#9CA3AF',
    borderRadius: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
});
