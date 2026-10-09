/**
 * Contratos c2fa7c472 (media) y 65bfe7b1d (potencia): Método pinta «Qué se
 * estima» primero y muestra p o cv según lo elegido; la asignación admite
 * potencia en el catálogo, la memoria, la técnica y la ficha.
 */
import type { ReactElement, ReactNode } from "react";
import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CalcMuestraComponente, CalcMuestraParametros } from "../../../../api/calcMuestra";
import {
  normalizeCalcMuestraCatalogoParametros,
  type CalcMuestraCatalogoParametros,
  type CalcMuestraGeneralCorrida,
  type CalcMuestraParametroDeTecnica,
} from "../../../../api/calcMuestraGeneral";
import { defaultComponente } from "../../sharedCore";
import { asignacionEstratificada, tecnicaCalculadaLabel } from "../catalogos";
import {
  AYUDA_MARGEN_MEDIA,
  lineaDeAsignacion,
  parametrosVisibles,
  patchDeParametro,
  precisionEnPalabras,
} from "../modeloParametros";
import { CampoParametro, ParametrosTecnicaVista } from "../ParametrosTecnica";
import { nombreDeCorrida } from "../tituloCorrida";

// Forma real de las tres técnicas en `GET /tecnicas/parametros` tras c2fa7c472.
const COMUNES = [
  { clave: "z", rotulo: "Nivel de confianza", ayuda: "Se ingresa como z." },
  { clave: "p", rotulo: "Proporción esperada", ayuda: "Sin estimación previa, 0.5 es lo conservador." },
  { clave: "e", rotulo: "Margen de error", ayuda: "Como proporción: 0.05 = ±5 puntos." },
  { clave: "tasa_respuesta", rotulo: "Tasa de respuesta", ayuda: "" },
  { clave: "oversample_pct", rotulo: "Sobremuestra", ayuda: "" },
];
const INDICADOR = [
  { clave: "tipo_indicador", rotulo: "Qué se estima", ayuda: "Una proporción usa p; una media, el CV.", tipo: "opciones", opciones: ["proporcion", "media"] },
  { clave: "cv", rotulo: "Coeficiente de variación esperado", ayuda: "Sólo para medias.", tipo: "numero" },
];
const CATALOGO = normalizeCalcMuestraCatalogoParametros({
  ok: true,
  tecnicas: [
    { tecnica: "prob_aleatorio_simple", parametros: [...COMUNES, ...INDICADOR] },
    { tecnica: "sistematico", parametros: [...COMUNES, ...INDICADOR] },
    {
      tecnica: "prob_estratificado",
      parametros: [
        ...COMUNES,
        { clave: "asignacion", rotulo: "Asignación entre estratos", ayuda: "", tipo: "opciones", opciones: ["proporcional", "neyman", "potencia"] },
        ...INDICADOR,
      ],
    },
  ],
}) as CalcMuestraCatalogoParametros;

function comp(tecnica: CalcMuestraComponente["tecnica"], parametros: Partial<CalcMuestraParametros> = {}): CalcMuestraComponente {
  const base = defaultComponente({ id: "c1", actor: "Hogares", tecnica });
  return { ...base, parametros: { ...base.parametros, ...parametros } };
}

const vista = (c: CalcMuestraComponente) => renderToStaticMarkup(
  <ParametrosTecnicaVista comp={c} estado={{ fase: "listo", catalogo: CATALOGO }} onReintentar={() => {}} onParametro={() => {}} />,
);

const claves = (html: string) => [...html.matchAll(/data-param="([^"]+)"/g)].map((m) => m[1]);

/** El `<select>` de un árbol de elementos ya resuelto (CampoParametro no usa hooks). */
function buscarSelect(nodo: ReactNode): ReactElement<{ onChange: (e: { currentTarget: { value: string } }) => void }> | null {
  if (Array.isArray(nodo)) {
    for (const hijo of nodo) {
      const s = buscarSelect(hijo);
      if (s) return s;
    }
    return null;
  }
  if (!isValidElement(nodo)) return null;
  if (nodo.type === "select") return nodo as ReactElement<{ onChange: (e: { currentTarget: { value: string } }) => void }>;
  return buscarSelect((nodo.props as { children?: ReactNode }).children);
}

