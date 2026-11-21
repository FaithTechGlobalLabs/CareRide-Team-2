// Compatibility entry points; behavior lives in application services and infrastructure adapters.
import { notificationContainer } from "../infrastructure/notificationContainer.js";
export { pushConfig } from "../infrastructure/push/webPushTransport.js";

export async function flushPush(): Promise<void> {
  await notificationContainer.dispatch();
}
