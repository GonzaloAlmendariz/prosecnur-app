/**
 * E11 · W2 ronda 2 — lo que la QA visual rechazó de la ronda 1
 * (docs/qa/checklist-calc-muestra-paridad-visual-2026-09-24.md):
 * V17 contraste del chip «Sin marco», V15 pie de la meta en piezas que no se
 * parten a 1024, V9 divisoria que recorre la fila entera y V10 decimal es-PE
 * en los inputs numéricos.
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
} from "../../../../api/calcMuestraGeneral";
import { defaultComponente } from "../../sharedCore";
import { ActoresAcreditacion } from "../ActoresAcreditacion";
import { EstratosGeneralVista } from "../EstratosGeneral";
import { campoMetaDelActor, pieDeCuota } from "../modelo";
import { ParametrosTecnicaVista } from "../ParametrosTecnica";

const css = fs.readFileSync(path.join(__dirname, "..", "general.css"), "utf8");
const tokens = fs.readFileSync(path.join(__dirname, "..", "..", "..", "..", "app", "tokens.css"), "utf8");

function docentes(patch: Partial<CalcMuestraComponente["parametros"]> = {}, tecnica: CalcMuestraComponente["tecnica"] = "prob_aleatorio_simple"): CalcMuestraComponente {
  const base = defaultComponente({ id: "cmp-doc", actor: "Docentes", actor_categoria: "docentes", canal_recojo: "online_email", tecnica });
  return {
    ...base,
    marco: { ...base.marco, marco_validado: 1000 },
    parametros: { ...base.parametros, e: 0.05, tasa_respuesta: 0.6, oversample_pct: 0, ...patch },
  };
}

function actores(componentes: CalcMuestraComponente[]): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={["/calc-muestra?modo=acreditacion&seccion=actores"]}>
      <ActoresAcreditacion componentes={componentes} onComponente={() => {}} />
    </MemoryRouter>,
  );
}

/* --- Contraste WCAG con los tokens reales ---------------------------------- */

