export const MISSION_CONTROL_MENU_ITEMS = [
  { action: "open", label: "Abrir", section: "primary" },
  { action: "view-progress", label: "Ver avance", section: "primary" },
  { action: "remove", label: "Quitar del proyecto", section: "destructive" },
] as const;

export type MissionControlMenuAction =
  (typeof MISSION_CONTROL_MENU_ITEMS)[number]["action"];

export type MissionControlMenuState =
  | { kind: "closed" }
  | { kind: "menu"; slug: string }
  | { kind: "confirm-remove"; slug: string };

export type MissionControlMenuEvent =
  | { type: "open"; slug: string }
  | { type: "escape" }
  | { type: "select"; action: MissionControlMenuAction }
  | { type: "confirm-remove" };

export type MissionControlMenuCommand =
  | { type: "open"; slug: string }
  | { type: "view-progress"; slug: string }
  | { type: "remove"; slug: string };

export type MissionControlMenuTransition = {
  state: MissionControlMenuState;
  command: MissionControlMenuCommand | null;
};

const CLOSED_TRANSITION: MissionControlMenuTransition = {
  state: { kind: "closed" },
  command: null,
};

export function transitionMissionControlMenu(
  state: MissionControlMenuState,
  event: MissionControlMenuEvent,
): MissionControlMenuTransition {
  if (event.type === "open") {
    return {
      state: { kind: "menu", slug: event.slug },
      command: null,
    };
  }

  if (event.type === "escape") return CLOSED_TRANSITION;

  if (event.type === "confirm-remove") {
    if (state.kind !== "confirm-remove") return CLOSED_TRANSITION;
    return {
      state: { kind: "closed" },
      command: { type: "remove", slug: state.slug },
    };
  }

  if (state.kind !== "menu") return CLOSED_TRANSITION;

  if (event.action === "remove") {
    return {
      state: { kind: "confirm-remove", slug: state.slug },
      command: null,
    };
  }

  if (event.action === "view-progress") {
    return {
      state,
      command: { type: "view-progress", slug: state.slug },
    };
  }

  return {
    state: { kind: "closed" },
    command: { type: "open", slug: state.slug },
  };
}
