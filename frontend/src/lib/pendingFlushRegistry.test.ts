import { afterEach, describe, expect, test, vi } from "vitest";
import {
  __resetPendingFlushRegistry,
  flushPendingSyncs,
  registerPendingFlush,
} from "./pendingFlushRegistry";

afterEach(() => {
  __resetPendingFlushRegistry();
});

describe("pendingFlushRegistry (G-13)", () => {
  test("espera todos los flushers registrados", async () => {
    const calls: string[] = [];
    registerPendingFlush(async () => {
      calls.push("a");
    });
    registerPendingFlush(async () => {
      calls.push("b");
    });
    await flushPendingSyncs();
    expect(calls.sort()).toEqual(["a", "b"]);
  });

  test("un flusher caido no rechaza el guardado", async () => {
    const ok = vi.fn(async () => undefined);
    registerPendingFlush(async () => {
      throw new Error("boom");
    });
    registerPendingFlush(ok);
    await expect(flushPendingSyncs()).resolves.toBeUndefined();
    expect(ok).toHaveBeenCalledTimes(1);
  });

  test("des-registrar saca al flusher de la espera", async () => {
    const f = vi.fn(async () => undefined);
    const unregister = registerPendingFlush(f);
    unregister();
    await flushPendingSyncs();
    expect(f).not.toHaveBeenCalled();
  });
});
