import { create, isAxiosError } from 'axios';

import { authTokenStorage } from '@/storage';
import type {
  AppNotification,
  Contact,
  InventoryPage,
  Message,
  MessagePage,
  NotificationPage,
  Pharmacy,
  Subscription,
  User,
} from '@/types';

const defaultApiBaseUrl = typeof window === 'undefined'
  ? 'http://localhost:3000'
  : `${window.location.protocol}//${window.location.hostname}:3000`;

const api = create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL || defaultApiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'mobile',
  },
  timeout: 30_000,
});

let unauthorizedHandler: (() => void) | null = null;

export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
};

api.interceptors.request.use(async (config) => {
  const token = await authTokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const requestPath = isAxiosError(error)
      ? error.config?.url?.split('?')[0].replace(/\/+$/, '')
      : undefined;
    if (isAxiosError(error) && error.response?.status === 401 && !requestPath?.endsWith('/login')) {
      try {
        await authTokenStorage.clear();
      } finally {
        unauthorizedHandler?.();
      }
    }
    return Promise.reject(error);
  },
);

export const errorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError(error)) {
    const responseMessage = error.response?.data?.message ?? error.response?.data?.error;
    if (typeof responseMessage === 'string') return responseMessage;
  }
  return error instanceof Error ? error.message : fallback;
};

export const authApi = {
  login: async (mobile: string, password: string) => {
    const { data } = await api.post<{ success?: boolean; user: User; token?: string }>(
      '/login',
      { mobile, password },
    );
    if (!data.token) throw new Error('The server did not return a mobile session token.');
    await authTokenStorage.set(data.token);
    return data.user;
  },
  currentUser: async () => {
    const { data } = await api.get<User>('/me');
    return data;
  },
  logout: () => api.post('/logout'),
};

export const dashboardApi = {
  messageCount: async () => (await api.get<Message[]>('/messages/pharmacy')).data.length,
  inventoryCount: async () => (await api.get<number>('/inventory/pharmacy')).data,
  usersCount: async (pharmacyId: number) => (await api.get<User[]>(`/users/all/${pharmacyId}`)).data.length,
  orderCount: async (mobile: string) => (await api.get<number>(`/messages/orders/count/user/${encodeURIComponent(mobile)}`)).data,
};

export const messagesApi = {
  getContacts: async (userMobile: string) =>
    (await api.get<Contact[]>('/contacts', { params: { userMobile } })).data,
  getBlocked: async () => (await api.get<{ contact_number: string; blocked: boolean }[]>('/contacts/blocked')).data,
  getPage: async (userMobile: string, contactNumber: string, cursorId?: string) =>
    (await api.get<MessagePage>(`/messages/user/${encodeURIComponent(userMobile)}`, {
      params: { contactNumber, cursorId, limit: 20 },
    })).data,
  send: async (contactNumber: string, message: string) =>
    (await api.post<Message>('/messages/new', { to_number: contactNumber, message, message_type: 6 })).data,
  toggleBlock: async (phone: string, block: boolean) =>
    (await api.post('/contacts/toggle-block', { phone, block })).data,
};

export const inventoryApi = {
  count: async () => (await api.get<number>('/inventory/pharmacy')).data,
  list: async (params: { page: number; limit: number; search: string; stock: 'all' | 'in' | 'out' }) =>
    (await api.get<InventoryPage>('/inventory', { params })).data,
  upload: async (rows: Record<string, unknown>[], pharmacyId: number) =>
    (await api.post('/inventory/upload', { rows, pharmacy_id: pharmacyId })).data,
};

export const notificationsApi = {
  list: async (page: number, limit = 20) =>
    (await api.get<NotificationPage>('/notifications', { params: { page, limit } })).data,
  markAllRead: () => api.patch('/notifications/read'),
};

export const pharmacyApi = {
  get: async (pharmacyId: number) => (await api.get<Pharmacy>(`/pharmacy/${pharmacyId}`)).data,
  update: async (pharmacyId: number, data: Partial<Pharmacy>) =>
    (await api.patch<Pharmacy>(`/pharmacy/update/${pharmacyId}`, data)).data,
};

export const usersApi = {
  list: async (pharmacyId: number) => (await api.get<User[]>(`/users/all/${pharmacyId}`)).data,
  create: async (data: Pick<User, 'username' | 'mobile' | 'role_id' | 'pharmacy_id'> & { password: string }) =>
    (await api.post<User>('/users/new', data)).data,
  update: async (userId: number, data: Partial<User> & { password?: string }) =>
    (await api.patch<User>(`/users/update/${userId}`, data)).data,
  deactivate: async (userId: number) => api.patch(`/users/deactivate/${userId}`),
  savePushToken: async (fcmToken: string) => api.post('/users/update-fcm-token', { fcmToken }),
};

export const subscriptionApi = {
  current: async (pharmacyId: number) => {
    const { data } = await api.get<{ data: Subscription[] }>('/subscriptions/list');
    return data.data.find((subscription) => Number(subscription.pharmacy_id) === pharmacyId) ?? null;
  },
};

export const notificationFromData = (notification: AppNotification) => notification.data;

export default api;
