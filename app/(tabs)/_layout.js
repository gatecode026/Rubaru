import { Tabs } from 'expo-router';
import CustomTabBar from '@components/CustomTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => {
        const routeName = props.state.routes[props.state.index].name;
        return (
          <CustomTabBar
            activeTab={routeName}
            onTabPress={(key) => {
              props.navigation.navigate(key);
            }}
          />
        );
      }}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="connection"
        options={{
          title: 'Connection',
        }}
      />
      <Tabs.Screen
        name="reels"
        options={{
          title: 'Reels',
        }}
      />
      <Tabs.Screen
        name="notification"
        options={{
          title: 'Notification',
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
        }}
      />
    </Tabs>
  );
}
