import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ColorTheme, Fonts } from '@/theme';
import { useTheme } from '@/hooks/useTheme';

function TabIcon({ name, focused }: { name: React.ComponentProps<typeof Ionicons>['name']; focused: boolean }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  return (
    <View style={styles.iconWrapper}>
      <Ionicons name={name} size={22} color={colors.textoClaro} strokeWidth={1.2} />
      {focused && <View style={styles.activeDot} />}
    </View>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarActiveTintColor: colors.textoClaro,
        tabBarInactiveTintColor: colors.cinza,
        lazy: true,
        tabBarHideOnKeyboard: true,
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

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    tabBar: {
      backgroundColor: colors.tinta,
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
      backgroundColor: colors.vermelho,
    },
  });
}

let cachedStyles: ReturnType<typeof createStyles> | null = null;
let cachedTheme: ColorTheme | null = null;

function getStyles(colors: ColorTheme) {
  if (cachedStyles && cachedTheme === colors) {
    return cachedStyles;
  }
  cachedTheme = colors;
  cachedStyles = createStyles(colors);
  return cachedStyles;
}
