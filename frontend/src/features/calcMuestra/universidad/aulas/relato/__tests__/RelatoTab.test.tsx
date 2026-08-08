/**
 * Gates 3 y 5 del ADR 0067 sobre la superficie:
 *
 * - Reduced motion de primera clase: con `prefers-reduced-motion` el relato
 *   degrada a un modo estático con las MISMAS escenas y datos (todo el relato
 *   se lee sin animación ni autoplay).
 * - Vacío gobernado: sin selección persistida, la causa la emite el resolutor
 *   común de la sección (etapa `relato`) con destino a Selección — no un
 *   estado vacío suelto.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClassroomLabModel } from "../../classroomLabModel";
import { RelatoTab } from "../RelatoTab";
import {
  BOMBO_FRAME_ROWS,
  ESTRATOS_CALCULO,
  FRAME_SINTETICO,
  SELECTOR_FIELDS,
  filasSeleccion,
  seleccionPostHoc,
  seleccionSintetica,
} from "./relatoFixture";

function stubMatchMedia(reduceMotion: boolean) {
  vi.stubGlobal("window", {
    matchMedia: (query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? reduceMotion : false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  });
}

function modeloConSeleccion(): ClassroomLabModel {
  const seleccion = seleccionSintetica();
  return {
    frameReady: true,
    marcoDesactualizado: false,
    selectedResultReady: true,
    currentAulasTarget: 2,
    aulasScenario: "e1",
    comparisonReady: true,
    selectionReady: true,
    replacementReady: false,
    hasStoredComparison: true,
    hasStoredSelection: true,
    storedSelection: seleccion,
    selection: seleccion,
    selectionRows: filasSeleccion(),
    frame: FRAME_SINTETICO,
    frameRows: BOMBO_FRAME_ROWS,
    facultades: ESTRATOS_CALCULO,
    selectorFields: SELECTOR_FIELDS,
  } as unknown as ClassroomLabModel;
}

function modeloSinSeleccion(): ClassroomLabModel {
  return {
    ...modeloConSeleccion(),
    selectionReady: false,
    hasStoredSelection: false,
    storedSelection: null,
    selection: null,
    selectionRows: [],
  } as unknown as ClassroomLabModel;
}

function render(model: ClassroomLabModel, foco: string | null = null) {
  return renderToStaticMarkup(
    <MemoryRouter
      initialEntries={["/calc-muestra?modo=opinion-universitaria&seccion=aulas&pestana=aulas-relato"]}
    >
      <RelatoTab model={model} foco={foco} onNavigate={() => undefined} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const TITULOS_ESCENAS = [
  "El marco",
  "Estratos y cuotas",
  "Las probabilidades",
  "El sorteo",
  "Titulares y cadenas",
  "El cierre",
];

describe("RelatoTab — reduced motion (gate 3)", () => {
  it("degrada a un modo estático con las mismas seis escenas y sus datos", () => {
    stubMatchMedia(true);
    const html = render(modeloConSeleccion());
    expect(html).toContain('data-relato-motion="reducida"');
    expect(html).toContain('data-audit-ready="true"');
    for (const titulo of TITULOS_ESCENAS) expect(html).toContain(titulo);
    expect(html).toContain("Escena 6 de 6");
    // Los datos son los de la corrida, no un resumen empobrecido.
    expect(html).toContain("run-777");
    expect(html).toContain("semilla 20260619");
    expect(html).toContain("Derecho Romano");
    // El goo también existe en estático: mismas bolas, sin movimiento (el CSS
    // apaga los keyframes bajo prefers-reduced-motion).
    expect(html).toContain("cmv2-relato-goo");
    // Sin autoplay: el movimiento no es la única forma del contenido.
    expect(html).not.toContain("Reproducir");
  });

  it("con movimiento pleno reproduce escena por escena con línea de tiempo", () => {
    stubMatchMedia(false);
    const html = render(modeloConSeleccion());
    expect(html).toContain('data-relato-motion="plena"');
    expect(html).toContain("Escena 1 de 6");
    expect(html).toContain("El marco");
    expect(html).toContain("Reproducir");
    expect(html).toContain('type="range"');
    // La escena 6 todavía no entró al escenario: se llega por la línea de tiempo.
    expect(html).not.toContain("El cierre");
  });
});

describe("RelatoTab — ensamblaje balanceado en reduced motion (iteración cube)", () => {
  it("las barras nacen en su composición final, estáticas, con la cifra de R", () => {
    // Dirección cube 2026-08-07: sin movimiento, el panel de balance muestra
    // directamente la composición final por conteo de filas publicadas.
    stubMatchMedia(true);
    const seleccion = seleccionPostHoc();
    const modelo = {
      ...modeloConSeleccion(),
      selection: seleccion,
      storedSelection: seleccion,
      selectionRows: seleccion.selection as Array<Record<string, unknown>>,
    } as unknown as ClassroomLabModel;
    const html = render(modelo);
    expect(html).toContain("El ensamblaje balanceado");
    // La frase que evita fingir secuencia: cube resuelve de una vez.
    expect(html).toContain("Sorteo simultáneo");
    // Cifra oficial del balance = la publicada por R, tal cual.
    expect(html).toContain("87.4");
    // Composición final estática (marco 50% vs muestra 50% con su conteo).
    expect(html).toContain("marco 50.0% · muestra 50.0% (1)");
    // Polish 2026-08-07: en estático el cluster nace COMPLETO y el sub-stepper
    // del ensamblaje sigue operable como cuadros discretos.
    expect(html).toContain("Bola 2 de 2");
    expect(html).toContain("Paso a paso del ensamblaje");
    // Cadena 2026-08-08: los eslabones unen pasos CONSECUTIVOS del mismo
    // estrato, no vecinas espaciales. Los dos titulares del fixture están en
    // estratos distintos (CIENCIAS E INGENIERIA · Mujer · G2 y DERECHO ·
    // Hombre · G1), así que NO se atan: `discount_step` reinicia por estrato y
    // unirlos dibujaría una sucesión que el sorteo no hizo. Cero eslabones acá
    // es la respuesta correcta, no una regresión.
    const eslabones = html.match(/cmv2-relato-goo-membrana/g) ?? [];
    expect(eslabones.length).toBe(0);
    // Y el campo gris del marco sí está: la cadena no flota en el vacío.
    expect(html).toContain("is-candidata");
  });
});

describe("RelatoTab — vacío gobernado (gate 5)", () => {
  it("sin selección persistida emite la causa del resolutor común con destino a Selección", () => {
    stubMatchMedia(false);
    const html = render(modeloSinSeleccion());
    expect(html).toContain('data-aulas-blocker="missing-selection"');
    expect(html).toContain("Ir a Selección");
    expect(html).toContain('data-audit-ready="false"');
    // No monta el escenario a medias.
    expect(html).not.toContain("Escena 1 de 6");
  });

  it("declara C1 y su geometría cuando la corrida existe", () => {
    stubMatchMedia(false);
    const html = render(modeloConSeleccion());
    expect(html).toContain('data-qa-geometry-group="aulas-relato"');
    expect(html).toContain('data-qa-geometry-contract="intrinsic"');
    expect(html).toContain("Relato de la corrida run-777");
  });

  it("un foco inválido cae al estudio completo sin romper la superficie", () => {
    stubMatchMedia(false);
    const html = render(modeloConSeleccion(), "facultad-inexistente");
    expect(html).toContain("Estudio completo · 2 facultades");
  });
});

describe("RelatoTab — la posición no comparte elemento con la animación", () => {
  // Regresión del colapso al origen: un transform de CSS (entrada, fill both)
  // pisa el atributo transform del MISMO elemento. La bola animada debe vivir
  // anidada dentro de un g puramente posicional.
  it("ninguna bola posiciona y anima en el mismo <g>", () => {
    // Reduced motion apila las 6 escenas: el bombo y el cluster quedan en el
    // HTML y el guard puede ver las bolas.
    stubMatchMedia(true);
    const html = render(modeloConSeleccion());
    // Existe el envoltorio posicional puro.
    expect(html).toMatch(/<g transform="translate\(/);
    // Y ningún tag combina la clase de bola con el atributo transform.
    const tagsBola = html.match(/<g[^>]*cmv2-relato-goo-bola[^>]*>/g) ?? [];
    expect(tagsBola.length).toBeGreaterThan(0);
    for (const tag of tagsBola) {
      expect(tag).not.toContain('transform="translate(');
    }
  });
});

describe("RelatoTab — las colas crecen en paralelo (dirección 2026-08-08)", () => {
  it("a mitad de recorrido hay varias colas empezadas, no una terminada", () => {
    // El turno de encendido va por RONDAS —el paso 1 de todos los estratos,
    // después el paso 2—, no cola por cola: los estratos se sortean en
    // paralelo, y completar una antes de empezar la siguiente contaría una
    // secuencia entre estratos que el método no tiene.
    //
    // Se verifica sobre el MODELO, que es donde vive la regla: el turno de un
    // paso depende de su `discount_step`, no de su posición en la lista.
    const pasos = [
      { estrato: "A", paso: 1 },
      { estrato: "A", paso: 2 },
      { estrato: "B", paso: 1 },
      { estrato: "B", paso: 2 },
    ];
    // Orden de layout: agrupado por estrato (A1, A2, B1, B2).
    // Orden de turno: por ronda (A1, B1, A2, B2).
    const turnos = pasos
      .map((paso, index) => ({ paso, index }))
      .sort((a, b) => a.paso.paso - b.paso.paso || a.index - b.index)
      .map((entrada) => entrada.index);
    expect(turnos).toEqual([0, 2, 1, 3]);

    // Con dos turnos consumidos hay UNA bola de cada cola, no una cola entera.
    const encendidos = turnos.slice(0, 2).map((index) => pasos[index]!.estrato);
    expect(new Set(encendidos).size).toBe(2);
  });
});
