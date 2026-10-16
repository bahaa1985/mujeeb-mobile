import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Switch, View } from 'react-native';
import { z } from 'zod';

import { errorMessage, pharmacyApi } from '@/api';
import { useAuth } from '@/providers/auth-provider';
import { useSettings } from '@/providers/settings-provider';
import { ActionButton, AppText, Card, ErrorBanner, Field, LoadingInline, PageHeader, Screen, useColors } from '@/ui';

const pharmacySchema = z.object({
  pharmacy_name: z.string().trim().min(9, 'Enter at least 9 characters.').max(50),
  pharmacy_address: z.string().trim().min(5, 'Enter at least 5 characters.').max(50),
  work_time: z.string().trim().min(5, 'Enter your working hours.').max(50),
  delivery: z.boolean(),
  delivery_price: z.string().refine((value) => value === '' || Number.isFinite(Number(value)), 'Enter a valid price.'),
});
type PharmacyForm = z.infer<typeof pharmacySchema>;

export default function PharmacyScreen() {
  const { user } = useAuth();
  const { t } = useSettings();
  const colors = useColors();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const pharmacy = useQuery({
    queryKey: ['pharmacy', user?.pharmacy_id],
    enabled: Boolean(user?.pharmacy_id),
    queryFn: () => pharmacyApi.get(user!.pharmacy_id),
  });
  const { control, handleSubmit, reset, formState: { errors } } = useForm<PharmacyForm>({
    resolver: zodResolver(pharmacySchema),
    defaultValues: { pharmacy_name: '', pharmacy_address: '', work_time: '', delivery: false, delivery_price: '' },
  });

  useEffect(() => {
    if (pharmacy.data) reset({
      pharmacy_name: pharmacy.data.pharmacy_name,
      pharmacy_address: pharmacy.data.pharmacy_address,
      work_time: pharmacy.data.work_time,
      delivery: pharmacy.data.delivery,
      delivery_price: String(pharmacy.data.delivery_price ?? ''),
    });
  }, [pharmacy.data, reset]);

  const update = useMutation({
    mutationFn: (data: PharmacyForm) => pharmacyApi.update(user!.pharmacy_id, {
      ...data,
      delivery_price: Number(data.delivery_price || 0),
    }),
    onSuccess: async () => {
      setError('');
      await queryClient.invalidateQueries({ queryKey: ['pharmacy', user?.pharmacy_id] });
    },
    onError: (reason) => setError(errorMessage(reason, t('requestFailed'))),
  });
  const submit = handleSubmit((values) => update.mutate(values));

  if (user?.role_id !== 2) {
    return <Screen><PageHeader title={t('pharmacyProfile')} /><Card><AppText>{t('requestFailed')}</AppText><ActionButton title={t('cancel')} variant="secondary" onPress={() => router.back()} /></Card></Screen>;
  }

  return (
    <Screen>
      <PageHeader title={t('pharmacyProfile')} />
      {pharmacy.isLoading ? <LoadingInline /> : null}
      {pharmacy.isError ? <ErrorBanner message={t('requestFailed')} /> : null}
      <ErrorBanner message={error} />
      <Card>
        <Controller control={control} name="pharmacy_name" render={({ field }) => <Field label={t('pharmacyProfile')} value={field.value} onChangeText={field.onChange} error={errors.pharmacy_name?.message} />} />
        <Controller control={control} name="pharmacy_address" render={({ field }) => <Field label={t('address')} value={field.value} onChangeText={field.onChange} error={errors.pharmacy_address?.message} />} />
        <Controller control={control} name="work_time" render={({ field }) => <Field label={t('workingHours')} value={field.value} onChangeText={field.onChange} error={errors.work_time?.message} />} />
        <Controller control={control} name="delivery" render={({ field }) => (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText>{t('delivery')}</AppText>
            <Switch value={field.value} onValueChange={field.onChange} trackColor={{ true: colors.primary }} />
          </View>
        )} />
        <Controller control={control} name="delivery_price" render={({ field }) => <Field label={t('deliveryPrice')} value={field.value} onChangeText={field.onChange} keyboardType="decimal-pad" error={errors.delivery_price?.message} />} />
        <ActionButton title={t('save')} onPress={submit} loading={update.isPending} />
      </Card>
    </Screen>
  );
}
