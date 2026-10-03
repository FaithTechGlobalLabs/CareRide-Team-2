# CareRide — Planning Notes and Requirements

Updated: October 3, 2026.

This document organizes the full original planning notes and schema, incorporates Kenton's subsequent decisions, and preserves the supplied Belkin proposal at the end. Latest decisions override earlier working notes. Proposed schema additions are labeled; unresolved questions should not be silently decided during implementation.

## Team GitHub usernames

- `kentonbell`
- `derekleungdev`
- `chonglee30`
- `EsheanA`

## Confirmed decisions

- Staff book and act on behalf of clients for now. Client self-service will be integrated later; clients have no portal in the initial version.
- Driver approval is per organization. Verification records are the source of truth, and document access is restricted.
- Each organization account has exactly one role: partner organization or transportation provider. An organization that needs both roles uses two accounts.
- Round trips consist of two one-way bookings. Acceptance of one leg does not imply acceptance of the other.
- Drivers choose their waiting policy. If a client does not appear on time, the driver may leave. The requested product policy is “no liability”; this document records the requirement, not a legal determination.
- Carpooling has one primary booker. Booking two passengers together is allowed; separate-pickup pooling has not been specified.
- Ride acceptance is first come, first served through one shared database. Only one driver may successfully claim a given booking.
- Pickup time is required.
- Address-book selection by name autofills the stored address.
- Client DOB is required for verification. Client phone, email, emergency contact details, and notes are optional.
- Remove `verification_status` and `status` from the driver schema. Organization-specific verification records remain authoritative. The original `license_verified` field remains in the working schema, but must not independently authorize rides.
- Use one authentication identity with role memberships. Staff and driver profiles link to it; a person may have multiple roles or organization memberships. This does not change the separate-account rule for an organization acting in both organization roles.
- Store pickup and destination snapshots on bookings so changes to the address book do not rewrite existing ride details.
- Availability rows have their own IDs and use `America/Vancouver` as the default timezone. Overnight schedules and exception dates need explicit rules if supported.
- Notifications store an explicit recipient reference and delivery destination. Staff receive communications on behalf of clients initially.
- Demo measurement values will be made up and must be visibly identified as sample data.

## Vision and scope

CareRide is a community transportation platform where staff arrange free rides to essential services on behalf of clients. Transportation providers and independent volunteer drivers participate through the same platform.

The intended model is a plug-and-play registration process for new partner organizations and ride providers. It is not restricted to Salvation Army organizations. Potential operational partnerships are not confirmed and must not be relied upon.

### User types

- Organization accounts.
- Staff: for example, Salvation Army desk staff communicating with clients.
- Clients: records managed by staff, with no initial portal.
- Drivers: organization-affiliated or independent.
- Donors: later.

### Platform and screens

- Staff-facing web application with a simple, mobile-friendly interface.
- Original development note: React Native, adding Expo. Whether this is an additional mobile app or the implementation target remains unresolved.
- Booking screen.
- Client registration screen, from the case worker's point of view.
- Driver registration screen.
- Admin registration screen; its fields were not defined in the original notes.

## Notes from the discussion with Alvin

### Organizations and registration

- Organizations register as either a partner organization or a transportation provider.
- Individuals can volunteer as transportation providers/drivers without belonging to an organization. The schema already allows independent drivers.
- Drivers do not need to be existing ride-share drivers to volunteer.
- Multiple Salvation Army organizations or locations need to be represented.
- Locations mentioned by Alvin:
  - Belkin Emergency Shelter & Transitional House.
  - Grace Mansion Transitional House.
  - Richmond House Emergency Shelter.
- Other prospective partner organizations mentioned: Catholic Charity, UGM, and Hope Mission.
- Hope Mission was mentioned as currently offering free rides and as an example ride provider. This is a meeting note, not a verified partnership or current service guarantee.
- Belkin House, City Reach, food pantries, and churches were mentioned as places to include.
- Original discussion prompt: “Where are some places you would like to have?”
- Providers would like notifications when there is a booking.
- Salvation Army staff need organization-level control over destinations and routes.

