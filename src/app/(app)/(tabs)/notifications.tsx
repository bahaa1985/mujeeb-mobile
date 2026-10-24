import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { notificationsApi } from '@/api';
import { useSettings } from '@/providers/settings-provider';
import { ActionButton, AppText, Card, EmptyState, ErrorBanner, LoadingInline, PageHeader, Screen, useColors } from '@/ui';

export default function NotificationsScreen() {
  const { t, language } = useSettings();
  const colors = useColors();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const notificationQuery = useQuery({
    queryKey: ['notifications', page],
    queryFn: () => notificationsApi.list(page, 20),
  });
  const markRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = notificationQuery.data?.data ?? [];
  const lastPage = notificationQuery.data?.meta.lastPage ?? 1;
  const unreadCount = notificationQuery.data?.unreadCount ?? 0;

  return (
    <Screen>
      <PageHeader title={t('notifications')} subtitle={t('notificationsSubtitle')} />
      {unreadCount > 0 ? (
        <ActionButton title={t('markAllRead')} variant="secondary" loading={markRead.isPending} onPress={() => markRead.mutate()} />
      ) : null}
      {markRead.isError ? <ErrorBanner message={t('requestFailed')} /> : null}
      {notificationQuery.isLoading ? <LoadingInline /> : notificationQuery.isError ? (
        <Card><ErrorBanner message={t('requestFailed')} /><ActionButton title={t('retry')} onPress={() => void notificationQuery.refetch()} /></Card>
      ) : notifications.length === 0 ? <EmptyState title={t('noNotifications')} /> : (
        <View style={{ gap: 10 }}>
          {notifications.map((notification) => (
            <Pressable
              key={String(notification.id)}
              onPress={() => {
                if (notification.type !== 'ORDER_REQUEST' && notification.type !== 'AMBIGUOUS_MESSAGE') return;
                const contact = notification.data?.contactNumber
                  ?? notification.data?.fromNumber
                  ?? notification.data?.from_number
                  ?? notification.data?.contact_number;
                router.push({
                  pathname: '/(app)/(tabs)/messages',
                  params: typeof contact === 'string' ? { contactNumber: contact } : {},
                });
              }}
            >
              <Card style={{
                borderColor: !notification.is_read ? colors.primary : colors.border,
                backgroundColor: !notification.is_read ? colors.primarySoft : colors.surface,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <AppText style={{ flex: 1, fontWeight: '700' }}>{notification.title}</AppText>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {new Date(notification.created_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                  </Text>
                </View>
                <AppText muted>{notification.body}</AppText>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
      {lastPage > 1 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <ActionButton title={t('previous')} variant="secondary" disabled={page <= 1} onPress={() => setPage((current) => Math.max(1, current - 1))} />
          </View>
          <AppText muted>{page} / {lastPage}</AppText>
          <View style={{ flex: 1 }}>
            <ActionButton title={t('next')} variant="secondary" disabled={page >= lastPage} onPress={() => setPage((current) => Math.min(lastPage, current + 1))} />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
