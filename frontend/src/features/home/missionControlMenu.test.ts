import { describe, expect, it } from "vitest";
import {
  MISSION_CONTROL_MENU_ITEMS,
  transitionMissionControlMenu,
  type MissionControlMenuState,
} from "./missionControlMenu";

describe("menú de opciones de Mission Control", () => {
  it("presenta Abrir, Ver avance y Quitar como acciones separadas", () => {
    expect(
      MISSION_CONTROL_MENU_ITEMS.map(({ action, label }) => ({ action, label })),
    ).toEqual([
      { action: "open", label: "Abrir" },
      { action: "view-progress", label: "Ver avance" },
      { action: "remove", label: "Quitar del proyecto" },
    ]);

    expect(MISSION_CONTROL_MENU_ITEMS.at(-1)).toMatchObject({
      action: "remove",
      section: "destructive",
    });
  });

  it("seleccionar Quitar abre el confirm sin emitir todavía el borrado", () => {
    const openState: MissionControlMenuState = {
      kind: "menu",
      slug: "dashboard",
    };

    expect(
      transitionMissionControlMenu(openState, {
        type: "select",
        action: "remove",
      }),
    ).toEqual({
      state: { kind: "confirm-remove", slug: "dashboard" },
      command: null,
    });
  });

  it("Escape cancela el confirm sin ejecutar borrado", () => {
    const confirmState: MissionControlMenuState = {
      kind: "confirm-remove",
      slug: "dashboard",
    };

    expect(
      transitionMissionControlMenu(confirmState, { type: "escape" }),
    ).toEqual({
      state: { kind: "closed" },
      command: null,
    });
  });

  it("solo la confirmación explícita emite el comando de quitar", () => {
    const confirmState: MissionControlMenuState = {
      kind: "confirm-remove",
      slug: "dashboard",
    };

    expect(
      transitionMissionControlMenu(confirmState, { type: "confirm-remove" }),
    ).toEqual({
      state: { kind: "closed" },
      command: { type: "remove", slug: "dashboard" },
    });
  });
});
