import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { construirCorte } from "../corte/corteContract";
import { MonitoreoOutputsWorkbench } from "./MonitoreoOutputsWorkbench";

/**
 * Ronda 4 (2026-10-25): la tarjeta del PDF repetía en rojo el mismo bloqueo que
 * ya decía el estado del corte. Decidido: el bloqueo se dice una sola vez, en el
 * estado del corte; el botón del PDF queda deshabilitado con el motivo en su
 * tooltip. El componente es compartido: los tres modos montan y se comportan
 * igual. «Incluir metas» es un interruptor (maqueta Meta B, L26).
 */

const BLOQUEADO = construirCorte({
  ingesta: 2726,
  procesable: 2296,
  oficial: 423,
  meta: 400,
  hasSnapshot: true,
  generationStatus: "stale",
  cutAt: "2026-07-27T09:04:00",
});

const LISTO = construirCorte({
  ingesta: 10,
  procesable: 10,
  oficial: 10,
  meta: 10,
  hasSnapshot: true,
  generationStatus: "complete",
  cutAt: "2026-07-27T09:04:00",
});

function pintar(family: "telefonico" | "acreditacion" | "territorial", corte = BLOQUEADO) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <MonitoreoOutputsWorkbench
        family={family}
        routeLabel="Monitoreo"
        corte={corte}
        variante={family === "telefonico" ? "ficha" : undefined}
      />
    </MemoryRouter>,
  );
}

function ocurrencias(html: string, texto: string) {
  return html.split(texto).length - 1;
}

describe("salidas: el bloqueo se dice una vez", () => {
  for (const family of ["telefonico", "acreditacion", "territorial"] as const) {
    it(`${family}: monta, dice el bloqueo sólo en el estado del corte y lo deja en el tooltip del PDF`, () => {
      const html = pintar(family);
      expect(html).toContain("Estado del corte para publicar");
      expect(html).not.toContain("mon-outputs-alert is-error");
      const motivo = html.match(/mon-outputs-action-motivo" title="([^"]+)"><button[^>]*mon-outputs-primary/);
      expect(motivo?.[1]).toBeTruthy();
      // El texto visible del bloqueo, una vez (en la lista «Qué falta para
      // publicar»); la otra copia es la del lector de pantalla del botón.
      const mensaje = motivo?.[1] ?? "";
      expect(ocurrencias(html, `<span>${mensaje}</span>`)).toBe(1);
      expect(html).toMatch(/<button[^>]*mon-outputs-primary[^>]*disabled=""/);
      expect(html).toContain('aria-describedby="mon-outputs-pdf-motivo"');
      expect(html).toContain('role="switch"');
      expect(html).not.toContain('type="checkbox"');
    });
  }

  it("con el corte listo, el PDF no lleva motivo ni queda deshabilitado", () => {
    const html = pintar("telefonico", LISTO);
    expect(html).not.toContain("mon-outputs-pdf-motivo");
    expect(html).not.toMatch(/<button[^>]*mon-outputs-primary[^>]*disabled=""/);
  });
});
