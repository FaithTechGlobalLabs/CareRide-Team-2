export type NotificationRecipient = "client" | "staff";

export type NotificationChannel = "sms" | "email" | "phone_call" | "in_app";

export type NotificationType =
  "confirmation" | "reminder" | "driver_assigned" | "cancelled" | "completed";

export type NotificationStatus = "pending" | "sent" | "failed";

export interface Notification {
  id: string;
  ride_request_id: string;
  recipient_user_id: string;

  recipient: NotificationRecipient;
  channel: NotificationChannel;
  type: NotificationType;
  destination?: string;

  sent_at?: string;
  read_at?: string;
  status: NotificationStatus;
}
