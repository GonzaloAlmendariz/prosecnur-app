import { describe, expect, it } from "vitest";

import type { MonitoreoSource } from "../../../api/client";
import { guionConEstado, guionDeConexion, piezaPorLaQueSeguir } from "./guionDeConexion";

// El panel de conectar fuente preguntaba «Google Sheets / Kobo / SurveyMonkey»
// para cualquier estudio. Medido en `acnur_pdm` (family telefónico): ofrecía
// SurveyMonkey —que ese modo no usa— con el mismo peso que las otras dos, y
// preseleccionaba «Universo» cuando lo que ordena el estudio es el barrido.

const fuente = (over: Partial<MonitoreoSource>): MonitoreoSource => ({
  id: over.id ?? "s1",
  kind: over.kind ?? "google_sheets",
  label: over.label ?? "Fuente",
  enabled: over.enabled ?? true,
  role: over.role,
  dimensions: over.dimensions,
} as MonitoreoSource);

describe("cada modo declara sus piezas, no una lista de proveedores", () => {
  it("telefónico ordena barrido, universo y encuesta", () => {
    // El orden es la dependencia: sin barrido el padrón es una lista de
    // teléfonos sin operación.
    expect(guionDeConexion("telefonico").piezas.map((p) => p.papel)).toEqual([
      "barrido",
      "universo",
      "respuestas",
    ]);
  });

  it("telefónico no ofrece SurveyMonkey en ninguna pieza", () => {
    const servicios = guionDeConexion("telefonico").piezas.flatMap((p) => p.servicios);
    expect(servicios).not.toContain("surveymonkey");
  });

  it("una hoja de barrido no pregunta el proveedor", () => {
    // Con un solo servicio posible no hay decisión, y el paso desaparece.
    const barrido = guionDeConexion("telefonico").piezas.find((p) => p.papel === "barrido")!;
    expect(barrido.servicios).toEqual(["google_sheets"]);
  });

  it("acreditación reparte sus piezas por actor y telefónico no", () => {
    expect(guionDeConexion("acreditacion").piezas.every((p) => p.porActor)).toBe(true);
    expect(guionDeConexion("telefonico").piezas.some((p) => p.porActor)).toBe(false);
  });

  it("acreditación empieza por los instrumentos", () => {
    expect(guionDeConexion("acreditacion").piezas[0].papel).toBe("respuestas");
  });

  it("las respuestas de acreditación sí admiten elegir entre dos plataformas", () => {
    const respuestas = guionDeConexion("acreditacion").piezas[0];
    expect(respuestas.servicios).toEqual(["surveymonkey", "kobo"]);
  });

  it("una familia desconocida cae en el guion genérico en vez de romperse", () => {
    expect(guionDeConexion(undefined).familia).toBe("digital_general");
    expect(guionDeConexion("lo-que-sea").piezas.length).toBeGreaterThan(0);
  });
});

describe("el guion se lee con el estado real del estudio encima", () => {
  it("una fuente conectada pero apagada no pone lista su pieza", () => {
    const { piezas } = guionConEstado("telefonico", [
      fuente({ id: "e", kind: "kobo", role: "respuestas", enabled: false }),
    ]);
    expect(piezas.find((p) => p.papel === "respuestas")!.lista).toBe(false);
  });

  it("en telefónico el barrido cubre el universo cuando es la misma hoja", () => {
    // Regla de dominio, no atajo: muchos estudios telefónicos llevan las dos
    // cosas en una sola hoja —cada fila es una persona con su estado de llamada
    // al lado— y el motor ya lo resuelve así. Sin esto el panel pedía conectar
    // un padrón que el estudio ya tenía, contradiciendo a la pantalla de al lado.
    const { piezas } = guionConEstado("telefonico", [fuente({ id: "b", role: "barrido" })]);
    const universo = piezas.find((p) => p.papel === "universo")!;
    expect(universo.lista).toBe(true);
    expect(universo.cubiertaCon).toBe("Hoja de barrido");
  });

  it("sin barrido el universo sigue faltando", () => {
    const { piezas } = guionConEstado("telefonico", []);
    const universo = piezas.find((p) => p.papel === "universo")!;
    expect(universo.lista).toBe(false);
    expect(universo.cubiertaCon).toBe("");
  });

  it("en acreditación ninguna pieza cubre a otra", () => {
    // Un padrón no se deduce de una encuesta: son universos distintos.
    const { piezas } = guionConEstado("acreditacion", [
      fuente({ id: "e", kind: "surveymonkey", role: "respuestas", dimensions: { actor: "Docentes" } }),
    ]);
    expect(piezas.find((p) => p.papel === "universo")!.lista).toBe(false);
  });

  it("en acreditación lista los actores que ya tienen cada pieza", () => {
    const { piezas } = guionConEstado("acreditacion", [
      fuente({ id: "e1", kind: "surveymonkey", role: "respuestas", dimensions: { actor: "Docentes" } }),
      fuente({ id: "e2", kind: "surveymonkey", role: "respuestas", dimensions: { actor: "Egresados" } }),
    ]);
    expect(piezas[0].actores).toEqual(["Docentes", "Egresados"]);
  });
});

describe("piezaPorLaQueSeguir", () => {
  it("en telefónico manda al barrido antes que al padrón", () => {
    const { piezas } = guionConEstado("telefonico", []);
    expect(piezaPorLaQueSeguir(piezas)?.papel).toBe("barrido");
  });

  it("con el barrido puesto salta al universo sólo si no lo cubre", () => {
    // Con el barrido conectado el universo queda cubierto, así que lo que falta
    // de verdad es la encuesta. Mandar al padrón sería mandar a rehacer algo.
    const conBarrido = guionConEstado("telefonico", [fuente({ role: "barrido" })]);
    expect(piezaPorLaQueSeguir(conBarrido.piezas)?.papel).toBe("respuestas");

    const soloEncuesta = guionConEstado("telefonico", [fuente({ kind: "kobo", role: "respuestas" })]);
    expect(piezaPorLaQueSeguir(soloEncuesta.piezas)?.papel).toBe("barrido");
  });

  it("en acreditación con todo conectado sigue habiendo actor que sumar", () => {
    // Una pieza repartida por actor nunca está terminada: siempre puede entrar
    // otro, y ese es el caso que trae a alguien al panel.
    const { piezas } = guionConEstado("acreditacion", [
      fuente({ id: "e", kind: "surveymonkey", role: "respuestas", dimensions: { actor: "Docentes" } }),
      fuente({ id: "u", role: "universo", dimensions: { actor: "Docentes" } }),
    ]);
    expect(piezas.every((p) => p.lista)).toBe(true);
    expect(piezaPorLaQueSeguir(piezas)?.papel).toBe("respuestas");
  });
});
