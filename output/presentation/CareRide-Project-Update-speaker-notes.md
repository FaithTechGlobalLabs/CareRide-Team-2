# CareRide — seven-slide project update

Total: 7:00. Slides 1–4: 3:00. Slide 5 live demo: 2:00. Slides 6–7: 2:00.

Team: Derek, Kenton, Eashan, Chong.

Before presenting: replace the four title-slide photo slots with real team photos. Add confirmed individual contributions and one authentic personal moment to slide 6 notes. The deck uses collective contributions because individual roles have not been confirmed.

Prepare two sessions and a sample ride that is eligible for the driver, including the pickup time. Decide whether presenting screen-demo mode or the live API, and state this accurately. Use the embedded screenshots as a fallback. Sample savings are illustrative, never outcome evidence.

## PROJECT TITLE — 0:00–0:20

Imagine having somewhere important to be, but no reliable way to get there. We are Derek, Kenton, Eashan, and Chong. This is CareRide: a little help, a way forward. Connecting people to the care they need.

## PROBLEM DEFINITION — 0:20–1:20

Picture a neighbour who has a medical appointment. The staff member wants to help. A volunteer might have a seat in their car. But connecting those people can mean calls, messages, and uncertainty. This is an illustrative scenario, not a client testimonial. On pitch night, Belkin Communities of Hope brought us this challenge: clients need to reach hospitals, shelters, and essential services, but some lack smartphones or the digital access to arrange rides independently. Staff step in, yet there is no centralized way to request, track, and share those rides. Our understanding was that transportation and coordination are connected problems. We needed to support the staff-client relationship already in place, rather than assume every client could use another app.

## POTENTIAL IMPACT — 1:20–2:05

If we make that connection easier, three things become possible: a client has a more reachable path to essential care, staff can coordinate with less uncertainty, and a volunteer can turn willingness into practical help. We are addressing one barrier for people experiencing homelessness and other vulnerable neighbours. The same workflow could support other shelters, churches, service organizations, and transportation providers. That is potential, not a confirmed network. We have not measured savings or how many people this will reach. A real pilot should establish whether the journeys happen and whether staff and clients find the experience useful.

## OUR APPROACH — 2:05–3:00

We built a hackathon MVP around one complete journey. Staff book a free ride on a client's behalf, an organization-approved driver accepts an eligible request, and staff follow pickup through drop-off. The key design choice is staff-mediated access: the client does not need a smartphone or an account in this version. Saved pickup points and destinations make the request easier to arrange. Each organization approves drivers for its own rides. We chose this focused workflow so we could demonstrate a useful path before adding more features. Our core assumptions are that organizations can support approval and coordination, and enough eligible drivers will be available. Those need testing with real operations. This is an MVP, with more work required before a supported transport service.

## THE RESULT & LIVE DEMO — 3:00–5:00

DEMO WINDOW: 3:00–5:00. Use prepared staff and driver sessions with synthetic records.
0:00–0:15: Show staff workspace. Say: "Staff act on the client's behalf."
0:15–0:45: Choose a sample client, saved pickup and destination, and an eligible pickup time. Submit one one-way ride.
0:45–1:15: Switch to the prepared organization-approved driver. Open and accept the eligible request.
1:15–1:40: Show pickup and drop-off actions.
1:40–2:00: Return to staff and show completion and the in-app update. Say: "One shared journey, from request to care."
Do not narrate a feature tour. Skip registration, uploads, settings, and configuration. If the live demo fails, use the two authentic screenshots on this slide and explain the intended handoff. Verify eligibility and availability before presenting. Clearly say whether demonstrating browser screen-demo mode or the live API. Screenshots are actual local app screens using synthetic data; they do not establish current live backend health. Dashboard sample savings are not evidence of impact.

## THE STORY — 5:00–6:15

Our work came together across the staff and driver experience, backend, notifications, and deployment. The shared goal was one complete journey, from a staff request to a driver's completion update. One concrete challenge was integration. The repository documents a notification issue where the interface and backend did not agree after routes were merged. Bringing those parts together meant repairing the API and checking the handoff, rather than treating each screen as finished on its own. The project notes also record a browser check of the staff-to-driver path. The lesson we take from that work is simple: finish one useful path, then test the connections between the parts. For a person waiting on a ride, those connections are the product. Before presenting, add one brief true sentence about who did what and one personal moment from the weekend. Individual roles and personal anecdotes have not been confirmed; do not invent them.

## THANK YOU & NEXT STEPS — 6:15–7:00

Thank you to the organizers, project representatives, and everyone who helped build this weekend. Next, we want to validate the workflow with staff and a willing organization, agree driver approval and operating procedures, and strengthen the frontend, API, and database integration for a supported pilot. We also need to understand the organization's technical environment and agree who will maintain the product. You can help us test it, offer a ride, or keep building. The repository is linked here for anyone who wants to explore further. CareRide: a little help, a way forward. Connecting people to the care they need.

## Product-plan and judging Q&A

**Client technical-stack fit:** The repository includes a React frontend, Express/PostgreSQL API, and deployment support. Before a pilot, verify them together, understand the organization’s technical environment, and agree maintenance ownership. No integration with Salvation Army systems is confirmed.

**Evidence:** Project notes record a staff-to-driver browser pass and integration fixes. A local screen-demo capture does not prove current live deployment health.

**Potential:** The workflow could serve additional organizations. Driver availability, staff usefulness, client experience, and outcomes need pilot validation.

**Problem research:** The supplied Belkin challenge informed the approach. A quantified baseline and a formal competitor study are not claimed.

Repository: https://github.com/FaithTechGlobalLabs/CareRide-Team-2