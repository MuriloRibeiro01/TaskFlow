import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/theme';

function TabIcon({ name, focused }: { name: React.ComponentProps<typeof Ionicons>['name']; focused: boolean }) {
  return (
    <View style={styles.iconWrapper}>
      <Ionicons name={name} size={22} color={Colors.papel} strokeWidth={1.2} />
      {focused && <View style={styles.activeDot} />}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarActiveTintColor: Colors.papel,
        tabBarInactiveTintColor: Colors.cinza,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tarefas',
          tabBarIcon: ({ focused }) => <TabIcon name="list-outline" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="timer"
        options={{
          title: 'Timer',
          tabBarIcon: ({ focused }) => <TabIcon name="timer-outline" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused }) => <TabIcon name="person-outline" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.tinta,
    borderTopWidth: 0,
    height: 80,
    paddingBottom: 20,
    paddingTop: 8,
  },
  tabLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  iconWrapper: {
    alignItems: 'center',
    gap: 3,
  },
  activeDot: {
    width: 3,
    height: 3,
    backgroundColor: Colors.vermelho,
  },
});
