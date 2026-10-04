export type NotificationRecipient = "client" | "staff" | "driver";

export type NotificationChannel = "sms" | "email" | "phone_call" | "in_app";

export type NotificationType =
  | "confirmation"
  | "reminder"
  | "driver_assigned"
  | "cancelled"
  | "completed"
  | "ride_updated"
  | "client_updated"
  | "available_ride";

export type NotificationStatus = "pending" | "sent" | "failed";

export interface Notification {
  id: string;
  driver_id?: string;
  staff_id?: string;
  ride_request_id?: string;
  recipient_user_id: string;
  recipient: NotificationRecipient;
  channel: NotificationChannel;
  type: NotificationType;
  destination?: string;

  sent_at?: string;
  read_at?: string;
  status: NotificationStatus;
  title?: string;
  message?: string;
  event_key?: string;
  action_url?: string;
}

export interface NotificationPreference {
  user_id: string;
  kind: "staff" | "driver";
  push_enabled: boolean;
  updates_enabled: boolean;
  available_rides_enabled: boolean;
  prompt_after: string;
  prompt_dismissed: boolean;
  first_ride_accepted_at?: string;
  first_ride_prompt_pending?: boolean;
  prompt_snoozed_until?: string;
}

export interface PushSubscriptionRecord {
  user_id: string;
  kind: "staff" | "driver";
  endpoint: string;
  keys: { p256dh: string; auth: string };
  created_at: string;
}

export interface PushDelivery {
  notification_id: string;
  endpoint: string;
  attempts: number;
  next_attempt_at: string;
  delivered_at?: string;
  failed?: boolean;
}
