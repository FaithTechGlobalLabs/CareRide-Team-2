# CareRide

Shared language for arranging rides and determining driver eligibility.

## Language

**Booking**:
A staff arrangement for a one-way ride or a round trip. A round-trip booking
contains outbound and return ride requests that drivers can claim independently.

**Ride request**:
One requested ride leg, with its own pickup time, requirements, and driver
assignment.

**Open ride request**:
A requested ride with a future pickup time and no assigned driver.
_Avoid_: Available ride (confuses request state with driver availability).

**Driver availability**:
A driver's declared time window and service area for taking rides, either on a
specific date or a recurring schedule.

**Eligible driver**:
A driver who meets the organization approval, vehicle capability, and
availability requirements for a particular open ride request.
