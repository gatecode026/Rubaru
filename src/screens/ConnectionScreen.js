import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0;
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import NewUserCard from '../components/common/NewUserCard';
import InterestChip from '../components/common/InterestChip';
import BottomTabBar from '../components/common/BottomTabBar';

const newUsersData = [
  {
    id: '1',
    name: 'Rani',
    age: 19,
    city: 'JAIPUR',
    distance: '16 km away',
    imageUri: 'https://images.pexels.com/photos/1382731/pexels-photo-1382731.jpeg?auto=compress&cs=tinysrgb&w=800',
    isNew: true,
    isOnline: true,
  },
  {
    id: '2',
    name: 'Vandana',
    age: 18,
    city: 'MUMBAI',
    distance: '4.8 km away',
    imageUri: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=800',
    isNew: true,
    isOnline: false,
  },
  {
    id: '3',
    name: 'Keshav',
    age: 20,
    city: 'DELHI',
    distance: '2.2 km away',
    imageUri: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=800',
    isNew: true,
    isOnline: true,
  },
  {
    id: '4',
    name: 'Meera',
    age: 21,
    city: 'PUNE',
    distance: '1.2 km away',
    imageUri: 'https://images.pexels.com/photos/1462637/pexels-photo-1462637.jpeg?auto=compress&cs=tinysrgb&w=800',
    isNew: true,
    isOnline: true,
  },
];

const interestsList = [
  { id: '1', label: 'Football', emoji: '⚽' },
  { id: '2', label: 'Nature', emoji: '🌿' },
  { id: '3', label: 'Language', emoji: '🗣️' },
  { id: '4', label: 'Photography', emoji: '📷' },
  { id: '5', label: 'Music', emoji: '🎵' },
  { id: '6', label: 'Writing', emoji: '✍️' },
];

