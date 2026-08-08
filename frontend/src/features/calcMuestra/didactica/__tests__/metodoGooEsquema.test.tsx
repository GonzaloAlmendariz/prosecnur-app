/**
 * Contratos de los mini-goo de la pestaña Método (iteración 2026-08-07).
 *
 * (a) C1: cada esquema declara visible «esquema ilustrativo · no son aulas
 *     reales» — la pestaña Método no tiene selección y sus goo son didáctica
 *     de mecanismo, no una corrida (distinción congelada frente al ADR 0067).
 * (c) Reduced motion: el CSS apaga toda animación y los estilos base son el
 *     cuadro FINAL (estado resuelto), con la misma declaración.
 * (d) El enlace «Ver con tus aulas reales» usa la dirección canónica del
 *     catálogo (ADR 0044) y solo aparece cuando la selección existe.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CALC_MUESTRA_UNIVERSIDAD_PESTANAS } from "../../../../lib/navegacion/catalogos/calcMuestra";
import { ClassroomMethodStories } from "../../universidad/aulas/ClassroomMethodStories";
import {
  METODO_GOO_DECLARACION,
  METODO_GOO_ESQUEMAS,
  MetodoGooEsquema,
  type MetodoGooId,
} from "../MetodoGooEsquema";

const METODOS = Object.keys(METODO_GOO_ESQUEMAS) as MetodoGooId[];

describe("MetodoGooEsquema — declaración C1 (a)", () => {
  it("cubre exactamente los cuatro mecanismos de la pestaña Método", () => {
    expect(METODOS).toEqual([
      "sistematico_pps",
      "cube_balanceado",
      "local_pivotal_balanceado",
      "pool_controlado",
    ]);
  });

  for (const metodo of METODOS) {
    it(`${metodo} declara visible que es un esquema, no aulas reales`, () => {
      const html = renderToStaticMarkup(<MetodoGooEsquema metodo={metodo} />);
      expect(html).toContain(METODO_GOO_DECLARACION);
      expect(METODO_GOO_DECLARACION).toContain("esquema ilustrativo");
      expect(METODO_GOO_DECLARACION).toContain("no son aulas reales");
      // Y el aria también se declara como esquema, no como dato.
      expect(html).toContain("Esquema ilustrativo");
    });
  }

  it("cada mecanismo dibuja su seña: descuento PPS, barras de balance, repulsión y aro ganador", () => {
    expect(renderToStaticMarkup(<MetodoGooEsquema metodo="sistematico_pps" />)).toContain("is-descontada");
    const cube = renderToStaticMarkup(<MetodoGooEsquema metodo="cube_balanceado" />);
    expect(cube).toContain("cmv2-mgoo-barra-valor");
    const pivotal = renderToStaticMarkup(<MetodoGooEsquema metodo="local_pivotal_balanceado" />);
    expect(pivotal).toContain("is-repelida");
    expect(pivotal).toContain("is-gemela");
    expect(renderToStaticMarkup(<MetodoGooEsquema metodo="pool_controlado" />)).toContain(
      "cmv2-mgoo-anillo-ganador",
    );
  });
});

describe("MetodoGooEsquema — la estructura se ve ATÁNDOSE (corrección 2026-08-07)", () => {
  // Feedback de Gonzalo en la demo: «veo desplazamiento entre goos, mas no veo
  // que se conecten». Las conexiones son la esencia del lenguaje: cada esquema
  // publica su topología de tirantes como CONSTANTE pre-computada con la misma
  // primitiva del relato (vecinasMasCercanas sobre el layout final).
  it("PPS: la seleccionada viaja y se ata con DOS tirantes a la estructura", () => {
    const tirantes = METODO_GOO_ESQUEMAS.sistematico_pps.tirantes;
    expect(tirantes.filter((t) => t.rol === "snap")).toEqual([
      { de: 1, a: 3, rol: "snap" },
      { de: 2, a: 3, rol: "snap" },
    ]);
    // Y la estructura previa ya está atada entre sí (tirantes sólidos).
    expect(tirantes.filter((t) => t.rol === "estructura").length).toBeGreaterThanOrEqual(2);
    const html = renderToStaticMarkup(<MetodoGooEsquema metodo="sistematico_pps" />);
    expect(html).toContain("is-snap");
    expect(html).toContain("is-estructura");
  });

  it("cube: la red completa ata a TODAS las bolas del cluster, a ninguna del resto", () => {
    const { bolas, tirantes } = METODO_GOO_ESQUEMAS.cube_balanceado;
    const atadas = new Set(tirantes.flatMap((t) => [t.de, t.a]));
    for (let index = 0; index < 6; index += 1) expect(atadas.has(index), `bola ${index}`).toBe(true);
    for (const t of tirantes) {
      expect(t.rol).toBe("red");
      expect(bolas[t.de].rol).toBe("sorteada");
      expect(bolas[t.a].rol).toBe("sorteada");
    }
  });

  it("pivotal: la gemela aceptada entra a la red; la repelida queda SIN tirante", () => {
    const { bolas, tirantes } = METODO_GOO_ESQUEMAS.local_pivotal_balanceado;
    const indiceGemela = bolas.findIndex((b) => b.rol === "gemela");
    const indiceRepelida = bolas.findIndex((b) => b.rol === "repelida");
    expect(tirantes.some((t) => t.de === indiceGemela || t.a === indiceGemela)).toBe(true);
    // El contraste ES el mecanismo: cero tirantes hacia la repelida.
    expect(tirantes.every((t) => t.de !== indiceRepelida && t.a !== indiceRepelida)).toBe(true);
  });

  it("pool: cada cluster es una red propia; la ganadora queda, las perdedoras caen enteras", () => {
    const { bolas, tirantes } = METODO_GOO_ESQUEMAS.pool_controlado;
    // Ningún tirante cruza clusters: cada arista une bolas del mismo rol.
    for (const t of tirantes) expect(bolas[t.de].rol).toBe(bolas[t.a].rol);
    const ganadores = tirantes.filter((t) => t.rol === "ganador");
    expect(ganadores.length).toBeGreaterThanOrEqual(3);
    expect(ganadores.every((t) => bolas[t.a].rol === "ganadora")).toBe(true);
    expect(tirantes.filter((t) => t.rol === "perdedor").length).toBeGreaterThanOrEqual(6);
  });
});

describe("MetodoGooEsquema — cuadro estático final (c)", () => {
  const css = readFileSync(
    fileURLToPath(new URL("../metodoGooEsquema.css", import.meta.url)),
    "utf8",
  );

  it("el bloque prefers-reduced-motion apaga toda animación del esquema", () => {
    const reducido = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reducido).toContain("animation: none");
    for (const clase of [
      ".cmv2-mgoo-bola",
      ".cmv2-mgoo-halo",
      ".cmv2-mgoo-anillo-ganador",
      ".cmv2-mgoo-barra-valor",
      ".cmv2-mgoo-tirante",
    ]) {
      expect(reducido, clase).toContain(clase);
    }
  });

  it("sin animación la RED queda completa y visible (base = final, no opacity 0)", () => {
    const bloque = /\.cmv2-mgoo-tirante\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(bloque).toContain("stroke");
    expect(bloque).toContain("opacity: 0.9");
  });

  it("la llegada usa el asentamiento subamortiguado reducido, no un ease plano", () => {
    // Mismo lenguaje que el Relato (spec World of Goo destilada): la mini-bola
    // se pasa del equilibrio y oscila de vuelta (+6% → −3% → +2% → −1% → 0).
    const mover = css.slice(css.indexOf("@keyframes cmv2-mgoo-mover"));
    for (const pico of ["scale(1.06)", "scale(0.97)", "scale(1.02)", "scale(0.99)"]) {
      expect(mover, pico).toContain(pico);
    }
  });

  it("los estilos base codifican el estado RESUELTO: sin animación queda el final", () => {
    // La bola en reposo vive en su destino (--gx1/--gy1) y la barra en su
    // llenado final: apagar keyframes no puede dejar el esquema a medias.
    expect(css).toMatch(/\.cmv2-mgoo-bola\s*\{[^}]*translate\(var\(--gx1\), var\(--gy1\)\)/);
    expect(css).toMatch(/\.cmv2-mgoo-barra-valor\s*\{[^}]*scaleX\(var\(--mgoo-fill/);
  });
});

describe("ClassroomMethodStories — enlace al Relato (d)", () => {
  const RELATO_TO = CALC_MUESTRA_UNIVERSIDAD_PESTANAS.aulas.find(
    (tab) => tab.id === "aulas-relato",
  )?.to;

  function render(relatoDisponible: boolean) {
    return renderToStaticMarkup(
      <MemoryRouter>
        <ClassroomMethodStories
          configuredMethodId="cube_balanceado"
          relatoDisponible={relatoDisponible}
          onConfigure={() => undefined}
        />
      </MemoryRouter>,
    );
  }

  it("con selección vigente enlaza «ver con tus aulas reales» a la dirección canónica", () => {
    const html = render(true);
    expect(RELATO_TO).toBe(
      "/calc-muestra?modo=opinion-universitaria&seccion=aulas&pestana=aulas-relato",
    );
    expect(html).toContain("Ver con tus aulas reales");
    expect(html).toContain("pestana=aulas-relato");
    // Sin alias históricos en la dirección escrita (ADR 0044).
    expect(RELATO_TO).not.toMatch(/[?&](tab|stage|mesa|desk|step|reporte)=/);
  });

  it("sin selección no promete el Relato: el esquema basta y lo declara", () => {
    const html = render(false);
    expect(html).not.toContain("Ver con tus aulas reales");
    expect(html).toContain(METODO_GOO_DECLARACION);
  });
});
