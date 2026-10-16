import { Redirect } from 'expo-router';

import { useAuth } from '@/providers/auth-provider';
import { LoadingScreen } from '@/ui';

export default function IndexRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  return <Redirect href={user ? '/(app)/(tabs)' : '/(auth)/login'} />;
}
