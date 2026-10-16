import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Modal, Text, View } from 'react-native';
import { z } from 'zod';

import { errorMessage, usersApi } from '@/api';
import { useAuth } from '@/providers/auth-provider';
import { useSettings } from '@/providers/settings-provider';
import type { User } from '@/types';
import { ActionButton, AppText, Card, EmptyState, ErrorBanner, Field, LoadingInline, PageHeader, Screen, useColors } from '@/ui';

const createUserSchema = z.object({
  username: z.string().trim().min(3).max(30),
  mobile: z.string().trim().min(10).max(13),
  password: z.string().min(8).max(20),
});
type CreateUserForm = z.infer<typeof createUserSchema>;

const editUserSchema = z.object({
  username: z.string().trim().min(3).max(30),
  mobile: z.string().trim().min(10).max(13),
  password: z.string().max(20).refine((password) => !password || password.length >= 8),
});
type EditUserForm = z.infer<typeof editUserSchema>;

export default function UsersScreen() {
  const { user } = useAuth();
  const { t } = useSettings();
  const colors = useColors();
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [requestError, setRequestError] = useState('');
  const users = useQuery({
    queryKey: ['pharmacy-users', user?.pharmacy_id],
    enabled: user?.role_id === 2,
    queryFn: () => usersApi.list(user!.pharmacy_id),
  });
  const { control, handleSubmit, reset, formState: { errors } } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { username: '', mobile: '', password: '' },
  });
  const { control: editControl, handleSubmit: handleEditSubmit, reset: resetEdit, formState: editFormState } = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { username: '', mobile: '', password: '' },
  });

  useEffect(() => {
    resetEdit({
      username: editingUser?.username ?? '',
      mobile: editingUser?.mobile ?? '',
      password: '',
    });
  }, [editingUser, resetEdit]);

  const invalidateUsers = () =>
    queryClient.invalidateQueries({ queryKey: ['pharmacy-users', user?.pharmacy_id] });
  const create = useMutation({
    mutationFn: (values: CreateUserForm) => usersApi.create({ ...values, pharmacy_id: user!.pharmacy_id, role_id: 3 }),
    onSuccess: async () => {
      reset();
      setRequestError('');
      await invalidateUsers();
    },
    onError: (reason) => setRequestError(errorMessage(reason, t('requestFailed'))),
  });
  const update = useMutation({
    mutationFn: ({ id, values }: { id: number; values: EditUserForm }) => usersApi.update(id, {
      username: values.username,
      mobile: values.mobile,
      ...(values.password ? { password: values.password } : {}),
    }),
    onSuccess: async () => {
      setEditingUser(null);
      setRequestError('');
      await invalidateUsers();
    },
    onError: (reason) => setRequestError(errorMessage(reason, t('requestFailed'))),
  });
  const setUserActive = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => usersApi.update(id, { is_active: active }),
    onSuccess: async () => {
      setRequestError('');
      await invalidateUsers();
    },
    onError: (reason) => setRequestError(errorMessage(reason, t('requestFailed'))),
  });

  if (user?.role_id !== 2) return <Redirect href="/(app)/(tabs)/profile" />;

  return (
    <Screen>
      <PageHeader title={t('usersManagement')} />
      <ErrorBanner message={requestError} />
      <Card>
        <AppText style={{ fontWeight: '700', fontSize: 17 }}>{t('createStaff')}</AppText>
        <Controller control={control} name="username" render={({ field }) => <Field label={t('username')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.username?.message} />} />
        <Controller control={control} name="mobile" render={({ field }) => <Field label={t('mobile')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} keyboardType="phone-pad" error={errors.mobile?.message} />} />
        <Controller control={control} name="password" render={({ field }) => <Field label={t('password')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} secureTextEntry error={errors.password?.message} />} />
        <ActionButton title={t('create')} onPress={handleSubmit((values) => create.mutate(values))} loading={create.isPending} />
      </Card>
      {users.isLoading ? <LoadingInline /> : users.isError ? (
        <Card><ErrorBanner message={errorMessage(users.error, t('requestFailed'))} /><ActionButton title={t('retry')} onPress={() => void users.refetch()} /></Card>
      ) : users.data?.length ? users.data.map((pharmacyUser) => (
        <Card key={pharmacyUser.id}>
          <AppText style={{ fontWeight: '700' }}>{pharmacyUser.username}</AppText>
          <AppText muted>{pharmacyUser.mobile} · {pharmacyUser.role_id === 2 ? t('admin') : t('staff')}</AppText>
          <Text style={{ color: pharmacyUser.is_active ? colors.success : colors.danger, fontSize: 12 }}>
            {pharmacyUser.is_active ? t('active') : t('inactive')}
          </Text>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <ActionButton
                title={t('edit')}
                variant="secondary"
                onPress={() => {
                  setRequestError('');
                  setEditingUser(pharmacyUser);
                }}
              />
            </View>
            {pharmacyUser.id !== user.id ? (
              <View className="flex-1">
                <ActionButton
                  title={pharmacyUser.is_active ? t('deactivate') : t('activate')}
                  variant={pharmacyUser.is_active ? 'danger' : 'primary'}
                  loading={setUserActive.isPending}
                  onPress={() => setUserActive.mutate({ id: pharmacyUser.id, active: !pharmacyUser.is_active })}
                />
              </View>
            ) : null}
          </View>
        </Card>
      )) : <EmptyState title={t('emptyUsers')} />}
      <Modal
        visible={Boolean(editingUser)}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingUser(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 px-5">
          <View className="w-full max-w-md gap-3 rounded-xl border p-5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <AppText style={{ fontSize: 18, fontWeight: '800' }}>{t('edit')} · {editingUser?.username}</AppText>
            <ErrorBanner message={update.error ? errorMessage(update.error, t('requestFailed')) : ''} />
            <Controller control={editControl} name="username" render={({ field }) => <Field label={t('username')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={editFormState.errors.username?.message} />} />
            <Controller control={editControl} name="mobile" render={({ field }) => <Field label={t('mobile')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} keyboardType="phone-pad" error={editFormState.errors.mobile?.message} />} />
            <Controller control={editControl} name="password" render={({ field }) => <Field label={t('newPassword')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} secureTextEntry error={editFormState.errors.password?.message} />} />
            <AppText muted>{t('passwordBlankHint')}</AppText>
            <ActionButton
              title={t('updateUser')}
              loading={update.isPending}
              onPress={handleEditSubmit((values) => {
                if (editingUser) update.mutate({ id: editingUser.id, values });
              })}
            />
            <ActionButton title={t('cancel')} variant="secondary" disabled={update.isPending} onPress={() => setEditingUser(null)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