### Drivers and verification

- Someone needs to verify driver identity. The confirmed approval rule is per organization.
- Alvin would ideally like drivers already verified independently, while retaining security. External verification is a future possibility, not a replacement for the confirmed approval rule.
- Ask drivers how much advance notice they require, such as at least one day.
- Record how many passengers each driver can carry.
- Drivers decide how long they wait.
- Provide actions to mark a passenger picked up and dropped off.
- Demo verification flow: driver signs up, uploads a document, an admin approves with one action, and the driver then sees eligible rides.
- A driver can give rides only when a named organization has approved them. The platform keeps the records; each organization is the accountable approver.
- Later, a background-check service with an API could be considered. Certn was mentioned as a Canadian example; no integration is selected.

### Destinations and address book

- The initial experience is intentionally constrained around specific pickup and destination points, such as Belkin House and St. Paul's.
- Staff can choose other locations and add them to the address book.
- Alvin will provide a list of destinations per partner organization to prefill the address book.
- The app should help direct people toward appropriate services in addition to accepting requests. The exact behavior and service directory are not yet defined.
- Search pickup locations and destinations by name and autofill consistently formatted stored addresses.
- The original notes asked whether Google address autocomplete or a React library is needed. External address autocomplete remains optional and unselected; address-book autofill is the confirmed initial behavior.

### Booking rules

- Support multiple passengers on one booking, with one primary booker.
- Include severity/urgency of the request. Emergencies still use 911; this is not emergency transport.
- Staff choose one-way or round trip. A round trip creates two one-way bookings, and each leg can be accepted separately.
- The original discussion suggested allowing a driver to accept only one direction of a round trip; the two-booking model represents this.
- Required pickup time supersedes the earlier question about an optional time field.
- If no driver is available at the requested time, showing drivers or alternatives at other times is a proposed feature; its behavior is not yet defined.
- First-come-first-served acceptance must be enforced atomically in the database. Sharing one database alone does not prevent concurrent conflicting assignments.

### Client information

- Minimize unnecessary client data entry while keeping the confirmed required identity fields, including DOB for verification.
- Staff manage booking and communications on clients' behalf initially.
- Notes and accommodations are optional in the revised client schema.

## Screen requirements

### Booking screen

- Pickup location search.
- Destination search.
- Autofill the stored address when selecting an address-book name.
- Required pickup date and time.
- Optional appointment time.
- Passenger count, including any accompanying passengers who occupy seats.
- One-way or round-trip choice; round trip becomes two one-way requests.
- Request severity/urgency; its allowed values remain undefined.
- Accessibility needs and ride notes.
- Show the free option first. Paid external options are a future configuration.

### Client registration — case worker view

| Field | Input / rule |
| --- | --- |
| First and last name | Normal string inputs |
| DOB | Calendar selection; required for verification |
| Address or transitional home | Optional |
| Has smartphone | Boolean |
| Phone | Optional normal string input |
| Email | Optional normal string input |
| Emergency contact name and phone | Optional |
| Notes / accommodations / important information | Optional string input |

The original screen notes specified a 50-character maximum for accommodations/important information. No replacement limit was provided; confirm whether to retain it before implementation.

### Driver registration

| Field | Input / rule |
| --- | --- |
| Name | Normal string input |
| Email | Normal string input |
| Phone | Normal string input |
| License plate | String input; original limit is 8 characters |
| List of locations | String array; relationship to service-area rules needs definition |
| Password | Password input handled by the shared authentication system |

The working driver schema also includes DOB, vehicle details, organization affiliation, and license verification. The screen must be reconciled with those fields during implementation.

### Admin registration

The original notes included this screen but did not specify fields or how the first organization administrator is established. Do not assume open self-registration grants access to an existing organization.

## Working data schema

