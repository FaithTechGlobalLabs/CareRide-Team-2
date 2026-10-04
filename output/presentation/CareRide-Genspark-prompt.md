# CareRide — replacement presentation prompt

Entirely replace the existing presentation with the project update below. This is a HACKVAN2026 Redemptive Technology Hackathon project update, not a fundraising deck or a long business proposal. Make exactly **7 slides** in the organizer's required order. Answer **What is it? How does it work? Why does it matter?** early and clearly. Inspire the audience through a human story, a focused demonstration, and honest lessons learned.

## Duration and presentation rhythm

Target **7:00 total**, comfortably within 6–8 minutes. Keep on-slide text sparse. Include timed speaker notes and demo cues where supported.

- Slides 1–4: **3:00** — story, problem, impact, approach.
- Slide 5: **2:00** — result and live demo. Use one slide as the launch point for the entire demo; do not add extra feature slides.
- Slides 6–7: **2:00** — team story, lessons learned, next steps.

The narration outside the demo should be approximately 600–650 words at a natural pace. The demo is actions with short explanations, not two minutes of continuous scripted speech. Do not bury the presentation in architecture, safeguarding checklists, pilot metrics, repeated asks, or lists of every implemented feature. Put extra detail behind the repository link and in notes.

## Brand and visual direction

Project: **CareRide**. Team: **Derek, Kenton, Eashan, and Chong**. Preserve these display names exactly.

Exact slogan: **A little help, A way forward. Connecting people to the care they need.**

Use actual app branding: forest green `#285d4d`, dark green `#1d493d`, amber `#d99a52`, cream `#f7f4ed`, mint `#e8f3ed`, ink `#20302b`. Large editorial serif headlines inspired by Georgia; clean sans-serif supporting text inspired by Geist. Rounded cards, generous whitespace, calm and welcoming visuals. Avoid pity imagery, corporate stock photos, and Salvation Army/FaithTech logos implying endorsement.

The app graphics are the **heart-handshake CareRide mark**, and a **heart-handshake → car-front → shield-check** journey illustration made with Lucide line icons, circular backgrounds, and fine connecting lines. Reuse these throughout without visual clutter. The original icon source is `react-web-careride/public/careride-icon.svg`; brand and journey graphics are implemented in `src/features/careride/ui.tsx` and `AuthScreens.tsx`.

