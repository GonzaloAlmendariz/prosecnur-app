import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PantallaDeCarga } from "../PantallaDeCarga";
import { SIN_ESTIMACION } from "../warmupTiempo";
import { ESCENAS_CARGA, type ClaveEscenas } from "./escenasCarga";
import { CICLO_MS, PAUSA_MS, TRAMO_MS } from "./escenasMotor";
import { SegmentosRecorrido, tramoRecorrido } from "./RecorridoCarga";

const CLAVES: ClaveEscenas[] = ["calc", "form", "rutas", "material", "monitoreo", "proc", "dash"];

describe("escenas de la pantalla de carga", () => {
  it("cada módulo tiene cinco escenas y una sola marca", () => {
    for (const clave of CLAVES) {
      expect(ESCENAS_CARGA[clave]).toHaveLength(5);
      expect(ESCENAS_CARGA[clave].filter((e) => e.marca)).toHaveLength(1);
    }
  });

  it("cada escena dibuja un SVG sin valores rotos ni colores fijos (sólo tokens)", () => {
    for (const clave of CLAVES) {
      for (const escena of ESCENAS_CARGA[clave]) {
        const svg = escena.svg();
        expect(svg, `${clave}/${escena.id}`).not.toMatch(/NaN|undefined|Infinity/);
        expect(svg.replace(/url\(#[\w-]+\)/g, ""), `${clave}/${escena.id}`).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
      }
    }
  });

  it("los nombres son directos: sin suponer la plataforma ni parafrasear la acción", () => {
    const textos = CLAVES.flatMap((c) => ESCENAS_CARGA[c].flatMap((e) => [e.titulo, e.accion]));
    for (const t of textos) {
      expect(t).not.toMatch(/Kobo|Qué |Cada |que se |se cruza|De lo crudo/);
    }
  });
});

describe("colores de las escenas", () => {
  // 10 nov 2026: «s-sweep» no tenía regla y el barrido de Formularios salía como una barra negra (un SVG sin fill
  // se pinta negro). Toda clase s-* que dibuja una escena tiene que tener su regla en recorrido-carga.css.
  it("toda clase s-* que usa una escena tiene regla en recorrido-carga.css", () => {
    const aqui = path.dirname(fileURLToPath(import.meta.url));
    const css = fs.readFileSync(path.join(aqui, "recorrido-carga.css"), "utf8");
    const definidas = new Set([...css.matchAll(/\.(s-[a-z0-9-]+)/g)].map((m) => m[1]));
    const usadas = new Set<string>();
    for (const clave of CLAVES) for (const escena of ESCENAS_CARGA[clave]) {
      for (const m of escena.svg().matchAll(/class="([^"]+)"/g)) for (const c of m[1].split(/\s+/)) if (c.startsWith("s-")) usadas.add(c);
    }
    expect(usadas.size).toBeGreaterThan(20);
    expect([...usadas].filter((c) => !definidas.has(c))).toEqual([]);
  });
});

describe("tramos del recorrido", () => {
  it("cada módulo dura una sola pasada de su escena y el recorrido da otra vuelta si la carga sigue", () => {
    expect(TRAMO_MS).toBe(CICLO_MS + PAUSA_MS);
    expect(tramoRecorrido(0).indice).toBe(0);
    expect(tramoRecorrido(TRAMO_MS - 1).indice).toBe(0);
    expect(tramoRecorrido(TRAMO_MS + 1).indice).toBe(1);
    expect(tramoRecorrido(TRAMO_MS * 7 + 1)).toMatchObject({ indice: 0, vuelta: 1 });
  });

  it("la barra marca el módulo actual y los ya vistos", () => {
    const html = renderToStaticMarkup(<SegmentosRecorrido transcurridoMs={TRAMO_MS * 2 + 100} />);
    expect(html.match(/class="is-visto"/g)).toHaveLength(2);
    expect(html.match(/class="is-actual"/g)).toHaveLength(1);
  });
});

describe("PantallaDeCarga en disposición recorrido", () => {
  it("pone la lámina en su columna con la barra debajo y deja el fondo sin velo", () => {
    const html = renderToStaticMarkup(
      <PantallaDeCarga
        alto="ventana"
        disposicion="recorrido"
        ceja="Abriendo el proyecto"
        titulo="Preparando los datos"
        transcurridoMs={0}
        estimacion={SIN_ESTIMACION}
        fondo={<div data-prueba="fondo" />}
        bajoLamina={<div data-prueba="barra" />}
      />,
    );
    expect(html).toContain('class="pulso-carga is-ventana is-recorrido"');
    expect(html).toMatch(/class="pulso-carga-columna"><div class="pulso-carga-lamina">[\s\S]*data-prueba="barra"/);
    expect(html).toContain('data-prueba="fondo"');
  });
});
