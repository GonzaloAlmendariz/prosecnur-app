/**
 * E13 · cierre del loop — D1 y D3 del checklist 2026-09-24.
 *
 * D1: el tooltip del reparto se cerraba solo cuando el foco desplazaba el
 * dueño de scroll (el tooltip compartido cierra en todo scroll). Mientras la
 * barra tenga el foco, debe seguir abierto sobre su geometría nueva.
 *
 * D3: a 1024 × 600 la fila de estado + siguiente condición caía bajo el
 * título. En compacto va en la línea del título, con el texto recortado a una
 * línea pero entero en el DOM y en `title`.
 */
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { EstadoMesa } from "../bandaDisenoModelo";
import { EncabezadoSeccion } from "../EncabezadoSeccion";
import { sostenerTooltipEnFoco, type ObjetivoScroll, type ProgramadorFrame } from "../repartoEstratos";

/**
 * `window` de mentira con listeners en orden de registro. No se usa el
 * `EventTarget` de Node: ignora la captura booleana al quitar un listener
 * (medido), cosa que el navegador sí respeta.
 */
function ventanaFalsa(): ObjetivoScroll & { scroll: () => void } {
  const oyentes: Array<() => void> = [];
  return {
    addEventListener: (_tipo, fn) => {
      oyentes.push(fn);
    },
    removeEventListener: (_tipo, fn) => {
      const i = oyentes.indexOf(fn);
      if (i >= 0) oyentes.splice(i, 1);
    },
    scroll: () => [...oyentes].forEach((fn) => fn()),
  };
}

/** Frames manuales: se corren cuando el test lo dice, como el navegador. */
function frames(): ProgramadorFrame & { correr: () => void } {
  const cola = new Map<number, () => void>();
  let siguiente = 1;
  return {
    pedir: (fn) => {
      const id = siguiente++;
      cola.set(id, fn);
      return id;
    },
    cancelar: (id) => {
      cola.delete(id);
    },
    correr: () => {
      const pendientes = [...cola.values()];
      cola.clear();
      pendientes.forEach((fn) => fn());
    },
  };
}

type Barra = { nombre: string; top: number };

/**
 * Monta el escenario: `window` falso, el tooltip compartido que se
 * cierra en todo scroll (como `useTooltipGrafico`) y el sostén del gráfico.
 * `sostenPrimero` fija el orden de registro de los dos listeners de captura.
 */
function escenario(sostenPrimero: boolean) {
  const ventana = ventanaFalsa();
  const reloj = frames();
  const barra: Barra = { nombre: "Cayma", top: 400 };
  let foco: Barra | null = barra;
  let escapado = false;
  let tooltip: { barra: string; y: number } | null = null;
  const abrir = (b: Barra) => {
    tooltip = { barra: b.nombre, y: b.top };
  };
  const cerrarEnScroll = () => {
    tooltip = null;
  };
  const sostener = () =>
    sostenerTooltipEnFoco<Barra>({
      objetivo: ventana,
      enfocada: () => (escapado ? null : foco),
      reabrir: abrir,
      frame: reloj,
    });
  let soltar: () => void;
  if (sostenPrimero) {
    soltar = sostener();
    ventana.addEventListener("scroll", cerrarEnScroll, true);
  } else {
    ventana.addEventListener("scroll", cerrarEnScroll, true);
    soltar = sostener();
  }
  return {
    barra,
    reloj,
    abrir: () => abrir(barra),
    scroll: (nuevoTop: number) => {
      barra.top = nuevoTop;
      ventana.scroll();
    },
    tooltip: () => tooltip,
    blur: () => {
      foco = null;
      tooltip = null;
    },
    escape: () => {
      escapado = true;
      tooltip = null;
    },
    soltar: () => soltar(),
  };
}

