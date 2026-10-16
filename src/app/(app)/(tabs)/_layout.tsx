import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

import type { TranslationKey } from '@/i18n';
import { useSettings } from '@/providers/settings-provider';
import { useColors } from '@/ui';

const tabs = [
  {
    name: 'index',
    label: 'dashboard',
    iosIcon: 'square.grid.2x2.fill',
    androidIcon: 'dashboard',
  },
  {
    name: 'messages',
    label: 'messages',
    iosIcon: 'message.fill',
    androidIcon: 'chat',
  },
  {
    name: 'inventory',
    label: 'inventory',
    iosIcon: 'shippingbox.fill',
    androidIcon: 'inventory_2',
  },
  {
    name: 'notifications',
    label: 'notifications',
    iosIcon: 'bell.fill',
    androidIcon: 'notifications',
  },
  {
    name: 'profile',
    label: 'profile',
    iosIcon: 'person.crop.circle.fill',
    androidIcon: 'person',
  },
] satisfies readonly {
  name: 'index' | 'messages' | 'inventory' | 'notifications' | 'profile';
  label: TranslationKey;
  iosIcon: SFSymbol;
  androidIcon: AndroidSymbol;
}[];

export default function TabLayout() {
  const { t, direction } = useSettings();
  const colors = useColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 68,
          paddingTop: 7,
          paddingBottom: 8,
          direction,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          writingDirection: direction,
          textAlign: 'center',
        },
        tabBarIconStyle: { marginBottom: 1 },
      }}
    >
      {tabs.map(({ name, label, iosIcon, androidIcon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: t(label),
            tabBarLabel: t(label),
            tabBarIcon: ({ color, focused }) => (
              <View className="items-center justify-center">
                <SymbolView
                  name={{
                    ios: iosIcon,
                    android: androidIcon,
                    web: androidIcon,
                  }}
                  size={22}
                  tintColor={color}
                  weight={focused ? 'semibold' : 'regular'}
                />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
