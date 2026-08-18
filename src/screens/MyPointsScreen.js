import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  StatusBar,
  Platform,
  StatusBar as RNStatusBar,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import PointsUsageIcon from '../components/common/PointsUsageIcon';
import PointsPackageRow from '../components/common/PointsPackageRow';
import BottomTabBar from '../components/common/BottomTabBar';
import { usePointsStore } from '../store/pointsStore';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0;

const usageList = [
  { id: '1', label: 'Like', cost: '10 Points', imageSource: require('@assets/images/like_icon.png'), iconSize: 34, borderColor: '#FFE5EC', borderWidth: 1 },
  { id: '2', label: 'Messages', cost: '20 Points', icon: 'chatbubble-ellipses-outline', iconColor: '#8B5CF6', borderColor: '#E5D5F5', borderWidth: 1, IconComponent: Ionicons },
  { id: '3', label: 'Profile Boost', cost: '50 Points', icon: 'eye', iconColor: '#EF4444', borderColor: '#F5D5D5', borderWidth: 1, IconComponent: Ionicons },
  { id: '4', label: 'Super Like', cost: '30 Points', icon: 'star', iconColor: '#FBBF24', borderColor: '#F5E5D5', borderWidth: 1, IconComponent: Ionicons },
  { id: '5', label: 'Premium', cost: '100 Points', icon: 'diamond-outline', iconColor: '#EC4899', borderColor: '#F5D5EB', borderWidth: 1, IconComponent: Ionicons },
];

const packagesList = [
  { id: '1', points: '100', price: '₹ 79' },
  { id: '2', points: '250', price: '₹ 179' },
  { id: '3', points: '500', price: '₹ 329' },
  { id: '4', points: '1000', price: '₹ 549' },
];

export default function MyPointsScreen() {
  const router = useRouter();
  const scrollViewRef = useRef(null);
  const balance = usePointsStore((state) => state.balance);

  const handleGetMorePoints = () => {
    router.push('/buy-points');
  };

  const handlePurchase = (item) => {
    router.push('/buy-points');
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF5F5" />

      {/* Custom Points Background Image */}
      <ImageBackground
        source={require('@assets/images/points_backgroud.png')}
        style={styles.gradientBackground}
        resizeMode="cover"
      >

        {/* Header Row */}
        <View style={styles.headerContainer}>
          <TouchableOpacity activeOpacity={0.8} style={styles.avatarGradientBorder} onPress={() => router.push('/user-profile')}>
            <Image source={{ uri: 'https://i.pravatar.cc/150?img=60' }} style={styles.headerAvatarImage} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>My Points</Text>

          <TouchableOpacity activeOpacity={0.8} style={styles.historyPill} onPress={() => router.push('/transactions?from=my-points')}>
            <Ionicons name="time-outline" size={16} color="#000" />
            <Text style={styles.historyText}>History</Text>
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Balance Card */}
          <ImageBackground
            source={require('@assets/images/card_background.png')}
            style={styles.balanceCard}
            imageStyle={{ borderRadius: 24 }}
          >
            <Text style={styles.balanceLabel}>Your Balance</Text>

            <View style={styles.balanceAmountRow}>
              <Image
                source={require('@assets/images/glyphs-poly_heart.png')}
                style={styles.polyHeartImage}
                resizeMode="contain"
              />
              <Text style={styles.balanceAmount}>{balance}</Text>
            </View>

            <Text style={styles.rubaruPointsText}>Rubaru Points</Text>

            <View style={styles.descriptionRow}>
              <Ionicons name="sparkles" size={16} color="#6B7280" style={styles.sparkleIcon} />
              <Text style={styles.descriptionText}>
                Use Points to connect, chat{'\n'}and unlock special features
              </Text>
            </View>

            <TouchableOpacity activeOpacity={0.8} style={styles.getMorePointsButton} onPress={handleGetMorePoints}>
              <Text style={styles.getMorePointsText}>Get More Points</Text>
            </TouchableOpacity>
          </ImageBackground>

          {/* How to Use Points Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>How to Use Points</Text>
            <View style={styles.usageIconsRow}>
              {usageList.map((item) => (
                <PointsUsageIcon
                  key={item.id}
                  icon={item.icon}
                  iconColor={item.iconColor}
                  iconBg={item.iconBg}
                  borderColor={item.borderColor}
                  borderWidth={item.borderWidth}
                  label={item.label}
                  cost={item.cost}
                  IconComponent={item.IconComponent}
                  iconSize={item.iconSize || 22}
                  imageSource={item.imageSource}
                />
              ))}
            </View>
          </View>

          {/* Points Packages Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.packagesOuterCard}>
              <Text style={styles.packagesOuterTitle}>Points Packages</Text>
              {packagesList.map((item) => (
                <PointsPackageRow
                  key={item.id}
                  points={item.points}
                  price={item.price}
                  onPress={() => handlePurchase(item)}
                />
              ))}
            </View>
          </View>

          {/* Go Premium Banner */}
          <LinearGradient colors={['#FFF3E0', '#FFE8D6']} style={styles.premiumBanner}>
            <View style={styles.premiumBannerLeft}>
              <FontAwesome5 name="crown" size={24} color="#000" style={styles.crownIcon} />
              <View>
                <Text style={styles.premiumTitle}>Go Premium</Text>
                <Text style={styles.premiumSubtitle}>Unlock unlimited likes,{'\n'}see who likes you & more!</Text>
              </View>
            </View>
            <TouchableOpacity activeOpacity={0.8} style={styles.upgradePill}>
              <Text style={styles.upgradeText}>Upgrade Now</Text>
            </TouchableOpacity>
          </LinearGradient>

        </ScrollView>
      </ImageBackground>

      {/* Fixed Bottom Tab Bar */}
      <BottomTabBar
        activeTab="Home"
        onTabPress={(tabKey) => {
          router.push(tabKey === 'index' ? '/(tabs)' : `/(tabs)/${tabKey}`);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFF5F5',
  },
  gradientBackground: {
    flex: 1,
  },
  watermarkContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  watermarkHeart: {
    position: 'absolute',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
    zIndex: 10,
  },
  avatarGradientBorder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    padding: 2,
    borderWidth: 2,
    borderColor: '#E63956',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000',
  },
  historyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  historyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    marginLeft: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 90,
  },
  balanceCard: {
    borderRadius: 24,
    padding: 24,
    marginTop: 20,
    marginBottom: 24,
    overflow: 'hidden',
    width: 370,
    height: 280,
    alignSelf: 'center',
  },
  balanceLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  balanceAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  polyHeartImage: {
    width: 48,
    height: 48,
  },
  balanceAmount: {
    fontSize: 42,
    fontWeight: '800',
    color: '#000',
    marginLeft: 12,
  },
  rubaruPointsText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  descriptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  sparkleIcon: {
    marginTop: 2,
    marginRight: 8,
  },
  descriptionText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  getMorePointsButton: {
    backgroundColor: '#000',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  getMorePointsText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
    marginBottom: 16,
  },
  usageIconsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  packagesOuterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FFC5D3',
    padding: 16,
    paddingTop: 18,
    paddingBottom: 6,
  },
  packagesOuterTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 16,
  },
  premiumBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
  },
  premiumBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  crownIcon: {
    marginRight: 12,
  },
  premiumTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000',
    marginBottom: 4,
  },
  premiumSubtitle: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 16,
  },
  upgradePill: {
    backgroundColor: '#FF1DC',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginLeft: 12,
  },
  upgradeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },
});
