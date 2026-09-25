/**
 * E16 — Las animaciones de aulas llevadas a Muestra general y Acreditación
 * (docs/qa/checklist-calc-muestra-animaciones-2026-09-25.md, M1–M9).
 *
 * Sin DOM en vitest: la lógica que decide CUÁNDO se anima es pura y se prueba
 * aquí; el markup se lee con SSR; y el CSS se lee como contrato (sólo
 * transform/opacity/filter, tokens `--motion-*`, relleno hacia atrás, y todo
 * lo que se mueve se apaga con movimiento reducido).
 */
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { CalcMuestraComponente } from "../../../../api/calcMuestra";
import { BandaDiseno } from "../BandaDiseno";
import { pestanasDeSeccion } from "../modeloPestanas";
import { PestanasMesa } from "../PestanasMesa";
import { anchosPrevios, desdeReescala, dibujarReparto, type FilaReparto } from "../repartoEstratos";
import { RepartoEstratosGrafico } from "../RepartoEstratosGrafico";
import { ResultadosComponentes } from "../ResultadosComponentes";
import { SelectorActor } from "../SelectorActor";
import { SiguienteCondicion } from "../SiguienteCondicion";
import { siguienteEntrada, type EstadoEntrada } from "../useEntradaPorCambio";

const leer = (archivo: string) =>
  fs.readFileSync(path.join(__dirname, "..", archivo), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const FILAS: FilaReparto[] = [
  { clave: "A", etiqueta: "A", N: 1000, n: 90, nCampo: 120, pi: 0.12 },
  { clave: "B", etiqueta: "B", N: 250, n: 40, nCampo: 50, pi: 0.2 },
  { clave: "C", etiqueta: "C", N: 50, n: null, nCampo: 10, pi: 0.2 },
];

describe("M2 · la entrada del cuerpo de la pestaña", () => {
  it("monta en `montaje` y alterna a/b en cada cambio de clave, nunca por render", () => {
    const inicio: EstadoEntrada = { clave: "metodo/metodo-tecnica", fase: "montaje" };
    expect(siguienteEntrada(inicio, "metodo/metodo-tecnica")).toBe(inicio);
    const uno = siguienteEntrada(inicio, "metodo/metodo-parametros");
    expect(uno.fase).toBe("b");
    const dos = siguienteEntrada(uno, "metodo/metodo-memoria");
    expect(dos.fase).toBe("a");
    expect(siguienteEntrada(dos, "metodo/metodo-memoria")).toBe(dos);
    expect(siguienteEntrada(dos, "seleccion/sorteo").fase).toBe("b");
  });

  it("el cuerpo declara su fase sin re-montarse (sin `key` por pestaña)", () => {
    const pestanas = pestanasDeSeccion("marco_disponible", "metodo");
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PestanasMesa grupo="general" seccion="metodo" tituloSeccion="Método" pestanas={pestanas} activa={pestanas[0].id} onElegir={() => {}} listo>
          <p>cuerpo</p>
        </PestanasMesa>
      </MemoryRouter>,
    );
    expect(html).toMatch(/class="cmg-pestana-cuerpo"[^>]*data-entrada="montaje"/);
    expect(fs.readFileSync(path.join(__dirname, "..", "PestanasMesa.tsx"), "utf8")).not.toMatch(/key=\{meta\.id\}/);
  });
});

describe("M1 · la banda entra en cascada por cifra", () => {
  it("la cascada no cuelga del contenedor de un único hijo", () => {
    const html = renderToStaticMarkup(
      <BandaDiseno grupo="g" cadena={["Marco", "n"]} cifras={[{ clave: "N", label: "N", value: "1,000" }, { clave: "n", label: "n", value: "120" }]} />,
    );
    expect(html).not.toContain("cmv2-uni-stagger");
    expect(leer("movimiento.css")).toContain(".cmg-banda-cifras > .cmv2-uni-cifra-fila");
  });
});

