// U1 del QA de CCSS (2026-10-24): las preguntas que el motor lee de la base principal sin que el plan lo diga ya no
// bloquean; el panel las junta en una fila con la acción masiva, en vez de 117 líneas casi iguales.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ValidationIssue } from "../usePlanValidator";
import { PanelAvisos } from "./PanelAvisos";

const aviso = (slideId: string): ValidationIssue => ({
  severity: "warning", code: "var-base-implicita", slideId, slotName: "grafico",
  message: `Lámina · “${slideId}” (Un gráfico), espacio «Gráfico»: la pregunta «Sexo» se lee de la base principal.`,
});
const otro: ValidationIssue = { severity: "warning", code: "titulo-vacio", slideId: "s9", message: "Lámina 9 (Un gráfico): no tiene título." };

const pintar = (baseImplicita?: { laminas: number; preguntas: number; base: string; fijar: () => void }) => renderToStaticMarkup(
  <PanelAvisos
    panel={{ abierto: true, abrir: () => {}, cerrar: () => {}, alternar: () => {}, props: { "data-pulso-panel": "avisos" } }}
    grupos={{ bloquean: [], revisar: [aviso("s1"), aviso("s2"), aviso("s3"), otro], motor: [], plan: [], equivalencias: [] }}
    estructura={{ nodos: [], laminas: [] }}
    onIr={() => {}}
    baseImplicita={baseImplicita}
  />,
);

describe("PanelAvisos · base implícita", () => {
  it("junta los avisos en una fila con «Fijar la base principal en todas las láminas»", () => {
    const html = pintar({ laminas: 3, preguntas: 5, base: "default", fijar: () => {} });
    expect(html).toContain("Fijar la base principal en todas las láminas");
    expect(html).toContain("En 3 láminas, 5 preguntas se leen de la base principal sin que el plan lo diga.");
    expect(html).not.toContain("la pregunta «Sexo» se lee");
    expect(html).toContain("no tiene título");
    expect(html).toMatch(/Conviene revisar <span>2<\/span>/);
    expect(html).not.toContain("default");
  });

  it("sin la acción, los avisos se listan como siempre", () => {
    const html = pintar();
    expect(html).not.toContain("Fijar la base");
    expect(html).toMatch(/Conviene revisar <span>4<\/span>/);
  });
});
