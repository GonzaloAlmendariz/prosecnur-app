import { readFileSync } from "node:fs";

import { MONITOREO_PESTANAS } from "../../../../lib/navegacion/catalogos/monitoreo";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasDashboard } from "../../../../api/monitoreo";
import { railDeAulas } from "./railDeAulas";

/**
 * **Un badge es un número desnudo al lado de una etiqueta.**
 *
 * El de «Reemplazos» contaba `dashboard.reemplazos.length`, que trae el plan
 * entero sin la reserva adicional —titulares y sus reservas, movidas o
 * no—. Medido sobre
 * HSVG2026 «como 2025»: decía **1.347** y los reemplazos que de verdad
 * ocurrieron son **18**. La intención estaba escrita en el propio comentario del
 * código, «Pendiente = cadenas movidas», y la cuenta decía otra cosa.
 */
const dashboard = (reemplazos: Array<Record<string, unknown>>) =>
  ({ kpis: {}, reemplazos } as unknown as MonitoreoAulasDashboard);

const badgeDe = (d: MonitoreoAulasDashboard, key: string) =>
  railDeAulas("consultas", d).find((p) => p.key === key)?.badge;

describe("el badge de Reemplazos cuenta cadenas movidas", () => {
  it("no cuenta las filas de la lista, que son el plan entero", () => {
    // Dos movidas entre cinco filas: tres son reservas dormidas y titulares que
    // nunca se tocaron, y en la lista están igual.
    const d = dashboard([
      { sample_status: "reemplazada" },
      { sample_status: "reemplazada" },
      { sample_status: "en_reserva" },
      { sample_status: "agendada" },
      { sample_status: "sin_contactar" },
    ]);
    expect(badgeDe(d, "reemplazos")).toBe("2");
  });

  it("sin ninguna movida no hay nada que revisar", () => {
    const d = dashboard([
      { sample_status: "en_reserva" }, { sample_status: "agendada" },
    ]);
    const tab = railDeAulas("consultas", d).find((p) => p.key === "reemplazos");
    expect(tab?.badge).toBeUndefined();
    expect(tab?.estado).toBe("listo");
  });

  it("«reagendada» no es «reemplazada»: sólo cuenta el prefijo exacto", () => {
    // Se compara por prefijo porque el estado puede traer sufijos, pero un
    // estado distinto que empiece parecido no puede colarse.
    const d = dashboard([
      { sample_status: "reemplazada por caída" },
      { sample_status: "reagendada" },
    ]);
    expect(badgeDe(d, "reemplazos")).toBe("1");
  });
});

describe("el badge de Registro cuenta lo que espera parte", () => {
  /**
   * `total_aulas` cuenta el plan sin la reserva adicional: titulares **más** sus reservas
   * encadenadas. Una reserva dormida no espera ningún parte —sólo sale a campo
   * si cae su titular—, así que el badge decía 1.195 sobre HSVG2026 «como 2025»
   * donde faltan 22.
   *
   * Tercera superficie con este mismo universo: ya pasó en el pronóstico de
   * cierre y en el resumen que va al cliente.
   */
  const conKpis = (kpis: Record<string, number>) =>
    railDeAulas("calidad", { kpis } as unknown as MonitoreoAulasDashboard)
      .find((p) => p.key === "registro")?.badge;

  it("el universo son los titulares, no el plan con sus reservas", () => {
    expect(conKpis({ total_aulas: 1347, aulas_titulares: 174, aulas_aplicadas: 152 })).toBe("22");
  });

  it("sin `aulas_titulares` cae al plan sin la reserva adicional: la conducta anterior", () => {
    // Un payload viejo no trae el KPI; publicar cero pendientes sería peor.
    expect(conKpis({ total_aulas: 1347, aulas_aplicadas: 152 })).toBe("1195");
  });

  it("con todo aplicado no hay badge", () => {
    expect(conKpis({ total_aulas: 1347, aulas_titulares: 174, aulas_aplicadas: 174 })).toBeUndefined();
  });
});

describe("todas las ramas del rail apuntan a una pestaña que existe", () => {
  /**
   * `modelo/registro` no existía: la pestaña se declara como
   * `calidad/registro`, así que la medida estaba escrita —con su comentario y
   * su intención— y no casaba nunca. «Registro de campo» salía sin badge.
   *
   * El guard mira la fuente porque una rama muerta no se ve de otra forma: no
   * rompe el typecheck, no rompe ningún test y en pantalla sólo falta un número
   * que nadie echa de menos.
   */
  it("ninguna rama nombra una sección/pestaña que el catálogo no declare", () => {
    const fuente = readFileSync(new URL("./railDeAulas.ts", import.meta.url), "utf8");
    const declaradas = [...fuente.matchAll(/seccion === "([a-z]+)" && key === "([a-z-]+)"/g)]
      .map((m) => `${m[1]}/${m[2]}`);
    expect(declaradas.length).toBeGreaterThan(0);
    const reales = new Set(
      Object.entries(MONITOREO_PESTANAS.aulas as Record<string, ReadonlyArray<{ key: string }>>)
        .flatMap(([seccion, pestanas]) => pestanas.map((p) => `${seccion}/${p.key}`)),
    );
    const muertas = declaradas.filter((d) => !reales.has(d));
    expect(muertas, `ramas que no casan con ninguna pestaña: ${muertas.join(", ")}`).toEqual([]);
  });
});

/**
 * Meta B, L21: mientras el proyecto se lee no hay tablero, y con `brechas` y
 * `reemplazos` en cero Resumen, Reemplazos y Brechas se declaraban «listo»
 * encima de «Preparando vista».
 */
describe("sin tablero el rail no mide", () => {
  it("ninguna pestaña publica estado ni contador mientras carga", () => {
    for (const seccion of ["modelo", "calidad", "consultas", "avance"]) {
      for (const pestana of railDeAulas(seccion, null)) {
        expect(pestana.estado, `${seccion}/${pestana.key}`).toBeUndefined();
        expect(pestana.badge, `${seccion}/${pestana.key}`).toBeUndefined();
      }
    }
  });

  it("con tablero vacío sí mide: el cero ya es un conteo", () => {
    const d = { kpis: {}, brechas: [], reemplazos: [] } as unknown as MonitoreoAulasDashboard;
    expect(railDeAulas("avance", d).find((p) => p.key === "resumen")?.estado).toBe("listo");
  });
});
