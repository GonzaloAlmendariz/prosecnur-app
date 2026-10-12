// C22: la ayuda de atajos lista los del editor de la pestaña activa. En Láminas y Vista general no hay Timeline,
// Canvas, picker (N), ajuste (F) ni zoom: anunciarlos ahí es prometer teclas que no hacen nada.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { atajosDePestana, ShortcutsModal } from "./ShortcutsModal";

const DEL_CLASICO = /Timeline|Canvas|canvas|picker|Zoom|zoom|slide/;
const teclas = (pestana: Parameters<typeof atajosDePestana>[0]) => atajosDePestana(pestana, "Ctrl").map((a) => a.keys.join("+"));

describe("atajosDePestana", () => {
  it("Láminas anuncia J/K, Alt+↑/↓ y «/», y nada del clásico", () => {
    const lista = atajosDePestana("laminas", "Ctrl");
    expect(teclas("laminas")).toEqual(expect.arrayContaining(["J", "K", "/", "Alt+↑", "Alt+↓", "Ctrl+1", "Ctrl+."]));
    expect(teclas("laminas")).not.toEqual(expect.arrayContaining(["N"]));
    expect(teclas("laminas")).not.toContain("F");
    expect(teclas("laminas")).not.toContain("T");
    expect(teclas("laminas")).not.toContain("V");
    expect(lista.map((a) => a.label).join(" ")).not.toMatch(DEL_CLASICO);
  });

  it("Vista general anuncia su recorrido de tarjetas y nada del clásico", () => {
    const lista = atajosDePestana("vista-general", "⌘");
    expect(lista.map((a) => a.keys.join("+"))).toEqual(expect.arrayContaining(["←+→", "Enter", "⌘+A", "Alt+←+↑", "Supr"]));
    expect(lista.map((a) => a.keys.join("+"))).not.toContain("J");
    expect(lista.map((a) => a.label).join(" ")).not.toMatch(DEL_CLASICO);
  });

  it("todas las pestañas ofrecen deshacer y la ayuda", () => {
    for (const p of ["laminas", "vista-general", "estilo", "estilo-informe", "word"] as const) {
      expect(teclas(p)).toEqual(expect.arrayContaining(["Ctrl+Z", "?"]));
    }
  });
});

const pintar = (search: string) => renderToStaticMarkup(
  createElement(MemoryRouter, { initialEntries: [`/graficos${search}`] }, createElement(ShortcutsModal, { onClose: () => undefined })),
);

describe("ShortcutsModal", () => {
  it("en Láminas (pestaña por defecto) no pinta los grupos Canvas ni Vista del clásico", () => {
    for (const search of ["", "?pestana=laminas"]) {
      const html = pintar(search);
      expect(html).toContain("Lámina siguiente");
      expect(html).toContain("Buscar una lámina en la Estructura");
      expect(html).not.toMatch(/Modo Timeline|Ajustar canvas|Zoom in/);
    }
  });

  it("un enlace viejo al Editor anterior abre Láminas", () => {
    const html = pintar("?pestana=clasico");
    expect(html).toContain("Lámina siguiente");
    expect(html).not.toContain("Modo Timeline");
  });

  it("en Vista general pinta su recorrido", () => {
    const html = pintar("?pestana=vista-general");
    expect(html).toContain("Abrir la lámina en Láminas");
    expect(html).not.toContain("Modo Timeline");
  });
});
