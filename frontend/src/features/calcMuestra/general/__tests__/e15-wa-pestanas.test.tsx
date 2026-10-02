/**
 * E15 · W-A — Muestra general y Acreditación con aulas como patrón:
 * P1 Selección en pestañas (general y por actor), P2 Método en pestañas,
 * P3 Marco con su selector de formas en pestaña propia, P4 sin acción global
 * en la cabecera y P5 cabecera + banda compactas.
 */
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { CalcMuestraComponente, CalcMuestraEstudio, CalcMuestraWorkspace } from "../../../../api/calcMuestra";
import { PROSECNUR_MODULES } from "../../../../lib/modules";
import {
  CALC_MUESTRA_ACREDITACION_PESTANAS,
  CALC_MUESTRA_GENERAL_PESTANAS,
} from "../../../../lib/navegacion/catalogos/calcMuestra";
import { parsearDireccion, serializarDireccion } from "../../../../lib/navegacion/direccion";
import { MANIFIESTO_NAVEGACION } from "../../../../lib/navegacion/manifiesto";
import { searchConNivel, seccionesDelModo } from "../../../../lib/navegacion/useDireccion";
import { defaultComponente } from "../../sharedCore";
import type { EstadoMesa } from "../bandaDisenoModelo";
import { cadenaDelN } from "../cadenaDelN";
import { EncabezadoSeccion } from "../EncabezadoSeccion";
import { MesaGeneral } from "../MesaGeneral";
import {
  enlaceSiguiente,
  pestanaPorDefectoActor,
  pestanaPorDefectoMarco,
  resolverPestana,
  searchConSeccionYPestana,
} from "../modeloPestanas";

type Resultado = NonNullable<CalcMuestraComponente["resultado"]>;

const CALC = PROSECNUR_MODULES.find((m) => m.slug === "calc-muestra")!;
const firma = (pestanas: readonly { id: string; label: string }[]) => pestanas.map((p) => `${p.id}:${p.label}`);

describe("navegación v3 · la dimensión «pestaña» en Muestra general y Acreditación", () => {
  it("declara las pestañas de cada sección con su orden y copy", () => {
    expect(firma(CALC_MUESTRA_GENERAL_PESTANAS.marco)).toEqual([
      "marco-forma:Forma del marco",
      "marco-archivo:Archivo del marco",
      "marco-ficha:Ficha del estudio",
    ]);
    expect(firma(CALC_MUESTRA_GENERAL_PESTANAS.metodo)).toEqual([
      "metodo-tecnica:Técnica",
      "metodo-parametros:Parámetros",
      "metodo-memoria:Cálculo del n",
      "metodo-estratos:Estratos",
    ]);
    expect(firma(CALC_MUESTRA_GENERAL_PESTANAS.seleccion)).toEqual([
      "seleccion-sorteo:Selección aleatoria",
      "seleccion-corrida:Resumen",
      "seleccion-unidades:Unidades",
    ]);
    expect(firma(CALC_MUESTRA_ACREDITACION_PESTANAS.seleccion)).toEqual([
      "seleccion-marco:Archivo del marco",
      "seleccion-sorteo:Selección aleatoria",
      "seleccion-corrida:Resumen",
      "seleccion-unidades:Unidades",
    ]);
  });

  it("cada pestaña formula una pregunta y publica la dirección de SU modo", () => {
    for (const [modo, catalogo] of [
      ["marco-disponible", CALC_MUESTRA_GENERAL_PESTANAS],
      ["acreditacion", CALC_MUESTRA_ACREDITACION_PESTANAS],
    ] as const) {
      for (const [seccion, pestanas] of Object.entries(catalogo)) {
        for (const p of pestanas) {
          expect(p.detail).toMatch(/^¿.+\?$/);
          expect(p.to).toBe(`/calc-muestra?modo=${modo}&seccion=${seccion}&pestana=${p.id}`);
          expect(p.direccionPublicada).toBe(true);
        }
      }
    }
  });

  it("el manifiesto adjunta los catálogos sin clonarlos; Resultados, Actores y Contexto no se parten", () => {
    const general = seccionesDelModo(CALC, "marco-disponible");
    expect(general.find((s) => s.id === "marco")?.tabs).toBe(CALC_MUESTRA_GENERAL_PESTANAS.marco);
    expect(general.find((s) => s.id === "metodo")?.tabs).toBe(CALC_MUESTRA_GENERAL_PESTANAS.metodo);
    expect(general.find((s) => s.id === "seleccion")?.tabs).toBe(CALC_MUESTRA_GENERAL_PESTANAS.seleccion);
    expect(general.find((s) => s.id === "resultados")?.tabs).toBeUndefined();
    const acreditacion = seccionesDelModo(CALC, "acreditacion");
    expect(acreditacion.find((s) => s.id === "seleccion")?.tabs).toBe(CALC_MUESTRA_ACREDITACION_PESTANAS.seleccion);
    expect(acreditacion.filter((s) => s.tabs).map((s) => s.id)).toEqual(["seleccion"]);
  });

  it("un enlace directo sobrevive el round-trip y existe como nodo del manifiesto", () => {
    const search = "?modo=marco-disponible&seccion=metodo&pestana=metodo-memoria";
    const direccion = parsearDireccion("/calc-muestra", search);
    expect(direccion).toMatchObject({ modo: "marco-disponible", seccion: "metodo", pestana: "metodo-memoria" });
    expect(serializarDireccion(direccion!)).toBe(`/calc-muestra${search}`);
    const claves = new Set(MANIFIESTO_NAVEGACION.map((n) => n.clave));
    expect(claves.has("calc-muestra/marco-disponible/metodo/metodo-memoria")).toBe(true);
    expect(claves.has("calc-muestra/acreditacion/seleccion/seleccion-unidades")).toBe(true);
  });

  it("elegir pestaña en Acreditación conserva el actor en foco", () => {
    const search = searchConNivel("?modo=acreditacion&seccion=seleccion&foco=cmp-est", "pestana", "seleccion-corrida");
    expect(search).toContain("foco=cmp-est");
    expect(search).toContain("pestana=seleccion-corrida");
  });
});