describe("M3 · barras del reparto", () => {
  it("al montar: fila escalonada, sin reescala y el ancho es el dato", () => {
    const html = renderToStaticMarkup(<RepartoEstratosGrafico titulo="Reparto" filas={FILAS} origen="resultado" />);
    expect(html).not.toContain("data-reescala");
    expect(html).not.toContain("--cmg-desde");
    expect(html).toContain('style="--cmg-fila:0"');
    expect(html).toContain('style="--cmg-fila:2"');
    const dibujo = dibujarReparto(FILAS, "tamano");
    expect(html).toContain(`width="${dibujo[1].anchoN}%"`);
  });

  it("al cambiar de escala, cada barra arranca desde su ancho anterior, sin salirse del carril", () => {
    const previos = anchosPrevios(FILAS, "fraccion");
    const ahora = dibujarReparto(FILAS, "fraccion");
    for (const f of ahora) {
      const antes = previos.get(f.clave)!;
      const desde = desdeReescala(antes.anchoN, f.anchoN);
      expect(desde * f.anchoN).toBeCloseTo(antes.anchoN, 0);
      expect(desde * f.anchoN).toBeLessThanOrEqual(100.1);
    }
    expect(desdeReescala(null, 40)).toBe(1);
    expect(desdeReescala(30, 0)).toBe(1);
    expect(desdeReescala(0, 40)).toBe(0);
    expect(desdeReescala(20, 40)).toBe(0.5);
  });
});

describe("M5 · los n de Resultados cruzan con el swap de aulas", () => {
  it("n objetivo y operativo van dentro de `.cmv2-uni-swap`, en reposo sin cruzar", () => {
    const comp = {
      id: "c1",
      actor: "Usuarios",
      tecnica: "prob_mas",
      naturaleza: "probabilistica",
      marco: { marco_validado: 1000 },
      parametros: {},
      resultado: { n_objetivo: 234, n_operativo: 390, precision_alcanzada: 0.05 },
    } as unknown as CalcMuestraComponente;
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ResultadosComponentes modo="marco_disponible" componentes={[comp]} calculando={false} onCalcular={() => {}} />
      </MemoryRouter>,
    );
    expect(html).toContain('<td class="cmg-col-num"><div class="cmv2-uni-swap">234</div></td>');
    expect(html).toContain('<div class="cmv2-uni-swap">390</div>');
    expect(html).not.toContain("data-cambiando");
  });
});

