"use strict";

const EXPECTED_STDIO_DISCONNECT_CODES = new Set(["EIO", "EPIPE"]);

function createCloseGuard({ schedule = setTimeout, cancel = clearTimeout } = {}) {
  let rendererMode = "app";
  let rendererReady = false;
  let closeConfirmed = false;
  let pendingTimer = null;

  function clearPending() {
    if (pendingTimer !== null) {
      cancel(pendingTimer);
      pendingTimer = null;
    }
  }

  return {
    allowRenderer() {
      rendererMode = "app";
      rendererReady = false;
      clearPending();
    },

    setRendererReady(ready) {
      if (!ready) {
        rendererReady = false;
        clearPending();
        return false;
      }
      if (rendererMode !== "app") return false;
      rendererReady = true;
      return true;
    },

    invalidateRenderer() {
      rendererMode = "shell";
      rendererReady = false;
      clearPending();
    },

    confirmClose() {
      closeConfirmed = true;
      clearPending();
    },

    isConfirmed() {
      return closeConfirmed;
    },

    shouldBlockClose() {
      return !closeConfirmed && rendererMode === "app" && rendererReady;
    },

    requestClose({ hasWindow, sendCloseRequest, quit }) {
      if (!hasWindow || rendererMode !== "app" || !rendererReady) {
        closeConfirmed = true;
        clearPending();
        quit();
        return "quit";
      }

      if (pendingTimer !== null) return "pending";
      sendCloseRequest();
      pendingTimer = schedule(() => {
        pendingTimer = null;
      }, 1000);
      return "renderer";
    }
  };
}

function isExpectedStdioDisconnect(error) {
  return Boolean(
    error &&
    error.syscall === "write" &&
    EXPECTED_STDIO_DISCONNECT_CODES.has(error.code)
  );
}

function createStdioMirror(stream, { onUnexpectedError = () => {} } = {}) {
  let available = true;

  function handleError(error) {
    available = false;
    if (!isExpectedStdioDisconnect(error)) {
      onUnexpectedError(error);
    }
  }

  stream.on("error", handleError);

  return {
    write(chunk) {
      if (!available) return false;
      try {
        stream.write(chunk);
        return true;
      } catch (error) {
        handleError(error);
        return false;
      }
    },

    isAvailable() {
      return available;
    }
  };
}

module.exports = {
  createCloseGuard,
  createStdioMirror,
  isExpectedStdioDisconnect
};