describe("Qué se estima: proporción o media", () => {
  for (const tecnica of ["prob_aleatorio_simple", "sistematico", "prob_estratificado"] as const) {
    it(`${tecnica}: va primero; con proporción se ve p y no cv`, () => {
      const html = vista(comp(tecnica));
      const vistas = claves(html);
      expect(vistas[0]).toBe("tipo_indicador");
      expect(vistas).toContain("p");
      expect(vistas).not.toContain("cv");
      expect(html).toContain('<option value="proporcion" selected="">Proporción</option>');
      expect(html).toContain('<option value="media">Media</option>');
      expect(html).not.toContain(">proporcion<");
      expect(html).not.toContain(">media<");
    });

    it(`${tecnica}: con media se ve cv y no p, y el margen es relativo`, () => {
      const html = vista(comp(tecnica, { tipo_indicador: "media" }));
      const vistas = claves(html);
      expect(vistas[0]).toBe("tipo_indicador");
      expect(vistas).toContain("cv");
      expect(vistas).not.toContain("p");
      expect(html).toContain('<option value="media" selected="">Media</option>');
      expect(html).toContain(AYUDA_MARGEN_MEDIA);
      expect(html).not.toContain("±5 puntos");
      // Sin cv guardado se ve el default del motor como placeholder, no como valor.
      // Desde L14 el campo es texto: el rango (0.01–10) lo valida el motor y lo avisa.
      expect(html).toMatch(/<input[^>]*id="cmg-param-c1-cv"[^>]*placeholder="1"[^>]*value=""/);
    });
  }

  it("con proporción el margen conserva la ayuda del motor", () => {
    expect(vista(comp("prob_aleatorio_simple"))).toContain("Como proporción: 0.05 = ±5 puntos.");
  });

  it("el selector escribe parametros.tipo_indicador", () => {
    const escritos: Array<[string, number | string]> = [];
    const param = CATALOGO.prob_aleatorio_simple.find((p) => p.clave === "tipo_indicador") as CalcMuestraParametroDeTecnica;
    const arbol = CampoParametro({
      compId: "c1", nota: null, param, parametros: comp("prob_aleatorio_simple").parametros, aviso: null,
      onParametro: (clave, valor) => escritos.push([clave, valor]),
    });
    const select = buscarSelect(arbol);
    expect(select).not.toBeNull();
    select?.props.onChange({ currentTarget: { value: "media" } });
    expect(escritos).toEqual([["tipo_indicador", "media"]]);
    expect(patchDeParametro("tipo_indicador", "media")).toEqual({ tipo_indicador: "media" });
    expect(patchDeParametro("cv", 0.8)).toEqual({ cv: 0.8 });
    expect(patchDeParametro("no_existe", 1)).toBeNull();
  });

  it("un catálogo sin tipo_indicador no pinta cv suelto", () => {
    const viejo = CATALOGO.prob_aleatorio_simple.filter((p) => p.clave !== "tipo_indicador");
    expect(parametrosVisibles(viejo, comp("prob_aleatorio_simple", { tipo_indicador: "media" }).parametros).map((p) => p.clave))
      .toEqual(["z", "p", "e", "tasa_respuesta", "oversample_pct"]);
  });

  it("la precisión de una media se lee como ± % de la media", () => {
    expect(precisionEnPalabras(comp("prob_aleatorio_simple", { tipo_indicador: "media" }), "5.0%")).toBe("±5.0% de la media");
    expect(precisionEnPalabras(comp("prob_aleatorio_simple"), "5.0%")).toBe("5.0%");
    expect(precisionEnPalabras(comp("prob_aleatorio_simple", { tipo_indicador: "media" }), "—")).toBe("—");
    expect(precisionEnPalabras(comp("intencion_censal", { tipo_indicador: "media" }), "80.0%")).toBe("80.0%");
  });
});

describe("asignación de potencia", () => {
  const resultado = (asignacion: "potencia", formula_n: "potencia") =>
    ({ n_objetivo: 215, asignacion, formula_n }) as unknown as CalcMuestraComponente["resultado"];

  it("se elige como «Potencia» y la memoria la nombra con Bankier", () => {
    expect(vista(comp("prob_estratificado"))).toContain('<option value="potencia">Potencia</option>');
    expect(lineaDeAsignacion({ resultado: resultado("potencia", "potencia") }))
      .toBe("Reparto entre estratos: potencia (Bankier) · n calculado por estrato.");
  });

  it("la técnica y la ficha la llevan en el nombre", () => {
    const c = { ...comp("prob_estratificado", { asignacion: "potencia" }), resultado: resultado("potencia", "potencia") };
    expect(tecnicaCalculadaLabel(c)).toBe("Estratificado · potencia");
    const corrida = {
      corrida: { semilla: 7, metodo: "mas", modalidad: "probabilistica" },
      estratos: [{ clave: "Norte" }, { clave: "Sur" }],
    } as unknown as CalcMuestraGeneralCorrida;
    expect(nombreDeCorrida(corrida, c).titulo).toBe("Estratificado (potencia) · MAS dentro de cada estrato · semilla 7");
    // Sin resultado, manda la declarada.
    expect(tecnicaCalculadaLabel(comp("prob_estratificado", { asignacion: "potencia" }))).toBe("Estratificado · potencia");
  });
});

describe("con una media la asignación no se ofrece ni se anuncia", () => {
  it("parametrosVisibles oculta la asignación con media y la muestra con proporción", () => {
    const params = [
      { clave: "tipo_indicador", rotulo: "Qué se estima", ayuda: "", tipo: "opciones", opciones: ["proporcion", "media"] },
      { clave: "p", rotulo: "p", ayuda: "", tipo: "numero" },
      { clave: "cv", rotulo: "CV", ayuda: "", tipo: "numero" },
      { clave: "asignacion", rotulo: "Asignación", ayuda: "", tipo: "opciones", opciones: ["proporcional", "neyman", "potencia"] },
    ] as Parameters<typeof parametrosVisibles>[0];
    const conMedia = parametrosVisibles(params, { tipo_indicador: "media" } as never).map((p) => p.clave);
    expect(conMedia).toEqual(["tipo_indicador", "cv"]);
    const conProp = parametrosVisibles(params, { tipo_indicador: "proporcion" } as never).map((p) => p.clave);
    expect(conProp).toEqual(["tipo_indicador", "p", "asignacion"]);
  });
  it("asignacionEstratificada dice proporcional para una media aunque se pida Neyman", () => {
    expect(asignacionEstratificada({ parametros: { tipo_indicador: "media", asignacion: "neyman" }, resultado: null } as never)).toBe("proporcional");
    expect(asignacionEstratificada({ parametros: {}, resultado: { formula_n: "media_global" } } as never)).toBe("proporcional");
  });
});
