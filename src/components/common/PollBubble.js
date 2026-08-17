import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AvatarStack from './AvatarStack';
import { useTheme } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_POLL_WIDTH = SCREEN_WIDTH * 0.76;

export default function PollBubble({
  poll,
  onVote,
  onViewAll,
  onLongPress,
}) {
  const { isDarkMode, colors } = useTheme();

  if (!poll) return null;

  const { question, options = [], time, isSent, isRead } = poll;

  // Calculate total votes across all options
  const totalVotes = options.reduce(
    (sum, opt) => sum + (opt.votes ?? (opt.voters ? opt.voters.length : 0)),
    0
  );

  // In dark mode: sent is pure black #000000, received is white #FFFFFF (as previously)
  // In light mode: sent is soft light pink #FF6584, received is white #FFFFFF
  const cardBg = isSent
    ? (isDarkMode ? '#000000' : (colors.pollSentBg || '#FF6584'))
    : '#FFFFFF';

  const textColor = isSent ? '#FFFFFF' : '#000000';
  const secondaryTextColor = isSent ? (isDarkMode ? 'rgba(255, 255, 255, 0.7)' : '#FFF0F3') : '#8E8E93';
  const dividerColor = isSent
    ? (isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.3)')
    : '#E5E5EA';

  const pinkAccent = colors.primary || '#FF6584';

  return (
    <View style={isSent ? styles.sentContainer : styles.receivedContainer}>
      <TouchableOpacity
        activeOpacity={0.95}
        onLongPress={onLongPress}
        style={[
          isSent ? styles.sentCard : styles.receivedCard,
          {
            backgroundColor: cardBg,
          },
        ]}
      >
        {/* Question Title */}
        <Text style={[styles.questionText, { color: textColor }]}>
          {question}
        </Text>

        {/* Options List */}
        <View style={styles.optionsList}>
          {options.map((option) => {
            const voteCount = option.votes ?? (option.voters ? option.voters.length : 0);
            const percentage =
              totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
            const isSelected = option.isSelected;

            return (
              <TouchableOpacity
                key={option.id}
                style={styles.optionRowContainer}
                activeOpacity={0.7}
                onPress={() => onVote && onVote(option.id)}
              >
                {/* Radio button & Label & AvatarStack row */}
                <View style={styles.optionHeaderRow}>
                  {/* Radio button icon */}
                  <View style={styles.radioWrapper}>
                    {isSelected ? (
                      <View
                        style={[
                          styles.radioFilled,
                          {
                            backgroundColor: isSent
                              ? '#FFFFFF'
                              : (isDarkMode ? '#48484A' : pinkAccent),
                          },
                        ]}
                      >
                        <Ionicons
                          name="checkmark"
                          size={12}
                          color={isSent ? (isDarkMode ? '#000000' : pinkAccent) : '#FFFFFF'}
                        />
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.radioEmpty,
                          {
                            borderColor: isSent
                              ? '#FFFFFF'
                              : '#8E8E93',
                          },
                        ]}
                      />
                    )}
                  </View>

                  {/* Option Label */}
                  <Text
                    style={[
                      styles.optionLabel,
                      { color: textColor },
                      isSelected && styles.selectedOptionLabel,
                    ]}
                  >
                    {option.label}
                  </Text>

                  {/* Avatar Stack & Count */}
                  <AvatarStack
                    voters={option.voters}
                    totalVotes={voteCount}
                    isSent={isSent}
                  />
                </View>

                {/* Progress Bar */}
                <View
                  style={[
                    styles.progressTrack,
                    {
                      backgroundColor: isSent
                        ? (isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.28)')
                        : '#E5E5EA',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: isSent
                          ? (isSelected ? '#FFFFFF' : (isDarkMode ? 'rgba(255, 255, 255, 0.7)' : '#FFFFFF'))
                          : (isSelected ? (isDarkMode ? '#48484A' : pinkAccent) : (isDarkMode ? '#8E8E93' : '#D1D5DB')),
                        width: `${percentage}%`,
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Divider Line */}
        <View style={[styles.divider, { backgroundColor: dividerColor }]} />

        {/* View All Button */}
        <TouchableOpacity style={styles.viewAllButton} onPress={onViewAll}>
          <Text
            style={[
              styles.viewAllText,
              { color: isSent ? '#FFFFFF' : (isDarkMode ? '#000000' : pinkAccent) },
            ]}
          >
            View All
          </Text>
        </TouchableOpacity>

        {/* Timestamp */}
        <View style={styles.timestampContainer}>
          <Text style={[styles.timestampText, { color: secondaryTextColor }]}>
            {time}
          </Text>
          {isSent && (
            <Ionicons
              name="checkmark-done"
              size={15}
              color={isRead ? '#10B981' : (isDarkMode ? '#AEAEB2' : '#FFF0F3')}
              style={styles.checkIcon}
            />
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  sentContainer: {
    alignSelf: 'flex-end',
    width: MAX_POLL_WIDTH,
    marginBottom: 12,
    marginRight: 16,
  },
  receivedContainer: {
    alignSelf: 'flex-start',
    width: MAX_POLL_WIDTH,
    marginBottom: 12,
    marginLeft: 16,
  },
  sentCard: {
    borderRadius: 18,
    padding: 14,
    borderBottomRightRadius: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  receivedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderBottomLeftRadius: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  questionText: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    marginBottom: 14,
  },
  optionsList: {
    marginBottom: 6,
  },
  optionRowContainer: {
    marginBottom: 12,
  },
  optionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  radioWrapper: {
    marginRight: 8,
  },
  radioEmpty: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  radioFilled: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    marginRight: 6,
  },
  selectedOptionLabel: {
    fontWeight: '700',
  },
  progressTrack: {
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
    marginLeft: 28,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  viewAllButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  viewAllText: {
    fontSize: 15,
    fontWeight: '700',
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timestampText: {
    fontSize: 11,
    fontWeight: '500',
  },
  checkIcon: {
    marginLeft: 4,
  },
});