describe("pestaña activa y por defecto", () => {
  const pestanas = CALC_MUESTRA_GENERAL_PESTANAS.marco;

  it("la dirección manda; un id ajeno cae al defecto y luego a la primera", () => {
    expect(resolverPestana("marco-ficha", pestanas, "marco-archivo")).toBe("marco-ficha");
    expect(resolverPestana("metodo-tecnica", pestanas, "marco-archivo")).toBe("marco-archivo");
    expect(resolverPestana(null, pestanas, "no-existe")).toBe("marco-forma");
  });

  it("P3 · con marco declarado, Marco abre en el archivo; sin él, en la forma", () => {
    expect(pestanaPorDefectoMarco(true)).toBe("marco-archivo");
    expect(pestanaPorDefectoMarco(false)).toBe("marco-forma");
  });

  it("un actor sin archivo abre en su archivo; con él, en el sorteo", () => {
    expect(pestanaPorDefectoActor(false)).toBe("seleccion-marco");
    expect(pestanaPorDefectoActor(true)).toBe("seleccion-sorteo");
  });
});

describe("P4 · la siguiente condición enlaza con la pestaña donde se resuelve", () => {
  const calcular = { tipo: "calcular", etiqueta: "Calcular" } as const;
  const sortear = { tipo: "seccion", seccion: "seleccion", etiqueta: "Ir a Selección" } as const;

  it("Calcular vive en Método › Parámetros (general) y en Actores (acreditación)", () => {
    expect(enlaceSiguiente("marco_disponible", calcular, { seccion: "marco", pestana: "marco-archivo" }))
      .toEqual({ etiqueta: "Calcular en Parámetros", seccion: "metodo", pestana: "metodo-parametros" });
    expect(enlaceSiguiente("acreditacion", calcular, { seccion: "resultados", pestana: null }))
      .toEqual({ etiqueta: "Calcular en Actores", seccion: "actores", pestana: null });
  });

  it("en la pestaña donde se resuelve no se enlaza consigo misma", () => {
    expect(enlaceSiguiente("marco_disponible", calcular, { seccion: "metodo", pestana: "metodo-parametros" })).toBeNull();
    expect(enlaceSiguiente("acreditacion", calcular, { seccion: "actores", pestana: null })).toBeNull();
    expect(enlaceSiguiente("marco_disponible", sortear, { seccion: "seleccion", pestana: "seleccion-sorteo" })).toBeNull();
  });

  it("ya en la sección, nombra la pestaña: «Ir a Selección aleatoria», no «Ir a Selección»", () => {
    expect(enlaceSiguiente("marco_disponible", sortear, { seccion: "seleccion", pestana: "seleccion-corrida" }))
      .toEqual({ etiqueta: "Ir a Selección aleatoria", seccion: "seleccion", pestana: "seleccion-sorteo" });
  });

  it("el href escribe sección y pestaña y conserva el foco", () => {
    const search = searchConSeccionYPestana("?modo=acreditacion&seccion=resultados&foco=cmp-est", "seleccion", "seleccion-sorteo");
    expect(search).toContain("seccion=seleccion");
    expect(search).toContain("pestana=seleccion-sorteo");
    expect(search).toContain("foco=cmp-est");
  });

  it("la cabecera no lleva botones: estado, siguiente condición y a lo sumo un enlace", () => {
    const estado: EstadoMesa = { clave: "sin-calculo", tono: "pendiente", etiqueta: "Falta calcular", siguiente: "Calcula el n.", accion: calcular };
    const cabecera = (pestana: string) => renderToStaticMarkup(
      <MemoryRouter initialEntries={[`/calc-muestra?modo=marco-disponible&seccion=metodo&pestana=${pestana}`]}>
        <EncabezadoSeccion modo="marco_disponible" seccion="metodo" pestana={pestana} estado={estado} />
      </MemoryRouter>,
    );
    const enTecnica = cabecera("metodo-tecnica");
    expect(enTecnica).not.toContain("<button");
    expect(enTecnica).toMatch(/<a [^>]*href="\/calc-muestra\?modo=marco-disponible&amp;seccion=metodo&amp;pestana=metodo-parametros"[^>]*>Calcular en Parámetros/);
    const enParametros = cabecera("metodo-parametros");
    expect(enParametros).not.toContain("<a ");
    expect(enParametros).toContain("Falta calcular");
  });
});

