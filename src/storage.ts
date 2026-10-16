import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_KEY = 'pharmacydb-mobile-token';
const SETTINGS_KEY = 'pharmacydb-mobile-settings';

const read = async (key: string) => {
  if (Platform.OS === 'web') {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
};

const write = async (key: string, value: string) => {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
};

const remove = async (key: string) => {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
};

export const authTokenStorage = {
  get: () => read(AUTH_TOKEN_KEY),
  set: (token: string) => write(AUTH_TOKEN_KEY, token),
  clear: () => remove(AUTH_TOKEN_KEY),
};

export const settingsStorage = {
  get: () => read(SETTINGS_KEY),
  set: (settings: string) => write(SETTINGS_KEY, settings),
};
