import { describe, expect, test } from "vitest";

import { normalizeMailBlock, normalizeMailBox } from "./materialMail";

// Estilo propio del bloque (collection_mail_box.R, GOAL editor profesional L2):
// la caja tiene que sobrevivir a leer y guardar, sin aceptar nada fuera del contrato.

describe("caja del bloque", () => {
  test("una caja completa vuelve tal cual", () => {
    const box = { bg: "tinte", border: "fino", corners: "redondas", spacing: "amplio", text: "auto" } as const;
    const b = normalizeMailBlock({ block_id: "p1", type: "paragraph", text: "Hola", box });
    expect(b).toMatchObject({ block_id: "p1", type: "paragraph", box });
  });

  test("el color libre se acepta en #rrggbb y en minúsculas; lo demás se descarta", () => {
    expect(normalizeMailBox({ bg: "#A1B2C3" })).toEqual({ bg: "#a1b2c3" });
    expect(normalizeMailBox({ bg: "rojo", border: "doble", corners: "12px", spacing: "enorme", text: "rojo" })).toEqual({});
    expect(normalizeMailBox({ css: "color:red", bg: "acento" })).toEqual({ bg: "acento" });
  });

  test("sin caja el bloque no gana una; el pie legal nunca la lleva", () => {
    expect(normalizeMailBlock({ block_id: "p1", type: "paragraph", text: "Hola" })).not.toHaveProperty("box");
    expect(normalizeMailBlock({ block_id: "f", type: "footer_legal", text: "Pie", box: { bg: "tinte" } })).not.toHaveProperty("box");
  });

  test("toda pieza la conserva, también las piezas gráficas", () => {
    for (const block of [
      { block_id: "b", type: "button", text: "Ir", url: "https://x.pe", box: { bg: "acento" } },
      { block_id: "i", type: "image", image_ref: "foto", alt: "Foto", box: { corners: "suaves" } },
      { block_id: "t", type: "icon_text", icon: "regalo", text: "Sorteo", box: { border: "acento" } },
    ]) {
      expect(normalizeMailBlock(block)).toHaveProperty("box", block.box);
    }
  });
});
