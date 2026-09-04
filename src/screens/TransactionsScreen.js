import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Pressable,
  StatusBar,
  Share,
  Platform,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { usePointsStore } from '../store/pointsStore';

const CATEGORY_TABS = [
  { id: 'all', label: 'All' },
  { id: 'purchase', label: 'Purchases (₹)' },
  { id: 'usage', label: 'Spent (Points)' },
  { id: 'reward', label: 'Rewards & Gifts' },
  { id: 'withdrawal', label: 'Withdrawals' },
];

const FAKE_TRANSACTIONS = [
  {
    id: 'TXN-849201948',
    title: '500 Points Package',
    subtitle: 'Google Pay • UPI',
    category: 'purchase',
    type: 'credit',
    points: '+500',
    amount: '₹ 329.00',
    date: 'Today, 11:42 AM',
    timestamp: '18 Aug 2026, 11:42:15 AM',
    status: 'Completed',
    statusColor: '#10B981',
    icon: 'wallet-outline',
    iconColor: '#10B981',
    iconBg: '#ECFDF5',
    referenceNo: 'UPI/623198421094/PAY',
    tax: '₹ 29.61 (18% GST)',
  },
  {
    id: 'TXN-849182390',
    title: 'Profile Boost (1 Hour)',
    subtitle: 'Increased profile visibility 5x',
    category: 'usage',
    type: 'debit',
    points: '-50',
    amount: '50 Points',
    date: 'Today, 09:15 AM',
    timestamp: '18 Aug 2026, 09:15:02 AM',
    status: 'Completed',
    statusColor: '#10B981',
    icon: 'rocket-outline',
    iconColor: '#EF4444',
    iconBg: '#FEF2F2',
    referenceNo: 'BOOST/INT-98421',
  },
  {
    id: 'TXN-848729103',
    title: 'Super Like to Priya',
    subtitle: 'Priority Match Interaction',
    category: 'usage',
    type: 'debit',
    points: '-30',
    amount: '30 Points',
    date: 'Yesterday, 08:30 PM',
    timestamp: '17 Aug 2026, 08:30:44 PM',
    status: 'Completed',
    statusColor: '#10B981',
    icon: 'star-outline',
    iconColor: '#F59E0B',
    iconBg: '#FFFBEB',
    referenceNo: 'SLIKE/USR-77291',
  },
  {
    id: 'TXN-848201938',
    title: 'Daily Check-in Bonus (Day 5)',
    subtitle: 'Streak rewards earned',
    category: 'reward',
    type: 'credit',
    points: '+25',
    amount: '25 Points',
    date: 'Yesterday, 09:00 AM',
    timestamp: '17 Aug 2026, 09:00:10 AM',
    status: 'Completed',
    statusColor: '#10B981',
    icon: 'flame-outline',
    iconColor: '#FF2E63',
    iconBg: '#FFF1F2',
    referenceNo: 'REWARD/STRK-05',
  },
  {
    id: 'TXN-847291094',
    title: 'Like Sent to Ananya',
    subtitle: 'Connection Request',
    category: 'usage',
    type: 'debit',
    points: '-10',
    amount: '10 Points',
    date: '16 Aug 2026, 06:22 PM',
    timestamp: '16 Aug 2026, 06:22:18 PM',
    status: 'Completed',
    statusColor: '#10B981',
    icon: 'heart-outline',
    iconColor: '#EC4899',
    iconBg: '#FDF2F8',
    referenceNo: 'LIKE/USR-88219',
  },
  {
    id: 'TXN-846182903',
    title: 'Direct Chat Message Unlock',
    subtitle: 'Message sent before match',
    category: 'usage',
    type: 'debit',
    points: '-20',
    amount: '20 Points',
    date: '15 Aug 2026, 11:05 PM',
    timestamp: '15 Aug 2026, 11:05:33 PM',
    status: 'Completed',
    statusColor: '#10B981',
    icon: 'chatbubble-ellipses-outline',
    iconColor: '#8B5CF6',
    iconBg: '#F5F3FF',
    referenceNo: 'CHAT/UNLK-4921',
  },
  {
    id: 'TXN-845920193',
    title: '250 Points Package',
    subtitle: 'PhonePe • UPI',
    category: 'purchase',
    type: 'credit',
    points: '+250',
    amount: '₹ 179.00',
    date: '14 Aug 2026, 04:45 PM',
    timestamp: '14 Aug 2026, 04:45:50 PM',
    status: 'Completed',
    statusColor: '#10B981',
    icon: 'wallet-outline',
    iconColor: '#10B981',
    iconBg: '#ECFDF5',
    referenceNo: 'UPI/992182736192/PHONEPE',
    tax: '₹ 16.11 (18% GST)',
  },
  {
    id: 'TXN-843920184',
    title: 'Live Stream Gift Received',
    subtitle: 'Gift from @rohit_kumar',
    category: 'reward',
    type: 'credit',
    points: '+100',
    amount: '100 Points',
    date: '12 Aug 2026, 09:30 PM',
    timestamp: '12 Aug 2026, 09:30:12 PM',
    status: 'Completed',
    statusColor: '#10B981',
    icon: 'gift-outline',
    iconColor: '#8B5CF6',
    iconBg: '#F5F3FF',
    referenceNo: 'GIFT/LIVESTREAM-102',
  },
  {
    id: 'TXN-841920384',
    title: 'Rubaru Premium (1 Month)',
    subtitle: 'Unlimited swipes, see who liked you',
    category: 'usage',
    type: 'debit',
    points: '-100',
    amount: '100 Points',
    date: '10 Aug 2026, 01:10 PM',
    timestamp: '10 Aug 2026, 01:10:05 PM',
    status: 'Completed',
    statusColor: '#10B981',
    icon: 'diamond-outline',
    iconColor: '#3B82F6',
    iconBg: '#EFF6FF',
    referenceNo: 'SUB/PREM-30DAYS',
  },
  {
    id: 'TXN-839201948',
    title: 'Referral Bonus (Friend Joined)',
    subtitle: 'Joined via invite link',
    category: 'reward',
    type: 'credit',
    points: '+150',
    amount: '150 Points',
    date: '08 Aug 2026, 05:20 PM',
    timestamp: '08 Aug 2026, 05:20:00 PM',
    status: 'Completed',
    statusColor: '#10B981',
    icon: 'people-outline',
    iconColor: '#10B981',
    iconBg: '#ECFDF5',
    referenceNo: 'REF/BONUS-INVITE',
  },
  {
    id: 'TXN-836192834',
    title: '100 Points Package (Failed)',
    subtitle: 'HDFC Bank Debit Card ****4281',
    category: 'purchase',
    type: 'failed',
    points: '0',
    amount: '₹ 79.00',
    date: '05 Aug 2026, 10:15 AM',
    timestamp: '05 Aug 2026, 10:15:22 AM',
    status: 'Failed',
    statusColor: '#EF4444',
    icon: 'alert-circle-outline',
    iconColor: '#EF4444',
    iconBg: '#FEF2F2',
    referenceNo: 'CARD/DECLINED-AUTH',
  },
  {
    id: 'TXN-836199999',
    title: 'Refund for Failed Purchase',
    subtitle: 'Auto-refund credited to bank',
    category: 'purchase',
    type: 'credit',
    points: 'Refunded',
    amount: '₹ 79.00',
    date: '05 Aug 2026, 10:30 AM',
    timestamp: '05 Aug 2026, 10:30:10 AM',
    status: 'Refunded',
    statusColor: '#3B82F6',
    icon: 'refresh-outline',
    iconColor: '#3B82F6',
    iconBg: '#EFF6FF',
    referenceNo: 'RFND/HDFC-AUTO-892',
  },
  {
    id: 'TXN-832109485',
    title: 'Gifts Cash-Out Withdrawal',
    subtitle: 'Transferred to UPI: user@okhdfc',
    category: 'withdrawal',
    type: 'debit',
    points: '-500',
    amount: '₹ 500.00',
    date: '01 Aug 2026, 02:00 PM',
    timestamp: '01 Aug 2026, 02:00:19 PM',
    status: 'Completed',
    statusColor: '#10B981',
    icon: 'cash-outline',
    iconColor: '#10B981',
    iconBg: '#ECFDF5',
    referenceNo: 'PAYOUT/IMPS-984210',
  },
];

