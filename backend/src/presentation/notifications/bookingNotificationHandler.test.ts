import { expect, test, vi } from "vitest";

import { createBookingNotificationHandler } from "./bookingNotificationHandler.js";

test("retains background work without waiting for delivery to finish", async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const tasks: Promise<unknown>[] = [];
  let completed = false;
  const notify = async () => {
    await pending;
    completed = true;
    return { noticesCreated: 1 };
  };
  const handler = createBookingNotificationHandler({ notify }, (task) => {
    tasks.push(task);
  });
  handler(["outbound", "return"]);
  expect(tasks).toHaveLength(1);
  expect(completed).toBe(false);
  finish();
  await tasks[0];
  expect(completed).toBe(true);
});

test("catches background rejection and retention failure without leaking sensitive errors", async () => {
  const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
  const tasks: Promise<unknown>[] = [];
  try {
    const handler = createBookingNotificationHandler(
      {
        notify: async () => {
          throw new Error("sensitive endpoint and key");
        },
      },
      (task) => {
        tasks.push(task);
        throw new Error("sensitive hosting context");
      }
    );
    expect(() => handler(["ride"])).not.toThrow();
    await expect(tasks[0]).resolves.toBeUndefined();
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("sensitive");
  } finally {
    errorLog.mockRestore();
  }
});
