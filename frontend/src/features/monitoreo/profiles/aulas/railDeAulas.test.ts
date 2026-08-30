import { describe, expect, it } from "vitest";

import type { MonitoreoAulasDashboard } from "../../../../api/monitoreo";
import { railDeAulas } from "./railDeAulas";

/**
 * **Un badge es un número desnudo al lado de una etiqueta.**
 *
 * El de «Reemplazos» contaba `dashboard.reemplazos.length`, que trae el plan
 * entero sin banco —titulares y sus reservas, movidas o no—. Medido sobre
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
