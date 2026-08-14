import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

export default function AvatarStack({ voters = [], totalVotes = 0, isSent = false, maxVisible = 3 }) {
  const visibleVoters = voters.slice(0, maxVisible);
  const overflow = totalVotes > maxVisible ? totalVotes - maxVisible : 0;

  return (
    <View style={styles.container}>
      <View style={styles.stackRow}>
        {visibleVoters.map((voter, index) => (
          <Image
            key={voter.id || index}
            source={{ uri: voter.avatarUri || voter }}
            style={[
              styles.avatar,
              {
                marginLeft: index === 0 ? 0 : -8,
                borderColor: isSent ? '#000000' : '#FFFFFF',
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.countText, { color: isSent ? '#FFFFFF' : '#000000' }]}>
        {overflow > 0 ? `+${overflow}` : totalVotes}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    backgroundColor: '#E1E1E1',
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
});
