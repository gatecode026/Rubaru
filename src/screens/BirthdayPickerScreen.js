import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  Dimensions,
  ScrollView,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function BirthdayPickerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [selectedYear, setSelectedYear] = useState(1995);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(6); // July (0-indexed)
  const [selectedDay, setSelectedDay] = useState(11);
  const [showYearModal, setShowYearModal] = useState(false);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Years list for selection (1940 - 2026)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 87 }, (_, i) => currentYear - i);

  // Get total days in currently selected month and year
  const daysInMonthCount = new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
  // Get starting day index of week (0 = Sun, 1 = Mon...)
  const firstDayOfWeek = new Date(selectedYear, selectedMonthIndex, 1).getDay();

  const handlePrevMonth = () => {
    if (selectedMonthIndex === 0) {
      setSelectedMonthIndex(11);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonthIndex((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonthIndex === 11) {
      setSelectedMonthIndex(0);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonthIndex((prev) => prev + 1);
    }
  };

  const handleSave = () => {
    const formattedDob = `${selectedDay} ${months[selectedMonthIndex]} ${selectedYear}`;
    router.push({
      pathname: '/profile-details',
      params: { 
        ...params,
        selectedDob: formattedDob 
      },
    });
  };

  // Build grid items (empty padding cells + days of month)
  const calendarCells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push({ type: 'empty', id: `empty-${i}` });
  }
  for (let day = 1; day <= daysInMonthCount; day++) {
    calendarCells.push({ type: 'day', day });
  }

  return (
    <View style={styles.rootContainer}>
      {/* Full-Screen Blush Hearts Background Image */}
      <ImageBackground
        source={require('@assets/images/app_background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={[styles.mainWrapper, { paddingTop: Math.max(insets.top + 16, 44) }]}>
          
          {/* Header Row with Back Button (NO Skip Button) */}
          <View style={styles.topHeaderRow}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
              hitSlop={12}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </Pressable>
          </View>

          {/* Upper Spacer */}
          <View style={{ flex: 1 }} />

          {/* White Bottom Sheet Calendar Container */}
          <View style={[styles.sheetContainer, { paddingBottom: Math.max(insets.bottom + 16, 28) }]}>
            
            {/* Top Grab Handle */}
            <View style={styles.grabHandle} />

            {/* Subtitle & Year Header (Tap year to select year) */}
            <Text style={styles.birthdayLabel}>Birthday</Text>
            <Pressable onPress={() => setShowYearModal(true)} hitSlop={8}>
              <View style={styles.yearRow}>
                <Text style={styles.yearText}>{selectedYear}</Text>
                <Ionicons name="chevron-down" size={18} color="#111827" style={{ marginLeft: 6, marginTop: 4 }} />
              </View>
            </Pressable>

            {/* Month Selector Row */}
            <View style={styles.monthSelectorRow}>
              <Pressable onPress={handlePrevMonth} hitSlop={12}>
                <Ionicons name="chevron-back" size={18} color="#111827" />
              </Pressable>
              <Text style={styles.monthText}>{months[selectedMonthIndex]}</Text>
              <Pressable onPress={handleNextMonth} hitSlop={12}>
                <Ionicons name="chevron-forward" size={18} color="#111827" />
              </Pressable>
            </View>

            {/* Calendar Days Grid */}
            <View style={styles.daysGrid}>
              {calendarCells.map((cell, idx) => {
                if (cell.type === 'empty') {
                  return <View key={cell.id} style={styles.dayCellContainer} />;
                }

                const day = cell.day;
                const isSelected = day === selectedDay;

                return (
                  <Pressable
                    key={day}
                    onPress={() => setSelectedDay(day)}
                    style={styles.dayCellContainer}
                  >
                    <View style={[styles.dayCell, isSelected && styles.dayCellSelected]}>
                      <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
                        {day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Save Button */}
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [styles.saveButton, pressed && styles.buttonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Save birthday"
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </Pressable>

          </View>

        </View>
      </ImageBackground>

      {/* Year Selector Modal */}
      <Modal visible={showYearModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Birth Year</Text>
              <Pressable onPress={() => setShowYearModal(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color="#111827" />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {years.map((y) => (
                <Pressable
                  key={y}
                  onPress={() => {
                    setSelectedYear(y);
                    setShowYearModal(false);
                  }}
                  style={[styles.yearOption, y === selectedYear && styles.yearOptionSelected]}
                >
                  <Text style={[styles.yearOptionText, y === selectedYear && styles.yearOptionTextSelected]}>
                    {y}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#FFF0F3',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mainWrapper: {
    flex: 1,
  },
  topHeaderRow: {
    width: '100%',
    paddingHorizontal: 24,
    height: 44,
    justifyContent: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.8)',
  },
  sheetContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 14,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  grabHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 20,
  },
  birthdayLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 4,
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  yearText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  monthSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  monthText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginHorizontal: 44,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: 28,
  },
  dayCellContainer: {
    width: `${100 / 7}%`,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  dayCell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCellSelected: {
    backgroundColor: '#FF2E63',
  },
  dayText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  saveButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#FF2E63',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    maxHeight: 380,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  yearOption: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    marginVertical: 2,
  },
  yearOptionSelected: {
    backgroundColor: '#FF2E63',
  },
  yearOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  yearOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