Exact logo SVG for a generator without filesystem access:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#285d4d"/><g transform="translate(88 88) scale(14)" fill="none" stroke="#d99a52" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052 2.12 2.12 0 0 0-.004-3 2.124 2.124 0 1 0 3-3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.823-2.762"/></g></svg>
```

Use the exact main slogan on the title and closing slides. Select only a few genuine app phrases elsewhere: **A ride to care starts with you.** **People at the heart of every journey.** **A little coordination. A meaningful difference.** **A helping hand behind the wheel.** **Small steps. Stronger communities.**

Use respectful language: people experiencing homelessness, vulnerable neighbours, clients, staff, volunteers. Present care as offered to people of all backgrounds.

## Required seven slides

### 1. Project title page — 0:00–0:20

**Headline:** CareRide

**Main slogan:** A little help, A way forward.

**Supporting line:** Connecting people to the care they need.

**Required one-sentence problem summary:** People without reliable transport or digital access can struggle to reach hospitals, shelters, and essential services.

**Team names:** Derek · Kenton · Eashan · Chong.

**Clickable repository link:** https://github.com/FaithTechGlobalLabs/CareRide-Team-2

Include four small, neatly aligned team-photo positions. Actual team photos have not been supplied. Keep clearly editable, name-labelled photo placeholders; never generate fake portraits or substitute stock people. These placeholders are the only permitted missing-asset placeholders. The final presenter must replace them with real photos.

**Speaker note:** “Imagine having somewhere important to be, but no reliable way to get there. We are Derek, Kenton, Eashan, and Chong. This is CareRide: a little help, a way forward.”

### 2. Problem definition — 0:20–1:20

**Headline:** Care exists. Getting there is the gap.

Frame the Friday challenge from **Belkin Communities of Hope, Salvation Army**. Three short points:

- Essential trips to hospitals, shelters, and services.
- Some clients lack smartphones or digital access.
- Staff coordinate rides through fragmented manual processes.

Use a simple broken connection between “person” and “care.”

Tell a clearly labelled **illustrative scenario**, not a claimed client testimonial: a neighbour has an appointment; staff want to help; a willing driver exists; the connection is hard to organize. The lack of transport can put access to care at risk. Avoid fabricated missed-appointment rates, prevalence numbers, quotes, or research claims.

**Speaker note direction:** Explain the context that is not evident from the code: staff are already helping clients, so the product should support that relationship. The barrier is both transportation and coordination. Conventional self-service ride apps assume digital access; the supplied brief identifies why that assumption does not fit everyone. This is challenge analysis, not a completed competitor study.

### 3. Potential impact — 1:20–2:05

**Headline:** A seat in a car can open a door to care.

Show three outcomes as **potential**, not demonstrated results:

- Clients: more reachable essential services.
- Staff: less fragmented ride coordination.
- Communities: a practical way to offer help.

Explain the potential to spread from one organization to other shelters, churches, service organizations, and transportation providers. These are prospective participants, not confirmed partners. No unsupported claims about how many people will be reached, cost savings, or solving homelessness.

**Speaker note direction:** “We are addressing one practical barrier on a much larger journey. If a client can reach care, a staff member can coordinate with less uncertainty, and a volunteer can offer a useful ride, a small connection can matter. The same workflow could serve other organizations, subject to their participation and operating needs.”

### 4. Our approach — 2:05–3:00

**Headline:** Staff arrange. Drivers respond. Care stays connected.

Label the deliverable **Hackathon MVP**, with an explicit distinction between the demonstrated workflow and a production-ready transport service.

Use the app's heart-handshake → car-front → shield-check graphic and three short captions:

- Staff book on a client's behalf.
- Organization-approved drivers accept eligible requests.
- Staff follow pickup through drop-off.

Highlight the angle: staff-mediated access means the client does not need a smartphone or a client account in this MVP.

Put only two core assumptions on the slide or in notes: organizations can support approval/coordination; enough eligible drivers will be available. These require real pilot validation.

**Speaker note direction:** Explain the choice to focus on one complete journey rather than building every future feature. Current scope is free rides. Each organization approves drivers for its rides. The client-facing portal and paid alternatives are future possibilities, not implemented core features. Returning trips need two separately accepted legs; do not spend stage time detailing this unless asked.

### 5. The result & live demo — 3:00–5:00

**Headline:** One request. One driver. A journey to care.

**Short result summary:** Staff and driver screens · booking and acceptance · journey tracking · notifications.

One small status line: **Request → Accepted → Picked up → Completed**.

Use an authentic app screenshot if supplied. If no screenshot can be imported, use a restrained workflow diagram and an interface illustration clearly labelled **Prototype workflow illustration**, never “actual screenshot.” The local PowerPoint version can embed actual app captures from `output/presentation/assets/`.

**Live-demo run of show, 120 seconds total:**

1. **0:00–0:15:** Open the staff workspace with synthetic demo data. Explain: “The staff member acts on the client's behalf.”
2. **0:15–0:45:** Choose a sample client, saved pickup and destination, and pickup time. Submit one one-way ride.
3. **0:45–1:15:** Switch to a prepared, organization-approved driver session. Open the eligible request and accept it.
4. **1:15–1:40:** Show pickup and drop-off actions.
5. **1:40–2:00:** Return to the staff view, show completed status and the in-app update. Conclude: “One shared journey, from request to care.”

Prepare the staff and driver sessions before presenting. Precheck the selected time against driver eligibility and availability; use eligible synthetic records. Avoid registration, document uploads, settings, map configuration, and extra features during this demo. If anything fails, switch promptly to saved screenshots and describe what is visible. Do not claim today's live backend was tested if only the browser screen demo was used.

In notes, identify the evidence: repository progress notes document a staff-to-driver browser workflow; current repo includes React frontend, Express/PostgreSQL API, and deployment support. Earlier progress notes describe a JSON-backed stage; the latest code and merge notes show a later PostgreSQL restoration. Do not present that older JSON stage as the current production architecture. Core workflow demonstration should distinguish browser demo from live API deployment. The illustrative savings in the dashboard are not measured results.

### 6. The story — 5:00–6:15

**Headline:** One team. One complete journey.

Prioritize the human teamwork story, with three short beats:

- **Focus:** Align around the staff-to-driver journey.
- **Challenge:** Bring the interface, API, and deployment together.
- **Lesson:** Finish one useful path and test the handoffs.

Keep names visible: Derek, Kenton, Eashan, Chong. Individual contribution descriptions and personal anecdotes have not been confirmed by the team; keep a compact editable speaker-note section for these details. Do not invent personal sacrifice, emotional quotes, participant feedback, hours worked, or a hero story. An optional teammate spotlight belongs within this slide only if the team supplies a true example; do not add an eighth slide by default.

Evidence for a grounded story: `docs/PROGRESS.md` records an implemented and browser-checked staff-to-driver path. `docs/NOTIFICATION_MERGE_FIX.md` records a real notification/API integration issue when SQL and earlier JSON routes were combined, and a repair with build/test validation. Git history indicates interface/notifications/mobile work, staff workflow/deployment work, and backend/cloud integration work. Translate this into plain language: parts had to agree about ride status and updates. Do not claim every live deployment or notification channel is now verified.

**Speaker-note structure:** 20 seconds for confirmed contributions, 25 seconds for one real challenge and how the team addressed it, 20 seconds for the lesson, 10 seconds for the success. Until individual roles are confirmed, describe contributions collectively across design, staff/driver workflows, backend, and integration. The audience should understand something meaningful that the repository alone does not communicate; invite the presenters to add one authentic sentence about their experience here before delivery.

### 7. Thank you & next steps — 6:15–7:00

**Headline:** Help us make a way forward.

Three focused next steps:

- Validate with staff and a willing pilot organization.
- Confirm driver approval and operating procedures.
- Strengthen integration and continue maintaining the MVP.

**Audience invitation:** “Help us test it, offer a ride, or keep building.”

**Repository link again:** https://github.com/FaithTechGlobalLabs/CareRide-Team-2

**Exact closing slogan:** A little help, A way forward. Connecting people to the care they need.

**Speaker note direction:** Thank the organizers, project representatives, and team without claiming endorsements. The product plan should start with understanding the participating organization's operating and technical needs, checking the current frontend/API/database deployment end to end, and testing a limited supported workflow. Additional organizations and providers are growth potential. No confirmed pilot dates, budgets, launch guarantees, integrations with Salvation Army systems, or numerical impact promises. Conclude with one concrete invitation, not repeated fundraising asks.

## Judging criteria: evidence through the story

Do not add a judging-score slide. Cover the criteria naturally:

1. **Problem:** Friday challenge, digital exclusion, staff coordination context. Acknowledge the lack of a quantified baseline or formal competitor study.
2. **Potential:** The shared workflow could serve other organizations; client reach and savings remain to be measured.
3. **Approach:** Staff-mediated access, approval per organization, and the focused request-to-completion path.
4. **Deliverable:** Show the workflow in the live demo and distinguish demo mode from current live API verification.
5. **Excellence:** Thoughtful UX, grounded scope choices, documented integration work, and honest lessons under a short hackathon timeline. Do not invent the team's professional experience.
6. **Product plan:** Validate operational needs, assess client technical-stack fit, harden the current deployment and integration, establish maintenance ownership, then consider additional organizations.

## Alignment and factual guardrails

Sources: the supplied `docs/CareRide Team 2 HACKVAN2026.pdf`, especially pp. 19–21; `docs/CARERIDE_REQUIREMENTS.md`; current app source; `docs/PROGRESS.md`; `docs/NOTIFICATION_MERGE_FIX.md`; the organizer guidelines supplied by the user; event page https://luma.com/faithtech-hack2026.

HACKVAN's values are **Excellence, Impact, Hope**, and its purpose is helping redemptive organizations use technology to accelerate impact. Reflect these through useful service, dignity, practical neighbour-love, and humility about untested assumptions. Do not add a separate values slide or a religious condition for receiving care.

CareRide is an **independent platform shaped by the Belkin challenge**, not an official Salvation Army product. Staff book on behalf of clients in the current MVP; there is no initial client portal. Rides are planned essential-service trips; emergencies use emergency services. Potential service partnerships remain unconfirmed. Sample dashboard savings are made up and must never become outcome claims. Do not include real client information, credentials, contact phone numbers, or emails from the proposal.

The finished deck should be short, clear, authentic, and easy to present. Exactly seven slides, no appendix inside the live presentation. Put extra detail in the repository and speaker notes. Team photos and personal contribution/story details remain the only presenter-supplied items to complete.
