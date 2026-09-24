/**
 * E11 · W2 — paridad estética y de accesibilidad de Muestra general y
 * Acreditación con aulas (docs/qa/checklist-calc-muestra-paridad-visual-2026-09-24.md).
 *
 * Sujeta lo que cierra W2: tablas con la gramática de aulas (V9), un solo
 * formato es-PE (V10), todo input con nombre (V11), sin paneles huérfanos (V3),
 * avisos con AvisoModulo (V4), botones deshabilitados que dicen por qué (V7),
 * encabezados sin saltos (V12), readiness (V13), foco y movimiento (V14),
 * técnicas que no se parten (V15), docentes con MAS (V16) y contraste (V17).
 */
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { CalcMuestraComponente } from "../../../../api/calcMuestra";
import {
  normalizeCalcMuestraCatalogoParametros,
  type CalcMuestraCatalogoParametros,
  type CalcMuestraGeneralMarco,
} from "../../../../api/calcMuestraGeneral";
import { defaultComponente, fmtInt } from "../../sharedCore";
import { NumberCell } from "../../universidad/aulas";
import { ActoresAcreditacion } from "../ActoresAcreditacion";
import { EstratosGeneralVista } from "../EstratosGeneral";
import { MetodoGeneralVista, metodoListo } from "../MetodoGeneral";
import {
  ARCHIVO_MARCO_INICIAL,
  campoMetaDelActor,
  formatearEntero,
  formatearPeso,
  motivoNoDeclarar,
  motivoNoSortear,
} from "../modelo";
import { ParametrosTecnicaVista } from "../ParametrosTecnica";
import { SeleccionActoresVista } from "../SeleccionActores";
import { SeleccionGeneralVista } from "../SeleccionGeneral";
import { TablaUnidades } from "../TablaUnidades";

const CATALOGO = normalizeCalcMuestraCatalogoParametros({
  ok: true,
  tecnicas: [
    {
      tecnica: "prob_aleatorio_simple",
      parametros: [
        { clave: "e", rotulo: "Margen de error", ayuda: "Como proporción: 0,05 = ±5 puntos." },
        { clave: "asignacion", rotulo: "Asignación entre estratos", ayuda: "", tipo: "opciones", opciones: ["proporcional", "neyman"] },
      ],
    },
  ],
}) as CalcMuestraCatalogoParametros;

const MARCO: CalcMuestraGeneralMarco = {
  file_id: "f1",
  hoja: "padron",
  columnas: { id: "dni", estrato: "", tamano: "" },
  marco_hash: "abcdef0123456789",
  N: 26954,
  estratos: [],
  declarado_at: "2026-09-24T06:00:00Z",
};

function comp(patch: Partial<CalcMuestraComponente> = {}): CalcMuestraComponente {
  return { ...defaultComponente({ id: "c1", actor: "Usuarios" }), ...patch };
}

/** Docentes con N grande: el cuadro los manda a MAS a ±5 % y 60 % de respuesta (ADR 0091). */
function docentesMas(): CalcMuestraComponente {
  const base = comp({ id: "cmp-doc", actor: "Docentes", actor_categoria: "docentes", canal_recojo: "online_email", tecnica: "prob_aleatorio_simple" });
  return {
    ...base,
    marco: { ...base.marco, marco_validado: 1000 },
    parametros: { ...base.parametros, e: 0.05, tasa_respuesta: 0.6, oversample_pct: 0 },
  };
}

function conRouter(node: JSX.Element, url = "/calc-muestra?modo=acreditacion&seccion=actores") {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[url]}>{node}</MemoryRouter>);
}

