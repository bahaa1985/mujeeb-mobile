import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { z } from 'zod';

import { errorMessage } from '@/api';
import { useAuth } from '@/providers/auth-provider';
import { useSettings } from '@/providers/settings-provider';
import { ActionButton, ErrorBanner, Field, useColors } from '@/ui';

const loginSchema = z.object({
  mobile: z.string().trim().min(1, 'Enter your mobile number.'),
  password: z.string().min(1, 'Enter your password.'),
});
type LoginValues = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const { t } = useSettings();
  const { login } = useAuth();
  const colors = useColors();
  const scrollViewRef = useRef<ScrollView>(null);
  const [requestError, setRequestError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { mobile: '', password: '' },
  });

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      requestAnimationFrame(() => scrollViewRef.current?.scrollToEnd({ animated: true }));
    });
    return () => subscription.remove();
  }, []);

  const onSubmit = handleSubmit(async ({ mobile, password }) => {
    setRequestError('');
    setSubmitting(true);
    try {
      await login(mobile, password);
      router.replace('/(app)/(tabs)');
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 429) {
        const message = errorMessage(error, '').toLowerCase();
        setRequestError(
          message.includes('lock') || message.includes('temporarily')
            ? t('loginAccountLocked')
            : t('loginRateLimited'),
        );
      } else {
        setRequestError(errorMessage(error, t('invalidCredentials')));
      }
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <View className="flex-1 bg-slate-950">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: 16,
            paddingBottom: 32,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          <View
            className="w-full  max-w-md self-center rounded-lg p-4 shadow-xl"
            style={{ backgroundColor: colors.surface, minHeight: 300 }}
          >
            <Text style={{ color: colors.muted, fontSize: 14, textAlign: 'center', marginVertical: 8 }}>
              {t('loginWelcome')}
            </Text>
            <View className="gap-3">
              <ErrorBanner message={requestError} />
              <Controller
                control={control}
                name="mobile"
                render={({ field: { value, onChange, onBlur } }) => (
                  <Field
                    label={t('mobile')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    placeholder="20123456789"
                    error={errors.mobile?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="password"
                render={({ field: { value, onChange, onBlur } }) => (
                  <Field
                    label={t('password')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry
                    autoComplete="password"
                    textContentType="password"
                    error={errors.password?.message}
                  />
                )}
              />
              <ActionButton variant='primary' title={t('login')} onPress={onSubmit} loading={submitting} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
