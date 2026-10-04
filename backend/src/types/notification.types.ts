export type NotificationChannel = "push" | "sms" | "email" | "in_app";

export interface Notification {
  id: string;
  driver_id?: string;
  staff_id?: string;
  ride_request_id?: string;
  title: string;
  message: string;
  action_url?: string;
  channel: NotificationChannel;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}
