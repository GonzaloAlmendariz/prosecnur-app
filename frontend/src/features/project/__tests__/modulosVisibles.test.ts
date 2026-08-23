import { describe, expect, it } from "vitest";
import { modulosVisibles } from "../ProjectModulesContext";
import type { ProjectOverview } from "../../../api/overview";

/**
 * Un módulo con trabajo dentro no puede faltar en la pantalla de inicio.
 *
 * Medido en HSVG2026 el 2026-08-23: el backend declaraba `recopiladores` y
 * `monitoreo` en estado «ready», con su evidencia —«Agenda de aulas», «Plan
 * desde Cálculo de muestra»— sobre un plan de 193 titulares y 2.616 unidades. El
 * homepage enseñaba DOS tarjetas: Cálculo de muestra y Formularios. Quien abría
 * el proyecto no veía que ya había un plan de recolección ni un monitoreo
 * declarado.
 *
 * La causa: la lista curada sustituía por completo a la derivada del avance, así
 * que un proyecto que la curó antes de hacer ese trabajo no se entera nunca.
 */

const overview = (estados: Record<string, string>): ProjectOverview => ({
  maturity: { level: "draft" },
  modules: Object.entries(estados).map(([id, state]) => ({ id, state })),
} as unknown as ProjectOverview);

describe("modulosVisibles", () => {
  it("enseña el módulo con trabajo aunque la curación no lo incluya", () => {
    // El caso medido, exacto.
    const visto = modulosVisibles(
      ["calc-muestra", "editor-xlsform"],
      overview({
        "calc-muestra": "ready",
        "editor-xlsform": "ready",
        recopiladores: "ready",
        monitoreo: "ready",
      }),
    );
    expect(visto).toContain("recopiladores");
    expect(visto).toContain("monitoreo");
  });

  it("respeta la curación para lo que está vacío", () => {
    // Quitar de la vista un módulo que no se usa es justo para lo que existe:
    // si `hojas-ruta` está pendiente y nadie lo curó, no aparece.
    const visto = modulosVisibles(
      ["calc-muestra"],
      overview({ "calc-muestra": "ready", "hojas-ruta": "pending", dashboard: "pending" }),
    );
    expect(visto).toEqual(["calc-muestra"]);
  });

  it("no duplica un módulo que está en las dos listas", () => {
    const visto = modulosVisibles(
      ["calc-muestra", "recopiladores"],
      overview({ "calc-muestra": "ready", recopiladores: "ready" }),
    );
    expect(visto.filter((s) => s === "recopiladores")).toHaveLength(1);
  });

  it("mantiene el orden canónico, no el de llegada", () => {
    // La curación puede venir en cualquier orden; la barra y las tarjetas se
    // leen siempre en el orden del recorrido del estudio.
    const visto = modulosVisibles(
      ["monitoreo", "calc-muestra"],
      overview({ "calc-muestra": "ready", monitoreo: "ready" }),
    );
    expect(visto.indexOf("calc-muestra")).toBeLessThan(visto.indexOf("monitoreo"));
  });

  it("sin curación, deriva del avance", () => {
    const visto = modulosVisibles(
      null,
      overview({ "calc-muestra": "ready", recopiladores: "pending" }),
    );
    expect(visto).toEqual(["calc-muestra"]);
  });

  it("sin overview no inventa módulos, y conserva lo curado", () => {
    // Mientras carga el proyecto: enseñar la curación es mejor que parpadear a
    // vacío, y derivar sin datos seria inventarse el estado.
    expect(modulosVisibles(["calc-muestra"], null)).toEqual(["calc-muestra"]);
    expect(modulosVisibles(null, null)).toEqual([]);
  });
});

describe("modulosVisibles · lo que NO puede colarse", () => {
  it("no reabre un módulo vacío que su dueño había quitado", () => {
    // `deriveDefaultAdded` abre la bitácora cuando el estudio está en marcha,
    // aunque no tenga ni una entrada. Eso es correcto para un proyecto sin
    // curar y no para uno que ya decidió qué ver: medido en pantalla, la unión
    // a secas colaba una tarjeta «Bitácora · Sin actividad».
    const enMarcha = {
      maturity: { level: "in_progress" },
      modules: [
        { id: "calc-muestra", state: "ready" },
        { id: "plan-trabajo", state: "pending" },
        { id: "recopiladores", state: "ready" },
      ],
    } as unknown as ProjectOverview;
    const visto = modulosVisibles(["calc-muestra"], enMarcha);
    expect(visto).toContain("recopiladores");
    expect(visto).not.toContain("diseno-estudio");
  });

  it("pero sin curación sí lo abre, que es el default de un proyecto nuevo", () => {
    const enMarcha = {
      maturity: { level: "in_progress" },
      modules: [{ id: "plan-trabajo", state: "pending" }],
    } as unknown as ProjectOverview;
    expect(modulosVisibles(null, enMarcha)).toContain("diseno-estudio");
  });

  it("Procesamiento cuenta como trabajo si CUALQUIERA de sus etapas lo tiene", () => {
    // Es el único módulo cuyo estado no vive en una sola entrada.
    const conCarga = {
      maturity: { level: "draft" },
      modules: [{ id: "carga", state: "ready" }, { id: "validacion", state: "pending" }],
    } as unknown as ProjectOverview;
    expect(modulosVisibles(["calc-muestra"], conCarga)).toContain("procesamiento");
  });
});
