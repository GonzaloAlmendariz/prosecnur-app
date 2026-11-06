import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PantallaDeCarga } from "../PantallaDeCarga";
import { SIN_ESTIMACION, normalizarEstimacionWarmup } from "../warmupTiempo";
import { ESCENAS_CARGA, type ClaveEscenas } from "./escenasCarga";
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

describe("tramos del recorrido", () => {
  it("con apertura anterior, cada módulo dura la séptima parte (entre 3 y 9 s)", () => {
    const est = normalizarEstimacionWarmup({ ultima_apertura: { elapsed_ms: 28_000 } });
    expect(tramoRecorrido(0, est).indice).toBe(0);
    expect(tramoRecorrido(4_100, est).indice).toBe(1);
    expect(tramoRecorrido(28_100, est)).toMatchObject({ indice: 0, vuelta: 1 });
    const larga = normalizarEstimacionWarmup({ ultima_apertura: { elapsed_ms: 600_000 } });
    expect(tramoRecorrido(8_900, larga).indice).toBe(0);
    expect(tramoRecorrido(9_100, larga).indice).toBe(1);
  });

  it("sin apertura anterior, 4 s por módulo", () => {
    expect(tramoRecorrido(3_900, SIN_ESTIMACION).indice).toBe(0);
    expect(tramoRecorrido(4_100, SIN_ESTIMACION).indice).toBe(1);
  });

  it("la barra marca el módulo actual y los ya vistos", () => {
    const html = renderToStaticMarkup(<SegmentosRecorrido transcurridoMs={9_000} estimacion={SIN_ESTIMACION} />);
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
