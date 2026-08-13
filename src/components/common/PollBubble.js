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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_POLL_WIDTH = SCREEN_WIDTH * 0.72; // Reduced width for compact display

export default function PollBubble({
  poll,
  onVote,
  onViewAll,
  onLongPress,
}) {
  if (!poll) return null;

  const { question, options = [], time, isSent, isRead } = poll;

  // Calculate total votes across all options
  const totalVotes = options.reduce(
    (sum, opt) => sum + (opt.votes ?? (opt.voters ? opt.voters.length : 0)),
    0
  );

  return (
    <View style={isSent ? styles.sentContainer : styles.receivedContainer}>
      <TouchableOpacity
        activeOpacity={0.95}
        onLongPress={onLongPress}
        style={[isSent ? styles.sentCard : styles.receivedCard]}
      >
        {/* Question Title */}
        <Text style={[styles.questionText, isSent ? styles.sentText : styles.receivedText]}>
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
                          isSent ? styles.radioFilledSent : styles.radioFilledReceived,
                        ]}
                      >
                        <Ionicons
                          name="checkmark"
                          size={11}
                          color={isSent ? '#000000' : '#FFFFFF'}
                        />
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.radioEmpty,
                          isSent ? styles.radioEmptySent : styles.radioEmptyReceived,
                        ]}
                      />
                    )}
                  </View>

                  {/* Option Label */}
                  <Text
                    style={[
                      styles.optionLabel,
                      isSent ? styles.sentText : styles.receivedText,
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
                    isSent ? styles.progressTrackSent : styles.progressTrackReceived,
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      isSent
                        ? isSelected
                          ? styles.progressFillSentSelected
                          : styles.progressFillSent
                        : isSelected
                        ? styles.progressFillReceivedSelected
                        : styles.progressFillReceived,
                      { width: `${percentage}%` },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Divider Line */}
        <View
          style={[
            styles.divider,
            isSent ? styles.dividerSent : styles.dividerReceived,
          ]}
        />

        {/* View All Button */}
        <TouchableOpacity style={styles.viewAllButton} onPress={onViewAll}>
          <Text style={[styles.viewAllText, isSent ? styles.sentText : styles.receivedText]}>
            View All
          </Text>
        </TouchableOpacity>

        {/* Timestamp */}
        <View style={styles.timestampContainer}>
          <Text
            style={[
              styles.timestampText,
              isSent ? styles.sentTimeText : styles.receivedTimeText,
            ]}
          >
            {time}
          </Text>
          {isSent && (
            <Ionicons
              name="checkmark-done"
              size={15}
              color={isRead ? '#34C759' : '#AEAEB2'}
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
    backgroundColor: '#000000', // Pure black card
    borderRadius: 18,
    padding: 12,
    borderBottomRightRadius: 4, // Sharp corner tail
  },
  receivedCard: {
    backgroundColor: '#FFFFFF', // Pure white card
    borderRadius: 18,
    padding: 12,
    borderBottomLeftRadius: 4, // Sharp corner tail
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  questionText: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 12,
  },
  sentText: {
    color: '#FFFFFF',
  },
  receivedText: {
    color: '#000000',
  },
  optionsList: {
    marginBottom: 6,
  },
  optionRowContainer: {
    marginBottom: 10,
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
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.8,
  },
  radioEmptySent: {
    borderColor: '#FFFFFF',
  },
  radioEmptyReceived: {
    borderColor: '#8E8E93',
  },
  radioFilled: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioFilledSent: {
    backgroundColor: '#FFFFFF',
  },
  radioFilledReceived: {
    backgroundColor: '#48484A',
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '400',
    flex: 1,
    marginRight: 6,
  },
  selectedOptionLabel: {
    fontWeight: '600',
  },
  progressTrack: {
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
    marginLeft: 26, // align with text label start
  },
  progressTrackSent: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  progressTrackReceived: {
    backgroundColor: '#E5E5EA',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressFillSent: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  progressFillSentSelected: {
    backgroundColor: '#FFFFFF',
  },
  progressFillReceived: {
    backgroundColor: '#8E8E93',
  },
  progressFillReceivedSelected: {
    backgroundColor: '#48484A',
  },
  divider: {
    height: 0.5,
    marginVertical: 12,
  },
  dividerSent: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dividerReceived: {
    backgroundColor: '#E5E5EA',
  },
  viewAllButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  viewAllText: {
    fontSize: 15,
    fontWeight: '600',
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timestampText: {
    fontSize: 10,
  },
  sentTimeText: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  receivedTimeText: {
    color: '#8E8E93',
  },
  checkIcon: {
    marginLeft: 4,
  },
});
