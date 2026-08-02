import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * ADR 0057 · Las reglas de Gonzalo, como pruebas.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 *
 * Las mismas correcciones se repitieron varias veces en este módulo. La causa no
 * fue que las reglas estuvieran mal escritas —estaban en el ADR y en el doc del
 * loop—, sino que **nada las hacía cumplir**: los tests de cada iteración
 * confirmaban lo que se acababa de construir, no lo que estaba prohibido. Así,
 * montar la radiografía en la ruta de estudiante —contra una regla explícita—
 * dejó el gate entero en verde.
 *
 * Este archivo invierte eso: vigila las reglas por sí mismas, sobre el código
 * fuente, con independencia de qué componente se toque. Una regla sin guard es
 * una regla que se va a romper otra vez.
 *
 * Si una regla cambia, se cambia **aquí y en el ADR**, nunca sólo en el código.
 */

const raiz = new URL("../", import.meta.url);

/**
 * Lee el fuente **sin comentarios**.
 *
 * La primera versión de este guard falló contra los comentarios que explican por
 * qué se retiró «Procedencia y contrato». Un guard que se dispara con su propia
 * documentación empuja a borrar la explicación para pasar en verde, que es peor
 * que el defecto: las reglas se vigilan sobre lo que se renderiza, y las razones
 * se conservan escritas.
 */
const leer = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, raiz)), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("ADR 0057 · regla 4 — la radiografía es de curso-horario, no de estudiante", () => {
  // «No es necesaria la radiografía [en criterios de estudiante]: la radiografía
  // es la descripción de alumnos elegibles por alguna característica de
  // curso-horario, tomando en cuenta los criterios anteriores.»
  it("los controles de criterio de estudiante no montan evidencia radiográfica", () => {
    const controles = leer("criterios/controles.tsx");
    expect(controles).not.toContain("CategoriaEvidencia");
    expect(controles).not.toContain("dominioCategorias");
    expect(controles).not.toContain("EjeCategorias");
  });

  it("la evidencia por categoría sí vive en la ruta de curso-horario", () => {
    // La contraparte de la regla: prohibirla arriba no puede dejarla sin casa.
    expect(leer("criterios/FacultadCategoriaToggles.tsx")).toContain("CategoriaEvidencia");
  });
});

describe("ADR 0057 · regla 1 — no hay sección de criterios transversales", () => {
  // «Sigues poniendo criterios generales cuando ya quedamos en que todos los
  // criterios son por facultad.» Su VALOR puede seguir siendo común —el
  // contrato no admite umbral por facultad—, pero su SITIO es el embudo de la
  // facultad, no una sección aparte que los presenta como generales.
  it("la pestaña de curso-horario no rotula un bloque «transversal»", () => {
    const tab = leer("marco/CursosHorarioMarcoTab.tsx");
    expect(tab).not.toContain("Ajustes del marco");
    expect(tab).not.toContain("Transversales a todas las facultades");
  });

  it("los criterios comunes se montan como piezas del flujo de la facultad", () => {
    const tab = leer("marco/CursosHorarioMarcoTab.tsx");
    expect(tab).toContain("slotApertura");
    expect(tab).toContain("slotCierre");
  });
});

describe("ADR 0057 · regla 2 — la matriz pertenece al Panorama", () => {
  it("la matriz se declara antes que los bloques de facultad", () => {
    const tab = leer("marco/CursosHorarioMarcoTab.tsx");
    const matriz = tab.indexOf("cmv2-chfp-matriz-title");
    const bloques = tab.indexOf("cmv2-chfp-bloques");
    expect(matriz).toBeGreaterThan(-1);
    expect(bloques).toBeGreaterThan(-1);
    expect(matriz).toBeLessThan(bloques);
  });
});

describe("ADR 0057 · regla 3 — los boxplots comparten eje y lo muestran", () => {
  it("la caja no se dibuja sin un dominio del criterio", () => {
    const evidencia = leer("criterios/CategoriaEvidencia.tsx");
    // El dominio es un parámetro obligatorio del cálculo de posiciones: sin él
    // no hay forma de pintar una caja normalizada contra su propio rango, que
    // es el defecto que la regla 3 prohíbe.
    expect(evidencia).toContain("function pct(valor: number, dominio: DominioCategorias)");
    expect(evidencia).toContain("export function EjeCategorias");
  });
});

describe("ADR 0057 · lenguaje y transparencia", () => {
  const superficies = [
    "marco/CursosHorarioMarcoTab.tsx",
    "marco/CriteriosRadiografiaCardDetalle.tsx",
    "criterios/CriterioCard.tsx",
    "criterios/controles.tsx",
    "criterios/FacultadCategoriaToggles.tsx",
  ];

  it("ninguna superficie de criterios esconde contenido tras un plegado", () => {
    // «Si algo está oculto es un error de diseño.»
    for (const archivo of superficies) {
      expect(leer(archivo), archivo).not.toContain("<details");
    }
  });

  it("no se muestra el contrato interno del motor al usuario", () => {
    for (const archivo of superficies) {
      const fuente = leer(archivo);
      expect(fuente, archivo).not.toContain("Procedencia y contrato");
      expect(fuente, archivo).not.toContain("trazabilidad completa");
    }
  });
});
