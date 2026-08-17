import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  StatusBar as RNStatusBar,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { usePointsStore } from '../store/pointsStore';
import PlanCard from '../components/common/PlanCard';
import TrustBadge from '../components/common/TrustBadge';
import PaymentMethodBadge from '../components/common/PaymentMethodBadge';
import BottomTabBar from '../components/common/BottomTabBar';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0;

const PLANS_DATA = [
  {
    id: '1',
    points: '100',
    price: '₹79',
    originalPrice: '₹99',
    discount: '20% OFF',
    description: 'Great for getting started. Connect and chat with new people.',
    isMostPopular: true,
    features: [
      { icon: 'heart', label: 'Like', value: '10 times' },
      { icon: 'chatbubble-ellipses', label: 'Messages', value: '5 chats' },
      { icon: 'eye', label: 'Profile Boost', value: '1 time' },
    ],
  },
  {
    id: '2',
    points: '250',
    price: '₹179',
    originalPrice: '₹249',
    discount: '28% OFF',
    description: 'Best value pack. Unlock more interactions and features.',
    isMostPopular: false,
    features: [
      { icon: 'heart', label: 'Like', value: '25 times' },
      { icon: 'chatbubble-ellipses', label: 'Messages', value: '15 chats' },
      { icon: 'eye', label: 'Profile Boost', value: '3 times' },
    ],
  },
  {
    id: '3',
    points: '500',
    price: '₹329',
    originalPrice: '₹499',
    discount: '34% OFF',
    description: 'More points, more possibilities. Stand out and connect better.',
    isMostPopular: false,
    features: [
      { icon: 'heart', label: 'Like', value: '50 times' },
      { icon: 'chatbubble-ellipses', label: 'Messages', value: '30 chats' },
      { icon: 'star', label: 'Super Like', value: '10 times' },
    ],
  },
  {
    id: '4',
    points: '1000',
    price: '₹549',
    originalPrice: '₹999',
    discount: '45% OFF',
    description: 'Maximum value for unlimited connections and premium features.',
    isMostPopular: false,
    features: [
      { icon: 'heart', label: 'Like', value: '100 times' },
      { icon: 'chatbubble-ellipses', label: 'Messages', value: '60 chats' },
      { icon: 'star', label: 'Super Like', value: '25 times' },
    ],
  },
];

