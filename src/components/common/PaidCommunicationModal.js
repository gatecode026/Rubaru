import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Paid Communication Confirmation & Rate Disclosure Modal
 */
export function PaidCommunicationConfirmModal({
  visible,
  communicationType = 'MESSAGE',
  ratePerMinute = 1,
  currentBalance = 0,
  recipientName = 'Rubaru User',
  onConfirm,
  onCancel,
  loading = false,
}) {
  const isSufficient = currentBalance >= ratePerMinute;
  const typeLabel = communicationType === 'VIDEO' ? 'Video Call' : communicationType === 'AUDIO' ? 'Voice Call' : 'Paid Chat';
  const typeIcon = communicationType === 'VIDEO' ? 'videocam' : communicationType === 'AUDIO' ? 'call' : 'chatbubbles';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <LinearGradient
            colors={['#FF2E63', '#FF6B6B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.iconCircle}>
              <Ionicons name={typeIcon} size={28} color="#FF2E63" />
            </View>
            <Text style={styles.headerTitle}>Start Paid {typeLabel}</Text>
            <Text style={styles.headerSubtitle}>with {recipientName}</Text>
          </LinearGradient>

          <View style={styles.bodyContent}>
            {/* Rate Information Box */}
            <View style={styles.rateBox}>
              <View style={styles.rateRow}>
                <Text style={styles.rateLabel}>Authoritative Rate:</Text>
                <Text style={styles.rateValue}>{ratePerMinute} Rubaru Coin{ratePerMinute > 1 ? 's' : ''} / min</Text>
              </View>
              <View style={styles.rateRow}>
                <Text style={styles.rateLabel}>Billing Increment:</Text>
                <Text style={styles.rateSubValue}>Started-minute (1-60s = 1 min)</Text>
              </View>
              <View style={styles.rateRow}>
                <Text style={styles.rateLabel}>Receiver Earnings:</Text>
                <Text style={styles.greenText}>100% of deducted amount (0% fee)</Text>
              </View>
              <View style={styles.rateRow}>
                <Text style={styles.rateLabel}>Non-connected cost:</Text>
                <Text style={styles.greenText}>0 Coins (Ringing/Declined = Free)</Text>
              </View>
            </View>

            {/* Wallet Balance Display */}
            <View style={[styles.balanceCard, !isSufficient && styles.insufficientBorder]}>
              <View style={styles.balanceLeft}>
                <Ionicons name="wallet-outline" size={22} color={isSufficient ? '#10B981' : '#EF4444'} />
                <Text style={styles.balanceLabel}>Your Balance:</Text>
              </View>
              <Text style={[styles.balanceAmount, !isSufficient && styles.insufficientText]}>
                {currentBalance} Coin{currentBalance !== 1 ? 's' : ''}
              </Text>
            </View>

            {!isSufficient && (
              <View style={styles.warningBanner}>
                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                <Text style={styles.warningText}>
                  Insufficient balance for first minute ({ratePerMinute} coins required).
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                activeOpacity={0.7}
                onPress={onCancel}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, (!isSufficient || loading) && styles.disabledButton]}
                activeOpacity={0.8}
                onPress={onConfirm}
                disabled={!isSufficient || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>Start Session</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Live In-Session Paid Status Pill / Overlay
 */
export function PaidSessionLiveBadge({
  isInitiator = true,
  ratePerMinute = 1,
  billedMinutes = 1,
  totalCoins = 1,
  currentBalance = 0,
}) {
  const isLowBalance = isInitiator && currentBalance < ratePerMinute * 2;

  return (
    <View style={[styles.liveBadgeContainer, isLowBalance && styles.lowBalanceGlow]}>
      <View style={styles.liveDot} />
      <Text style={styles.liveBadgeText}>
        {isInitiator ? `Spent: ${totalCoins} Coin${totalCoins !== 1 ? 's' : ''}` : `Earned: +${totalCoins} Coin${totalCoins !== 1 ? 's' : ''}`}
      </Text>
      <Text style={styles.liveBadgeDivider}>•</Text>
      <Text style={styles.liveBadgeSubText}>
        Min {billedMinutes} ({ratePerMinute} c/m)
      </Text>
      {isLowBalance && (
        <View style={styles.lowBalancePill}>
          <Text style={styles.lowBalanceText}>Low Balance</Text>
        </View>
      )}
    </View>
  );
}

/**
 * End-of-Session Financial Receipt Modal
 */
export function PaidSessionReceiptModal({
  visible,
  sessionData,
  onClose,
  onViewTransactions,
}) {
  if (!sessionData) return null;

  const {
    communicationType = 'MESSAGE',
    durationSeconds = 0,
    billedMinutes = 1,
    totalCoinsCharged = 0,
    totalCoinsEarned = 0,
    isInitiator = true,
    counterpartyName = 'Rubaru User',
    endReason = 'NORMAL_COMPLETION',
  } = sessionData;

  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;
  const durationStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const coinsAmount = isInitiator ? totalCoinsCharged : totalCoinsEarned;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.receiptHeader}>
            <View style={styles.receiptCheckCircle}>
              <Ionicons name="checkmark-done" size={32} color="#10B981" />
            </View>
            <Text style={styles.receiptTitle}>Session Completed</Text>
            <Text style={styles.receiptSubtitle}>{communicationType} with {counterpartyName}</Text>
          </View>

          <View style={styles.receiptBody}>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Total Duration</Text>
              <Text style={styles.receiptValue}>{durationStr}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Billed Minutes</Text>
              <Text style={styles.receiptValue}>{billedMinutes} minute{billedMinutes !== 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Ending Reason</Text>
              <Text style={styles.receiptValue}>{endReason}</Text>
            </View>
            <View style={styles.receiptDivider} />
            <View style={styles.receiptRow}>
              <Text style={styles.receiptTotalLabel}>
                {isInitiator ? 'Total Deducted' : 'Total Earned'}
              </Text>
              <Text style={[styles.receiptTotalAmount, isInitiator ? styles.redText : styles.greenText]}>
                {isInitiator ? `-${coinsAmount}` : `+${coinsAmount}`} Coins
              </Text>
            </View>
          </View>

          <View style={styles.receiptActions}>
            {onViewTransactions && (
              <TouchableOpacity
                style={styles.viewTxnBtn}
                activeOpacity={0.7}
                onPress={onViewTransactions}
              >
                <Ionicons name="receipt-outline" size={18} color="#FF2E63" style={{ marginRight: 6 }} />
                <Text style={styles.viewTxnText}>View in Ledger</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.doneBtn} activeOpacity={0.8} onPress={onClose}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1E232B',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A313D',
  },
  headerGradient: {
    padding: 20,
    alignItems: 'center',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  bodyContent: {
    padding: 20,
  },
  rateBox: {
    backgroundColor: '#14181F',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  rateLabel: {
    fontSize: 13,
    color: '#94A3B8',
  },
  rateValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  rateSubValue: {
    fontSize: 12,
    color: '#CBD5E1',
  },
  greenText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  redText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
  balanceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#14181F',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2A313D',
  },
  insufficientBorder: {
    borderColor: '#EF4444',
  },
  balanceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#E2E8F0',
    marginLeft: 8,
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  insufficientText: {
    color: '#EF4444',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  warningText: {
    fontSize: 12,
    color: '#EF4444',
    marginLeft: 8,
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 18,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#2A313D',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#FF2E63',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#475569',
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  liveBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#384252',
    alignSelf: 'center',
    marginVertical: 6,
  },
  lowBalanceGlow: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.2)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  liveBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  liveBadgeDivider: {
    color: '#94A3B8',
    marginHorizontal: 6,
  },
  liveBadgeSubText: {
    fontSize: 12,
    color: '#CBD5E1',
  },
  lowBalancePill: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  lowBalanceText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  receiptHeader: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2A313D',
  },
  receiptCheckCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(16,185,129,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  receiptTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  receiptSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  receiptBody: {
    padding: 20,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  receiptLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  receiptValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  receiptDivider: {
    height: 1,
    backgroundColor: '#2A313D',
    marginVertical: 12,
  },
  receiptTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  receiptTotalAmount: {
    fontSize: 18,
    fontWeight: '800',
  },
  receiptActions: {
    padding: 20,
    paddingTop: 0,
    gap: 10,
  },
  viewTxnBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF2E63',
    backgroundColor: 'rgba(255,46,99,0.08)',
  },
  viewTxnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF2E63',
  },
  doneBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FF2E63',
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
