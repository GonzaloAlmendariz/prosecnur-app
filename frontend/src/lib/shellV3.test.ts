import { describe, expect, it, vi } from "vitest";
import {
  SHELL_V3_SIDEBAR_STORAGE_KEY,
  defaultSidebarCollapsed,
  isShellV3Enabled,
  readSidebarCollapsed,
  withShellV3Query,
  writeSidebarCollapsed,
} from "./shellV3";

describe("shell v3 runtime contract", () => {
  it("enables the experimental shell only in development", () => {
    expect(isShellV3Enabled("?shell=v3", { dev: true })).toBe(true);
    expect(
      isShellV3Enabled("", { dev: true, envEnabled: true }),
    ).toBe(true);
    expect(
      isShellV3Enabled("?shell=v3", { dev: false, envEnabled: true }),
    ).toBe(false);
    expect(isShellV3Enabled("?shell=v2", { dev: true })).toBe(false);
  });

  it("keeps the flag across links without leaking unrelated query state", () => {
    expect(withShellV3Query("/carga", "?shell=v3&tab=old")).toBe(
      "/carga?shell=v3",
    );
    expect(
      withShellV3Query("/monitoreo?tab=avance#resumen", "?shell=v3"),
    ).toBe("/monitoreo?tab=avance&shell=v3#resumen");
    expect(withShellV3Query("/carga", "?shell=v2")).toBe("/carga");
  });

  it("defaults canvas-heavy routes to 64px and workbenches to 248px", () => {
    expect(defaultSidebarCollapsed(undefined, "/")).toBe(true);
    expect(defaultSidebarCollapsed("editor-xlsform", "/editor-xlsform")).toBe(
      true,
    );
    expect(defaultSidebarCollapsed("dashboard", "/tablero")).toBe(true);
    expect(defaultSidebarCollapsed("hojas-ruta", "/hojas-ruta")).toBe(false);
    expect(defaultSidebarCollapsed("calc-muestra", "/calc-muestra")).toBe(
      false,
    );
    expect(defaultSidebarCollapsed("procesamiento", "/carga")).toBe(false);
  });

  it("persists only the local chrome preference", () => {
    const getItem = vi.fn(() => "true");
    expect(readSidebarCollapsed({ getItem })).toBe(true);
    expect(getItem).toHaveBeenCalledWith(SHELL_V3_SIDEBAR_STORAGE_KEY);

    const setItem = vi.fn();
    writeSidebarCollapsed({ setItem }, false);
    expect(setItem).toHaveBeenCalledWith(
      SHELL_V3_SIDEBAR_STORAGE_KEY,
      "false",
    );
  });
});