These are requirements-level schemas, not executable migrations. Required/optional constraints beyond those explicitly stated still need to be finalized. Original field names are normalized to snake_case.

### Authentication identity and role memberships — accepted addition

- One authentication identity per person.
- Staff and driver profiles reference that identity.
- Role memberships link people to organizations and permissions.
- A person may have more than one role or organization membership.
- Credentials belong to the authentication system rather than being duplicated across staff and driver profiles.
- Exact tables, authentication provider, and cross-role foreign keys are not yet selected.

### Organization

- `id` — primary key.
- `name`.
- `type` — `partner_org` or `transport_provider`; exactly one per organization account.
- `contact_name`.
- `email`.
- `phone`.
- `address`.
- `status` — `pending`, `active`, or `suspended`.
- `created_at`.

Belkin Communities of Hope would be the first `partner_org` row. Multiple sites must be supported; whether sites are separate organization rows or child locations remains undecided.

### Staff

- `id` — primary key.
- Authentication identity reference — accepted addition; final field name pending.
- `organization_id` — foreign key.
- `name`.
- `email`.
- `phone`.
- Original authentication field: `password_hash` or auth provider ID. Under the accepted shared-identity model, use the authentication reference rather than duplicate credentials.
- `role` — original values: `staff`, `admin`, `dispatcher`, `driver`. Role memberships become authoritative; decide whether this field is retained as a summary.
- `is_active`.

Staff need logins to book for clients. Alvin and Olive were named as intended test accounts. Use synthetic credentials and sample records for the demo.

### Client — revised

- `id` — primary key.
- `first_name`.
- `last_name`.
- `dob` — required for verification.
- `address` or transitional home location — optional.
- `has_smartphone` — boolean; staff can book and receive confirmations for clients.
- `phone` — optional.
- `email` — optional.
- `emergency_contact_name` — optional.
- `emergency_contact_phone` — optional.
- `notes` / accommodations / important information — optional.
- `created_at`.

The original client schema also had a separate `accessibility_needs` field, with examples of wheelchair, mobility aid, or escort required. It is absent from the revised client schema; accessibility needs remain on the ride request.

### Ride request / booking

- `id` — primary key.
- `client_id` — foreign key to the primary client.
- `requested_by_user_id` — foreign key to the authenticated staff user initially; client booking later.
- `organization_id` — foreign key.
- `pickup_address`, `pickup_lat`, `pickup_lng` — booking snapshot.
- `destination_id` — foreign key to the address book, if selected; free-text destination if allowed.
- Destination address and coordinates snapshot — accepted addition; persist independently of the address-book reference.
- `requested_pickup_at` — required `timestamptz`.
- `appointment_at` — optional.
- `passenger_count`.
- `accessibility_needs`.
- `notes`.
- `status` — original values: `requested`, `approved`, `dispatched`, `accepted`, `in_progress`, `completed`, `cancelled`, `no_show`, `declined`.
- `driver_id` — foreign key; nullable until assigned.
- `approved_by_user_id` — foreign key.
- `approved_at`.
- `ride_option` — `free` or `paid_external`; free option shown first, external paid option later.
- `created_at`.
- `updated_at`.
- `completed_at`.
- `cancelled_reason`.
- `distance_km` — measurement.
- `duration_minutes` — measurement.
- `estimated_cost_saved` — measurement.
- `staff_minutes_spent` — measurement.
- `missed_appointment_avoided` — optional boolean.

Additional requirements needing final field names:

- Link the two one-way bookings that form a round trip.
- Store request severity/urgency.
- Record pickup and drop-off actions; determine whether separate timestamps are needed beyond status and `completed_at`.
- Preserve one primary booker for a multi-passenger booking.

### Driver — revised

- `id` — primary key.
- Authentication identity reference — accepted addition; final field name pending.
- `name`.
- `dob`.
- `email`.
- `phone`.
- `organization_id` — nullable foreign key to a `transport_provider` organization; null for independent drivers.
- `license_verified` — boolean, default false; original field retained, but not sufficient to authorize rides for an organization.
- Vehicle details, either on this table or in a vehicle table:
  - `make`.
  - `model`.
  - `plate`.
  - `seats`.
  - `wheelchair_accessible`.

