import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

export default function CreatePollModal({ visible, onClose, onCreatePoll }) {
  const { isDarkMode, colors } = useTheme();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  const handleAddOption = () => {
    if (options.length >= 8) {
      alert('Maximum 8 options allowed per poll');
      return;
    }
    setOptions([...options, '']);
  };

  const handleOptionChange = (text, index) => {
    const updated = [...options];
    updated[index] = text;
    setOptions(updated);
  };

  const handleRemoveOption = (index) => {
    if (options.length <= 2) {
      alert('Polls must have at least 2 options');
      return;
    }
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (question.trim() === '') {
      alert('Please enter a poll question');
      return;
    }
    const validOptions = options.filter((o) => o.trim() !== '');
    if (validOptions.length < 2) {
      alert('Please provide at least 2 options for your poll');
      return;
    }

    const pollData = {
      question: question.trim(),
      options: validOptions.map((optLabel, i) => ({
        id: `opt-created-${Date.now()}-${i}`,
        label: optLabel.trim(),
        votes: 0,
        voters: [],
        isSelected: false,
      })),
    };

    onCreatePoll(pollData);
    // Reset state and close
    setQuestion('');
    setOptions(['', '']);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={[
                styles.sheetContainer,
                {
                  backgroundColor: colors.surface || (isDarkMode ? '#1E1E22' : '#FFFFFF'),
                },
              ]}
            >
              <View style={[styles.dragHandle, { backgroundColor: isDarkMode ? '#3F3F46' : '#E5E5EA' }]} />

              <View style={styles.headerRow}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Create Poll</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
                {/* Question Input */}
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Question</Text>
                <TextInput
                  placeholder="Ask a question..."
                  placeholderTextColor={colors.inputPlaceholder}
                  style={[
                    styles.questionInput,
                    {
                      backgroundColor: isDarkMode ? '#27272A' : '#F2F2F7',
                      color: colors.textPrimary,
                    },
                  ]}
                  value={question}
                  onChangeText={setQuestion}
                  multiline
                />

                {/* Options List */}
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Options</Text>
                {options.map((option, index) => (
                  <View
                    key={index}
                    style={[
                      styles.optionRow,
                      { backgroundColor: isDarkMode ? '#27272A' : '#F2F2F7' },
                    ]}
                  >
                    <Ionicons name="menu" size={20} color={colors.textMuted} style={styles.dragIcon} />
                    <TextInput
                      placeholder={`Option ${index + 1}`}
                      placeholderTextColor={colors.inputPlaceholder}
                      style={[styles.optionInput, { color: colors.textPrimary }]}
                      value={option}
                      onChangeText={(text) => handleOptionChange(text, index)}
                    />
                    {options.length > 2 && (
                      <TouchableOpacity onPress={() => handleRemoveOption(index)} style={styles.removeBtn}>
                        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                {/* Add Option Button */}
                <TouchableOpacity style={styles.addOptionBtn} onPress={handleAddOption}>
                  <Ionicons name="add" size={20} color="#FF2E63" />
                  <Text style={[styles.addOptionText, { color: '#FF2E63' }]}>Add Option</Text>
                </TouchableOpacity>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    {
                      backgroundColor: isDarkMode ? '#121212' : '#FF2E63',
                      borderWidth: isDarkMode ? 1 : 0,
                      borderColor: isDarkMode ? '#FF2E63' : 'transparent',
                    },
                  ]}
                  onPress={handleSubmit}
                  activeOpacity={0.8}
                >
                  <Text style={styles.submitBtnText}>Create Poll</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
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
    maxHeight: '85%',
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  closeBtn: {
    padding: 4,
  },
  scrollBody: {
    paddingBottom: 40,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 8,
  },
  questionInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#000000',
    marginBottom: 16,
    minHeight: 48,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
    height: 48,
  },
  dragIcon: {
    marginRight: 8,
  },
  optionInput: {
    flex: 1,
    fontSize: 15,
    color: '#000000',
  },
  removeBtn: {
    padding: 6,
  },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 24,
  },
  addOptionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF2E63',
    marginLeft: 4,
  },
  submitBtn: {
    backgroundColor: '#FF2E63',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