describe("P1–P3 · la mesa pinta el rail de aulas y un tabpanel por pestaña", () => {
  const workspace = {
    notas_diseno: "", fuente_marco: "", marco_disponible: "", unidad_observacion: "", unidad_muestreo: "",
    variables_control: [], escenarios: [],
  } as unknown as CalcMuestraWorkspace;
  const calculado: CalcMuestraComponente = {
    ...defaultComponente({ id: "c1", actor: "Usuarios" }),
    tecnica: "prob_aleatorio_simple",
    marco: { ...defaultComponente().marco, marco_validado: 5000 },
    resultado: { n_objetivo: 357, n_operativo: 476, tasa_respuesta_esperada: 0.75 } as unknown as Resultado,
  };
  const estudio = {
    titulo: "Estudio", modo_trabajo: "estimacion_preliminar",
    contexto: { cliente: "", tipo_cliente: "", descripcion_libre: "" },
    componentes: [calculado],
  } as unknown as CalcMuestraEstudio;
  const noop = () => {};

  function mesa(search: string, seccion: string) {
    return renderToStaticMarkup(
      <MemoryRouter initialEntries={[`/calc-muestra?modo=marco-disponible&seccion=${seccion}${search}`]}>
        <MesaGeneral
          estudio={estudio} workspace={workspace} activeSection={seccion}
          onTitulo={noop} onContexto={noop} onPatchEstudio={noop} onWorkspace={noop} onComponente={noop}
          onReplaceComponente={noop} onEnsureKind={noop} onCalcular={noop} onMonitoreo={noop}
          calculando={false} reporteListo={false} reporte={{ resultados: 0, enCurso: false, disponible: false, verUrl: null, onGenerar: noop }} onCambiarTipo={noop}
        />
      </MemoryRouter>,
    );
  }
  const cabeceraDe = (html: string) => html.slice(0, html.indexOf('class="cmv2-university-workbench"'));

  it("el enlace directo aterriza donde dice, con tab seleccionado y tabpanel nombrado por él", () => {
    const html = mesa("&pestana=metodo-memoria", "metodo");
    expect(html).toContain('role="tablist"');
    expect(html).toMatch(/id="cmg-tab-metodo-metodo-memoria"[^>]*role="tab"[^>]*aria-selected="true"[^>]*aria-controls="cmg-panel-metodo"/);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html).toMatch(/id="cmg-panel-metodo" class="cmg-pestana-panel" role="tabpanel" aria-labelledby="cmg-tab-metodo-metodo-memoria" data-pestana="metodo-memoria" data-audit-ready="(true|false)"/);
    // El grupo medido envuelve sólo el cuerpo: la cabecera de la pestaña queda fuera (como en aulas).
    expect(html).toMatch(/class="cmg-pestana-cuerpo" data-qa-geometry-group="calc-muestra\/general-pestana-metodo-memoria" data-qa-geometry-contract="intrinsic"/);
    // La pestaña formula su pregunta, con la cabecera de aulas.
    expect(html).toContain('<h2 id="cmv2-active-local-title">Cálculo del n</h2>');
    expect(html).toContain("¿qué fórmula lleva del N de la población al n y a la muestra a contactar?");
    // P2 · cadena del marco al n a campo (patrón 5) y memoria (patrón 6).
    expect(html).toContain("Del marco a la muestra a contactar");
    expect(html).toContain('class="cmv2-uni-flujo"');
    // Lo de otras pestañas no se pinta.
    expect(html).not.toContain('id="cmg-tecnica-titulo"');
  });

  it("P4 · Calcular vive en Parámetros, no en la cabecera", () => {
    const tecnica = mesa("", "metodo");
    expect(tecnica).toMatch(/aria-labelledby="cmg-tab-metodo-metodo-tecnica"/);
    expect(cabeceraDe(tecnica)).not.toContain("<button");
    expect(tecnica).not.toContain("cmg-accion-calcular");
    const parametros = mesa("&pestana=metodo-parametros", "metodo");
    expect(cabeceraDe(parametros)).not.toContain("<button");
    expect(parametros).toMatch(/class="cmv2-inline-actions cmg-accion-calcular"[^>]*><button type="button" class="cmv2-primary"[^>]*>.*Recalcular<\/button>/);
  });

  it("P3 · el selector de formas vive en su pestaña; la ficha, en la suya", () => {
    const forma = mesa("&pestana=marco-forma", "marco");
    expect(forma).toContain('id="cmg-forma-marco-titulo"');
    expect(forma).not.toContain("cmg-archivo");
    const ficha = mesa("&pestana=marco-ficha", "marco");
    expect(ficha).not.toContain('id="cmg-forma-marco-titulo"');
    expect(ficha).toContain('data-qa-geometry-group="calc-muestra/general-ficha-estudio"');
  });

  it("P1 · Selección parte en Selección aleatoria · Resumen · Unidades", () => {
    const html = mesa("&pestana=seleccion-unidades", "seleccion");
    expect(html).toMatch(/aria-labelledby="cmg-tab-seleccion-seleccion-unidades"/);
    for (const id of ["seleccion-sorteo", "seleccion-corrida", "seleccion-unidades"]) {
      expect(html).toContain(`id="cmg-tab-seleccion-${id}"`);
    }
  });

  it("Resultados no se parte: sin rail ni tabpanel", () => {
    const html = mesa("", "resultados");
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('role="tabpanel"');
  });

  it("la cabecera es la misma en todas las pestañas de una sección (P5)", () => {
    const cabeceras = CALC_MUESTRA_GENERAL_PESTANAS.metodo
      .filter((p) => p.id !== "metodo-parametros")
      .map((p) => cabeceraDe(mesa(`&pestana=${p.id}`, "metodo")).replace(/pestana=[a-z-]+/g, ""));
    expect(new Set(cabeceras).size).toBe(1);
  });
});

