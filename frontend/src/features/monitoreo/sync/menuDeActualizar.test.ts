import { describe, expect, it } from "vitest";
import type { MonitoreoSource } from "../../../api/monitoreo";
import { planDeActualizar } from "./menuDeActualizar";

const fuente = (id: string, kind: MonitoreoSource["kind"], extra: Partial<MonitoreoSource> = {}): MonitoreoSource => ({
  id, kind, label: id, enabled: true, ...extra,
});

const telefonico = [
  fuente("Universo", "google_sheets", { role: "universo" }),
  fuente("Barrido", "google_sheets", { role: "barrido" }),
  fuente("PDM Kobo", "kobo", { role: "respuestas" }),
];

describe("el control único Actualizar", () => {
  it("el cuerpo trae lo nuevo (avance) y el menú ofrece fuentes, Traer todo de nuevo y Recalcular", () => {
    const plan = planDeActualizar({ fuentes: telefonico, familia: "telefonico" });
    expect(plan.principal.peticion).toEqual({ tipo: "sync", modo: "advance", fuentes: ["Universo", "Barrido", "PDM Kobo"] });
    const claves = plan.menu.map((entrada) => entrada.clave);
    expect(claves).toEqual(["fuente:Universo", "fuente:Barrido", "fuente:PDM Kobo", "grupo:hojas", "todo", "recalcular"]);
    expect(plan.menu.find((e) => e.clave === "todo")?.peticion).toEqual({ tipo: "sync", modo: "full", fuentes: ["Universo", "Barrido", "PDM Kobo"] });
    expect(plan.menu.find((e) => e.clave === "recalcular")?.peticion).toEqual({ tipo: "recalcular" });
  });

  it("cada fuente se trae por el camino que usaba su botón de la franja", () => {
    const plan = planDeActualizar({ fuentes: telefonico, familia: "telefonico" });
    expect(plan.menu.find((e) => e.clave === "fuente:Universo")?.peticion).toEqual({ tipo: "hojas", fuentes: ["Universo"] });
    expect(plan.menu.find((e) => e.clave === "fuente:PDM Kobo")?.peticion).toEqual({ tipo: "sync", modo: "full", fuentes: ["PDM Kobo"] });
    expect(plan.menu.find((e) => e.clave === "fuente:Universo")?.detalle).toBe("Google Sheets · universo");
  });

  it("no queda ningún segundo «Todo»", () => {
    const plan = planDeActualizar({ fuentes: telefonico, familia: "telefonico" });
    const etiquetas = [plan.principal, ...plan.menu].map((e) => e.etiqueta);
    expect(etiquetas).not.toContain("Todo");
    expect(etiquetas.filter((e) => e === "Traer todo de nuevo")).toHaveLength(1);
  });

  it("con varias encuestas ofrece traerlas juntas, como el botón «encuestas» de la franja", () => {
    const acreditacion = [
      fuente("Base", "google_sheets", { role: "universo" }),
      fuente("Egresados", "surveymonkey", { role: "respuestas" }),
      fuente("Docentes", "surveymonkey", { role: "respuestas" }),
    ];
    const plan = planDeActualizar({ fuentes: acreditacion, familia: "acreditacion" });
    const grupo = plan.menu.find((e) => e.clave === "grupo:plataforma");
    expect(grupo?.etiqueta).toBe("Las 2 encuestas");
    expect(grupo?.peticion).toEqual({ tipo: "sync", modo: "full", fuentes: ["Egresados", "Docentes"] });
    expect(plan.menu.some((e) => e.clave === "grupo:hojas")).toBe(false);
  });

  it("sin fuentes de respuesta, el cuerpo lee las activas; sin ninguna, se apaga y dice por qué", () => {
    const soloHojas = planDeActualizar({ fuentes: [fuente("Base", "google_sheets", { role: "supervision" })], familia: "acreditacion" });
    expect(soloHojas.principal.peticion).toEqual({ tipo: "sync", modo: "full", fuentes: ["Base"] });
    const vacio = planDeActualizar({ fuentes: [], familia: "telefonico" });
    expect(vacio.principal.disabled).toBe(true);
    expect(vacio.principal.titulo).toBe("No hay fuentes activas para actualizar.");
    expect(vacio.menu.map((e) => e.clave)).toEqual(["todo", "recalcular"]);
    expect(vacio.menu.find((e) => e.clave === "todo")?.disabled).toBe(true);
  });

  it("deja fuera las inactivas y las ocurrencias de campo", () => {
    const plan = planDeActualizar({
      fuentes: [...telefonico, fuente("Apagada", "kobo", { enabled: false }), fuente("Ocurrencias", "google_sheets", { role: "ocurrencias_campo" })],
      familia: "telefonico",
    });
    expect(plan.menu.some((e) => e.clave === "fuente:Apagada" || e.clave === "fuente:Ocurrencias")).toBe(false);
  });

  it("«Recalcular» dice si hay cambios sin recalcular", () => {
    const plan = planDeActualizar({ fuentes: telefonico, familia: "telefonico", pendienteDeRecalcular: true });
    expect(plan.menu.find((e) => e.clave === "recalcular")?.detalle).toBe("Hay cambios sin recalcular");
  });

  it("todo se apaga mientras la vista carga", () => {
    const plan = planDeActualizar({ fuentes: telefonico, familia: "telefonico", deshabilitado: true });
    expect([plan.principal, ...plan.menu].every((e) => e.disabled)).toBe(true);
  });
});
