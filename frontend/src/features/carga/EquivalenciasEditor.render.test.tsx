// ADR 0104 (P22): Carga › Equivalencias se maneja entera en la app, por la persona.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { VariableDeBase } from "../../api/equivalencias";
import { EquivalenciasTabla } from "./EquivalenciasTabla";
import { aFilasEditor } from "./equivalenciasEditorModel";

function sinComentarios(nombre: string): string {
  return fs.readFileSync(fileURLToPath(new URL(nombre, import.meta.url)), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const v = (name: string, label: string, firma: string): VariableDeBase => ({ name, label, seccion: "", firma });
const variablesPorBase = {
  docentes: [v("p13_1", "¿Ha utilizado el servicio de salud?", "1=Sí|2=No"), v("p20", "Satisfacción general", "1..5")],
  estudiantes: [v("p11_1", "¿Ha usado el servicio de salud?", "1=Sí|2=No|9=NS"), v("q30", "Satisfacción", "1..5")],
};

const render = (filas = aFilasEditor([
  { seccion: "", etiqueta_estandar: "Uso de salud", variables: { docentes: "p13_1", estudiantes: "p11_1" }, cantidad: 2 },
  { seccion: "", etiqueta_estandar: "Satisfacción", variables: { docentes: "p20", estudiantes: "q30" }, cantidad: 2 },
  { seccion: "", etiqueta_estandar: "", variables: { docentes: "p20" }, cantidad: 1 },
])) => renderToStaticMarkup(createElement(EquivalenciasTabla, {
  bases: ["docentes", "estudiantes"],
  filas,
  variablesPorBase,
  onAsignar: () => undefined,
  onEditar: () => undefined,
  onQuitar: () => undefined,
  onConfirmar: () => undefined,
  onAgregarFila: () => undefined,
  onArmonizar: () => undefined,
}));

describe("editor directo de la matriz (ADR 0104)", () => {
  it("cada base elige su pregunta con un buscador, no con un <select>, y se lee etiqueta y código", () => {
    const html = render();
    expect(html).not.toContain("<select");
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain("¿Ha utilizado el servicio de salud?");
    expect(html).toContain('<code class="pulso-preg-codigo">p13_1</code>');
    expect(html).toContain('aria-label="Pregunta de estudiantes en Uso de salud: ¿Ha usado el servicio de salud? (p11_1)"');
    // La base que todavía no tiene pregunta invita a buscarla.
    expect(html).toContain("Buscar pregunta…");
  });

  it("la columna «Escala» dice si coinciden y abre la armonización cuando no", () => {
    const html = render();
    expect(html).toContain(">Escala</th>");
    expect(html).toContain("Escalas distintas · Armonizar");
    expect(html).toContain("Misma escala");
    expect(html).toContain("Falta otra base");
    expect(html).toContain('aria-label="Escalas distintas · Armonizar. Abrir la armonización de Uso de salud"');
    expect(html).toContain('data-armon-abrir="0"');
  });

  it("cobertura «N de M» por fila y «Añadir pregunta equivalente»", () => {
    const html = render();
    expect(html).toContain("2 de 2");
    expect(html).toContain("1 de 2");
    expect(html).toContain("Añadir pregunta equivalente");
  });

  it("sin propuestas: sólo una fila heredada sin confirmar lleva marca y confirmación propia", () => {
    expect(render()).not.toContain("Sin confirmar");
    const heredada = render(aFilasEditor([
      { seccion: "", etiqueta_estandar: "Vieja", variables: { docentes: "p20", estudiantes: "q30" }, cantidad: 2, sugerida: true },
    ]));
    expect(heredada).toContain("Sin confirmar");
    expect(heredada).toContain('aria-label="Confirmar Vieja"');
  });
});

describe("la pestaña ya no ofrece plantilla, subida ni emparejado automático (ADR 0104)", () => {
  const panel = sinComentarios("./EquivalenciasPanel.tsx");
  const bloques = sinComentarios("./ImportarBloquesDialog.tsx");

  it("sin «Generar plantilla», «Subir matriz» ni «Proponer emparejados», ni confirmación en bloque", () => {
    for (const quitado of ["Generar plantilla", "Descargar plantilla", "Subir matriz", "Proponer emparejados", "propuestas", "Sparkles", "apiUpload"]) {
      expect(panel).not.toContain(quitado);
    }
    expect(panel).toContain("Añadir pregunta equivalente");
    expect(panel).toContain("ImportarBloquesBoton");
  });

  it("«Importar por bloques» se presenta sólo como vía de series de mediciones", () => {
    expect(bloques).toContain("Traer una serie de mediciones ya armada");
    expect(bloques).not.toContain("Subir matriz");
  });
});
