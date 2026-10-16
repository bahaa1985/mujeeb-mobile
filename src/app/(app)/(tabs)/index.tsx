import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { dashboardApi, subscriptionApi } from '@/api';
import { useAuth } from '@/providers/auth-provider';
import { useSettings } from '@/providers/settings-provider';
import { ActionButton, AppText, Card, LoadingInline, PageHeader, Screen, useColors } from '@/ui';

export default function DashboardScreen() {
  const { user } = useAuth();
  const { t } = useSettings();
  const colors = useColors();
  const stats = useQuery({
    queryKey: ['dashboard', user?.pharmacy_id, user?.mobile],
    enabled: Boolean(user),
    queryFn: async () => {
      const [messages, inventory, users, orders] = await Promise.all([
        dashboardApi.messageCount(),
        dashboardApi.inventoryCount(),
        dashboardApi.usersCount(user!.pharmacy_id),
        dashboardApi.orderCount(user!.mobile),
      ]);
      return { messages, inventory, users, orders };
    },
  });
  const subscription = useQuery({
    queryKey: ['subscription', user?.pharmacy_id],
    enabled: Boolean(user?.pharmacy_id),
    queryFn: () => subscriptionApi.current(user!.pharmacy_id),
  });

  const items = [
    { label: t('totalMessages'), value: stats.data?.messages },
    { label: t('inventoryItems'), value: stats.data?.inventory },
    { label: t('users'), value: stats.data?.users },
    { label: t('orders'), value: stats.data?.orders },
  ];

  return (
    <Screen>
      <PageHeader title={t('dashboard')} subtitle={t('welcome')} />
      {subscription.data?.subscription_state === 'SUSPENDED' ? (
        <Card style={{ borderColor: colors.warning, backgroundColor: colors.primarySoft }}>
          <AppText style={{ fontWeight: '700', color: colors.warning }}>{t('renewNotice')}</AppText>
        </Card>
      ) : null}
      {stats.isLoading ? <LoadingInline /> : stats.isError ? (
        <Card>
          <AppText>{t('requestFailed')}</AppText>
          <ActionButton title={t('retry')} variant="secondary" onPress={() => void stats.refetch()} />
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          {items.map(({ label, value }) => (
            <Card key={label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText muted>{label}</AppText>
              <Text style={{ fontSize: 27, fontWeight: '800', color: colors.text }}>{value ?? 0}</Text>
            </Card>
          ))}
        </View>
      )}
      <Card>
        <AppText style={{ fontWeight: '700', fontSize: 17 }}>{user?.username}</AppText>
        <AppText muted>{user?.mobile}</AppText>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={() => router.push('/(app)/(tabs)/messages')}
            style={{ flex: 1, borderRadius: 9, backgroundColor: colors.primarySoft, padding: 13 }}
          >
            <Text style={{ color: colors.primary, fontWeight: '700', textAlign: 'center' }}>{t('messages')}</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(app)/(tabs)/inventory')}
            style={{ flex: 1, borderRadius: 9, backgroundColor: colors.primarySoft, padding: 13 }}
          >
            <Text style={{ color: colors.primary, fontWeight: '700', textAlign: 'center' }}>{t('inventory')}</Text>
          </Pressable>
        </View>
      </Card>
    </Screen>
  );
}
