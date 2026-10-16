import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Switch, Text, View } from 'react-native';
import { z } from 'zod';

import { errorMessage, usersApi } from '@/api';
import { useAuth } from '@/providers/auth-provider';
import { useSettings } from '@/providers/settings-provider';
import { ActionButton, AppText, Card, Divider, ErrorBanner, Field, Screen, useColors } from '@/ui';

const createPasswordSchema = (minimumMessage: string, mismatchMessage: string) => z.object({
  password: z.string().min(8, minimumMessage),
  confirmPassword: z.string(),
}).refine((values) => values.password === values.confirmPassword, {
  path: ['confirmPassword'],
  message: mismatchMessage,
});

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const { t, theme, setTheme, language, setLanguage } = useSettings();
  const colors = useColors();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const passwordSchema = createPasswordSchema(t('passwordTooShort'), t('passwordMismatch'));
  type PasswordForm = z.infer<typeof passwordSchema>;
  const { control, handleSubmit, reset, formState: { errors } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const aiMutation = useMutation({
    mutationFn: (aiMode: boolean) => usersApi.update(user!.id, { ai_mode: aiMode }),
    onSuccess: (updated) => updateUser({ ...user!, ai_mode: updated.ai_mode }),
    onError: () => setError(t('requestFailed')),
  });
  const passwordMutation = useMutation({
    mutationFn: (values: PasswordForm) => usersApi.update(user!.id, { password: values.password }),
    onSuccess: (updated) => {
      updateUser({ ...user!, username: updated.username, mobile: updated.mobile });
      reset();
      setError('');
      setSuccess(t('passwordUpdated'));
    },
    onError: (reason) => {
      setSuccess('');
      setError(errorMessage(reason, t('requestFailed')));
    },
  });

  const handleLogout = async () => {
    setError('');
    try {
      await logout();
    } catch (reason) {
      setError(errorMessage(reason, t('requestFailed')));
    } finally {
      queryClient.clear();
      router.replace('/(auth)/login');
    }
  };

  return (
    <Screen>
      <AppText style={{ fontSize: 27, fontWeight: '800' }}>{t('profile')}</AppText>
      <Card>
        <AppText style={{ fontSize: 20, fontWeight: '700' }}>{user?.username}</AppText>
        <AppText muted>{user?.mobile}</AppText>
      </Card>
      <ErrorBanner message={error} />
      {success ? <Text style={{ color: colors.success, fontWeight: '600' }}>{success}</Text> : null}
      <Card>
        <AppText style={{ fontWeight: '700', fontSize: 17 }}>{t('updatePassword')}</AppText>
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <Field label={t('newPassword')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} secureTextEntry error={errors.password?.message} />
          )}
        />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field }) => (
            <Field label={t('confirmPassword')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} secureTextEntry error={errors.confirmPassword?.message} />
          )}
        />
        <ActionButton title={t('updatePassword')} onPress={handleSubmit((values) => passwordMutation.mutate(values))} loading={passwordMutation.isPending} />
      </Card>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText>{t('aiMode')}</AppText>
          <Switch
            value={Boolean(user?.ai_mode)}
            disabled={aiMutation.isPending}
            onValueChange={(value) => {
              setError('');
              aiMutation.mutate(value);
            }}
            trackColor={{ true: colors.primary }}
          />
        </View>
        <Divider />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText>{t('darkMode')}</AppText>
          <Switch value={theme === 'dark'} onValueChange={(value) => void setTheme(value ? 'dark' : 'light')} trackColor={{ true: colors.primary }} />
        </View>
      </Card>
      <Card>
        <AppText style={{ fontWeight: '700' }}>{t('language')}</AppText>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {(['ar', 'en'] as const).map((value) => {
            const selected = language === value;
            return (
              <Pressable
                key={value}
                onPress={() => void setLanguage(value)}
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  borderWidth: 1,
                  borderRadius: 9,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primarySoft : colors.surface,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: selected ? colors.primary : colors.text, fontWeight: '700' }}>{value === 'ar' ? t('arabic') : t('english')}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
      <Card>
        <ActionButton title={t('showProfile')} variant="secondary" onPress={() => router.push('/(app)/settings')} />
        <ActionButton title={t('pharmacyProfile')} variant="secondary" onPress={() => router.push('/(app)/pharmacy')} />
        {user?.role_id === 2 ? (
          <ActionButton title={t('usersManagement')} variant="secondary" onPress={() => router.push('/(app)/users')} />
        ) : null}
        <ActionButton title={t('logout')} variant="danger" onPress={() => void handleLogout()} />
      </Card>
    </Screen>
  );
}