/** Los niveles de encabezado en orden de documento. */
function niveles(html: string): number[] {
  return [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
}

/** Bajo el h2 de la sección, ningún encabezado salta un nivel. */
function sinSaltos(html: string, desde = 2): boolean {
  let previo = desde;
  for (const n of niveles(html)) {
    if (n > previo + 1) return false;
    previo = n;
  }
  return true;
}

describe("V11 · NumberCell con nombre accesible", () => {
  it("aplica ariaLabel al input y sin él no inventa uno (aulas no cambia)", () => {
    const con = renderToStaticMarkup(<NumberCell value={3} ariaLabel="Marco (N) de Docentes" onChange={() => {}} />);
    expect(con).toContain('aria-label="Marco (N) de Docentes"');
    const sin = renderToStaticMarkup(<NumberCell value={3} title="N_h" onChange={() => {}} />);
    expect(sin).not.toContain("aria-label");
    expect(sin).toContain('title="N_h"');
  });
});

describe("Acreditación › Actores", () => {
  const tabla = (componentes: CalcMuestraComponente[]) => conRouter(<ActoresAcreditacion componentes={componentes} onComponente={() => {}} />);

  it("V16 · docentes con MAS muestran la respuesta esperada y el margen, no «sobremuestra 0 %»", () => {
    const html = tabla([docentesMas()]);
    expect(html).toContain('aria-label="Respuesta esperada de Docentes"');
    expect(html).toContain('value="60"');
    expect(html).toContain("Respuesta esperada · margen ±5.0%");
    expect(html).not.toContain("Sobremuestra");
    expect(html).not.toContain("0.0%");
  });

  it("V11 · Marco (N) y la cuota llevan nombre y rótulo real; nada de «Cuota sin fijar.»", () => {
    const cuotas = { ...docentesMas(), tecnica: "no_prob_cuotas" as const };
    const html = tabla([cuotas]);
    expect(html).toContain('aria-label="Marco (N) de Docentes"');
    expect(html).toContain('aria-label="Cuota de Docentes"');
    expect(html).not.toContain("Cuota sin fijar.");
    // Cada input de la tabla tiene nombre propio.
    const inputs = html.match(/<input[^>]*>/g) ?? [];
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) expect(input).toMatch(/aria-label="[^"]+"/);
  });

  it("V9 · caption, cabeceras con scope, actor como rótulo de fila y numéricas a la derecha", () => {
    const html = tabla([docentesMas()]);
    expect(html).toMatch(/<caption class="cmg-sr-only">/);
    expect(html).toContain('<th scope="col" class="cmg-num">Marco (N)</th>');
    expect(html).toContain('<th scope="row">');
    expect(html).not.toMatch(/<th>(?!<)/);
  });

  it("V13 · readiness declarada y V12 · el título es un h3 bajo el h2 de la sección", () => {
    const html = tabla([docentesMas()]);
    expect(html).toContain('data-audit-ready="true"');
    expect(html).toContain('<h3 class="cmg-panel-titulo" id="cmg-actores-marco-titulo">');
    expect(sinSaltos(html)).toBe(true);
  });

  it("V15 · el resultado y la técnica tienen su clase de no partir", () => {
    const html = tabla([comp({ actor: "Docentes", actor_categoria: "docentes" })]);
    expect(html).toMatch(/<td class="cmg-actor-resultado"><strong>Por calcular<\/strong><\/td>/);
    const css = fs.readFileSync(path.join(__dirname, "..", "general.css"), "utf8");
    expect(css).toMatch(/\.cmg-tabla-actores \.cmg-actor-tecnica,\s*\.cmg-tabla-actores \.cmg-actor-resultado \{\s*white-space: nowrap;/);
  });
});

describe("campoMetaDelActor", () => {
  it("elige el campo según la técnica", () => {
    expect(campoMetaDelActor(docentesMas())).toMatchObject({ tipo: "respuesta", clave: "tasa_respuesta" });
    expect(campoMetaDelActor({ ...docentesMas(), tecnica: "prob_estratificado" }).tipo).toBe("respuesta");
    expect(campoMetaDelActor({ ...docentesMas(), tecnica: "prob_conglomerado_multietapico" })).toMatchObject({ tipo: "sobremuestra", clave: "oversample_pct" });
    expect(campoMetaDelActor({ ...docentesMas(), tecnica: "no_prob_cuotas" }).tipo).toBe("cuota");
    expect(campoMetaDelActor({ ...docentesMas(), tecnica: "no_prob_conveniencia" })).toMatchObject({ tipo: "cobertura", detalle: expect.stringContaining("Piso") });
    expect(campoMetaDelActor({ ...docentesMas(), tecnica: "intencion_censal" })).toMatchObject({ tipo: "cobertura", clave: "cobertura_objetivo" });
  });

  it("una sobremuestra real se sigue diciendo; una en cero, no", () => {
    const con = campoMetaDelActor({ ...docentesMas(), parametros: { ...docentesMas().parametros, oversample_pct: 0.1 } });
    expect(con.tipo === "respuesta" && con.detalle).toContain("sobremuestra 10.0%");
    const sin = campoMetaDelActor(docentesMas());
    expect(sin.tipo === "respuesta" && sin.detalle).not.toContain("sobremuestra");
  });
});

describe("V10 · un solo formato es-PE", () => {
  it("formatearEntero es alias de fmtInt y el peso usa la misma convención", () => {
    for (const n of [0, 7, 5000, 26954, 1234567.4, null, undefined, Number.NaN]) {
      expect(formatearEntero(n)).toBe(fmtInt(n));
    }
    // Separador de miles y decimal según el runtime: se compara la cifra.
    expect(formatearPeso(26954.18).replace(/[.,]/g, "|")).toBe("26|954|18");
    expect(formatearPeso(null)).toBe("—");
  });
});

describe("V3 · Método es una región, no un tabpanel huérfano", () => {
  const metodo = (catalogo: Parameters<typeof metodoListo>[0], marcoLeido = true) => conRouter(
    <MetodoGeneralVista
      comp={comp()}
      calculando={false}
      onCalcular={() => {}}
      onComponente={() => {}}
      onReplaceComponente={() => {}}
      catalogo={catalogo}
      marcoLeido={marcoLeido}
      onReintentar={() => {}}
    />,
    "/calc-muestra?modo=marco-disponible&seccion=metodo",
  );

  it("section con aria-labelledby del encabezado, sin role=tabpanel", () => {
    const html = metodo({ fase: "listo", catalogo: CATALOGO });
    expect(html).toMatch(/^<section id="cmv2-section-general-metodo"[^>]*aria-labelledby="cmg-seccion-titulo"/);
    expect(html).not.toContain('role="tabpanel"');
    expect(html).toContain('<h3 class="cmg-panel-titulo" id="cmg-tecnica-titulo">');
  });

  it("V13 · readiness: false mientras el catálogo o el marco se leen", () => {
    expect(metodo({ fase: "cargando" })).toContain('data-audit-ready="false"');
    expect(metodo({ fase: "listo", catalogo: CATALOGO }, false)).toContain('data-audit-ready="false"');
    expect(metodo({ fase: "listo", catalogo: CATALOGO })).toContain('data-audit-ready="true"');
    // Un error también es un estado final que el QA puede auditar.
    expect(metodoListo({ fase: "error", mensaje: "x" }, true)).toBe(true);
  });
});

describe("V4 · los avisos del parámetro hablan con AvisoModulo", () => {
  it("corrección del motor en warn y la condición en info, ambas anunciadas y descritas", () => {
    const base = comp({ tecnica: "prob_aleatorio_simple" });
    const c = comp({
      tecnica: "prob_aleatorio_simple",
      parametros: { ...base.parametros, asignacion: "neyman" },
      avisos_parametros: [{ param: "e", recibido: 3, usado: 0.05, texto: "Si quisiste decir 3 %, escribe 0.03." }],
    });
    const html = conRouter(
      <ParametrosTecnicaVista comp={c} estado={{ fase: "listo", catalogo: CATALOGO }} onReintentar={() => {}} onParametro={() => {}} />,
    );
    expect(html).toMatch(/<div id="cmg-param-c1-e-aviso"><div class="cmv2-aviso cmv2-aviso--compact cmg-aviso-param" data-tone="warn" role="status">/);
    expect(html).toContain('aria-describedby="cmg-param-c1-e-ayuda cmg-param-c1-e-aviso"');
    expect(html).not.toContain("cmg-nota-param");
  });
});

describe("V7 · un botón deshabilitado dice por qué", () => {
  it("motivos puros de Sortear y Declarar", () => {
    expect(motivoNoSortear({ semillaValida: false, usaReservas: true, reservasValidas: true })).toContain("semilla");
    expect(motivoNoSortear({ semillaValida: true, usaReservas: true, reservasValidas: false })).toContain("reservas");
    expect(motivoNoSortear({ semillaValida: true, usaReservas: false, reservasValidas: false })).toBeNull();
    expect(motivoNoSortear({ semillaValida: true, usaReservas: true, reservasValidas: true })).toBeNull();
    expect(motivoNoDeclarar(ARCHIVO_MARCO_INICIAL)).toContain("Sube");
    const conArchivo = {
      ...ARCHIVO_MARCO_INICIAL,
      fase: "listo" as const,
      archivo: { file_id: "f", nombre: "p.csv", esLibro: false, hojas: [] },
    };
    expect(motivoNoDeclarar(conArchivo)).toContain("Id");
    expect(motivoNoDeclarar({ ...conArchivo, columnas: { id: "dni", estrato: "", tamano: "" } })).toBeNull();
    expect(motivoNoDeclarar({ ...conArchivo, fase: "declarando" })).toBeNull();
  });
});

describe("Selección general y de actores", () => {
  const seleccion = (marco: CalcMuestraGeneralMarco | null, enActor = false) => conRouter(
    <SeleccionGeneralVista componente={comp()} enActor={enActor} cargado error={null} marco={marco} corrida={null} />,
    "/calc-muestra?modo=marco-disponible&seccion=seleccion",
  );

  it("V3 · la sección general es una región nombrada, sin tabpanel", () => {
    const html = seleccion(null);
    expect(html).toMatch(/^<section id="cmv2-section-general-seleccion"[^>]*aria-labelledby="cmg-seccion-titulo"/);
    expect(html).not.toContain('role="tabpanel"');
  });

  it("V7 · el vacío dice la siguiente condición y ofrece la acción; V12 · h3 antes del h4 del vacío", () => {
    const general = seleccion(null);
    expect(general).toContain("Siguiente: declara en Marco");
    expect(general).toContain("Ir a Marco");
    expect(niveles(general)).toEqual([3, 4]);
    const actor = seleccion(null, true);
    expect(actor).toContain("Siguiente: declara arriba el archivo del marco");
    expect(actor).toContain("Ir al archivo del marco");
  });

  it("con marco, los encabezados propios no saltan de nivel", () => {
    expect(sinSaltos(seleccion(MARCO))).toBe(true);
  });

  it("Acreditación › Selección sin actores: región, h3 y siguiente condición", () => {
    const html = conRouter(
      <SeleccionActoresVista actores={[]} activo={null} cargado onElegir={() => {}} />,
      "/calc-muestra?modo=acreditacion&seccion=seleccion",
    );
    expect(html).toMatch(/^<section id="cmv2-section-acreditacion-seleccion"[^>]*aria-labelledby="cmg-seccion-titulo"/);
    expect(html).not.toContain('role="tabpanel"');
    expect(html).toContain("Siguiente: crea en Actores");
    expect(html).toContain("Ir a Actores");
    expect(niveles(html)).toEqual([3, 4]);
  });
});

describe("V9 · tablas con la gramática de aulas", () => {
  it("el listado usa cmv2-tabla: caption, rótulo de fila y numéricas cmv2-num", () => {
    const html = renderToStaticMarkup(
      <TablaUnidades
        unidades={[
          { id: "U-1", estrato: "(total)", N_h: 26954, n_h: 1, pi: 3.71e-5, orden: 1, estado: "titular", lote_reserva: null, peso_base: 26954.18 },
          { id: "U-2", estrato: "(total)", N_h: 26954, n_h: 1, pi: null, orden: 1, estado: "reserva", lote_reserva: 1, peso_base: null },
        ]}
        filtro="todas"
        pagina={0}
        onFiltro={() => {}}
        onPagina={() => {}}
      />,
    );
    expect(html).toContain('class="cmv2-tabla cmg-tabla-unidades"');
    expect(html).toContain('<caption class="cmg-sr-only">');
    expect(html).toContain('<th scope="row"><code>U-1</code></th>');
    expect(html).toContain('<th scope="col" class="cmv2-num">Peso base</th>');
    expect(html).toContain('class="cmv2-table-wrap cmg-tabla-desplazable"');
    expect(html).toContain('<h3 class="cmg-panel-titulo" id="cmg-unidades-titulo">');
  });

  it("estratos: caption, estrato como rótulo de fila y N_h con nombre accesible", () => {
    const base = defaultComponente({ id: "c1", tecnica: "prob_estratificado" });
    const c = {
      ...base,
      marco: {
        ...base.marco,
        estratos: [{ id: "e1", label: "Norte", N: 3000, N_a: 0, N_b: 0, sub_a_label: "A", sub_b_label: "B", promedio_conglomerado: 25, tau: 0.7 }],
      },
    };
    const html = renderToStaticMarkup(<EstratosGeneralVista comp={c} marcoDeclarado={false} onComponente={() => {}} />);
    expect(html).toContain('<caption class="cmg-sr-only">');
    expect(html).toContain('<th scope="row">');
    expect(html).toContain('aria-label="N_h de Norte"');
    expect(html).toContain('<th scope="col" class="cmg-num">p esperada</th>');
  });
});

describe("general.css · cabecera fija, foco, movimiento y contraste", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "general.css"), "utf8");

  it("V9 · la cabecera se pega al dueño de scroll de la sección mientras la tabla cabe", () => {
    expect(css).toMatch(/\.cmv2-table-wrap\.cmg-tabla-desplazable\[data-desborda="false"\] \{\s*overflow: visible;/);
    expect(css).toMatch(/\.cmg-tabla-desplazable thead th \{\s*position: sticky;\s*top: 0;/);
    expect(css).toContain(".cmg-tabla-desplazable tbody tr:hover > *");
  });

  it("V14 · foco visible y movimiento reducido cubren lo interactivo de general", () => {
    for (const bloque of [".cmg-actores-acred", ".cmg-estratos-general", ".cmg-unidades", ".cmg-seleccion", ".cmg-metodo-general", ".cmg-archivo"]) {
      expect(css).toMatch(new RegExp(`\\${bloque} :is\\([^)]*\\):focus-visible`));
    }
    expect(css.match(/@media \(prefers-reduced-motion: reduce\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("V17 · sin opacidad sobre texto deshabilitado ni colores propios", () => {
    expect(css).not.toMatch(/\.cmg-(metodo|campo[^{]*):disabled[^{]*\{[^}]*opacity/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