describe("M6/M7 · actores y chips de estado", () => {
  it("el chip del actor y el de la mesa llevan el cruce, sin cruzar al montar", () => {
    const actor = {
      id: "a1",
      nombre: "Docentes",
      tecnica: { clase: "probabilistica", etiqueta: "Muestra probabilística", sorteable: true, motivo: null },
      estado: { fase: "sorteado", etiqueta: "Sorteado", detalle: "n 120" },
      conMarco: true,
    } as unknown as Parameters<typeof SelectorActor>[0]["actores"][number];
    const actores = renderToStaticMarkup(<SelectorActor actores={[actor]} activoId="a1" onElegir={() => {}} />);
    expect(actores).toContain('class="cmg-actor-estado cmg-actor-estado--sorteado cmv2-uni-swap"');
    expect(actores).not.toContain("data-cambiando");

    const mesa = renderToStaticMarkup(
      <MemoryRouter>
        <SiguienteCondicion modo="marco_disponible" seccion="metodo" estado={{ clave: "sin-calculo", tono: "pendiente", etiqueta: "Falta calcular", siguiente: "Calcula el n.", accion: null }} />
      </MemoryRouter>,
    );
    expect(mesa).toContain('class="cmg-estado-chip cmv2-uni-swap" data-tono="pendiente"');
  });

  it("la tarjeta de actor transiciona su press con la duración del press", () => {
    const general = leer("general.css");
    const regla = general.slice(general.indexOf(".cmg-actor {"), general.indexOf("}", general.indexOf(".cmg-actor {")));
    expect(regla).toContain("transform var(--motion-dur-press) var(--motion-ease-out)");
    expect(leer("movimiento.css")).toMatch(/\.cmg-actor:active:not\(:disabled\) \{\s*transform: scale\(0\.97\);/);
  });
});

describe("M9 · contrato de movimiento de movimiento.css", () => {
  const css = leer("movimiento.css");
  const iReducido = css.indexOf("@media (prefers-reduced-motion: reduce)");
  const iPreferencia = css.indexOf("@media (prefers-reduced-motion: no-preference)");
  const keyframes = css.match(/@keyframes [\w-]+ \{[\s\S]*?\n\}/g) ?? [];

  it("cada `animation:` vive bajo no-preference o es un `none`", () => {
    const fuera = css.slice(0, iPreferencia) + css.slice(css.indexOf("\n}\n", iPreferencia));
    for (const decl of fuera.match(/animation:[^;]*;/g) ?? []) expect(decl).toBe("animation: none;");
  });

  it("los keyframes sólo tocan opacity y transform, y sólo declaran `from`", () => {
    expect(keyframes.length).toBeGreaterThanOrEqual(6);
    for (const k of keyframes) {
      expect(k).not.toMatch(/\bto\b\s*\{|%\s*\{/);
      const props = [...k.matchAll(/^\s*([a-z-]+):/gm)].map((m) => m[1]);
      for (const p of props) expect(["opacity", "transform"]).toContain(p);
    }
  });

  it("nunca anima geometría ni retiene el último fotograma (F55)", () => {
    expect(css).not.toMatch(/transition[^;]*\b(width|height|left|top|right|bottom)\b/);
    expect(css).not.toMatch(/animation:[^;]*\b(forwards|both)\b/);
    expect(css).not.toMatch(/scale\(0\)/);
  });

  it("tiempos y curvas salen de los tokens, sin literales ni `--cmv2-ease-*`", () => {
    for (const decl of css.match(/(animation|transition):[^;]*;/g) ?? []) {
      if (decl === "animation: none;") continue;
      expect(decl).toMatch(/var\(--motion-dur-(press|fast|base|panel)\)/);
      expect(decl).toContain("var(--motion-ease-out)");
      expect(decl).not.toMatch(/\d+ms/);
    }
    expect(css).not.toContain("--cmv2-ease");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("las cascadas tienen tope (≤ 200 ms) y las barras también (≤ 280 ms por fila)", () => {
    const retrasos = [...css.matchAll(/animation-delay: (\d+)ms;/g)].map((m) => Number(m[1]));
    expect(retrasos.length).toBeGreaterThan(0);
    expect(Math.max(...retrasos)).toBeLessThanOrEqual(200);
    expect(css).toContain("min(calc(120ms + var(--cmg-fila, 0) * 20ms), 280ms)");
  });

  it("con movimiento reducido se apaga todo lo que se mueve; el color sigue cruzando", () => {
    const reducido = css.slice(iReducido);
    for (const sel of [".cmg-pestana-cuerpo", ".cmg-memoria-pasos", ".cmg-actores-lista", ".cmg-cadena-n", ".cmg-reparto-rect"]) {
      expect(reducido).toContain(sel);
    }
    expect(reducido).toMatch(/\.cmg-actor:active \{\s*transform: none;/);
    expect(reducido).not.toMatch(/filter var/);
    expect(reducido).toContain("background-color var(--motion-dur-fast) var(--motion-ease-out)");
  });

  it("la animación de las barras ya no vive duplicada en mesa.css", () => {
    const mesa = leer("mesa.css");
    expect(mesa).not.toContain("cmg-reparto-crecer");
    expect(mesa).toMatch(/\.cmg-reparto-fila:hover/);
  });
});
