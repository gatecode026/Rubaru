import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminPaidService } from '../../services/adminPaidService';
import { lightColors } from '../../theme/colors';

const TABS = [
  { id: 'overview', title: 'Overview', icon: 'stats-chart' },
  { id: 'rates', title: 'Rates & Flags', icon: 'settings' },
  { id: 'sessions', title: 'Live Sessions', icon: 'radio' },
  { id: 'wallets', title: 'Wallets', icon: 'wallet' },
  { id: 'ledger', title: 'Ledger', icon: 'receipt' },
  { id: 'reconciliation', title: 'Reconcile', icon: 'shield-checkmark' },
  { id: 'risk', title: 'Risk & Abuse', icon: 'warning' },
  { id: 'audit', title: 'Audit Trail', icon: 'time' },
];

export default function PaidAdminDashboardScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // State slices
  const [overview, setOverview] = useState(null);
  const [timeframe, setTimeframe] = useState('7d');
  const [ratesData, setRatesData] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [reconciliation, setReconciliation] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);

  // Modals state
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [selectedWalletUserId, setSelectedWalletUserId] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState('CREDIT');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  const [rateEditModalVisible, setRateEditModalVisible] = useState(false);
  const [msgRate, setMsgRate] = useState('1');
  const [audioRate, setAudioRate] = useState('5');
  const [videoRate, setVideoRate] = useState('10');
  const [rateReason, setRateReason] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        const data = await adminPaidService.getOverview({ timeframe });
        setOverview(data);
      } else if (activeTab === 'rates') {
        const data = await adminPaidService.getRates();
        setRatesData(data);
        if (data?.activeConfig?.rates) {
          setMsgRate(String(data.activeConfig.rates.MESSAGE || 1));
          setAudioRate(String(data.activeConfig.rates.AUDIO || 5));
          setVideoRate(String(data.activeConfig.rates.VIDEO || 10));
        }
      } else if (activeTab === 'sessions') {
        const res = await adminPaidService.getSessions({ limit: 30 });
        setSessions(res.data || []);
      } else if (activeTab === 'wallets') {
        const res = await adminPaidService.getWallets({ limit: 30 });
        setWallets(res.data || []);
      } else if (activeTab === 'ledger') {
        const res = await adminPaidService.getLedger({ limit: 30 });
        setLedger(res.data || []);
      } else if (activeTab === 'reconciliation') {
        const data = await adminPaidService.getReconciliation();
        setReconciliation(data);
      } else if (activeTab === 'risk') {
        const data = await adminPaidService.getRiskAlerts();
        setRiskData(data);
      } else if (activeTab === 'audit') {
        const res = await adminPaidService.getAuditLogs({ limit: 30 });
        setAuditLogs(res.data || []);
      }
    } catch (err) {
      Alert.alert('Admin Error', err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, timeframe]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Actions
  const handleEndSession = (sessionId) => {
    Alert.prompt(
      'Terminate Session',
      'Enter reason for administrative session termination:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Terminate',
          style: 'destructive',
          onPress: async (reason) => {
            if (!reason) {
              Alert.alert('Error', 'Reason is required');
              return;
            }
            try {
              await adminPaidService.endSession(sessionId, reason);
              Alert.alert('Success', 'Session ended');
              loadData();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || err.message);
            }
          },
        },
      ]
    );
  };

  const handleFreezeToggle = (userId, currentStatus) => {
    const isFrozen = currentStatus === 'FROZEN';
    const actionName = isFrozen ? 'Unfreeze' : 'Freeze';
    Alert.prompt(
      `${actionName} Wallet`,
      `Enter reason to ${actionName.toLowerCase()} wallet:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionName,
          style: isFrozen ? 'default' : 'destructive',
          onPress: async (reason) => {
            if (!reason) {
              Alert.alert('Error', 'Reason is required');
              return;
            }
            try {
              if (isFrozen) {
                await adminPaidService.unfreezeWallet(userId, reason);
              } else {
                await adminPaidService.freezeWallet(userId, reason);
              }
              Alert.alert('Success', `Wallet ${actionName.toLowerCase()}d`);
              loadData();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || err.message);
            }
          },
        },
      ]
    );
  };

  const handleAdjustSubmit = async () => {
    const amountNum = parseInt(adjustAmount, 10);
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Validation Error', 'Enter a positive integer amount');
      return;
    }
    if (!adjustReason.trim()) {
      Alert.alert('Validation Error', 'Enter a detailed reason');
      return;
    }

    setAdjustSubmitting(true);
    try {
      await adminPaidService.adjustWallet(selectedWalletUserId, {
        amount: amountNum,
        type: adjustType,
        reason: adjustReason.trim(),
      });
      Alert.alert('Success', `Wallet adjusted (${adjustType} ${amountNum} Coins)`);
      setAdjustModalVisible(false);
      setAdjustAmount('');
      setAdjustReason('');
      loadData();
    } catch (err) {
      Alert.alert('Adjustment Failed', err.response?.data?.message || err.message);
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const handleSaveRates = async () => {
    const m = parseInt(msgRate, 10);
    const a = parseInt(audioRate, 10);
    const v = parseInt(videoRate, 10);

    if (!m || !a || !v || m <= 0 || a <= 0 || v <= 0) {
      Alert.alert('Validation Error', 'All rates must be positive non-zero integers');
      return;
    }
    if (!rateReason.trim()) {
      Alert.alert('Validation Error', 'Enter a reason for rate update');
      return;
    }

    try {
      await adminPaidService.updateRates({
        rates: { MESSAGE: m, AUDIO: a, VIDEO: v },
        reason: rateReason.trim(),
      });
      Alert.alert('Success', 'Rates updated successfully');
      setRateEditModalVisible(false);
      setRateReason('');
      loadData();
    } catch (err) {
      Alert.alert('Update Failed', err.response?.data?.message || err.message);
    }
  };

  const handleRunReconciliation = async () => {
    try {
      setLoading(true);
      const res = await adminPaidService.runReconciliation('Admin manual run');
      setReconciliation(res);
      Alert.alert('Reconciliation Completed', `Checked ${res.totalChecked || 0} records. Findings: ${res.issues?.length || 0}`);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack && navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Paid Admin Dashboard</Text>
          <Text style={styles.headerSubtitle}>Authoritative Financial Operations</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={22} color={lightColors.primaryDark} />
        </TouchableOpacity>
      </View>

      {/* Tabs Horizontal Scroll */}
      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={isActive ? '#FFFFFF' : '#6B7280'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.title}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content Area */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={lightColors.primaryDark} />}
      >
        {loading && !refreshing ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={lightColors.primaryDark} />
            <Text style={styles.loaderText}>Loading authoritative database metrics...</Text>
          </View>
        ) : null}

        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && overview ? (
          <View style={styles.section}>
            {/* Timeframe selector */}
            <View style={styles.timeframeRow}>
              {['today', '7d', '30d', 'all'].map((tf) => (
                <TouchableOpacity
                  key={tf}
                  style={[styles.tfBtn, timeframe === tf && styles.tfBtnActive]}
                  onPress={() => setTimeframe(tf)}
                >
                  <Text style={[styles.tfText, timeframe === tf && styles.tfTextActive]}>
                    {tf.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* KPI Cards Grid */}
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <Ionicons name="pulse" size={22} color="#10B981" />
                <Text style={styles.kpiVal}>{overview.activePaidSessions || 0}</Text>
                <Text style={styles.kpiLabel}>Active Sessions</Text>
              </View>

              <View style={styles.kpiCard}>
                <Ionicons name="cash" size={22} color={lightColors.primaryDark} />
                <Text style={styles.kpiVal}>{overview.totalTransferredCoins || 0}</Text>
                <Text style={styles.kpiLabel}>Coins Transferred</Text>
              </View>

              <View style={styles.kpiCard}>
                <Ionicons name="chatbubbles" size={22} color="#3B82F6" />
                <Text style={styles.kpiVal}>{overview.messagingSessions || 0}</Text>
                <Text style={styles.kpiLabel}>Paid Chats (1c/m)</Text>
              </View>

              <View style={styles.kpiCard}>
                <Ionicons name="call" size={22} color="#8B5CF6" />
                <Text style={styles.kpiVal}>{overview.audioCalls || 0}</Text>
                <Text style={styles.kpiLabel}>Voice Calls (5c/m)</Text>
              </View>

              <View style={styles.kpiCard}>
                <Ionicons name="videocam" size={22} color="#EC4899" />
                <Text style={styles.kpiVal}>{overview.videoCalls || 0}</Text>
                <Text style={styles.kpiLabel}>Video Calls (10c/m)</Text>
              </View>

              <View style={styles.kpiCard}>
                <Ionicons name="checkmark-done" size={22} color="#10B981" />
                <Text style={styles.kpiVal}>{overview.connectedSessionRate || 0}%</Text>
                <Text style={styles.kpiLabel}>Connected Rate</Text>
              </View>
            </View>

            {/* Worker Health Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="server" size={20} color="#111827" />
                <Text style={styles.cardTitle}>Background Workers & Health</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.rowLabel}>Billing Worker Engine</Text>
                <Text style={styles.badgeSuccess}>ONLINE</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.rowLabel}>Reconciliation Worker</Text>
                <Text style={styles.badgeSuccess}>ONLINE (300s)</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.rowLabel}>Frozen Wallets</Text>
                <Text style={styles.rowVal}>{overview.frozenWallets || 0}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.rowLabel}>Risk / Fraud Alerts</Text>
                <Text style={styles.rowVal}>{overview.riskFlaggedUsers || 0}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* 2. RATES & FLAGS TAB */}
        {activeTab === 'rates' && ratesData ? (
          <View style={styles.section}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="pricetag" size={20} color={lightColors.primaryDark} />
                <Text style={styles.cardTitle}>Active Rate Snapshot</Text>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => setRateEditModalVisible(true)}
                >
                  <Text style={styles.editBtnText}>Edit Rates</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.rateRow}>
                <Text style={styles.rateType}>Paid Messaging</Text>
                <Text style={styles.rateVal}>{ratesData.activeConfig?.rates?.MESSAGE || 1} Rubaru Coin / min</Text>
              </View>
              <View style={styles.rateRow}>
                <Text style={styles.rateType}>Voice Call</Text>
                <Text style={styles.rateVal}>{ratesData.activeConfig?.rates?.AUDIO || 5} Rubaru Coins / min</Text>
              </View>
              <View style={styles.rateRow}>
                <Text style={styles.rateType}>Video Call</Text>
                <Text style={styles.rateVal}>{ratesData.activeConfig?.rates?.VIDEO || 10} Rubaru Coins / min</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.rowBetween}>
                <Text style={styles.rowLabel}>Config Version</Text>
                <Text style={styles.rowVal}>v{ratesData.activeConfig?.version || 1}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.rowLabel}>Receiver Commission</Text>
                <Text style={styles.badgeSuccess}>0% (100% Earned)</Text>
              </View>
            </View>

            {/* Version History */}
            <Text style={styles.sectionSubtitle}>Configuration Version History</Text>
            {(ratesData.history || []).map((h) => (
              <View key={h._id} style={styles.historyCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.historyTitle}>Version {h.version}</Text>
                  <Text style={h.isActive ? styles.badgeSuccess : styles.badgeInactive}>
                    {h.isActive ? 'ACTIVE' : 'HISTORICAL'}
                  </Text>
                </View>
                <Text style={styles.historyDetail}>
                  Msg: {h.rates?.MESSAGE}c | Audio: {h.rates?.AUDIO}c | Video: {h.rates?.VIDEO}c
                </Text>
                <Text style={styles.historyDate}>{new Date(h.createdAt).toLocaleString()}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* 3. LIVE SESSIONS TAB */}
        {activeTab === 'sessions' ? (
          <View style={styles.section}>
            <Text style={styles.sectionSubtitle}>Active & Recent Sessions ({sessions.length})</Text>
            {sessions.map((s) => (
              <View key={s.sessionId} style={styles.card}>
                <View style={styles.rowBetween}>
                  <View style={styles.sessionTypePill}>
                    <Text style={styles.sessionTypeText}>{s.communicationType}</Text>
                  </View>
                  <Text style={s.status === 'ACTIVE' ? styles.badgeSuccess : styles.badgeInactive}>
                    {s.status}
                  </Text>
                </View>
                <Text style={styles.sessionSubId}>ID: {s.sessionId}</Text>
                <Text style={styles.sessionUser}>Initiator: {s.initiatorId?.email || s.initiatorId?._id || 'User'}</Text>
                <Text style={styles.sessionUser}>Receiver: {s.receiverId?.email || s.receiverId?._id || 'User'}</Text>

                <View style={styles.divider} />
                <View style={styles.rowBetween}>
                  <Text style={styles.rowLabel}>Billed Minutes:</Text>
                  <Text style={styles.rowVal}>{s.billedMinutes || 0} min</Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.rowLabel}>Total Charged:</Text>
                  <Text style={styles.rowValBold}>{s.totalCoinsCharged || 0} Coins</Text>
                </View>

                {['ACTIVE', 'ACCEPTED', 'CONNECTING', 'REQUESTED'].includes(s.status) ? (
                  <TouchableOpacity
                    style={styles.terminateBtn}
                    onPress={() => handleEndSession(s.sessionId)}
                  >
                    <Ionicons name="close-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.terminateBtnText}>Terminate Session</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* 4. WALLETS TAB */}
        {activeTab === 'wallets' ? (
          <View style={styles.section}>
            <Text style={styles.sectionSubtitle}>User Wallets & Balances ({wallets.length})</Text>
            {wallets.map((w) => (
              <View key={w._id} style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.walletUser}>{w.userId?.email || w.userId?._id || 'User'}</Text>
                  <Text style={w.status === 'ACTIVE' ? styles.badgeSuccess : styles.badgeDestructive}>
                    {w.status}
                  </Text>
                </View>
                <Text style={styles.walletBalance}>{w.availableBalance} Coins</Text>
                <Text style={styles.walletStats}>
                  Earned: +{w.lifetimeEarned} | Spent: -{w.lifetimeSpent}
                </Text>

                <View style={styles.walletActionRow}>
                  <TouchableOpacity
                    style={styles.adjustBtn}
                    onPress={() => {
                      setSelectedWalletUserId(w.userId?._id || w.userId);
                      setAdjustModalVisible(true);
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.adjustBtnText}>Manual Adjust</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.freezeBtn, w.status === 'FROZEN' && styles.unfreezeBtn]}
                    onPress={() => handleFreezeToggle(w.userId?._id || w.userId, w.status)}
                  >
                    <Text style={styles.freezeBtnText}>
                      {w.status === 'FROZEN' ? 'Unfreeze' : 'Freeze'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* 5. LEDGER TAB */}
        {activeTab === 'ledger' ? (
          <View style={styles.section}>
            <Text style={styles.sectionSubtitle}>Double-Entry Immutable Ledger ({ledger.length})</Text>
            {ledger.map((e) => (
              <View key={e._id} style={styles.ledgerCard}>
                <View style={styles.rowBetween}>
                  <Text style={e.entryType === 'CREDIT' ? styles.ledgerCredit : styles.ledgerDebit}>
                    {e.entryType === 'CREDIT' ? '+' : '-'}{e.amount} Coins
                  </Text>
                  <Text style={styles.ledgerTxType}>{e.transactionType}</Text>
                </View>
                <Text style={styles.ledgerMeta}>User: {e.userId?.email || e.userId?._id || 'User'}</Text>
                {e.sessionId ? <Text style={styles.ledgerMeta}>Session: {e.sessionId}</Text> : null}
                <Text style={styles.ledgerBalance}>
                  Balance: {e.balanceBefore} → {e.balanceAfter}
                </Text>
                <Text style={styles.ledgerTime}>{new Date(e.createdAt).toLocaleString()}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* 6. RECONCILIATION TAB */}
        {activeTab === 'reconciliation' ? (
          <View style={styles.section}>
            <TouchableOpacity style={styles.runRecBtn} onPress={handleRunReconciliation}>
              <Ionicons name="play" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.runRecBtnText}>Run Reconciliation Audit</Text>
            </TouchableOpacity>

            {reconciliation ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Reconciliation Audit Report</Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.rowLabel}>Status</Text>
                  <Text style={reconciliation.status === 'HEALTHY' ? styles.badgeSuccess : styles.badgeDestructive}>
                    {reconciliation.status || 'HEALTHY'}
                  </Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.rowLabel}>Records Audited</Text>
                  <Text style={styles.rowVal}>{reconciliation.totalChecked || 0}</Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.rowLabel}>Open Inconsistencies</Text>
                  <Text style={styles.rowValBold}>{reconciliation.issues?.length || 0}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* 7. RISK & ABUSE TAB */}
        {activeTab === 'risk' && riskData ? (
          <View style={styles.section}>
            <Text style={styles.sectionSubtitle}>Active Risk Rules & Alerts</Text>
            {(riskData.rules || []).map((r, i) => (
              <View key={i} style={styles.ruleCard}>
                <Ionicons name="shield-checkmark" size={18} color="#10B981" style={{ marginRight: 8 }} />
                <Text style={styles.ruleText}>{r}</Text>
              </View>
            ))}
            <Text style={[styles.sectionSubtitle, { marginTop: 16 }]}>
              Recent Alerts ({riskData.alerts?.length || 0})
            </Text>
            {(riskData.alerts || []).map((a) => (
              <View key={a._id} style={styles.alertCard}>
                <Text style={styles.alertType}>{a.violationType || 'SUSPICIOUS_VELOCITY'}</Text>
                <Text style={styles.alertDetail}>{a.details || a.reason || 'High frequency session requests'}</Text>
                <Text style={styles.alertTime}>{new Date(a.createdAt).toLocaleString()}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* 8. AUDIT TRAIL TAB */}
        {activeTab === 'audit' ? (
          <View style={styles.section}>
            <Text style={styles.sectionSubtitle}>Administrative Audit Trail ({auditLogs.length})</Text>
            {auditLogs.map((log) => (
              <View key={log._id} style={styles.auditCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.auditAction}>{log.action}</Text>
                  <Text style={styles.badgeSuccess}>{log.result || 'SUCCESS'}</Text>
                </View>
                <Text style={styles.auditAdmin}>Admin: {log.adminUserId?.email || 'Admin'}</Text>
                <Text style={styles.auditReason}>Reason: {log.reason || 'No reason specified'}</Text>
                <Text style={styles.auditTime}>{new Date(log.createdAt).toLocaleString()}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Manual Adjustment Modal */}
      <Modal visible={adjustModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Manual Wallet Adjustment</Text>
            <Text style={styles.modalSubtitle}>Creates immutable double-entry ledger trace.</Text>

            <View style={styles.typeSelectorRow}>
              <TouchableOpacity
                style={[styles.typeBtn, adjustType === 'CREDIT' && styles.typeBtnActiveCredit]}
                onPress={() => setAdjustType('CREDIT')}
              >
                <Text style={[styles.typeBtnText, adjustType === 'CREDIT' && styles.typeBtnTextActive]}>
                  CREDIT (+)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, adjustType === 'DEBIT' && styles.typeBtnActiveDebit]}
                onPress={() => setAdjustType('DEBIT')}
              >
                <Text style={[styles.typeBtnText, adjustType === 'DEBIT' && styles.typeBtnTextActive]}>
                  DEBIT (-)
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Amount (Rubaru Coins)</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              placeholder="e.g. 50"
              value={adjustAmount}
              onChangeText={setAdjustAmount}
            />

            <Text style={styles.inputLabel}>Reason (Required for Audit)</Text>
            <TextInput
              style={[styles.modalInput, { height: 70 }]}
              multiline
              placeholder="Detailed reason for administrative adjustment..."
              value={adjustReason}
              onChangeText={setAdjustReason}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setAdjustModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                disabled={adjustSubmitting}
                onPress={handleAdjustSubmit}
              >
                {adjustSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Apply Adjustment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Rates Modal */}
      <Modal visible={rateEditModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Update Communication Rates</Text>
            <Text style={styles.modalSubtitle}>Creates a new version; active sessions retain snapshot.</Text>

            <Text style={styles.inputLabel}>Paid Messaging Rate (Coins/min)</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              value={msgRate}
              onChangeText={setMsgRate}
            />

            <Text style={styles.inputLabel}>Voice Call Rate (Coins/min)</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              value={audioRate}
              onChangeText={setAudioRate}
            />

            <Text style={styles.inputLabel}>Video Call Rate (Coins/min)</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              value={videoRate}
              onChangeText={setVideoRate}
            />

            <Text style={styles.inputLabel}>Reason for Rate Change</Text>
            <TextInput
              style={[styles.modalInput, { height: 60 }]}
              multiline
              placeholder="e.g. PC-08 production launch rates alignment"
              value={rateReason}
              onChangeText={setRateReason}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRateEditModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSaveRates}>
                <Text style={styles.modalSubmitText}>Save New Version</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  refreshBtn: {
    padding: 6,
  },
  tabsWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabsScroll: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  tabBtnActive: {
    backgroundColor: lightColors.primaryDark,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loaderContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
  },
  section: {
    marginBottom: 20,
  },
  sectionSubtitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  timeframeRow: {
    flexDirection: 'row',
    marginBottom: 14,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    padding: 2,
  },
  tfBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  tfBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  tfText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  tfTextActive: {
    color: lightColors.primaryDark,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiVal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginTop: 6,
  },
  kpiLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginLeft: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  rowLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  rowVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  rowValBold: {
    fontSize: 14,
    fontWeight: '800',
    color: lightColors.primaryDark,
  },
  badgeSuccess: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeInactive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeDestructive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rateType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  rateVal: {
    fontSize: 14,
    fontWeight: '700',
    color: lightColors.primaryDark,
  },
  editBtn: {
    backgroundColor: lightColors.primaryDark,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  editBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 10,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  historyDetail: {
    fontSize: 12,
    color: '#4B5563',
    marginVertical: 2,
  },
  historyDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  sessionTypePill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sessionTypeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  sessionSubId: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  sessionUser: {
    fontSize: 13,
    color: '#374151',
    marginTop: 2,
  },
  terminateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  terminateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  walletUser: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  walletBalance: {
    fontSize: 20,
    fontWeight: '800',
    color: lightColors.primaryDark,
    marginTop: 4,
  },
  walletStats: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  walletActionRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  adjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  adjustBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  freezeBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  unfreezeBtn: {
    backgroundColor: '#D1FAE5',
  },
  freezeBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
  ledgerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  ledgerCredit: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
  },
  ledgerDebit: {
    fontSize: 16,
    fontWeight: '800',
    color: '#DC2626',
  },
  ledgerTxType: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ledgerMeta: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 2,
  },
  ledgerBalance: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    marginTop: 4,
  },
  ledgerTime: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  runRecBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lightColors.primaryDark,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  runRecBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  ruleText: {
    fontSize: 13,
    color: '#374151',
  },
  alertCard: {
    backgroundColor: '#FFF1F2',
    borderLeftWidth: 4,
    borderLeftColor: '#F43F5E',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  alertType: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9F1239',
  },
  alertDetail: {
    fontSize: 12,
    color: '#881337',
    marginVertical: 2,
  },
  alertTime: {
    fontSize: 10,
    color: '#BE123C',
  },
  auditCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  auditAction: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  auditAdmin: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 2,
  },
  auditReason: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  auditTime: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 14,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginRight: 6,
  },
  typeBtnActiveCredit: {
    backgroundColor: '#10B981',
  },
  typeBtnActiveDebit: {
    backgroundColor: '#DC2626',
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  typeBtnTextActive: {
    color: '#FFFFFF',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#111827',
    marginBottom: 12,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalSubmitBtn: {
    backgroundColor: lightColors.primaryDark,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalSubmitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
