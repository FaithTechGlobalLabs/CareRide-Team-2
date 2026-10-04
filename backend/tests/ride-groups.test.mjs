import assert from "node:assert/strict";
import test from "node:test";
import { groupRideAppointments } from "../../react-web-careride/src/features/careride/rideGroups.ts";

test("linked legs stay together across midnight, outbound first", () => {
  const outbound = {
    id: "out",
    linked_ride_id: "back",
    trip_leg: "outbound",
    requested_pickup_at: "2026-10-05T06:00:00Z",
  };
  const inbound = {
    id: "back",
    linked_ride_id: "out",
    trip_leg: "return",
    requested_pickup_at: "2026-10-05T09:00:00Z",
  };
  const single = { id: "single", requested_pickup_at: "2026-10-05T07:00:00Z" };
  assert.deepEqual(
    groupRideAppointments([inbound, single, outbound]).map((g) =>
      g.map((r) => r.id),
    ),
    [["out", "back"], ["single"]],
  );
});
test("trip IDs group legs without link IDs and do not merge other appointments", () => {
  const rides = [
    {
      id: "out",
      trip_group_id: "trip",
      trip_leg: "outbound",
      requested_pickup_at: "2026-10-05",
    },
    { id: "single", requested_pickup_at: "2026-10-05" },
    {
      id: "back",
      trip_group_id: "trip",
      trip_leg: "return",
      requested_pickup_at: "2026-10-06",
    },
  ];
  assert.deepEqual(
    groupRideAppointments(rides).map((g) => g.map((r) => r.id)),
    [["out", "back"], ["single"]],
  );
});
test("filtering to one leg never reveals an unlisted ride", () => {
  const onlyVisible = {
    id: "back",
    linked_ride_id: "private-outbound",
    trip_leg: "return",
    requested_pickup_at: "2026-10-05",
  };
  assert.deepEqual(groupRideAppointments([onlyVisible]), [[onlyVisible]]);
  assert.deepEqual(groupRideAppointments([]), []);
});
