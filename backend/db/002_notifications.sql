CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('staff', 'driver')),
  push_enabled boolean NOT NULL DEFAULT false,
  updates_enabled boolean NOT NULL DEFAULT true,
  available_rides_enabled boolean NOT NULL DEFAULT true,
  prompt_after timestamptz NOT NULL DEFAULT now() + interval '1 day',
  prompt_dismissed boolean NOT NULL DEFAULT false,
  first_ride_accepted_at timestamptz,
  first_ride_prompt_pending boolean NOT NULL DEFAULT false,
  prompt_snoozed_until timestamptz,
  PRIMARY KEY (user_id, kind)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint text PRIMARY KEY,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, kind) REFERENCES notification_preferences (user_id, kind) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS push_deliveries (
  notification_id uuid NOT NULL REFERENCES notifications (id) ON DELETE CASCADE,
  endpoint text NOT NULL REFERENCES push_subscriptions (endpoint) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  failed boolean NOT NULL DEFAULT false,
  PRIMARY KEY (notification_id, endpoint)
);
