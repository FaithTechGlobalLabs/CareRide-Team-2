import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { test } from "vitest";

const source = await readFile(
  new URL(
    "../../../react-web-careride/public/notifications-sw.js",
    import.meta.url
  ),
  "utf8"
);

for (const [destination, expected] of [
  ["/driver", "/driver"],
  ["/notifications", "/notifications"],
  [undefined, "/notifications"],
  ["https://outside.example/driver", "/notifications"],
  ["/settings", "/notifications"],
] as const) {
  test(`push destination ${destination} opens ${expected}`, async () => {
    const handlers = new Map<string, (event: any) => void>();
    let shown: any;
    let opened = "";
    const tasks: Promise<unknown>[] = [];
    vm.runInNewContext(source, {
      URL,
      self: {
        location: { origin: "https://careride.example" },
        addEventListener: (name: string, handler: (event: any) => void) =>
          handlers.set(name, handler),
        registration: {
          showNotification: async (_title: string, options: unknown) => {
            shown = options;
          },
        },
        clients: {
          matchAll: async () => [],
          openWindow: async (url: string) => {
            opened = url;
          },
        },
      },
    });
    handlers.get("push")!({
      data: {
        json: () => ({ title: "CareRide", body: "Generic", url: destination }),
      },
      waitUntil: (task: Promise<unknown>) => tasks.push(task),
    });
    await Promise.all(tasks);
    handlers.get("notificationclick")!({
      notification: { data: shown.data, close() {} },
      waitUntil: (task: Promise<unknown>) => tasks.push(task),
    });
    await Promise.all(tasks);
    assert.equal(opened, `https://careride.example${expected}`);
    assert.equal(shown.body, "Generic");
  });
}