describe("D1 · el tooltip sigue abierto mientras la barra tiene el foco", () => {
  it.each([true, false])("foco + scroll: se reabre sobre la geometría nueva (sostén registrado primero: %s)", (primero) => {
    const e = escenario(primero);
    e.abrir();
    expect(e.tooltip()).toEqual({ barra: "Cayma", y: 400 });

    e.scroll(180);
    e.reloj.correr();
    expect(e.tooltip()).toEqual({ barra: "Cayma", y: 180 });

    // Un scroll continuo (varios eventos en el mismo frame) reabre una vez.
    e.scroll(170);
    e.scroll(160);
    e.reloj.correr();
    expect(e.tooltip()).toEqual({ barra: "Cayma", y: 160 });
  });

  it("sin foco en una barra el scroll lo cierra, como antes", () => {
    const e = escenario(true);
    e.abrir();
    e.blur();
    e.abrir();
    e.scroll(100);
    e.reloj.correr();
    expect(e.tooltip()).toBeNull();
  });

  it("Escape lo cierra y un scroll posterior no lo reabre", () => {
    const e = escenario(true);
    e.abrir();
    e.escape();
    e.scroll(100);
    e.reloj.correr();
    expect(e.tooltip()).toBeNull();
  });

  it("al desmontar deja de escuchar y cancela el frame pendiente", () => {
    const e = escenario(true);
    e.abrir();
    e.scroll(100);
    e.soltar();
    e.reloj.correr();
    expect(e.tooltip()).toBeNull();
    e.abrir();
    e.scroll(50);
    e.reloj.correr();
    expect(e.tooltip()).toBeNull();
  });

  it("el componente conecta el sostén con el foco real y no con el mouse", () => {
    const fuente = fs.readFileSync(path.join(__dirname, "..", "RepartoEstratosGrafico.tsx"), "utf8");
    expect(fuente).toContain("sostenerTooltipEnFoco<HTMLElement>");
    expect(fuente).toContain("document.activeElement");
    expect(fuente).toContain("ref={filasRef}");
  });
});

const ESTADO: EstadoMesa = {
  clave: "sin-memoria",
  tono: "alerta",
  etiqueta: "Falta la memoria",
  siguiente: "Recalcula para registrar la memoria de cálculo de los tres actores con su precisión",
  accion: { tipo: "calcular", etiqueta: "Recalcular" },
};

describe("D3 · estado y siguiente condición en la línea del título (compacto)", () => {
  it("el texto de la siguiente condición queda entero en el DOM y en title", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <EncabezadoSeccion modo="marco_disponible" seccion="metodo" estado={ESTADO} onCalcular={() => undefined} />
      </MemoryRouter>,
    );
    expect(html).toContain(`title="${ESTADO.siguiente}"`);
    expect(html).toContain(`<span class="cmg-siguiente-valor">${ESTADO.siguiente}</span>`);
    expect(html).toContain('role="status"');
    expect(html).toContain("Recalcular");
  });

  it("en compacto el título no cede, la fila no se parte y el texto se recorta a una línea", () => {
    const css = fs.readFileSync(path.join(__dirname, "..", "mesa.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const compacto = css.slice(css.indexOf("@media (max-width: 1100px), (max-height: 800px)"));
    const regla = (selector: string) => {
      const i = compacto.indexOf(`${selector} {`);
      return i < 0 ? "" : compacto.slice(i, compacto.indexOf("}", i));
    };
    expect(regla(".cmg-encabezado-id")).toContain("flex: 0 0 auto");
    expect(regla(".cmg-siguiente")).toMatch(/flex: 1 1 \d+px;[\s\S]*flex-wrap: nowrap/);
    expect(regla(".cmg-siguiente-estado")).toContain("flex-wrap: nowrap");
    const valor = regla(".cmg-siguiente-valor");
    expect(valor).toContain("text-overflow: ellipsis");
    expect(valor).toContain("white-space: nowrap");
    expect(valor).toContain("min-width: 0");
    // El encabezado sigue pudiendo partirse si ni recortado cabe.
    expect(css.slice(css.indexOf(".cmg-encabezado {"), css.indexOf("}", css.indexOf(".cmg-encabezado {")))).toContain("flex-wrap: wrap");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
