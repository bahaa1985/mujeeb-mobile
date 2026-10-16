import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';

import { errorMessage, messagesApi, usersApi } from '@/api';
import { realtimeClient } from '@/realtime';
import { useAuth } from '@/providers/auth-provider';
import { useSettings } from '@/providers/settings-provider';
import { ActionButton, AppText, Card, EmptyState, ErrorBanner, Field, LoadingInline, PageHeader, Screen, useColors } from '@/ui';

export default function MessagesScreen() {
  const { user } = useAuth();
  const { t } = useSettings();
  const colors = useColors();
  const queryClient = useQueryClient();
  const routeParams = useLocalSearchParams<{ contactNumber?: string }>();
  const [ownerMobile, setOwnerMobile] = useState(user?.mobile ?? '');
  const [selectedContactNumber, setSelectedContactNumber] = useState('');
  const contactNumber = typeof routeParams.contactNumber === 'string'
    ? routeParams.contactNumber
    : selectedContactNumber;
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [requestError, setRequestError] = useState('');
  const [blockConfirmationVisible, setBlockConfirmationVisible] = useState(false);

  const pharmacyUsers = useQuery({
    queryKey: ['pharmacy-users', user?.pharmacy_id],
    enabled: user?.role_id === 2,
    queryFn: () => usersApi.list(user!.pharmacy_id),
  });
  const contacts = useQuery({
    queryKey: ['contacts', ownerMobile],
    enabled: Boolean(ownerMobile),
    queryFn: () => messagesApi.getContacts(ownerMobile),
  });
  const blocked = useQuery({
    queryKey: ['blocked-contacts'],
    queryFn: () => messagesApi.getBlocked(),
  });
  const selectedContact = contacts.data?.find((contact) => contact.contact_mobile === contactNumber);
  const blockedNumbers = useMemo(
    () => new Set(blocked.data?.filter((item) => item.blocked).map((item) => item.contact_number) ?? []),
    [blocked.data],
  );
  const conversation = useInfiniteQuery({
    queryKey: ['conversation', user?.pharmacy_id, ownerMobile, contactNumber],
    enabled: Boolean(ownerMobile && contactNumber),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => messagesApi.getPage(ownerMobile, contactNumber, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const client = realtimeClient;
    if (!user || !client) return;
    const channel = client
      .channel(`mobile-messages-${user.pharmacy_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `pharmacy_id=eq.${user.pharmacy_id}`,
        },
        () => void queryClient.invalidateQueries({ queryKey: ['conversation', user.pharmacy_id] }),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [queryClient, user]);

  const messageRows = useMemo(
    () => conversation.data?.pages.flatMap((page) => page.data) ?? [],
    [conversation.data],
  );
  const matchingContacts = (contacts.data ?? []).filter((contact) => {
    const text = `${contact.contact_name ?? ''} ${contact.contact_mobile}`.toLowerCase();
    return text.includes(search.trim().toLowerCase());
  });
  const sendMessage = useMutation({
    mutationFn: (text: string) => messagesApi.send(contactNumber, text),
    onSuccess: () => {
      setDraft('');
      void queryClient.invalidateQueries({ queryKey: ['conversation', user?.pharmacy_id, ownerMobile, contactNumber] });
    },
    onError: (error) => setRequestError(errorMessage(error, t('requestFailed'))),
  });
  const toggleBlock = useMutation({
    mutationFn: () => messagesApi.toggleBlock(contactNumber, !blockedNumbers.has(contactNumber)),
    onSuccess: async () => {
      setBlockConfirmationVisible(false);
      await queryClient.invalidateQueries({ queryKey: ['blocked-contacts'] });
    },
    onError: (error) => setRequestError(errorMessage(error, t('requestFailed'))),
  });

  const closeConversation = () => {
    setSelectedContactNumber('');
    setRequestError('');
    if (typeof routeParams.contactNumber === 'string') router.replace('/(app)/(tabs)/messages');
  };

  if (!contactNumber) {
    return (
      <Screen>
        <PageHeader title={t('messages')} subtitle={t('searchContacts')} />
        {user?.role_id === 2 && pharmacyUsers.data && pharmacyUsers.data.length > 1 ? (
          <Card>
            <AppText style={{ fontWeight: '700' }}>{t('usersManagement')}</AppText>
            <View style={{ gap: 8 }}>
              {pharmacyUsers.data.map((pharmacyUser) => (
                <Pressable
                  key={pharmacyUser.id}
                  onPress={() => setOwnerMobile(pharmacyUser.mobile)}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: ownerMobile === pharmacyUser.mobile ? colors.primary : colors.border,
                    backgroundColor: ownerMobile === pharmacyUser.mobile ? colors.primarySoft : colors.surface,
                  }}
                >
                  <AppText>{pharmacyUser.username} · {pharmacyUser.mobile}</AppText>
                </Pressable>
              ))}
            </View>
          </Card>
        ) : null}
        <Field label={t('searchContacts')} value={search} onChangeText={setSearch} autoCapitalize="none" />
        {contacts.isLoading ? <LoadingInline /> : contacts.isError ? (
          <Card><ErrorBanner message={t('requestFailed')} /><ActionButton title={t('retry')} onPress={() => void contacts.refetch()} /></Card>
        ) : matchingContacts.length === 0 ? <EmptyState title={t('noContacts')} /> : (
          <View style={{ gap: 8 }}>
            {matchingContacts.map((contact) => (
              <Pressable key={contact.id} onPress={() => { setSelectedContactNumber(contact.contact_mobile); setRequestError(''); }}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.primary, fontWeight: '800' }}>{(contact.contact_name || contact.contact_mobile).slice(0, 1)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontWeight: '700' }}>{contact.contact_name || contact.contact_mobile}</AppText>
                    <AppText muted>{contact.contact_mobile}</AppText>
                  </View>
                  {blockedNumbers.has(contact.contact_mobile) ? <AppText muted>●</AppText> : null}
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <>
      <KeyboardAvoidingView style={{ flex: 1, gap: 10 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={closeConversation} hitSlop={10}><Text style={{ color: colors.primary, fontSize: 17, fontWeight: '700' }}>‹ {t('messages')}</Text></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>{selectedContact?.contact_name || contactNumber}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{contactNumber}</Text>
          </View>
          <Pressable onPress={() => setBlockConfirmationVisible(true)} disabled={toggleBlock.isPending} style={{ padding: 8 }}>
            <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '700' }}>
              {blockedNumbers.has(contactNumber) ? t('unblock') : t('block')}
            </Text>
          </Pressable>
        </View>
        <ErrorBanner message={requestError || (conversation.isError ? t('requestFailed') : '')} />
        <View style={{ flex: 1, gap: 8 }}>
          {conversation.isLoading ? <LoadingInline /> : (
            <FlatList
              style={{ flex: 1 }}
              inverted
              data={messageRows}
              keyExtractor={(message) => message.id}
              onEndReached={() => {
                if (conversation.hasNextPage && !conversation.isFetchingNextPage) void conversation.fetchNextPage();
              }}
              onEndReachedThreshold={0.35}
              ListEmptyComponent={<EmptyState title={t('noMessages')} />}
              ListFooterComponent={conversation.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : null}
              contentContainerStyle={{ flexGrow: 1, justifyContent: messageRows.length ? 'flex-start' : 'center', gap: 8, paddingVertical: 8 }}
              renderItem={({ item: message }) => {
                const own = message.message_type === 5 || message.message_type === 6 || message.from_number === ownerMobile;
                return (
                  <View style={{ alignItems: own ? 'flex-end' : 'flex-start' }}>
                    <View style={{
                      maxWidth: '88%',
                      padding: 11,
                      borderRadius: 12,
                      backgroundColor: own ? colors.primarySoft : colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}>
                      {message.image_url ? <Image source={{ uri: message.image_url }} style={{ width: 210, height: 170, borderRadius: 8, marginBottom: 6 }} resizeMode="cover" /> : null}
                      <Text style={{ color: colors.text, textAlign: 'left', writingDirection: 'auto' }}>{message.message || (message.image_url ? 'Image' : '')}</Text>
                      <Text style={{ color: colors.muted, fontSize: 10, marginTop: 5, textAlign: 'right' }}>{new Date(message.created_at).toLocaleTimeString()}</Text>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field label={t('messagePlaceholder')} value={draft} onChangeText={setDraft} multiline />
          </View>
          <View style={{ width: 116, paddingBottom: 1 }}>
            <ActionButton
              title={t('sendMessage')}
              disabled={!draft.trim()}
              loading={sendMessage.isPending}
              onPress={() => {
                setRequestError('');
                sendMessage.mutate(draft.trim());
              }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
      <Modal
        visible={blockConfirmationVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBlockConfirmationVisible(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 px-5">
          <View className="w-full max-w-md rounded-xl border p-5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <AppText style={{ fontSize: 18, fontWeight: '800' }}>
              {blockedNumbers.has(contactNumber) ? t('unblock') : t('block')}
            </AppText>
            <AppText muted>{selectedContact?.contact_name || contactNumber}</AppText>
            <ErrorBanner message={requestError} />
            <ActionButton
              title={blockedNumbers.has(contactNumber) ? t('unblock') : t('block')}
              variant={blockedNumbers.has(contactNumber) ? 'primary' : 'danger'}
              loading={toggleBlock.isPending}
              onPress={() => {
                setRequestError('');
                toggleBlock.mutate();
              }}
            />
            <ActionButton
              title={t('cancel')}
              variant="secondary"
              disabled={toggleBlock.isPending}
              onPress={() => setBlockConfirmationVisible(false)}
            />
          </View>
        </View>
      </Modal>
      </>
    </Screen>
  );
}
