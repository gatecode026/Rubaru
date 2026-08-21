import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
 
const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';
const CORAL = '#F04452';
const CARD_OVERLAP_RATIO = 0.135; // must match HeroCurvedHeader's CARD_OVERLAP_RATIO
 
export default function QuoteCard({ quoteStart, quoteEmphasis, width }) {
  const overlap = Math.round(width * CARD_OVERLAP_RATIO);
 
  return (
    <View style={[styles.card, { width, marginTop: -overlap }]}>
      <Text style={styles.quoteGlyph}>“</Text>
 
      <Text style={styles.quoteText}>
        {quoteStart}
        <Text style={styles.quoteEmphasis}>{quoteEmphasis}</Text>
      </Text>
 
      {/* Decorative heart squiggle, bottom-right flourish */}
      <View style={styles.squiggleWrap} pointerEvents="none">
        <Svg width={70} height={46} viewBox="0 0 70 46">
          <Path
            d="M4,6 C22,2 30,18 22,26 C16,32 8,28 10,20 C12,12 24,10 30,18 C38,28 48,40 62,36"
            stroke={CORAL}
            strokeWidth={1.4}
            fill="none"
            opacity={0.35}
            strokeLinecap="round"
          />
        </Svg>
      </View>
    </View>
  );
}
 
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFDF9',
    borderRadius: 26,
    paddingHorizontal: 24,
    paddingVertical: 22,
    alignSelf: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 5,
    overflow: 'hidden',
  },
  quoteGlyph: {
    fontFamily: SERIF,
    fontSize: 34,
    color: CORAL,
    lineHeight: 34,
    marginBottom: -6,
  },
  quoteText: {
    fontFamily: SERIF,
    fontSize: 19,
    lineHeight: 27,
    color: '#1F1F1F',
  },
  quoteEmphasis: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    color: CORAL,
  },
  squiggleWrap: {
    position: 'absolute',
    right: 10,
    bottom: 6,
  },
});
