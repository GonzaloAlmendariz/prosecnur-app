import type { CollectionMaterialTemplate } from "../../api/recopiladores";

export const TEMPLATE_HISTORY_LIMIT = 30;

export type TemplateHistory = {
  past: CollectionMaterialTemplate[];
  present: CollectionMaterialTemplate;
  future: CollectionMaterialTemplate[];
};

export type TemplateHistoryAction =
  | { type: "replace"; template: CollectionMaterialTemplate }
  | { type: "commit"; template: CollectionMaterialTemplate }
  | { type: "undo" }
  | { type: "redo" };

export function createTemplateHistory(template: CollectionMaterialTemplate): TemplateHistory {
  return { past: [], present: template, future: [] };
}

function sameTemplate(a: CollectionMaterialTemplate, b: CollectionMaterialTemplate) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function templateHistoryReducer(
  state: TemplateHistory,
  action: TemplateHistoryAction,
): TemplateHistory {
  if (action.type === "replace") return createTemplateHistory(action.template);
  if (action.type === "commit") {
    if (sameTemplate(state.present, action.template)) return state;
    return {
      past: [...state.past, state.present].slice(-TEMPLATE_HISTORY_LIMIT),
      present: action.template,
      future: [],
    };
  }
  if (action.type === "undo") {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return {
      past: state.past.slice(0, -1),
      present: previous,
      future: [state.present, ...state.future].slice(0, TEMPLATE_HISTORY_LIMIT),
    };
  }
  const next = state.future[0];
  if (!next) return state;
  return {
    past: [...state.past, state.present].slice(-TEMPLATE_HISTORY_LIMIT),
    present: next,
    future: state.future.slice(1),
  };
}

type ShortcutEvent = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey" | "target">;

function isEditingTarget(target: EventTarget | null) {
  if (!target || typeof target !== "object") return false;
  const element = target as { tagName?: unknown; isContentEditable?: unknown };
  const tag = typeof element.tagName === "string" ? element.tagName.toLowerCase() : "";
  return tag === "input" || tag === "textarea" || element.isContentEditable === true;
}

export function templateHistoryShortcut(event: ShortcutEvent): "undo" | "redo" | null {
  if (isEditingTarget(event.target) || !(event.metaKey || event.ctrlKey)) return null;
  const key = event.key.toLowerCase();
  if (key === "z") return event.shiftKey ? "redo" : "undo";
  if (key === "y" && event.ctrlKey) return "redo";
  return null;
}