export default function TransactionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const balance = usePointsStore((state) => state.balance);
  const fetchBalance = usePointsStore((state) => state.fetchBalance);

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/v1/wallet/transactions');
      if (res.data && res.data.ok && Array.isArray(res.data.data)) {
        const mapped = res.data.data.map((txn) => {
          const isCredit = txn.entryType === 'CREDIT';
          const title = txn.communicationType
            ? `${txn.communicationType} with ${txn.counterparty?.displayName || 'Rubaru User'}`
            : (txn.transactionType === 'INITIAL_MIGRATION' ? 'Initial Migrated Balance' : 'Wallet Transfer');
          const subtitle = txn.minuteIndex
            ? `Minute ${txn.minuteIndex} • ${isCredit ? 'Coins Earned' : 'Coins Deducted'}`
            : (txn.transactionType || 'Account Adjustment');

          const icon = txn.communicationType === 'VIDEO'
            ? 'videocam-outline'
            : (txn.communicationType === 'AUDIO'
              ? 'call-outline'
              : (txn.communicationType === 'MESSAGE' ? 'chatbubble-ellipses-outline' : 'wallet-outline'));

          const iconColor = isCredit ? '#10B981' : '#EF4444';
          const iconBg = isCredit ? '#ECFDF5' : '#FEF2F2';

          const createdDate = new Date(txn.createdAt);
          const dateStr = createdDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          const timeStr = createdDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

          return {
            id: txn.transactionId,
            sessionId: txn.sessionId,
            title,
            subtitle,
            category: isCredit ? 'reward' : 'usage',
            type: isCredit ? 'credit' : 'debit',
            points: `${isCredit ? '+' : '-'}${txn.amount}`,
            amount: `${txn.amount} Coins`,
            date: dateStr,
            timestamp: `${dateStr}, ${timeStr}`,
            status: 'Completed',
            statusColor: '#10B981',
            icon,
            iconColor,
            iconBg,
            referenceNo: `TXN-${txn.transactionId.substring(0, 12).toUpperCase()}`,
            counterparty: txn.counterparty,
            balanceBefore: txn.balanceBefore,
            balanceAfter: txn.balanceAfter,
          };
        });
        setTransactions(mapped);
      }
    } catch (err) {
      console.warn('[TRANSACTIONS SCREEN] Error loading transactions:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
    if (fetchBalance) fetchBalance();
  }, []);

  const handleBack = () => {
    if (selectedTxn) {
      setSelectedTxn(null);
      return;
    }
    if (params?.from === 'my-points') {
      router.push('/my-points');
      return;
    }
    if (params?.from === 'sidebar') {
      router.push('/user-profile?openSettings=true');
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/my-points');
    }
  };

  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [selectedTxn, showSearchBar, params, router]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((txn) => {
      const matchesTab = activeTab === 'all' || txn.category === activeTab;
      const matchesSearch =
        txn.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        txn.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        txn.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [transactions, activeTab, searchQuery]);

  const handleShareReceipt = async (txn) => {
    try {
      await Share.share({
        message: `Rubaru Transaction Receipt\nID: ${txn.id}\nItem: ${txn.title}\nAmount: ${txn.amount}\nDate: ${txn.timestamp}\nStatus: ${txn.status}`,
      });
    } catch (e) {
      console.log('Share error', e);
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Transactions</Text>

        <View style={styles.headerRightRow}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setShowSearchBar(!showSearchBar)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showSearchBar ? 'close' : 'search-outline'}
              size={20}
              color="#374151"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => showToast('Statement exported to Downloads (PDF)')}
            activeOpacity={0.7}
          >
            <Ionicons name="download-outline" size={20} color="#374151" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Expandable Search Input */}
      {showSearchBar && (
        <View style={styles.searchBarWrapper}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search by name, ID (e.g. TXN-849)..."
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Balance & Summary Card */}
        <LinearGradient
          colors={['#FF527B', '#FF2E63']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceSummaryCard}
        >
          <View style={styles.balanceCardTopRow}>
            <View>
              <Text style={styles.balanceLabelText}>Current Balance</Text>
              <View style={styles.balanceValueRow}>
                <Ionicons name="heart" size={22} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.balanceValueText}>{balance}</Text>
                <Text style={styles.balanceUnitText}>Points</Text>
              </View>
              <Text style={styles.balanceEquivalentText}>≈ ₹{(balance * 0.79).toFixed(2)} Estimated Value</Text>
            </View>

            <TouchableOpacity
              style={styles.addPointsBtn}
              activeOpacity={0.85}
              onPress={() => router.push('/buy-points')}
            >
              <Ionicons name="add-circle" size={18} color="#FF2E63" style={{ marginRight: 4 }} />
              <Text style={styles.addPointsBtnText}>Buy Points</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Metrics Bar */}
          <View style={styles.metricsDivider} />
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Total Spent</Text>
              <Text style={styles.metricValue}>-310 pts</Text>
            </View>
            <View style={styles.metricSeparator} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Earned</Text>
              <Text style={styles.metricValue}>+275 pts</Text>
            </View>
            <View style={styles.metricSeparator} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Purchases</Text>
              <Text style={styles.metricValue}>₹ 508.00</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Filter Tabs */}
        <View style={styles.tabsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsScrollContent}
          >
            {CATEGORY_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.filterTab, isActive && styles.filterTabActive]}
                  onPress={() => setActiveTab(tab.id)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      isActive && styles.filterTabTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Transaction Count Row */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderText}>
            Activity History ({filteredTransactions.length})
          </Text>
          <Text style={styles.sectionSubText}>Tap for receipt</Text>
        </View>

        {/* Transactions List */}
        {filteredTransactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={54} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Transactions Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try a different search keyword'
                : 'No transaction activity in this category yet.'}
            </Text>
          </View>
        ) : (
          <View style={styles.transactionsCard}>
            {filteredTransactions.map((txn, index) => {
              const isLast = index === filteredTransactions.length - 1;
              const isCredit = txn.type === 'credit';
              const isFailed = txn.type === 'failed';

              return (
                <TouchableOpacity
                  key={txn.id}
                  style={[styles.txnRow, !isLast && styles.txnRowBorder]}
                  activeOpacity={0.7}
                  onPress={() => setSelectedTxn(txn)}
                >
                  {/* Icon */}
                  <View style={[styles.txnIconWrap, { backgroundColor: txn.iconBg }]}>
                    <Ionicons name={txn.icon} size={22} color={txn.iconColor} />
                  </View>

                  {/* Title & Date */}
                  <View style={styles.txnCenterCol}>
                    <Text style={styles.txnTitle} numberOfLines={1}>
                      {txn.title}
                    </Text>
                    <Text style={styles.txnDate}>{txn.date}</Text>
                    <Text style={styles.txnSubtitle} numberOfLines={1}>
                      {txn.subtitle}
                    </Text>
                  </View>

                  {/* Amount & Status Badge */}
                  <View style={styles.txnRightCol}>
                    <Text
                      style={[
                        styles.txnAmountText,
                        isCredit && styles.txnAmountCredit,
                        isFailed && styles.txnAmountFailed,
                      ]}
                    >
                      {txn.amount}
                    </Text>

                    {txn.points !== '0' && txn.points !== 'Refunded' && (
                      <View style={styles.pointsBadgeWrap}>
                        <Ionicons
                          name="heart"
                          size={11}
                          color={isCredit ? '#10B981' : '#EF4444'}
                          style={{ marginRight: 3 }}
                        />
                        <Text
                          style={[
                            styles.pointsBadgeText,
                            { color: isCredit ? '#10B981' : '#EF4444' },
                          ]}
                        >
                          {txn.points}
                        </Text>
                      </View>
                    )}

                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: `${txn.statusColor}15` },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: txn.statusColor },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusPillText,
                          { color: txn.statusColor },
                        ]}
                      >
                        {txn.status}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Transaction Details / Receipt Modal */}
      <Modal
        visible={!!selectedTxn}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedTxn(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setSelectedTxn(null)}
          />

          {selectedTxn && (
            <View style={styles.receiptSheet}>
              <View style={styles.dragHandle} />

              <View style={styles.receiptHeaderRow}>
                <Text style={styles.receiptModalTitle}>Transaction Receipt</Text>
                <TouchableOpacity
                  onPress={() => setSelectedTxn(null)}
                  style={styles.closeReceiptBtn}
                >
                  <Ionicons name="close" size={20} color="#4B5563" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.receiptScroll}
              >
                {/* Top Status Icon & Amount */}
                <View style={styles.receiptHero}>
                  <View
                    style={[
                      styles.receiptBigIconWrap,
                      { backgroundColor: selectedTxn.iconBg },
                    ]}
                  >
                    <Ionicons
                      name={selectedTxn.icon}
                      size={36}
                      color={selectedTxn.iconColor}
                    />
                  </View>
                  <Text style={styles.receiptHeroAmount}>
                    {selectedTxn.amount}
                  </Text>
                  <Text style={styles.receiptHeroTitle}>
                    {selectedTxn.title}
                  </Text>

                  <View
                    style={[
                      styles.receiptStatusBadge,
                      { backgroundColor: `${selectedTxn.statusColor}15` },
                    ]}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={15}
                      color={selectedTxn.statusColor}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        styles.receiptStatusText,
                        { color: selectedTxn.statusColor },
                      ]}
                    >
                      {selectedTxn.status}
                    </Text>
                  </View>
                </View>

                {/* Details Card */}
                <View style={styles.receiptDetailsBox}>
                  <View style={styles.receiptFieldRow}>
                    <Text style={styles.receiptFieldLabel}>Transaction ID</Text>
                    <TouchableOpacity
                      style={styles.copyIdRow}
                      onPress={() => showToast(`Copied ID: ${selectedTxn.id}`)}
                    >
                      <Text style={styles.receiptFieldValueBold}>
                        {selectedTxn.id}
                      </Text>
                      <Ionicons
                        name="copy-outline"
                        size={14}
                        color="#FF2E63"
                        style={{ marginLeft: 5 }}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.receiptFieldDivider} />

                  <View style={styles.receiptFieldRow}>
                    <Text style={styles.receiptFieldLabel}>Date & Time</Text>
                    <Text style={styles.receiptFieldValue}>
                      {selectedTxn.timestamp}
                    </Text>
                  </View>

                  <View style={styles.receiptFieldDivider} />

                  <View style={styles.receiptFieldRow}>
                    <Text style={styles.receiptFieldLabel}>Payment Method</Text>
                    <Text style={styles.receiptFieldValue}>
                      {selectedTxn.subtitle}
                    </Text>
                  </View>

                  {selectedTxn.tax && (
                    <>
                      <View style={styles.receiptFieldDivider} />
                      <View style={styles.receiptFieldRow}>
                        <Text style={styles.receiptFieldLabel}>GST / Tax</Text>
                        <Text style={styles.receiptFieldValue}>
                          {selectedTxn.tax}
                        </Text>
                      </View>
                    </>
                  )}

                  <View style={styles.receiptFieldDivider} />

                  <View style={styles.receiptFieldRow}>
                    <Text style={styles.receiptFieldLabel}>Reference ID</Text>
                    <Text style={styles.receiptFieldValue}>
                      {selectedTxn.referenceNo}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons in Receipt */}
                <View style={styles.receiptActionsRow}>
                  <TouchableOpacity
                    style={styles.receiptSecondaryBtn}
                    onPress={() => handleShareReceipt(selectedTxn)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="share-social-outline"
                      size={18}
                      color="#374151"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.receiptSecondaryBtnText}>Share</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.receiptPrimaryBtn}
                    onPress={() => {
                      showToast('Receipt downloaded successfully');
                    }}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['#FF527B', '#FF2E63']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.receiptPrimaryGradient}
                    >
                      <Ionicons
                        name="download"
                        size={18}
                        color="#FFFFFF"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.receiptPrimaryBtnText}>Download PDF</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                {/* Report Issue Button */}
                <TouchableOpacity
                  style={styles.reportIssueBtn}
                  activeOpacity={0.75}
                  onPress={() => {
                    const id = selectedTxn.id;
                    setSelectedTxn(null);
                    router.push('/report-problem');
                  }}
                >
                  <Ionicons
                    name="chatbox-ellipses-outline"
                    size={16}
                    color="#6B7280"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.reportIssueText}>
                    Have a problem with this transaction? Contact Support
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>

      {/* Floating Toast Notification */}
      {toastMessage.length > 0 && (
        <View style={styles.toastContainer}>
          <Ionicons
            name="checkmark-circle"
            size={18}
            color="#FFFFFF"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.3,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBarWrapper: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 0,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  balanceSummaryCard: {
    borderRadius: 22,
    padding: 18,
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 16,
  },
  balanceCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  balanceLabelText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 4,
  },
  balanceValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceValueText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginRight: 6,
  },
  balanceUnitText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 6,
  },
  balanceEquivalentText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  addPointsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addPointsBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FF2E63',
  },
  metricsDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.75)',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  metricSeparator: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  tabsContainer: {
    marginBottom: 16,
  },
  tabsScrollContent: {
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterTabActive: {
    backgroundColor: '#FF2E63',
    borderColor: '#FF2E63',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  sectionSubText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  transactionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  txnRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  txnIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txnCenterCol: {
    flex: 1,
    marginRight: 8,
  },
  txnTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  txnDate: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
    marginBottom: 2,
  },
  txnSubtitle: {
    fontSize: 11,
    color: '#6B7280',
  },
  txnRightCol: {
    alignItems: 'flex-end',
  },
  txnAmountText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 3,
  },
  txnAmountCredit: {
    color: '#10B981',
  },
  txnAmountFailed: {
    color: '#EF4444',
    textDecorationLine: 'line-through',
  },
  pointsBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  pointsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 30,
  },

  /* ----------------- Modal / Receipt Styles ----------------- */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
  },
  receiptSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 8,
  },
  receiptHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  receiptModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  closeReceiptBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptScroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  receiptHero: {
    alignItems: 'center',
    marginBottom: 20,
  },
  receiptBigIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  receiptHeroAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 4,
  },
  receiptHeroTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 10,
  },
  receiptStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  receiptStatusText: {
    fontSize: 13,
    fontWeight: '800',
  },
  receiptDetailsBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },
  receiptFieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  receiptFieldDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 6,
  },
  receiptFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  receiptFieldValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  receiptFieldValueBold: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  copyIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  receiptActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  receiptSecondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptSecondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  receiptPrimaryBtn: {
    flex: 1.6,
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
  },
  receiptPrimaryGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  reportIssueBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  reportIssueText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },

  /* ----------------- Floating Toast ----------------- */
  toastContainer: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: '#1F2937',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
});
