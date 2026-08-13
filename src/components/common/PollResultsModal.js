import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PollResultsModal({ visible, onClose, poll }) {
  const [selectedTab, setSelectedTab] = useState('all');

  if (!poll) return null;

  const { question, options = [] } = poll;

  // Aggregate all voters across options
  let allVoters = [];
  options.forEach((opt) => {
    (opt.voters || []).forEach((voter) => {
      allVoters.push({ ...voter, optionLabel: opt.label });
    });
  });

  const activeVoters =
    selectedTab === 'all'
      ? allVoters
      : allVoters.filter((v) => v.optionLabel === selectedTab);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              <View style={styles.dragHandle} />

              <View style={styles.headerRow}>
                <Text style={styles.questionText} numberOfLines={2}>
                  {question}
                </Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color="#8E8E93" />
                </TouchableOpacity>
              </View>

              {/* Tabs */}
              <View style={styles.tabsContainer}>
                <TouchableOpacity
                  style={[styles.tab, selectedTab === 'all' && styles.activeTab]}
                  onPress={() => setSelectedTab('all')}
                >
                  <Text style={[styles.tabText, selectedTab === 'all' && styles.activeTabText]}>
                    All ({allVoters.length})
                  </Text>
                </TouchableOpacity>
                {options.map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.tab, selectedTab === opt.label && styles.activeTab]}
                    onPress={() => setSelectedTab(opt.label)}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        selectedTab === opt.label && styles.activeTabText,
                      ]}
                    >
                      {opt.label.split(' ')[0]} ({opt.voters ? opt.voters.length : 0})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Voter list */}
              <FlatList
                data={activeVoters}
                keyExtractor={(item, index) => `${item.id}-${index}`}
                renderItem={({ item }) => (
                  <View style={styles.voterRow}>
                    <Image source={{ uri: item.avatarUri }} style={styles.voterAvatar} />
                    <View style={styles.voterMeta}>
                      <Text style={styles.voterName}>{item.name}</Text>
                      <Text style={styles.voterOption}>{item.optionLabel}</Text>
                    </View>
                  </View>
                )}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No votes yet for this option</Text>
                  </View>
                }
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: SCREEN_HEIGHT * 0.55,
    paddingTop: 12,
    paddingHorizontal: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E5EA',
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  questionText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
    marginRight: 12,
  },
  closeBtn: {
    padding: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
    marginBottom: 12,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#000000',
  },
  tabText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#000000',
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 24,
  },
  voterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F2F2F7',
  },
  voterAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#E1E1E1',
  },
  voterMeta: {
    flex: 1,
  },
  voterName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  voterOption: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
  },
});