export default function BuyPointsScreen() {
  const router = useRouter();
  const balance = usePointsStore((state) => state.balance);
  const addPoints = usePointsStore((state) => state.addPoints);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [purchaseStatus, setPurchaseStatus] = useState('confirming'); // 'confirming' | 'success'

  const handlePurchase = (plan) => {
    setSelectedPlan(plan);
    setPurchaseStatus('confirming');
    setModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF0F3" />

      {/* Soft Warm Pink Gradient Background */}
      <LinearGradient colors={['#FFF0F3', '#FFE3E8', '#FFD8E1']} style={styles.gradientBackground}>
        {/* Scattered floating watermark hearts */}
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
        </View>

        {/* Top Header Row */}
        <View style={styles.topHeaderRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Buy Points</Text>

          {/* Top-Right My Points Balance Card */}
          <View style={styles.myPointsCard}>
            <Text style={styles.myPointsLabel}>My Points</Text>
            <View style={styles.myPointsPill}>
              <Image
                source={require('@assets/images/glyphs-poly_heart.png')}
                style={styles.myPointsHeartIcon}
                resizeMode="contain"
              />
              <Text style={styles.myPointsCount}>{balance}</Text>
            </View>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
          {/* Page Intro Title Block */}
          {/* <View style={styles.introContainer}>
            <Text style={styles.introTitle}>Choose a Plan that suits you</Text>
            <Text style={styles.introSubtitle}>More points, more connections!</Text>
          </View> */}

          {/* Plan Cards Stack */}
          {PLANS_DATA.map((plan) => (
            <PlanCard
              key={plan.id}
              points={plan.points}
              price={plan.price}
              originalPrice={plan.originalPrice}
              discount={plan.discount}
              description={plan.description}
              features={plan.features}
              isMostPopular={plan.isMostPopular}
              onPress={() => handlePurchase(plan)}
            />
          ))}

          {/* Trust Badges container */}
          <View style={styles.trustBadgesCard}>
            <TrustBadge
              icon="shield-checkmark"
              title="100% Secure"
              subtext="Safe & reliable payments"
              iconColor="#F04452"
              bgColor="#FFE1E8"
            />
            <TrustBadge
              icon="flash"
              title="Instant Credit"
              subtext="Points added instantly"
              iconColor="#8B5CF6"
              bgColor="#E5D5F5"
            />
            <TrustBadge
              icon="ribbon"
              title="Best Value"
              subtext="Get more points for less"
              iconColor="#EF4444"
              bgColor="#F5D5D5"
            />
            <TrustBadge
              icon="headset"
              title="24/7 Support"
              subtext="We're here to help you"
              iconColor="#FBBF24"
              bgColor="#F5E5D5"
            />
          </View>

          {/* Payment Methods Section */}
          <View style={styles.paymentCard}>
            <Text style={styles.paymentTitle}>We Accept</Text>
            <View style={styles.paymentRow}>
              <PaymentMethodBadge brandName="upi" />
              <PaymentMethodBadge brandName="visa" />
              <PaymentMethodBadge brandName="mastercard" />
              <PaymentMethodBadge brandName="rupay" />
              <PaymentMethodBadge brandName="paytm" />
            </View>
          </View>

          {/* Security Footer Band */}
          <View style={styles.securityFooterCard}>
            <Ionicons name="shield-checkmark" size={18} color="#F04452" style={styles.securityIcon} />
            <View style={styles.securityTextContainer}>
              <Text style={styles.securityTitleText}>All transactions are secure and encrypted.</Text>
              <Text style={styles.securityDescText}>
                By purchasing, you agree to our{' '}
                <Text style={styles.linkText} onPress={() => router.push('/terms-of-use')}>
                  Terms of Service
                </Text>{' '}
                and{' '}
                <Text style={styles.linkText} onPress={() => router.push('/privacy-policy')}>
                  Privacy Policy
                </Text>
                .
              </Text>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>

      {/* Custom Payment Dialog Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCardContainer}>
            {purchaseStatus === 'confirming' ? (
              <>
                {/* Heart Logo Header */}
                <View style={styles.modalHeaderIconContainer}>
                  <View style={styles.modalIconCircle}>
                    <Image
                      source={require('@assets/images/glyphs-poly_heart.png')}
                      style={styles.modalHeartIcon}
                      resizeMode="contain"
                    />
                  </View>
                </View>

                {/* Title */}
                <Text style={styles.modalTitle}>Confirm Purchase</Text>

                {/* Description */}
                <Text style={styles.modalDesc}>
                  Would you like to purchase{' '}
                  <Text style={{ fontWeight: '800', color: '#111827' }}>
                    {selectedPlan?.points} Rubaru Points
                  </Text>{' '}
                  for <Text style={{ fontWeight: '800', color: '#F04452' }}>{selectedPlan?.price}</Text>?
                </Text>

                {/* Buttons Row */}
                <View style={styles.modalButtonsRow}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.modalCancelButton}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.modalCancelText}>CANCEL</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.modalBuyButton}
                    onPress={() => {
                      if (selectedPlan) {
                        const pointsToAdd = parseInt(selectedPlan.points, 10);
                        addPoints(pointsToAdd);
                        setPurchaseStatus('success');
                      }
                    }}
                  >
                    <Text style={styles.modalBuyText}>BUY NOW</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {/* Success Icon */}
                <View style={styles.modalHeaderIconContainer}>
                  <View style={[styles.modalIconCircle, { backgroundColor: '#E6FDF5' }]}>
                    <Ionicons name="checkmark-circle" size={32} color="#10B981" />
                  </View>
                </View>

                {/* Success Title */}
                <Text style={styles.modalTitle}>Payment Successful</Text>

                {/* Success Description */}
                <Text style={styles.modalDesc}>
                  Successfully added{' '}
                  <Text style={{ fontWeight: '800', color: '#111827' }}>
                    {selectedPlan?.points} points
                  </Text>{' '}
                  to your balance!
                </Text>

                {/* Done Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.modalDoneButton}
                  onPress={() => {
                    setModalVisible(false);
                    router.back();
                  }}
                >
                  <Text style={styles.modalDoneText}>DONE</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Reused Bottom Tab Bar (Home Active) */}
      <BottomTabBar
        activeTab="index"
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
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.8)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  myPointsCard: {
    width: 90,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FFE5EC',
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  myPointsLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8E8E93',
  },
  myPointsPill: {
    backgroundColor: '#FFEBF0',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  myPointsHeartIcon: {
    width: 14,
    height: 14,
    marginRight: 4,
  },
  myPointsCount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  scrollBody: {

    paddingHorizontal: 16,
    paddingTop:5,
    paddingBottom: 80, // safe offset above bottom tab bar
  },
  introContainer: {
    alignItems: 'flex-start',
    marginTop: 8,
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
  },
  introSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E8E93',
    marginTop: 4,
  },
  trustBadgesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFE1E8',
    paddingVertical: 16,
    paddingHorizontal: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFE1E8',
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  paymentTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
  },
  securityFooterCard: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFEBEF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  securityIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  securityTextContainer: {
    flex: 1,
  },
  securityTitleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 4,
  },
  securityDescText: {
    fontSize: 10,
    color: '#6B7280',
    lineHeight: 14,
  },
  linkText: {
    color: '#F04452',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCardContainer: {
    width: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#FFE1E8',
  },
  modalHeaderIconContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFE1E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeartIcon: {
    width: 32,
    height: 32,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginTop: 16,
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  modalCancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4B5563',
  },
  modalBuyButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#F04452',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  modalBuyText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalDoneButton: {
    width: '100%',
    height: 46,
    borderRadius: 14,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDoneText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
