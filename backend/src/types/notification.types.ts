export type NotificationRecipient =
  | "client"
  | "staff";

export type NotificationChannel =
  | "sms"
  | "email"
  | "phone_call";

export type NotificationType =
  | "confirmation"
  | "reminder"
  | "driver_assigned"
  | "cancelled";

export type NotificationStatus =
  | "pending"
  | "sent"
  | "failed";

export interface Notification {
  id: string;
  ride_request_id: string;

  recipient: NotificationRecipient;
  channel: NotificationChannel;
  type: NotificationType;

  sent_at?: Date;
  status: NotificationStatus;
}