describe("cadena del n", () => {
  it("sólo publica lo que el motor devolvió", () => {
    const comp = { resultado: { n_objetivo: 357, n_operativo: 476, tasa_respuesta_esperada: 0.75 }, parametros: {} } as unknown as CalcMuestraComponente;
    expect(cadenaDelN(comp, 5000).map((e) => [e.label, e.valor, e.estado])).toEqual([
      ["Tamaño del marco (N)", "5,000", "ready"],
      ["Casos completos", "357", "ready"],
      ["Muestra a contactar", "476", "ready"],
    ]);
    const sinCalculo = cadenaDelN({ resultado: null, parametros: {} } as unknown as CalcMuestraComponente, 0);
    expect(sinCalculo.every((e) => e.valor === "—" && e.estado === "pending")).toBe(true);
  });
});

describe("CSS · P5 compacta y rail a la vista", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "mesa.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const regla = (selector: string) => {
    const i = css.indexOf(`${selector} {`);
    return i < 0 ? "" : css.slice(i, css.indexOf("}", i));
  };

  it("cabecera de una línea y banda sin fila propia para su rótulo", () => {
    expect(regla(".cmg-cabecera")).toContain("padding: 6px");
    expect(regla(".cmg-encabezado-texto")).toContain("align-items: baseline");
    expect(regla(".cmg-encabezado-linea")).toContain("white-space: nowrap");
    expect(regla(".cmg-banda-head")).toContain("position: absolute");
    expect(regla(".cmg-banda-cadena")).toContain("clip-path: inset(50%)");
    expect(regla(".cmg-banda-cifras .cmv2-uni-cifra-fila")).toContain("grid-auto-flow: column");
  });

  it("el rail se queda a la vista sin crear un segundo dueño de scroll", () => {
    expect(regla(".cmg-mesa .cmv2-university-workbench")).toContain("overflow: clip");
    expect(regla(".cmg-pestanas > .cmg-pestanas-rail")).toContain("position: sticky");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
