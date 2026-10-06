# CareRide

## A little help, a way forward.

![CareRide — connecting people to the care they need](../output/presentation/preview/slide-01.png)

**A community transportation proposal for people experiencing homelessness and other vulnerable neighbours.**

CareRide brings together the people arranging care and the people willing to offer a ride. Our aim is simple: help more neighbours reach hospitals, shelters, appointments, and essential services through free, planned rides coordinated by supporting organizations.

Developed by FaithTech Team 2 for HACKVAN2026, this prototype is an invitation to shape a practical community service together.

## Care exists. Getting there is the gap.

![The human need — a place to go, a barrier to cross, a person to help](../output/presentation/preview/slide-02.png)

An appointment can offer a way forward, but reaching it can be difficult without reliable transportation. Some clients have no smartphone or limited digital access. Staff help arrange the journey, often carrying the work of requests, calls, and follow-ups.

Shaped by the Belkin Communities of Hope brief, CareRide proposes one shared place to coordinate that work. Clients do not need a smartphone or a CareRide account in this first version; staff arrange rides on their behalf.

## Put the journey in one shared place.

![The proposal — staff request, drivers respond, everyone stays informed](../output/presentation/preview/slide-03.png)

A staff member requests a ride. An approved volunteer reviews and accepts an eligible journey. The organization can follow progress from assignment to pickup and completion.

Saved addresses make repeat journeys easier to arrange. Linked outbound and return bookings keep both directions visible, so staff can see when one leg still needs a driver.

## People at the heart of every journey

![How CareRide works — staff arrange, drivers offer, organizations approve](../output/presentation/preview/slide-04.png)

| Who | Their part in the journey |
| --- | --- |
| Clients | Receive support reaching care without having to navigate another digital service. |
| Staff | Arrange bookings, support clients, and follow ride progress. |
| Volunteer drivers | Offer time and a seat, accept eligible rides, and update pickup and drop-off. |
| Organizations | Approve drivers for their rides and establish operating procedures. |

## Built for the people arranging care

![CareRide staff dashboard with upcoming journeys and coordination tools](../output/presentation/assets/staff.png)

The staff dashboard brings upcoming rides and requests needing attention into view. Client records and an address book support repeat bookings, while clear status updates help staff coordinate the next step.

![CareRide booking screen for selecting a client, route, and pickup time](../output/presentation/assets/booking.png)

Staff choose a client, saved pickup and destination points, and the time the ride is needed. A return journey can be arranged as a linked booking. The goal is to make coordination easier while keeping the supporting staff member involved.

*Application screenshots show the prototype with synthetic demo records.*

## A helping hand behind the wheel

![CareRide driver dashboard showing available requests and upcoming rides](../output/presentation/assets/driver.png)

Drivers review requests that match their organization approval, vehicle, availability, and service area. They can accept a ride, see their commitments, open directions, and update the journey at pickup and drop-off.

Accepted rides can also be added to Google Calendar, Outlook, Microsoft 365, or an Apple/device calendar. Durations are estimated, and exported events do not sync; drivers remove them manually if a ride is cancelled or they withdraw.

## Build trust into the journey

![Dignity and accountability — organization approval, human support, clear expectations](../output/presentation/preview/slide-07.png)

Organization approval is part of the model: registration alone does not make a driver eligible for every organization's rides. Staff remain the client's point of contact, and planned trips have clear destinations and visible progress.

Before a live pilot, participating organizations would agree driver screening, insurance, consent, privacy, and escalation procedures. Emergency needs continue to go through emergency services. CareRide is an independent prototype; service partnerships remain to be confirmed.

## Start small. Measure what matters.

![Proposed pilot — prepare, run, and learn](../output/presentation/preview/slide-08.png)

We propose a **four-week pilot with one willing organization**, subject to partner agreement.

1. **Prepare:** name an operational owner, agree a small set of destinations, approve drivers, and establish a fallback when no ride is available.
2. **Run:** coordinate a limited set of planned trips with staff support and gather feedback throughout.
3. **Learn:** measure completed rides as a share of requests, time to driver acceptance, staff coordination time, and client and staff feedback.

The pilot should test whether CareRide makes journeys easier to coordinate and helps clients feel respected and supported. Savings shown in the prototype are illustrative demo figures, not measured outcomes.

## Excellence. Impact. Hope.

![CareRide's connection to FaithTech's values — excellence, impact, and hope](../output/presentation/preview/slide-09.png)

For FaithTech, this is a practical expression of loving our neighbour: offering time, attention, and help with an everyday barrier to care. Excellence means thoughtful tools for the people doing the work. Impact means testing whether those tools help. Hope means taking a useful next step together.

## Help us make a way forward

![The invitation — pilot with us, drive with us, build with us](../output/presentation/preview/slide-10.png)

We are looking for a service organization to shape a pilot, volunteers willing to drive under agreed approval procedures, and mentors and maintainers to help carry the project into its next phase.

The next step is a planning conversation with the people who would run and use the service: what journeys matter most, what support is needed, and what a useful pilot would look like.

Explore the [presentation deck](../output/presentation/CareRide-HACKVAN2026.pptx), [PDF presentation](../output/presentation/preview/CareRide-HACKVAN2026.pdf), or [speaker script](../output/presentation/CareRide-speaker-script.md) for the full pitch.

## Contribution guidance

Contributions can include staff and driver usability feedback, accessibility improvements, pilot planning, documentation, design, and software development. Open an issue describing the need and the proposed outcome, or submit a focused pull request explaining the change and how it was checked.

For contributors working on the application:

- Read the [project requirements](CARERIDE_REQUIREMENTS.md) and [repository instructions](../AGENTS.md).
- Find the frontend in `react-web-careride/` and the API and database code in `backend/`.
- Consult [database setup](POSTGRES.md), [notifications and settings](NOTIFICATIONS_AND_SETTINGS.md), and the [integration audit](dbAudit/FRONTEND_DATABASE_LINK_AUDIT.md) for technical context.
- Keep changes focused and run checks appropriate to the change. Obtain approval before installing or upgrading dependencies.
- Use synthetic records for demonstrations. Never commit credentials or sensitive client information.

See the [license](../LICENSE) for reuse terms.
