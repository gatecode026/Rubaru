import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useLocalSearchParams, useRouter } from 'expo-router';
import BottomTabBar from '../components/common/BottomTabBar';
import HomeScreen from '../screens/HomeScreen';
import ConnectionScreen from '../screens/ConnectionScreen';
import ReelsScreen from '../screens/ReelsScreen';
import NotificationScreen from '../screens/NotificationScreen';
import GroupsScreen from '../screens/GroupsScreen';

const tabToIndex = (tabName) => {
  switch (tabName) {
    case 'connection': return 1;
    case 'reels': return 2;
    case 'notification': return 3;
    case 'groups': return 4;
    default: return 0;
  }
};

const indexToTab = (index) => {
  switch (index) {
    case 1: return 'connection';
    case 2: return 'reels';
    case 3: return 'notification';
    case 4: return 'groups';
    default: return 'index';
  }
};

export default function MainTabsPager() {
  const pagerRef = useRef(null);
  const params = useLocalSearchParams();
  const router = useRouter();

  const tab = params.tab;
  const initialIndex = tabToIndex(tab);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  // Sync index when search params tab changes externally
  useEffect(() => {
    if (tab !== undefined) {
      const targetIndex = tabToIndex(tab);
      if (targetIndex !== activeIndex) {
        setActiveIndex(targetIndex);
        pagerRef.current?.setPage(targetIndex);
      }
    }
  }, [tab]);

  const onPageSelected = (e) => {
    const index = e.nativeEvent.position;
    if (index === activeIndex) return;

    setActiveIndex(index);
    
    // Silently update search params to sync layout URL state
    router.setParams({ tab: indexToTab(index) });
  };

  return (
    <View style={styles.container}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={initialIndex}
        onPageSelected={onPageSelected}
      >
        <View key="0" style={styles.page}>
          <HomeScreen isNestedInPager={true} />
        </View>
        <View key="1" style={styles.page}>
          <ConnectionScreen isNestedInPager={true} />
        </View>
        <View key="2" style={styles.page}>
          <ReelsScreen isNestedInPager={true} />
        </View>
        <View key="3" style={styles.page}>
          <NotificationScreen isNestedInPager={true} />
        </View>
        <View key="4" style={styles.page}>
          <GroupsScreen isNestedInPager={true} />
        </View>
      </PagerView>
      <BottomTabBar
        activeTab={indexToTab(activeIndex)}
        onTabPress={(tabKey) => {
          const index = tabToIndex(tabKey);
          if (index !== undefined) {
            pagerRef.current?.setPage(index);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
});

