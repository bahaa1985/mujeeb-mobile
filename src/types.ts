export interface User {
  id: number;
  username: string;
  mobile: string;
  avatar?: string | null;
  role_id: number;
  pharmacy_id: number;
  ai_mode: boolean;
  is_active: boolean;
  instance_name?: string | null;
  instance_status?: string | null;
}

export interface Pharmacy {
  id: number;
  pharmacy_name: string;
  pharmacy_address: string;
  work_time: string;
  delivery: boolean;
  delivery_price: number;
  logo?: string | null;
}

export interface Contact {
  id: string;
  contact_name: string | null;
  contact_mobile: string;
  user_mobile: string;
}

export interface Message {
  id: string;
  message?: string | null;
  message_type: number;
  created_at: string;
  pharmacy_id: string;
  from_number: string;
  to_number: string;
  image_url?: string | null;
}

export interface MessagePage {
  data: Message[];
  nextCursor: string | null;
}

export interface AppNotification {
  id: string | number;
  title: string;
  body: string;
  is_read: boolean;
  type: string;
  created_at: string;
  data?: Record<string, unknown> | null;
}

export interface NotificationPage {
  data: AppNotification[];
  meta: { total: number; page: number; limit: number; lastPage: number };
  unreadCount: number;
}

export interface InventoryItem {
  id: string;
  pharmacy_id: number;
  en_name: string | null;
  ar_name: string | null;
  price: number | null;
  units_count: number | null;
  dosage_form: string | null;
  drug_type: string | null;
  active_material: string | null;
  quantity: number | null;
}

export interface InventoryPage {
  data: InventoryItem[];
  meta: { total: number; page: number; limit: number; lastPage: number };
}

export interface Subscription {
  id: number;
  pharmacy_id: number;
  plan_id: number;
  subscription_state: string;
  messages_used: number;
  images_used: number;
  bill_due: string;
  plans?: { name: string; messages_limit: number; images_limit: number };
}
