// Fixed SQL aliases only; callers bind all request values separately.
export const eligibleSql = `
  r.status = 'requested'
  AND r.driver_id IS NULL
  AND r.requested_pickup_at > now()
  AND EXISTS (
    SELECT 1 FROM driver_verifications v
    WHERE v.driver_id = $DRIVER
      AND v.approved_by_org_id = r.organization_id
      AND v.status = 'approved'
      AND (v.expires_on IS NULL OR v.expires_on >= CURRENT_DATE)
  )
  AND EXISTS (
    SELECT 1 FROM vehicles veh
    WHERE veh.driver_id = $DRIVER
      AND veh.seats >= r.passenger_count
      AND (
        veh.wheelchair_accessible
        OR NOT EXISTS (
          SELECT 1 FROM unnest(r.accessibility_needs) need
          WHERE lower(need) LIKE '%wheelchair%'
        )
      )
  )
  AND EXISTS (
    SELECT 1 FROM driver_availabilities a
    WHERE a.driver_id = $DRIVER
      AND a.is_active
      AND (r.requested_pickup_at AT TIME ZONE a.timezone)::time BETWEEN a.start_time AND a.end_time
      AND (a.starts_on IS NULL OR (r.requested_pickup_at AT TIME ZONE a.timezone)::date >= a.starts_on)
      AND (a.ends_on IS NULL OR (r.requested_pickup_at AT TIME ZONE a.timezone)::date <= a.ends_on)
      AND (
        (a.kind = 'one_time' AND a.on_date = (r.requested_pickup_at AT TIME ZONE a.timezone)::date)
        OR (
          a.kind = 'weekly'
          AND EXTRACT(DOW FROM r.requested_pickup_at AT TIME ZONE a.timezone)::int = ANY (a.weekdays::int[])
        )
        OR (
          a.kind = 'monthly'
          AND EXTRACT(DAY FROM r.requested_pickup_at AT TIME ZONE a.timezone)::int = ANY (a.month_days::int[])
        )
      )
      AND ST_DWithin(
        a.centre,
        ST_SetSRID(ST_MakePoint(r.pickup_lng, r.pickup_lat), 4326)::geography,
        a.radius_m
      )
  )
`;
