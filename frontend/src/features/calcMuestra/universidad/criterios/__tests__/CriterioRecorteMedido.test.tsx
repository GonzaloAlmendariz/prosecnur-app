/**
 * V3 · Un criterio declarado que no recorta se ve como tal.
 *
 * La cabecera de la tarjeta ya avisa cuando la selección no restringe —nada o
 * todo marcado—, pero eso mira la DECLARACIÓN. Un criterio con un subconjunto
 * propio seleccionado puede aun así no dejar fuera a nadie porque las
 * categorías elegidas cubren toda la base. Es lo que pasó en el proyecto real
 * de 2025-2 ningún criterio es inerte —los cinco recortan—, así que el caso se
 * prueba con cifras SINTÉTICAS: es el que la pantalla no sabía distinguir, no
 * uno observado ahí. Lo que sí ocurre en ese proyecto es lo contrario y también
 * necesita decirse: `level` deja fuera 35.364 filas y aun así no reduce el
 * marco, porque vive en capa `instrumento`.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CriterioVariable, CriteriosSeleccionMarco } from "../../../../../api/client";
import { CriterioCard } from "../CriterioCard";
import type { RecorteCriterioAlumno } from "../recorteCriteriosAlumnoModel";

const VARIABLE = {
  id: "level", label: "Nivel curricular", scope: "alumno", kind: "flat",
  mappedColumn: "Nivel curricular",
  categories: [{ key: "1", label: "1", n: 10 }, { key: "2", label: "2", n: 20 }],
} as unknown as CriterioVariable;

const SEL = { byVariable: { level: { scope: "alumno", kind: "flat", values: ["1"] } } } as unknown as CriteriosSeleccionMarco;

function pintar(recorte: RecorteCriterioAlumno | null, desactualizado = false): string {
  return renderToStaticMarkup(
    <CriterioCard
      variable={VARIABLE} seleccion={SEL} facultades={[]}
      onSel={() => {}} onRango={() => {}} pendiente={false}
      onConfirmar={() => {}} onDescartar={() => {}}
      recorteMedido={recorte} recorteDesactualizado={desactualizado}
    />,
  );
}

/** Criterio sintético que se midió y no dejó fuera a nadie. */
const BASE = { id: "sintetico", layer: "marco", pasan: 136284, recorta: 0, pctRecorte: 0, noRecorta: true, evaluable: true };

describe("recorte medido en la tarjeta del criterio", () => {
  it("dice que dejó fuera a 0 cuando está declarado y no filtra", () => {
    const html = pintar(BASE);
    expect(html).toContain('data-estado="inerte"');
    expect(html).toContain("dejó fuera a <strong>0</strong>");
    expect(html).toContain("no filtra a nadie");
  });

  it("dice cuánto dejó fuera cuando sí recorta", () => {
    const html = pintar({ ...BASE, pasan: 123360, recorta: 12924, pctRecorte: 0.0948, noRecorta: false });
    expect(html).toContain('data-estado="recorta"');
    expect(html).toContain("<strong>12,924</strong>");
    expect(html).toContain("9.5%");
  });

  it("un criterio de otra capa no promete recortar el marco", () => {
    // instrumento/procesamiento se reportan pero no sacan a nadie del marco:
    // leer su conteo como un recorte sería atribuirle un efecto que no tuvo.
    // Cifras reales de `level` en 2025-2, que es justo este caso.
    const html = pintar({ ...BASE, id: "level", layer: "instrumento", pasan: 100920, recorta: 35364, pctRecorte: 0.2595, noRecorta: false });
    expect(html).toContain('data-estado="otra-capa"');
    expect(html).toContain("no recorta el marco");
  });

  it("avisa cuando la cifra es del marco anterior", () => {
    // La cifra sale del marco EJECUTADO. Si la selección cambió y no se
    // reconstruyó, leerla como el efecto de lo declarado es el error.
    expect(pintar(BASE, true)).toContain("la selección cambió");
    expect(pintar(BASE, false)).not.toContain("la selección cambió");
  });

  it("sin medición no dibuja nada", () => {
    expect(pintar(null)).not.toContain("cmv2-crit-recorte-medido");
  });
});

describe("criterio que no se pudo medir", () => {
  it("no se anuncia como que no filtra, sino como no medido", () => {
    // Sin datos en su columna el criterio deja pasar a todos porque no había
    // con qué morder. Decir «no filtra a nadie» afirmaría una medición que no
    // ocurrió — y es justo la distinción que este desglose existe para hacer.
    const html = pintar({ ...BASE, id: "formation", evaluable: false, noRecorta: false });
    expect(html).toContain('data-estado="no-medible"');
    expect(html).toContain("No se pudo medir");
    expect(html).toContain("no trae datos en la base");
    expect(html).not.toContain("no filtra a nadie");
  });
});