Removed by the latest decision:

- `verification_status` — originally `unverified`, `pending`, `verified`, `rejected`.
- `status` — originally `pending`, `active`, `suspended`.

The original driver-level `verified_at` accompanied the removed verification summary. Review timestamps belong in the organization-specific verification records; retaining a driver-level summary timestamp is not yet specified.

Driver advance-notice requirements and waiting policy must be represented; their field names and units remain undefined.

### Driver schedule availability

- `id` — primary key; accepted addition.
- `driver_id` — foreign key.
- Service-area center — pin location stored as a PostGIS geography.
- Service-area radius — determines where ride requests are received; radius units need definition.
- `is_active` — allows a driver to pause availability without deleting it.
- `kind` — required; `one_time`, `weekly`, or `monthly`.
- `start_time` — required time, for example `14:00`.
- `end_time` — required time, for example `16:00`; initial constraint: greater than `start_time`.
- `timezone` — default `America/Vancouver`.
- `on_date` — nullable date for one-time availability, for example `2026-10-14`.
- `weekdays` — nullable `smallint[]`; weekly recurrence, `0`–`6`, Sunday = `0`; `{2,4}` means Tuesday and Thursday.
- `month_days` — nullable `smallint[]`; monthly recurrence, `1`–`31`; `{14}` means the 14th.
- `starts_on` — optional date when a recurring rule begins.
- `ends_on` — optional date when a recurring rule ends; null means indefinitely.
- `note` — optional text.

Constraints:

- One-time rules require `on_date`.
- Weekly rules require `weekdays`.
- Monthly rules require `month_days`.
- Validate weekday values are `0`–`6` and month-day values are `1`–`31`.
- Overnight scheduling and exception dates need explicit rules if supported. The original `end_time > start_time` constraint permits only same-day windows.

### Driver verification

- `driver_id` — foreign key.
- `approved_by_org_id` — foreign key to the named approving organization.
- `approved_by_user_id` — foreign key to the reviewer.
- `check_type`.
- `document_ref` — reference to a restricted document, not a publicly accessible URL.
- `issued_on`.
- `expires_on`.
- `status` — `pending`, `approved`, `rejected`, `expired`.
- `reviewed_at`.

Approval is organization-specific. Verification records are the source of truth. Decide which checks constitute approval and whether a ride requires approval from the requesting organization, provider organization, or another designated organization; “per organization” alone does not specify that relationship.

### Address book / destination

- `id` — primary key.
- `organization_id` — foreign key.
- `name`.
- `type` — `hospital`, `shelter`, or `service`.
- `address`.
- `lat`.
- `lng`.
- `is_active`.

Organizations control their destinations and specific routes. An explicit allowed-route schema was not provided in the original notes.

### Notifications and confirmations

- `id` — primary key.
- `ride_request_id` — foreign key.
- Original recipient concept: client or staff.
- Explicit recipient reference — accepted addition; final field names pending.
- Delivery destination, such as phone number or email — accepted addition.
- `channel` — `sms`, `email`, or `phone_call`.
- `type` — `confirmation`, `reminder`, `driver_assigned`, `cancelled`.
- `sent_at`.
- `status` — allowed values not specified.

Initial communications go to staff acting for clients. Provider notifications on new bookings are also requested; their recipient model and notification type need definition. Future client communications need explicit routing rules.

### Dispatch / driver offers

- `id` — primary key.
- `ride_request_id` — foreign key.
- `driver_id` — foreign key.
- `offered_at`.
- `response` — `accepted`, `declined`, `expired`.
- `responded_at`.

Supports review, approval, and dispatch, with matching against availability and service area. Acceptance is first come, first served; recording an offer response and assigning the booking must agree within the same transaction.

### Measurement