function hexDe(token: string): [number, number, number] {
  const m = tokens.match(new RegExp(`${token}:\\s*#([0-9a-fA-F]{6});`));
  if (!m) throw new Error(`token ${token} sin hex en tokens.css`);
  const h = m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function rgbaDe(token: string): [number, number, number, number] {
  const m = tokens.match(new RegExp(`${token}:\\s*rgba\\((\\d+),\\s*(\\d+),\\s*(\\d+),\\s*([0-9.]+)\\);`));
  if (!m) throw new Error(`token ${token} sin rgba en tokens.css`);
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
}

function luminancia([r, g, b]: [number, number, number]): number {
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function contraste(a: [number, number, number], b: [number, number, number]): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const mezcla = (a: [number, number, number], b: [number, number, number], pa: number): [number, number, number] =>
  [0, 1, 2].map((i) => Math.round(a[i] * pa + b[i] * (1 - pa))) as [number, number, number];

describe("V17 · el chip «Sin marco» pasa 4.5:1 a 11 px", () => {
  it("la regla base oscurece el gris de «sin definir» hacia el texto", () => {
    const regla = css.match(/\.cmg-actor-estado \{[^}]*\}/)?.[0] ?? "";
    const m = regla.match(/color: color-mix\(in srgb, var\(--pulso-state-unset-fg\) (\d+)%, var\(--pulso-text\)\);/);
    expect(m).not.toBeNull();
    const fg = mezcla(hexDe("--pulso-state-unset-fg"), hexDe("--pulso-text"), Number(m?.[1]) / 100);
    // Peor caso: el tinte del chip sobre el fondo gris de la página y sobre blanco.
    const [r, g, b, a] = rgbaDe("--pulso-state-unset-bg");
    for (const base of [hexDe("--pulso-surface"), hexDe("--pulso-bg")]) {
      const fondo = mezcla([r, g, b], base, a);
      expect(contraste(fg, fondo)).toBeGreaterThanOrEqual(4.5);
    }
    // El gris crudo es justo lo que la QA midió por debajo del umbral.
    expect(contraste(hexDe("--pulso-state-unset-fg"), mezcla([r, g, b], hexDe("--pulso-bg"), a))).toBeLessThan(4.5);
  });
});

describe("V15 · el pie de la meta baja por piezas, no por palabras", () => {
  it("MAS: «Respuesta» y «margen ±5.0%», cada pieza corta; la frase entera queda para el lector", () => {
    const campo = campoMetaDelActor(docentes());
    expect(campo.tipo).toBe("respuesta");
    if (campo.tipo !== "respuesta") return;
    expect(campo.piezas).toEqual(["Respuesta", "margen ±5.0%"]);
    expect(campo.detalle).toBe("Respuesta esperada · margen ±5.0%");
    for (const pieza of campo.piezas) expect(pieza.length).toBeLessThanOrEqual(14);
  });

  it("con sobremuestra real siguen siendo dos piezas y el detalle la nombra", () => {
    const campo = campoMetaDelActor(docentes({ oversample_pct: 0.5 }));
    if (campo.tipo !== "respuesta") throw new Error("esperaba respuesta");
    expect(campo.piezas).toEqual(["Respuesta", "±5.0% · +50.0%"]);
    expect(campo.detalle).toBe("Respuesta esperada · margen ±5.0% · sobremuestra 50.0%");
  });

  it("conglomerados, conveniencia y cuota también en piezas cortas", () => {
    const cong = campoMetaDelActor(docentes({}, "prob_conglomerado_multietapico"));
    expect(cong.tipo === "sobremuestra" && cong.piezas).toEqual(["Sobremuestra"]);
    const conv = campoMetaDelActor(docentes({ n_minimo_estrato: 30, tope_operativo: 400 }, "no_prob_conveniencia"));
    expect(conv.tipo === "cobertura" && conv.piezas).toEqual(["Piso 30", "tope 400"]);
    expect(pieDeCuota(null)).toEqual({ detalle: "Cuota", piezas: ["Cuota"] });
    expect(pieDeCuota(120)).toEqual({ detalle: "Cuota · vacía, el motor aplica 120", piezas: ["Cuota vacía", "motor: 120"] });
  });

  it("la tabla pinta piezas sin partir y deja la frase entera en título y texto accesible", () => {
    const html = actores([docentes({ oversample_pct: 0.5 })]);
    expect(html).toContain('<small class="cmg-meta-pie" title="Respuesta esperada · margen ±5.0% · sobremuestra 50.0%">');
    expect(html).toContain('<span class="cmg-sr-only">Respuesta esperada · margen ±5.0% · sobremuestra 50.0%</span>');
    expect(html).toContain('<span class="cmg-meta-pieza" aria-hidden="true">Respuesta</span>');
    expect(html).toContain('<span class="cmg-meta-pieza" aria-hidden="true">±5.0% · +50.0%</span>');
    expect(css).toMatch(/\.cmg-tabla-actores \.cmg-meta-pieza \{\s*white-space: nowrap;/);
    expect(css).not.toMatch(/\.cmg-tabla-actores td\.cmg-num \.cmv2-target-stack small \{\s*white-space: normal;/);
    // «Por calcular» sigue en una sola línea.
    expect(html).toContain('<td class="cmg-actor-resultado"><strong>Por calcular</strong></td>');
  });
});

describe("V9 · la divisoria recorre la fila entera", () => {
  it("el rótulo de fila no suma la sombra de cabecera y usa el mismo gris que las celdas", () => {
    const regla = css.match(/\.cmg-tabla-desplazable \.cmv2-table tbody th\[scope="row"\] \{[^}]*\}/)?.[0] ?? "";
    expect(regla).toContain("box-shadow: none;");
    expect(regla).toContain("border-bottom-color: color-mix(in srgb, var(--cmv2-border) 86%, var(--cmv2-accent-border) 14%);");
    expect(css).toMatch(/\.cmg-tabla-desplazable \.cmv2-table tbody tr:last-child > th\[scope="row"\] \{\s*border-bottom: 0;/);
    // El gris de las celdas vive en calcMuestra.css: si cambia, esta regla debe seguirlo.
    const base = fs.readFileSync(path.join(__dirname, "..", "..", "calcMuestra.css"), "utf8");
    expect(base).toMatch(/\.cmv2-table td,\s*\.cmv2-variable-map-table td \{\s*border-bottom-color: color-mix\(in srgb, var\(--cmv2-border\) 86%, var\(--cmv2-accent-border\) 14%\);/);
  });
});

describe("V10 · los inputs numéricos declaran es-PE sin tocar su valor", () => {
  it("Actores: tabla y porcentaje en es-PE; el valor sigue siendo la cifra cruda", () => {
    const html = actores([docentes()]);
    expect(html).toMatch(/<table class="cmv2-table cmg-tabla-actores"[^>]*lang="es-PE"/);
    expect(html).toMatch(/<input type="number" lang="es-PE"[^>]*aria-label="Respuesta esperada de Docentes"[^>]*value="60"/);
    expect(html).toMatch(/aria-label="Marco \(N\) de Docentes" value="1000"/);
  });

  it("Parámetros: el margen se escribe «0.05», no «0,05»", () => {
    const catalogo = normalizeCalcMuestraCatalogoParametros({
      ok: true,
      tecnicas: [{ tecnica: "prob_aleatorio_simple", parametros: [{ clave: "e", rotulo: "Margen de error", ayuda: "" }] }],
    }) as CalcMuestraCatalogoParametros;
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ParametrosTecnicaVista comp={docentes()} estado={{ fase: "listo", catalogo }} onReintentar={() => {}} onParametro={() => {}} />
      </MemoryRouter>,
    );
    // Desde L14 (2026-09-27) es texto con teclado decimal: Chromium formatea los
    // type=number con el locale del sistema e ignora `lang` (pintaba «0,05»).
    expect(html).toMatch(/<input id="cmg-param-cmp-doc-e" type="text" inputMode="decimal"[^>]*value="0.05"/);
  });

  it("Estratos: la tabla hereda es-PE y un nombre largo lleva su título completo (C4)", () => {
    const base = defaultComponente({ id: "c1", tecnica: "prob_estratificado" });
    const largo = "Facultad de Ciencias Contables, Económicas y Financieras";
    const c = {
      ...base,
      marco: {
        ...base.marco,
        estratos: [{ id: "e1", label: largo, N: 3000, N_a: 0, N_b: 0, sub_a_label: "A", sub_b_label: "B", promedio_conglomerado: 25, tau: 0.7 }],
      },
    };
    const html = renderToStaticMarkup(<EstratosGeneralVista comp={c} marcoDeclarado={false} onComponente={() => {}} />);
    expect(html).toMatch(/<table class="cmv2-table cmg-tabla-estratos"[^>]*lang="es-PE"/);
    expect(html).toContain(`title="${largo}"`);
    expect(html).toContain('value="3000"');
  });
});
