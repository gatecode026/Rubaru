import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLanguage } from '../../localization/LanguageContext';

export default function SegmentedTabs({ onTabChange }) {
  const [activeTab, setActiveTab] = useState('friends'); // 'friends' | 'partners'
  const { t } = useLanguage();

  const handlePress = (tabKey) => {
    setActiveTab(tabKey);
    if (onTabChange) onTabChange(tabKey);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'friends' && styles.activeTab]}
        activeOpacity={0.8}
        onPress={() => handlePress('friends')}
      >
        <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
          {t('makeFriends', 'Make Friends')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'partners' && styles.activeTab]}
        activeOpacity={0.8}
        onPress={() => handlePress('partners')}
      >
        <Text style={[styles.tabText, activeTab === 'partners' && styles.activeTabText]}>
          {t('searchPartners', 'Search Partners')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#F4E5EB', // Soft pinkish-gray pill track matching reference image
    borderRadius: 26,
    padding: 4,
    marginHorizontal: 20,
    marginVertical: 14,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6A4A58',
  },
  activeTabText: {
    fontWeight: '800',
    color: '#3B1A28',
  },
});