export default function ConnectionScreen({ isNestedInPager }) {
  const router = useRouter();
  const [selectedInterest, setSelectedInterest] = useState('Music');

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/explore');
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFF0F3" />

      {/* Soft Warm Pink Gradient Background */}
      <LinearGradient colors={['#FFF0F3', '#FFE3E8', '#FFD8E1']} style={styles.gradientBackground}>
        {/* Scattered soft pink floating hearts matching reference image */}
        <View style={styles.watermarkContainer} pointerEvents="none">
          <Ionicons
            name="heart"
            size={52}
            color="#F492A5"
            style={[styles.heart, { top: 20, left: -12, transform: [{ rotate: '-20deg' }], opacity: 0.35 }]}
          />
          <Ionicons
            name="heart"
            size={42}
            color="#F492A5"
            style={[styles.heart, { top: 35, left: 162, transform: [{ rotate: '-15deg' }], opacity: 0.5 }]}
          />
          <Ionicons
            name="heart"
            size={34}
            color="#F492A5"
            style={[styles.heart, { top: 80, left: 210, transform: [{ rotate: '18deg' }], opacity: 0.55 }]}
          />
          <Ionicons
            name="heart"
            size={28}
            color="#F492A5"
            style={[styles.heart, { top: 122, left: 252, transform: [{ rotate: '-8deg' }], opacity: 0.4 }]}
          />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
          {/* "Discover" Header Row */}
          <View style={[styles.discoverHeaderRow, { paddingTop: STATUSBAR_HEIGHT + 6 }]}>
            <View style={styles.discoverTitleContainer}>
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Ionicons name="chevron-back" size={28} color="#000000" />
              </TouchableOpacity>
              <Text style={styles.discoverTitle}>Discover</Text>
            </View>
            <View style={styles.headerButtonsRow}>
              <TouchableOpacity style={styles.circleIconButton} activeOpacity={0.8}>
                <Ionicons name="search" size={20} color="#000000" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.circleIconButton} activeOpacity={0.8}>
                <Ionicons name="options-outline" size={20} color="#000000" />
              </TouchableOpacity>
            </View>
          </View>

          {/* "NEW" Users Carousel */}
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={newUsersData}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <NewUserCard item={item} />}
            contentContainerStyle={styles.carouselContentContainer}
            style={styles.carouselContainer}
          />

          {/* "Interest" Section */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Interest</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.viewAllText}>View all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.interestsChipsWrapper}>
            {interestsList.map((item) => (
              <InterestChip
                key={item.id}
                label={item.label}
                emoji={item.emoji}
                isSelected={selectedInterest === item.label}
                onPress={() => setSelectedInterest(item.label)}
              />
            ))}
          </View>

          {/* "Around Me" Section & Custom Map View */}
          <View style={styles.aroundMeSection}>
            <View style={styles.aroundMeHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Around me</Text>
                <Text style={styles.aroundMeSubtext}>
                  People with <Text style={styles.interestHighlight}>"{selectedInterest}"</Text> interest around you
                </Text>
              </View>
              <TouchableOpacity style={styles.mapLocationRow} activeOpacity={0.7}>
                <Ionicons name="location" size={14} color="#E63956" style={styles.mapPinIcon} />
                <Text style={styles.mapLocationText}>India</Text>
                <Ionicons name="chevron-down" size={12} color="#E63956" style={styles.mapChevronIcon} />
              </TouchableOpacity>
            </View>

            {/* Custom Interactive Map Representation */}
            <View style={styles.mapContainer}>
              {/* Map Canvas Styling */}
              <View style={styles.mapBackground}>
                {/* Stylized Street Lines */}
                <View style={[styles.streetLine, { top: '35%', left: '-10%', width: '120%', transform: [{ rotate: '-25deg' }] }]} />
                <View style={[styles.streetLine, { top: '55%', left: '-10%', width: '120%', transform: [{ rotate: '15deg' }] }]} />

                {/* POI Labels */}
                <View style={[styles.poiBadge, { bottom: 65, right: 15 }]}>
                  <Ionicons name="wine" size={12} color="#8E8E93" style={styles.poiIcon} />
                  <View>
                    <Text style={styles.poiTitle}>Chiquita Fruit Bar</Text>
                    <Text style={styles.poiSub}>Temporarily closed</Text>
                  </View>
                </View>

                <View style={[styles.poiBadge, { bottom: 40, left: 140 }]}>
                  <Ionicons name="school" size={12} color="#8E8E93" style={styles.poiIcon} />
                  <View>
                    <Text style={styles.poiTitle}>Nirbija - Yoga, Hand & Klang</Text>
                    <Text style={styles.poiSub}>Temporarily closed</Text>
                  </View>
                </View>

                <View style={[styles.poiBadge, { bottom: 15, left: 20 }]}>
                  <Ionicons name="restaurant" size={12} color="#D83A56" style={styles.poiIcon} />
                  <View>
                    <Text style={[styles.poiTitle, { color: '#D83A56' }]}>CurryCultTreffs</Text>
                    <Text style={styles.poiSub}>BB-Express-B</Text>
                  </View>
                </View>

                {/* Scattered Nearby People Avatars */}
                <View style={[styles.mapAvatarMarker, { bottom: 95, right: 90 }]}>
                  <Image source={{ uri: 'https://i.pravatar.cc/150?img=60' }} style={styles.mapAvatarImg} />
                </View>

                <View style={[styles.mapAvatarMarker, { bottom: 10, left: 110 }]}>
                  <Image source={{ uri: 'https://i.pravatar.cc/150?img=47' }} style={styles.mapAvatarImg} />
                </View>

                {/* Main Central Avatar Marker (Rakhi) with Connect Tooltip Bubble */}
                <View style={styles.centerMarkerWrapper}>
                  {/* Floating Tooltip Bubble */}
                  <View style={styles.tooltipBubble}>
                    <Ionicons name="pulse" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.tooltipText}>
                      Connect with <Text style={styles.tooltipBold}>Rakhi 👋</Text>
                    </Text>
                  </View>
                  <View style={styles.tooltipDot} />

                  {/* Main Avatar Circle */}
                  <View style={styles.mainRakhiAvatarRing}>
                    <Image source={{ uri: 'https://i.pravatar.cc/150?img=32' }} style={styles.mainRakhiAvatarImg} />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
      {!isNestedInPager && (
        <BottomTabBar
          activeTab="Connection"
          onTabPress={(tabKey) => {
            router.push(tabKey === 'index' ? '/(tabs)' : `/(tabs)/${tabKey}`);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFF0F3',
  },
  gradientBackground: {
    flex: 1,
  },
  watermarkContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  heart: {
    position: 'absolute',
  },
  scrollBody: {
    paddingBottom: 90,
  },
  discoverTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 6,
  },
  aroundMeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mapLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBF0', // highlighted soft pink background
    borderWidth: 1,
    borderColor: '#E63956', // highlighted theme border
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'center',
    shadowColor: '#E63956',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  mapPinIcon: {
    marginRight: 4,
  },
  mapLocationText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E63956', // highlighted text color
    marginRight: 4,
  },
  mapChevronIcon: {
    marginTop: 1,
  },
  discoverHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 14,
  },
  discoverTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.5,
  },
  headerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circleIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#F2F2F7',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  carouselContainer: {
    marginBottom: 20,
  },
  carouselContentContainer: {
    paddingHorizontal: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D9456B',
  },
  interestsChipsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  aroundMeSection: {
    paddingHorizontal: 20,
  },
  aroundMeSubtext: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 4,
    marginBottom: 14,
  },
  interestHighlight: {
    color: '#E63956',
    fontWeight: '700',
  },
  mapContainer: {
    height: 380,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#F5EFE6',
    borderWidth: 1,
    borderColor: '#EFEFF4',
  },
  mapBackground: {
    flex: 1,
    backgroundColor: '#F7F3EC',
    position: 'relative',
  },
  streetLine: {
    position: 'absolute',
    height: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#EADECE',
  },
  poiBadge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  poiIcon: {
    marginRight: 6,
  },
  poiTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#444444',
  },
  poiSub: {
    fontSize: 8,
    color: '#8E8E93',
  },
  mapAvatarMarker: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    elevation: 3,
  },
  mapAvatarImg: {
    width: '100%',
    height: '100%',
  },
  centerMarkerWrapper: {
    position: 'absolute',
    top: '32%',
    left: '18%',
    alignItems: 'center',
  },
  tooltipBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D1025',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    elevation: 4,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  tooltipBold: {
    fontWeight: '800',
  },
  tooltipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2D1025',
    marginVertical: 4,
  },
  mainRakhiAvatarRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    borderColor: '#E63956',
    padding: 2,
    backgroundColor: '#FFFFFF',
    elevation: 4,
  },
  mainRakhiAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
  },
});
