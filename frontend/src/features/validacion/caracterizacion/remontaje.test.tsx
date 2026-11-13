// @vitest-environment happy-dom
/**
 * Remontaje de la pestaña de Validación (ítem 46 del checklist).
 *
 * Al abrir el proyecto la base activa llega después del primer render; la
 * pestaña no debe montarse con base nula y volver a montarse al resolverla,
 * porque quien ya escribía una regla perdería el borrador. Cambiar de base,
 * en cambio, sí remonta.
 */
import { act } from "react";
import { describe, expect, it } from "vitest";
import { EN_VUELO, asentar, montar, prepararGrupo } from "./arnes";
import { DOS_BASES, RUTAS_EXPLORAR, UNA_BASE, base, estudio, limpieza, rutasLimpieza } from "./escenarios";
import { useValidacionStore } from "../store";

prepararGrupo("remontaje");

const RUTAS = [...RUTAS_EXPLORAR, ...rutasLimpieza(limpieza({ auditoria: false }))];

/** Cuenta cuántos cuerpos de pestaña distintos llegan a existir. */
function contarMontajes() {
  const nodos = new Set<Node>();
  const ver = () => document.querySelectorAll(".pulso-validacion-panel-body").forEach((n) => nodos.add(n));
  const observador = new MutationObserver(ver);
  observador.observe(document.body, { childList: true, subtree: true });
  return { total: () => { ver(); return nodos.size; }, parar: () => observador.disconnect() };
}

describe("Validación, remontaje de la pestaña", () => {
  it("la base que llega tras el primer render no remonta la pestaña ni borra el estado local", async () => {
    const cuenta = contarMontajes();
    await montar({ ...UNA_BASE, pestana: "explorar", rutas: RUTAS });
    expect(useValidacionStore.getState().baseNombre).toBe("default");
    const cuerpo = document.querySelector(".pulso-validacion-panel-body");
    expect(cuerpo).not.toBeNull();
    cuerpo?.setAttribute("data-marca", "borrador");
    await asentar(20);
    expect(document.querySelector(".pulso-validacion-panel-body")?.getAttribute("data-marca")).toBe("borrador");
    expect(cuenta.total()).toBe(1);
    cuenta.parar();
  });

  it("mientras el estudio no responde no se monta ninguna pestaña", async () => {
    await montar({ ...UNA_BASE, pestana: "explorar", rutas: RUTAS, estudio: EN_VUELO });
    expect(document.querySelector(".pulso-validacion-panel-body")).toBeNull();
    expect(document.querySelector("#validacion-panel [role=status]")).not.toBeNull();
  });

  it("cambiar de base sí remonta la pestaña", async () => {
    let activa = "estudiantes";
    const respuesta = () => estudio([base("docentes"), base("estudiantes")], { active_base: activa });
    await montar({ ...DOS_BASES, pestana: "explorar", rutas: [["GET", "/api/estudio", respuesta], ...RUTAS] });
    const antes = document.querySelector(".pulso-validacion-panel-body");
    expect(antes).not.toBeNull();
    activa = "docentes";
    await act(async () => {
      window.dispatchEvent(new CustomEvent("pulso:active-base-changed", { detail: { active: "docentes" } }));
    });
    await asentar(20);
    expect(useValidacionStore.getState().baseNombre).toBe("docentes");
    expect(document.querySelector(".pulso-validacion-panel-body")).not.toBe(antes);
  });
});
