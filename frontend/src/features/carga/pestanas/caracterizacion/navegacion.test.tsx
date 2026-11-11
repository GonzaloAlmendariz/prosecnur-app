// @vitest-environment happy-dom
/**
 * Caracterización de Carga: grupo "navegacion". Ver arnes.tsx.
 *
 * Mide solo el riel de pestañas y la cabecera tras cada paso del recorrido (no
 * el cuerpo ni los pedidos), para que rediseñar una pestaña no ponga en rojo
 * estas huellas.
 */
import { describe, expect } from "vitest";
import {
  ORIGEN,
  UNA_BASE_COMPLETA,
  VARIAS_SEPARADAS,
  escenario,
  fijarMesa,
  mesa,
  montar,
  prepararGrupo,
  pulsar,
  rutasDeRevision,
} from "./arnes";

prepararGrupo("navegacion");

/** Texto del origen de carga marcado (radio con aria-checked), o null si ninguno. */
function origenElegido(): string | null {
  const marcado = document.querySelector(`${ORIGEN}[aria-checked="true"]`);
  return marcado ? (marcado.textContent ?? "").trim() : null;
}

describe("CargaPage, navegación entre pestañas", () => {
  escenario("navegacion_una-base_ida-y-vuelta", "una base: recorre las pestañas desde el riel sin remontar la página", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana: "bases", rutas: rutasDeRevision(false) });
    const pasos = [mesa()];
    await pulsar(ORIGEN, "Plataforma");
    expect(origenElegido()).toBe("Plataforma");
    await pulsar("#carga-workspace-tab-revision");
    pasos.push(mesa());
    await pulsar("#carga-workspace-tab-bases");
    pasos.push(mesa());
    // El origen elegido vive en la página: debe seguir en Plataforma al volver.
    expect(origenElegido()).toBe("Plataforma");
    fijarMesa("navegacion_una-base_ida-y-vuelta", pasos);
  });

  escenario("navegacion_varias_recorrido", "varias bases: recorre las pestañas desde el riel", async () => {
    await montar({ ...VARIAS_SEPARADAS, pestana: "bases", rutas: rutasDeRevision(false) });
    const pasos = [mesa()];
    for (const pestana of ["revision", "variables", "equivalencias", "formulario", "respuestas"]) {
      await pulsar(`#carga-workspace-tab-${pestana}`);
      expect(document.querySelector(`#carga-workspace-tab-${pestana}`)?.getAttribute("aria-selected")).toBe("true");
      pasos.push(mesa());
    }
    fijarMesa("navegacion_varias_recorrido", pasos);
  });
});
