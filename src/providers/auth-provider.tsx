import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { authApi, setUnauthorizedHandler, usersApi } from '@/api';
import { requestNotificationPermission } from '@/notifications';
import { authTokenStorage } from '@/storage';
import type { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (mobile: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function registerDevicePushToken() {
  if (Platform.OS === 'web' || !Device.isDevice) return;

  if (!(await requestNotificationPermission())) {
    console.warn('Notification permission was not granted; push token registration was skipped.');
    return;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('Expo project ID is required to register push notifications.');
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await usersApi.savePushToken(token.data);
}

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const authOperationId = useRef(0);

  useEffect(() => setUnauthorizedHandler(() => {
    authOperationId.current += 1;
    setUser(null);
    setLoading(false);
  }), []);

  useEffect(() => {
    let mounted = true;
    const operationId = ++authOperationId.current;
    void authTokenStorage.get()
      .then(async (token) => {
        if (!token) return null;
        const currentUser = await authApi.currentUser();
        if (currentUser.role_id !== 2 && currentUser.role_id !== 3) {
          await authTokenStorage.clear();
          return null;
        }
        return currentUser;
      })
      .then((currentUser) => {
        if (mounted && operationId === authOperationId.current) {
          setUser(currentUser);
          if (currentUser) {
            void registerDevicePushToken().catch((error) => console.warn('Push registration failed:', error));
          }
        }
      })
      .catch(async () => {
        if (operationId === authOperationId.current) {
          await authTokenStorage.clear();
          if (mounted) setUser(null);
        }
      })
      .finally(() => {
        if (mounted && operationId === authOperationId.current) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const login = useCallback(async (mobile: string, password: string) => {
    const operationId = ++authOperationId.current;
    setLoading(true);
    try {
      const loggedInUser = await authApi.login(mobile, password);
      if (loggedInUser.role_id !== 2 && loggedInUser.role_id !== 3) {
        if (operationId === authOperationId.current) await authTokenStorage.clear();
        throw new Error('This app is for pharmacy admins and staff pharmacists.');
      }
      if (operationId === authOperationId.current) {
        setUser(loggedInUser);
        await registerDevicePushToken().catch((error) => console.warn('Push registration failed:', error));
      }
      return loggedInUser;
    } finally {
      if (operationId === authOperationId.current) setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    const operationId = ++authOperationId.current;
    try {
      await authApi.logout();
    } finally {
      if (operationId === authOperationId.current) {
        await authTokenStorage.clear();
        setUser(null);
      }
    }
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    updateUser: setUser,
  }), [user, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
};
