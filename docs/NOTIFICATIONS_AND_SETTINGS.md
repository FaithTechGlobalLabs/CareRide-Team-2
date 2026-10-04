# Notifications and settings

Implemented on KentonLast. The older database audit is outside this change's scope.

## Behavior

- The avatar menu opens `/settings` for staff and drivers. Staff can delete their own organization without an admin role.
- Account deletion requires the current password and `DELETE`. Organization deletion additionally requires its exact name, `DELETE ORGANIZATION`, and an explicit data-loss acknowledgment. A ride in progress blocks deletion.
- Driver deletion removes their profile, vehicle, availability, approval documents and notifications; accepted rides become available again. Completed rides retain organization history without the deleted driver profile. Staff deletion preserves organization records. Organization deletion removes its staff, clients, locations, rides, approval documents and associated notices. Independent driver accounts remain.
- JWTs are checked against current account membership on each request, so deleted accounts and deleted organizations immediately lose access.
- Active staff receive updates for client profile changes and ride changes within their organization. Drivers receive available rides using the same vehicle, approval, geography and availability rules used by the claim API. Repeated scans do not duplicate notifications.
- Both roles have an inbox, unread counts, read filters, individual read actions, mark-all-read and preferences. Unavailable driver offers point back to available rides.
- No native notification prompt occurs at login. A gentle card appears below the first successful ride-acceptance message, or after a day of use elsewhere. “Maybe later” snoozes for seven days; “No thanks” stops automatic prompts. Earlier snoozes are respected after accepting a ride. Native permission is requested only from the enable button. Browser declines receive settings instructions; inbox updates continue.
- On iPhone/iPad, use the installed Home Screen app for push. Browser support and unconfigured servers have clear fallback messages.
- Lock-screen messages deliberately omit client identities and health/location details. Clicking opens the authenticated notification inbox. The service worker does not cache account data.

## Persistence and deployment limits

This implementation extends the branch's **mounted API and existing `jsonStore` persistence** with notification preferences, browser subscriptions, an outbox and delivery results. It does not migrate that API to PostgreSQL, and introduces no SQL migration. The user explicitly requested skipping old database work. Do not describe these additions as verified PostgreSQL persistence. Container-local files do not provide durable multi-instance persistence on Cloud Run; the existing application storage must be addressed in the deployment's working persistence implementation before running these features across multiple instances. `CARERIDE_DATA_DIR` makes the store path explicit and isolates test fixtures.

The repository's backend typecheck still fails on pre-existing imports and seed-model incompatibilities. The new backend code was checked with TypeScript and exercised through source-based isolated HTTP tests. Fix the existing build failures before creating a fresh production image. No live deployment, database writes, account deletion, or real browser push delivery was performed.

## Push setup

The installed `web-push` library needs stable deployment values:

| Environment variable | Value |
| --- | --- |
| `VAPID_PUBLIC_KEY` | Public application-server key |
| `VAPID_PRIVATE_KEY` | Matching private key, injected as a deployment secret |
| `VAPID_SUBJECT` | A real contact such as `mailto:operations@example.org` |
| `NOTIFICATION_WORKER_TOKEN` | Separate random secret for the retry worker endpoint |

Generate a pair once in a private terminal, from `backend/`:

```sh
node --input-type=module -e 'import webpush from "web-push"; console.log(webpush.generateVAPIDKeys())'
```

Keep private keys and worker tokens out of source control. Reusing the same keys across deployments preserves subscriptions. Changing keys requires devices to subscribe again. The public key is returned by the authenticated preferences endpoint; no frontend secret is required.

Serve the frontend over HTTPS with `/notifications-sw.js` at the origin root, and point `VITE_API_URL` at the backend HTTPS origin. The worker intentionally handles notifications only, without fetch interception.

Mutations persist events first, then attempt bounded push delivery before the mutation promise resolves. An outbox tracks each notification/subscription combination. Temporary failures retry with exponential delay (up to five attempts); HTTP 404/410 removes expired subscriptions. Disabled preferences, read notices and unavailable rides are skipped. Subscription registration validates HTTPS hosts for Chrome/FCM, Firefox, Apple and Windows push services to avoid arbitrary outbound requests. Logout removes the current device subscription; settings can disable all devices.

For reliable retries/backlogs on request-billed Cloud Run, configure your scheduler to POST once per minute to `/internal/notifications/dispatch`, with `Authorization: Bearer <NOTIFICATION_WORKER_TOKEN>`. It processes up to 40 due deliveries per batch, eight at a time. There is no assumption that background timers run after a Cloud Run request ends. This endpoint is protected by the separate secret; absent secrets return 401. Ensure the scheduler can invoke the backend and that your persistence is shared by requests/worker instances.

## Verification

```sh
cd backend
npm run test:personal
cd ../react-web-careride
npm run build
```

The HTTP tests create a temporary store and delete only their own fixtures. Web Push delivery is mocked, so tests require no deployment credentials and send no real notifications. They cover account and organization confirmations, authorization/revocation, ride release, data preservation, recipient scoping, eligibility, deduplication, reminder timing, subscription rejection, retry behavior and expired endpoints. Full production builds and real-device push still require the deployment setup above.
