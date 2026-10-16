import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { errorMessage, usersApi } from '@/api';
import { useAuth } from '@/providers/auth-provider';
import { useSettings } from '@/providers/settings-provider';
import { ActionButton, AppText, Card, ErrorBanner, Field, PageHeader, Screen } from '@/ui';

const profileSchema = z.object({
  username: z.string().trim().min(3).max(30),
  mobile: z.string().trim(),
  password: z.string().max(20).refine((value) => !value || value.length >= 8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match.',
});
type ProfileForm = z.infer<typeof profileSchema>;

export default function SettingsScreen() {
  const { user, updateUser } = useAuth();
  const { t } = useSettings();
  const { control, handleSubmit, reset, formState: { errors } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { username: user?.username ?? '', mobile: user?.mobile ?? '', password: '', confirmPassword: '' },
  });

  useEffect(() => {
    reset({ username: user?.username ?? '', mobile: user?.mobile ?? '', password: '', confirmPassword: '' });
  }, [user, reset]);

  const update = useMutation({
    mutationFn: async (form: ProfileForm) => {
      const payload: { username: string; mobile?: string; password?: string } = { username: form.username };
      if (user?.role_id === 2) {
        if (form.mobile.length !== 12) throw new Error('Mobile number must contain 12 digits.');
        payload.mobile = form.mobile;
      }
      if (form.password) payload.password = form.password;
      return usersApi.update(user!.id, payload);
    },
    onSuccess: (updated) => {
      updateUser({ ...user!, username: updated.username, mobile: updated.mobile });
      router.back();
    },
  });

  return (
    <Screen>
      <PageHeader title={t('accountSettings')} />
      <Card>
        <ErrorBanner message={update.error ? errorMessage(update.error, t('requestFailed')) : ''} />
        <Controller control={control} name="username" render={({ field }) => <Field label={t('username')} value={field.value} onChangeText={field.onChange} error={errors.username?.message} />} />
        {user?.role_id === 2 ? <Controller control={control} name="mobile" render={({ field }) => <Field label={t('mobile')} value={field.value} onChangeText={field.onChange} keyboardType="phone-pad" error={errors.mobile?.message} />} /> : null}
        <Controller control={control} name="password" render={({ field }) => <Field label={t('password')} value={field.value} onChangeText={field.onChange} secureTextEntry error={errors.password?.message} />} />
        <Controller control={control} name="confirmPassword" render={({ field }) => <Field label="Confirm password" value={field.value} onChangeText={field.onChange} secureTextEntry error={errors.confirmPassword?.message} />} />
        <AppText muted>Leave the password fields blank to keep your current password.</AppText>
        <ActionButton title={t('save')} onPress={handleSubmit((values) => update.mutate(values))} loading={update.isPending} />
      </Card>
    </Screen>
  );
}
