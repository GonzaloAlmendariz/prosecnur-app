"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");

const {
  createCloseGuard,
  createStdioMirror,
  isExpectedStdioDisconnect
} = require("../lifecycle.cjs");

class FakeWritable extends EventEmitter {
  constructor() {
    super();
    this.writes = [];
  }

  write(chunk) {
    this.writes.push(chunk);
    return true;
  }
}

function makeStreamError(code, syscall) {
  return Object.assign(new Error(`${syscall} ${code}`), { code, syscall });
}

test("el cierre consulta al renderer sano y hace quit tras invalidarlo", () => {
  const guard = createCloseGuard({ schedule: () => 1, cancel: () => {} });
  const calls = [];
  const closeActions = {
    hasWindow: true,
    sendCloseRequest: () => calls.push("ipc"),
    quit: () => calls.push("quit")
  };

  guard.setRendererReady(true);
  guard.requestClose(closeActions);
  assert.deepEqual(calls, ["ipc"]);

  guard.invalidateRenderer();
  guard.requestClose(closeActions);
  assert.deepEqual(calls, ["ipc", "quit"]);
});

test("ignora un ready tardío hasta permitir una nueva generación del renderer", () => {
  const guard = createCloseGuard({ schedule: () => 1, cancel: () => {} });
  const calls = [];
  const closeActions = {
    hasWindow: true,
    sendCloseRequest: () => calls.push("ipc"),
    quit: () => calls.push("quit")
  };

  assert.equal(guard.setRendererReady(true), true);
  guard.invalidateRenderer();
  assert.equal(guard.setRendererReady(true), false);
  assert.equal(guard.requestClose(closeActions), "quit");
  assert.deepEqual(calls, ["quit"]);

  guard.allowRenderer();
  assert.equal(guard.setRendererReady(true), true);
  assert.equal(guard.requestClose(closeActions), "renderer");
  assert.deepEqual(calls, ["quit", "ipc"]);
});

test("solo EIO y EPIPE de write son desconexiones esperables de stdio", () => {
  assert.equal(isExpectedStdioDisconnect(makeStreamError("EIO", "write")), true);
  assert.equal(isExpectedStdioDisconnect(makeStreamError("EPIPE", "write")), true);
  assert.equal(isExpectedStdioDisconnect(makeStreamError("ENOSPC", "write")), false);
  assert.equal(isExpectedStdioDisconnect(makeStreamError("EIO", "read")), false);
});

test("una desconexión esperable deshabilita solo su mirror", async (t) => {
  for (const code of ["EIO", "EPIPE"]) {
    await t.test(code, () => {
      const stream = new FakeWritable();
      const unexpectedErrors = [];
      const mirror = createStdioMirror(stream, {
        onUnexpectedError: (error) => unexpectedErrors.push(error)
      });

      assert.equal(mirror.isAvailable(), true);
      assert.equal(mirror.write("antes"), true);
      stream.emit("error", makeStreamError(code, "write"));
      assert.equal(mirror.isAvailable(), false);
      assert.equal(mirror.write("después"), false);

      assert.deepEqual(stream.writes, ["antes"]);
      assert.deepEqual(unexpectedErrors, []);
    });
  }
});

test("el mirror devuelve false cuando la escritura falla", () => {
  const stream = new FakeWritable();
  const unexpectedErrors = [];
  const mirror = createStdioMirror(stream, {
    onUnexpectedError: (error) => unexpectedErrors.push(error)
  });
  const error = makeStreamError("EPIPE", "write");
  stream.write = () => {
    throw error;
  };

  assert.equal(mirror.write("mensaje"), false);
  assert.equal(mirror.isAvailable(), false);
  assert.deepEqual(unexpectedErrors, []);
});

test("el mirror entrega errores no esperables al manejador fatal", async (t) => {
  for (const [code, syscall] of [
    ["ENOSPC", "write"],
    ["EIO", "read"]
  ]) {
    await t.test(`${syscall} ${code}`, () => {
      const stream = new FakeWritable();
      const unexpectedErrors = [];
      createStdioMirror(stream, {
        onUnexpectedError: (error) => unexpectedErrors.push(error)
      });
      const error = makeStreamError(code, syscall);

      stream.emit("error", error);

      assert.deepEqual(unexpectedErrors, [error]);
    });
  }
});
