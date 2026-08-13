import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AIAssistMenu({ visible, onClose, onSelectOption }) {
  if (!visible) return null;

  const handleOptionPress = (optionName) => {
    alert(`AI Assist: "${optionName}" feature coming soon!`);
    onClose();
  };

  return (
    <View style={styles.menuContainer}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={16} color="#5856D6" style={styles.headerIcon} />
        <Text style={styles.headerTitle}>AI Assistant</Text>
      </View>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => handleOptionPress('Improve writing')}
      >
        <Ionicons name="create-outline" size={18} color="#000000" />
        <Text style={styles.itemText}>Improve writing</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => handleOptionPress('Make it funny')}
      >
        <Ionicons name="happy-outline" size={18} color="#000000" />
        <Text style={styles.itemText}>Make it funny</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => handleOptionPress('Translate')}
      >
        <Ionicons name="language-outline" size={18} color="#000000" />
        <Text style={styles.itemText}>Translate...</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.menuItem, styles.lastItem]}
        onPress={() => handleOptionPress('Summarize conversation')}
      >
        <Ionicons name="reader-outline" size={18} color="#000000" />
        <Text style={styles.itemText}>Summarize conversation</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  menuContainer: {
    position: 'absolute',
    bottom: 80, // Sits exactly above the input bar
    right: 16,
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F2F2F7',
  },
  headerIcon: {
    marginRight: 6,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5856D6',
    textTransform: 'uppercase',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F2F2F7',
  },
  lastItem: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  itemText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
  },
});
