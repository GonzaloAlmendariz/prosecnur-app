import { describe, expect, it } from "vitest";

import type { CollectionMaterialTemplate } from "../../api/recopiladores";
import {
  TEMPLATE_HISTORY_LIMIT,
  createTemplateHistory,
  templateHistoryReducer,
  templateHistoryShortcut,
} from "./templateHistory";

const template = (revision: number): CollectionMaterialTemplate => ({
  schema: "collection_material_template/v1",
  template_id: "template-1",
  revision,
  preset_id: "ficha_aplicacion_a4_v1",
  material_kind: "application_sheet",
  compatible_adapters: ["aulas_v1"],
  page: { size: "A4", orientation: "portrait" },
  pages: [{ page_id: "ficha", layout_preset: "single_sheet", blocks: [] }],
  brand_ref: "pulso-default",
  sensitivity_policy: "operational",
});

describe("historial del editor semántico", () => {
  it("deshace, rehace e invalida future al editar", () => {
    let state = createTemplateHistory(template(1));
    state = templateHistoryReducer(state, { type: "commit", template: template(2) });
    state = templateHistoryReducer(state, { type: "undo" });
    expect(state.present.revision).toBe(1);
    state = templateHistoryReducer(state, { type: "redo" });
    expect(state.present.revision).toBe(2);
    state = templateHistoryReducer(state, { type: "undo" });
    state = templateHistoryReducer(state, { type: "commit", template: template(3) });
    expect(templateHistoryReducer(state, { type: "redo" })).toBe(state);
  });

  it("retiene como máximo 30 estados pasados", () => {
    let state = createTemplateHistory(template(0));
    for (let i = 1; i <= TEMPLATE_HISTORY_LIMIT + 4; i += 1) {
      state = templateHistoryReducer(state, { type: "commit", template: template(i) });
    }
    expect(state.past).toHaveLength(TEMPLATE_HISTORY_LIMIT);
    expect(state.past[0].revision).toBe(4);
  });

  it("mapea atajos y no intercepta campos editables", () => {
    const root = { tagName: "DIV" } as unknown as EventTarget;
    const input = { tagName: "INPUT" } as unknown as EventTarget;
    expect(templateHistoryShortcut({ key: "z", metaKey: true, ctrlKey: false, shiftKey: false, target: root })).toBe("undo");
    expect(templateHistoryShortcut({ key: "Z", metaKey: true, ctrlKey: false, shiftKey: true, target: root })).toBe("redo");
    expect(templateHistoryShortcut({ key: "y", metaKey: false, ctrlKey: true, shiftKey: false, target: root })).toBe("redo");
    expect(templateHistoryShortcut({ key: "z", metaKey: true, ctrlKey: false, shiftKey: false, target: input })).toBeNull();
  });
});
