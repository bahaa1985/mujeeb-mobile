import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/providers/auth-provider';
import { LoadingScreen } from '@/ui';

export default function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Redirect href="/(auth)/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