The original proposal asks for quantified benefits. Proposed measurements are distance, ride duration, estimated transportation cost saved, staff time spent, completed rides, and optionally missed appointments avoided.

For the demo, measurement values and calculations are illustrative and made up. Label them as sample data and do not present them as measured outcomes. Production baselines and formulas remain undefined.

## Database and hosting recommendation

Start with **PostgreSQL**, adding **PostGIS** for the planned geographical service areas. The model is relational and requires foreign keys, constraints, transactions, and joins between organizations, users, clients, bookings, and drivers.

Local-network hosting is appropriate for initial development and the hackathon demo. Use one shared database behind the application backend; staff and driver browsers access the application rather than connecting directly to PostgreSQL. Maintain schema migrations, persistent storage, and backups so the database is reproducible and movable.

For later AWS hosting, **Aurora PostgreSQL** is a compatible managed option, particularly when scaling and availability justify its cluster model. **RDS for PostgreSQL** is a credible alternative for a modest workload where conventional PostgreSQL hosting is sufficient. Moving to Aurora is not a prerequisite for long-term sustainability; compare costs and operational needs when deployment is planned.

Both services document PostGIS support. Choose compatible PostgreSQL and extension versions before migrating; avoid assuming every local extension or version is supported.

First-come-first-served acceptance requires a single atomic claim conditioned on the booking still being unassigned and eligible, or equivalent transactional locking. A separate read followed by an unconditional write is unsafe even with one database. Eligibility includes organization approval and applicable booking rules. The first successful claim wins; competing attempts receive an already-assigned result. This does not automatically prevent one driver from accepting overlapping different rides.

Reference sources:

- [PostgreSQL transaction isolation and concurrent updates](https://www.postgresql.org/docs/current/transaction-iso.html).
- [Amazon Aurora overview](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/CHAP_AuroraOverview.html).
- [Aurora PostgreSQL PostGIS support](https://docs.aws.amazon.com/en_en/AmazonRDS/latest/AuroraUserGuide/Appendix.PostgreSQL.CommonDBATasks.PostGIS.html).
- [RDS for PostgreSQL overview](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html).
- [RDS PostgreSQL extension support](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Appendix.PostgreSQL.CommonDBATasks.Extensions.html).

## Decisions still needed before implementation

- Whether multiple physical sites are separate organizations or locations under an organization.
- Which organization's approval makes a driver eligible for a particular ride, and which checks are required.
- Who performs each transition in the booking status workflow, and whether approval/dispatch are required before first-come-first-served acceptance.
- What happens when a driver withdraws after accepting: reassignment, staff notification, and booking status.
- What happens when staff edit an accepted booking: which changes require renewed driver acceptance.
- How to prevent overlapping accepted rides for one driver, if required.
- Waiting policy units, notice requirements, and how the agreed waiting deadline is displayed and recorded for a no-show.
- Whether service-area matching covers pickup only or both endpoints.
- Whether addresses outside the configured routes are allowed and how approved routes are modeled.
- Required return time and linking behavior for round-trip legs.
- Multi-passenger details beyond the primary client and primary booker.
- Urgency values and their effect on matching or presentation.
- Authentication provider, first-admin registration, and final role membership schema.
- Final accommodations text limit, currently recorded as 50 characters in the original screen notes.
- Web-only versus React Native/Expo scope.
- Actual SMS/email integrations versus simulated demo notifications.

## Original task context

The original request asked: “any big things to consider before I prompt this off to an ai to figure it all out?” This cleaned document supplies the working context for that implementation prompt. The supplied proposal below is reference material and must not be rewritten to match later implementation decisions.

---

## Supplied proposal — do not edit

The following text preserves the supplied proposal wording. Only Markdown layout has been applied.

### Belkin Communities of Hope Proposal #HACKVAN2026

Name of Organization: Belkin Communities of Hope, Salvation Army

Innovators:

●      Alvin Chong
○      Title: Director of Community Development
○      Email: Alvin.Chong@salvationarmy.ca
○      Phone:  (778) 246-3663
●      Olive Wu
○      Title: Community Engagement Coordinator
○      Email: olive.wu@salvationarmy.ca
○      Phone: 604 802 6510

### The Vision

The Idea (1 sentence):
To provide Belkin Communities of Hope clients with reliable transportation to essential services by creating a staff-facing web application that coordinates free ride requests with transportation service partners.

The Problem (5-7 sentences)
Many Salvation Army clients frequently need to travel to vital destinations such as hospitals or shelters or essential services, but lack the smartphones or digital literacy required to use standard ride-sharing apps independently. Without safe and reliable transportation, they can easily miss critical medical appointments or essential care. However, there is currently no centralized system to request, track, or share these rides between organizations. This fragmented manual process creates major administrative bottlenecks for staff and leaves clients without a reliable way to reach their destination.

The Potential (3-4 sentences)
We can solve this by developing a dedicated web-based, community ride-sharing platform where Salvation Army staff or clients can request rides. Partner organizations/drivers that supply the rides can use this same platform to review, approve, and dispatch drivers efficiently. Although the exact operational partnerships are still being finalized, this system has the potential to streamline transportation logistics and ensure vulnerable individuals can always reach their destinations safely.

The benefit of this learning needs to be better quantified for this to be considered as a project.  Potentially time savings,  or cost options and savings.

### App Requirements (4-6 sentences)

●      CareRide.com is a non-Salvation Army affiliated Web-based portal for any organization to access
●      Organizations can register as a user-partner org or a transportation operator or provider
○      Drivers can sign up to join the platform
○      Other social services organizations can sign up to join the platform
●      Simple UX design, taking in mind those who have minimal digital literacy.  Another example, mobile device-friendly
●      Clients can book their rides, identifying pick up and destination points, manage their bookings and receive confirmations

●      Shows the clients what is the free option. (As a future configuration/option, it can also show links to other paid options, e.g., including Uber.)
●      Drivers can sign up to join the platform
●      Other social services organizations can sign up to join this 3rd party managed platform
●      Salvation Army can set destinations with specific routes for clients to order a ride (Not another Uber service)

### Details (to be filled out later if this becomes a selected project)

Is the app assisting an existing project or program?
n/a

What is your (the project owners) availability during the event (aka hackathon)?

NAME:
●      Pitch Night - Friday, October 2nd (5:30 pm to 8:30 pm): Alvin
●      User Testing - Saturday, October 3rd (1 pm to 3 pm): Alvin
●      Presentation - Sunday, October 4th (3:00/3:30 to 4:30 pm): Olive
●      Phone Number:

Who will be available to test the app during the User Testing Session (Saturday, October 3rd, 1 pm to 3 pm)?
Alvin will be the test client requesting a ride and Olive will be the test driver offering a ride
Belkin Communities of Hope will be the organization to sign up as a member

Other Notes:

Address: 228 W. 5th Ave, Vancouver.  Street parking only.
Google Map Link: https://maps.app.goo.gl/9wZbzg6FFeFkaCrv8



These cover the MVP where staff act on behalf of clients. Round trips create two linked one-way bookings.

## MVP for 12pm

### Login Screen

| Field / element | Input / behavior |
|---|---|
| Email | Normal string input |
| Password | Password input box |
| Log in | Button |
| Forgot password | Link to password reset |
| Register organization / driver | Registration links |

### Organization Registration Screen

| Field / element | Input / behavior |
|---|---|
| Organization name | Normal string input |
| Organization type | Select partner organization or transportation provider |
| Address | Normal string input |
| Contact name | Normal string input |
| Contact email | Email input |
| Contact phone | Phone input |
| Administrator name | Normal string input |
| Administrator email | Email input |
| Administrator password | Password input box |
| Register | Button; creates organization and its first administrator |

### Staff Dashboard Screen

| Field / element | Input / behavior |
|---|---|
| Book a ride | Button |
| Register client | Button |
| Upcoming rides | List showing client, time, route, driver, and status |
| Rides awaiting a driver | List |
| Search bookings | Search input |
| Booking status | Filter dropdown |
| Notifications | List with unread indicator |
| Address book | Navigation button |

### Client Registration / Edit Screen

| Field / element | Input / behavior |
|---|---|
| First name | Normal string input |
| Last name | Normal string input |
| DOB | Calendar selection; required for verification |
| Address / transitional home | Optional location selection or string input |
| Has smartphone | Checkbox |
| Phone | Optional phone input |
| Email | Optional email input |
| Emergency contact name | Optional string input |
| Emergency contact phone | Optional phone input |
| Accommodations / important information | Optional string input; 50-character maximum |
| Save client | Button |

### Booking Screen

| Field / element | Input / behavior |
|---|---|
| Primary client | Search and select existing client |
| Pickup location | Search address book by name |
| Pickup address | Autofilled from selected location |
| Destination | Search address book by name |
| Destination address | Autofilled from selected location |
| Add location | Opens address-book entry form |
| Trip type | One-way / round-trip selection |
| Pickup date | Required calendar selection |
| Pickup time | Required time selection |
| Appointment time | Optional time selection |
| Return pickup date and time | Required when booking a round trip |
| Passenger count | Number input, including accompanying passengers |
| Accessibility needs | Checkboxes for wheelchair, mobility aid, escort, and other |
| Request urgency | Dropdown; values to be defined |
| Ride notes | Optional text input |
| Submit request | Button; creates one booking or two linked bookings |

### Booking Details / Tracking Screen

| Field / element | Input / behavior |
|---|---|
| Client / primary booker | Display |
| Pickup and destination | Display saved booking addresses |
| Pickup and appointment times | Display |
| Passenger count and accommodations | Display |
| Booking status | Status indicator |
| Assigned driver | Name, vehicle, plate, and contact information |
| Driver waiting policy | Display |
| Linked return / outbound ride | Link when part of a round trip |
| Ride progress | Timeline showing acceptance, pickup, and drop-off |
| Edit booking | Staff action; accepted-booking edit rules still need definition |
| Cancel booking | Button with cancellation reason |

### Address Book Screen

| Field / element | Input / behavior |
|---|---|
| Search locations | Search by name or address |
| Location type | Hospital / shelter / service filter |
| Location list | Name, type, address, and active state |
| Add location | Button |
| Edit location | Button |
| Activate / deactivate | Organization-authorized action |

### Add / Edit Location Screen

| Field / element | Input / behavior |
|---|---|
| Location name | Normal string input |
| Location type | Hospital / shelter / service dropdown |
| Address | Normal string input |
| Map position | Pin selection or confirmed coordinates |
| Active | Checkbox |
| Save location | Button |

### Driver Registration Screen

| Field / element | Input / behavior |
|---|---|
| Name | Normal string input |
| DOB | Calendar selection |
| Email | Email input |
| Phone | Phone input |
| Password | Password input box |
| Affiliation | Independent driver / transportation provider selection |
| Transportation provider | Organization selection when affiliated |
| Vehicle make | Normal string input |
| Vehicle model | Normal string input |
| License plate | String input; 8-character maximum |
| Passenger seats | Number input; excludes driver |
| Wheelchair accessible | Checkbox |
| List of locations | Add/remove location chips, stored as a string array |
| Register | Button; opens verification setup |

### Driver Verification Submission Screen

| Field / element | Input / behavior |
|---|---|
| Approving organization | Organization selection |
| Check type | Dropdown of required verification checks |
| Document | File upload |
| Issue date | Calendar selection when applicable |
| Expiry date | Calendar selection when applicable |
| Submit for approval | Button |
| Approval records | Organization-specific pending / approved / rejected / expired indicators |

### Driver Availability Screen

| Field / element | Input / behavior |
|---|---|
| Saved availability | List with edit and delete actions |
| Available / paused | Toggle for each availability rule |
| Service-area center | Map pin selection |
| Service-area radius | Number input with explicit distance unit |
| Schedule type | One-time / weekly / monthly dropdown |
| Start and end times | Time selections |
| Timezone | Default `America/Vancouver` |
| Date | Calendar selection for one-time availability |
| Weekdays | Multiple selection for weekly availability |
| Days of month | Multiple selection for monthly availability |
| Recurrence start / end | Optional calendar selections |
| Minimum booking notice | Duration input |
| Maximum waiting time | Duration input |
| Notes | Optional text input |
| Save availability | Button |

### Driver Dashboard / Available Rides Screen

| Field / element | Input / behavior |
|---|---|
| Organization approvals | Display approval for each organization |
| Availability settings | Navigation button |
| Eligible ride requests | List matching approval, availability, area, and capacity |
| Ride summary | Pickup, destination, time, passenger count, and accommodations |
| View ride | Opens request details |
| Accept ride | Button; atomic first-come-first-served claim |
| Already assigned message | Display if another driver claims it first |
| My upcoming rides | List of accepted bookings |

### Driver Active Ride Screen

| Field / element | Input / behavior |
|---|---|
| Pickup and destination | Display addresses |
| Scheduled pickup time | Display |
| Passenger information | Pickup identification and relevant accommodations |
| Booking staff contact | Contact action |
| Navigation | Link to map directions |
| Waiting deadline | Display based on agreed waiting policy |
| Picked up | Button; marks ride in progress |
| Dropped off | Button; marks ride completed |
| Client no-show | Button; records no-show |
| Withdraw from ride | Action with reason; reassignment rules still need definition |

### Organization Admin Dashboard Screen

| Field / element | Input / behavior |
|---|---|
| Organization information | Display and edit action |
| Staff members | List with roles and active state |
| Invite staff | Email input and role selection |
| Activate / deactivate staff | Admin action |
| Pending driver approvals | List |
| Review driver | Opens verification review |
| Organization bookings | List with status filters |
| Destinations and routes | Management link |
| Demo impact summary | Completed rides and clearly labeled sample savings |

### Admin Driver Verification Review Screen

| Field / element | Input / behavior |
|---|---|
| Driver information | Name, contact information, and vehicle details |
| Requested organization approval | Display |
| Submitted checks | List |
| Verification document | Restricted document viewer |
| Issue and expiry dates | Display |
| Approve | Button; records organization and reviewing admin |
| Reject | Button with reason |
| Review history | Reviewer, decision, and review time |

### Notifications Screen

| Field / element | Input / behavior |
|---|---|
| Notification list | Booking confirmations, assignments, cancellations, and completion updates |
| Unread filter | Toggle |
| Notification details | Message, timestamp, and related booking |
| View booking | Link |
| Mark as read | Action |
| Booking alerts | Provider-facing alerts for eligible new requests |

## Future

### Staff Account Setup Screen

Existing organization administrators invite staff into their organization.

| Field / element | Input / behavior |
|---|---|
| Organization | Display from invitation |
| Name | Normal string input |
| Email | Prefilled from invitation |
| Phone | Optional phone input |
| Password | Password input box |
| Role | Display role assigned by administrator |
| Create account | Button |

### Client List Screen

| Field / element | Input / behavior |
|---|---|
| Search clients | Search by name |
| Client list | Name and identifying information visible to authorized staff |
| Register client | Button |
| View client | Opens client details |
| Book a ride | Button for selected client |

### Client Details Screen

| Field / element | Input / behavior |
|---|---|
| Client information | Display saved registration fields |
| Edit client | Button |
| Book a ride | Button; preselects client |
| Upcoming rides | List |
| Ride history | List with statuses |

### Password Reset Screen

| Field / element | Input / behavior |
|---|---|
| Email | Email input |
| Send reset link | Button |
| New password | Password input after opening reset link |
| Confirm password | Password input |
| Save password | Button |
