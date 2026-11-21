import { sql } from "kysely";

import type { IOpenRideNoticesRepository } from "../../../application/ports/openRideNotices.js";
import type { DatabaseClient } from "../databaseClient.js";

import { ensureNotificationSchema } from "../notificationSchema.js";
import { eligibleSql } from "../queries/openRideEligibilitySql.js";

export class OpenRideNoticesRepository implements IOpenRideNoticesRepository {
  constructor(private readonly databaseClient: DatabaseClient) {}

  async createForBooking(rideIds: readonly string[]): Promise<string[]> {
    if (rideIds.length === 0) return [];
    await ensureNotificationSchema(this.databaseClient);
    const result = await sql<{ id: string }>`
      INSERT INTO notifications
        (driver_id, ride_request_id, title, message, action_url, channel, metadata)
      SELECT d.id, ${rideIds[0]}::uuid,
        'A ride fits your availability',
        'Open available rides to view pickup times and details.',
        '/driver', 'in_app',
        jsonb_build_object('type', 'available_ride', 'ride_ids', ${[...rideIds]}::uuid[])
      FROM drivers d
      LEFT JOIN notification_preferences p ON p.user_id = d.id AND p.kind = 'driver'
      WHERE COALESCE(p.available_rides_enabled, true)
        AND EXISTS (
          SELECT 1 FROM ride_requests r
          WHERE r.id = ANY(${[...rideIds]}::uuid[])
            AND ${sql.raw(eligibleSql.replaceAll("$DRIVER", "d.id"))}
        )
      RETURNING id
    `.execute(this.databaseClient);
    return result.rows.map((row) => row.id);
  }
}
