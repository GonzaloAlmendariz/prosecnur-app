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

/** Nombre de la base abierta en el inspector de Bases, o null si no hay inspector. */
function baseInspeccionada(): string | null {
  return document.getElementById("pulso-bases-inspector")?.getAttribute("aria-label") ?? null;
}

describe("CargaPage, navegación entre pestañas", () => {
  escenario("navegacion_una-base_ida-y-vuelta", "una base: recorre las pestañas desde el riel sin remontar la página", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana: "bases", rutas: rutasDeRevision(false) });
    const pasos = [mesa()];
    await pulsar("button.pulso-bases-tarjeta-abrir");
    expect(baseInspeccionada()).toBe("Detalle de Base única");
    await pulsar("#carga-workspace-tab-revision");
    pasos.push(mesa());
    await pulsar("#carga-workspace-tab-bases");
    pasos.push(mesa());
    // La base enfocada vive en la dirección (`foco`): al volver sigue abierta.
    expect(baseInspeccionada()).toBe("Detalle de Base única");
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
