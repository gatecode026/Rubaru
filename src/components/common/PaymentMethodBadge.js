import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

export default function PaymentMethodBadge({ brandName }) {
  const renderLogo = () => {
    switch (brandName.toLowerCase()) {
      case 'upi':
        return (
          <View style={styles.upiContainer}>
            <Text style={styles.upiBlue}>UP</Text>
            <Text style={styles.upiGreen}>I</Text>
            <View style={styles.upiArrowContainer}>
              <Text style={styles.upiArrow}>▶</Text>
            </View>
          </View>
        );
      case 'visa':
        return <Text style={styles.visaText}>VISA</Text>;
      case 'mastercard':
        return (
          <View style={styles.mastercardContainer}>
            <View style={styles.mastercardCircles}>
              <View style={[styles.circle, styles.circleRed]} />
              <View style={[styles.circle, styles.circleOrange]} />
            </View>
            <Text style={styles.mastercardText}>mastercard</Text>
          </View>
        );
      case 'rupay':
        return (
          <Text style={styles.rupayText}>
            RuPay<Text style={{ color: '#FF8A00' }}>▸</Text>
          </Text>
        );
      case 'paytm':
        return (
          <Text style={styles.paytmText}>
            pay<Text style={{ color: '#002E6E', fontWeight: '800' }}>tm</Text>
          </Text>
        );
      // case 'applepay':
      // case 'apple pay':
      //   return (
      //     <View style={styles.applePayContainer}>
      //       <FontAwesome name="apple" size={16} color="#000000" style={styles.appleIcon} />
      //       <Text style={styles.applePayText}>Pay</Text>
      //     </View>
      //   );
      default:
        return <Text style={styles.defaultText}>{brandName}</Text>;
    }
  };

  return <View style={styles.badgeWrapper}>{renderLogo()}</View>;
}

const styles = StyleSheet.create({
  badgeWrapper: {
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  upiContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upiBlue: {
    fontSize: 17,
    fontStyle: 'italic',
    fontWeight: '900',
    color: '#097969', // cyan/teal
  },
  upiGreen: {
    fontSize: 17,
    fontStyle: 'italic',
    fontWeight: '900',
    color: '#FF8F00', // orange/amber
  },
  upiArrowContainer: {
    transform: [{ rotate: '-30deg' }],
    marginLeft: 2,
  },
  upiArrow: {
    fontSize: 9,
    color: '#FF8F00',
  },
  visaText: {
    fontSize: 19,
    fontStyle: 'italic',
    fontWeight: '900',
    color: '#1A1A9E',
    letterSpacing: -0.5,
  },
  mastercardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mastercardCircles: {
    flexDirection: 'row',
    marginRight: 4,
  },
  circle: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
  },
  circleRed: {
    backgroundColor: '#EB001B',
    marginRight: -5,
    zIndex: 1,
  },
  circleOrange: {
    backgroundColor: '#F79E1B',
  },
  mastercardText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#111827',
  },
  rupayText: {
    fontSize: 17,
    fontStyle: 'italic',
    fontWeight: '900',
    color: '#0A2540',
  },
  paytmText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#00B9F5',
  },
  applePayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appleIcon: {
    marginRight: 2,
    marginTop: -2,
  },
  applePayText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
  defaultText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
  },
});
