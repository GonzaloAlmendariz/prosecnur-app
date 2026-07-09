/**
 * deriveMuestraRecorrido: la etapa "bases" del MuestraFlowDiagram debe leerse
 * como completada tanto si hay un archivo declarado en source_bindings como
 * si ya existe un marco construido (input_rows > 0), aunque no haya binding
 * de archivo — caso de proyectos sembrados por API o marco llegado por otra
 * vía. Sin ninguna de las dos señales, sigue pendiente. Además, el recorrido
 * es secuencial y la derivación monótona: una etapa posterior completa
 * arrastra como completas todas las anteriores (backfill), y el "Estás aquí"
 * apunta a la primera etapa realmente pendiente.
 */
import { describe, expect, it } from "vitest";
import { deriveMuestraRecorrido, type MuestraRecorridoInputs } from "../DefEstudioTab";

const baseInputs: MuestraRecorridoInputs = {
  tituloDefinido: true,
  hasFileBinding: false,
  inputRows: 0,
  variablesListas: false,
  poblacion: 0,
  muestra: 0,
  aulasM1: 0,
};

describe("deriveMuestraRecorrido", () => {
  it("sin binding de archivo y sin marco construido, 'bases' queda pendiente", () => {
    const resultado = deriveMuestraRecorrido(baseInputs);
    expect(resultado.hayBases).toBe(false);
    expect(resultado.estados.bases).toBe("pending");
    expect(resultado.highlight).toBe("bases");
  });

  it("con binding de archivo, 'bases' queda lista", () => {
    const resultado = deriveMuestraRecorrido({ ...baseInputs, hasFileBinding: true });
    expect(resultado.hayBases).toBe(true);
    expect(resultado.estados.bases).toBe("ready");
  });

  it("sin binding pero con marco construido (input_rows > 0), 'bases' queda lista", () => {
    const resultado = deriveMuestraRecorrido({ ...baseInputs, hasFileBinding: false, inputRows: 240 });
    expect(resultado.hayBases).toBe(true);
    expect(resultado.estados.bases).toBe("ready");
  });

  it("con marco construido, el highlight avanza a la siguiente etapa pendiente", () => {
    const resultado = deriveMuestraRecorrido({
      ...baseInputs,
      inputRows: 240,
      variablesListas: false,
    });
    expect(resultado.highlight).toBe("variables");
  });

  it("con marco, variables y marco/N/n/aulas completos, el highlight llega a 'aulas'", () => {
    const resultado = deriveMuestraRecorrido({
      tituloDefinido: true,
      hasFileBinding: false,
      inputRows: 240,
      variablesListas: true,
      poblacion: 200,
      muestra: 132,
      aulasM1: 12,
    });
    expect(resultado.highlight).toBe("aulas");
    expect(resultado.estados).toEqual({
      definir: "ready",
      bases: "ready",
      variables: "ready",
      marco: "ready",
      calcular: "ready",
      aulas: "ready",
    });
  });

  describe("monotonicidad (backfill): una etapa posterior completa arrastra las anteriores", () => {
    it("variables sin señal directa + marco listo → variables done y highlight en 'calcular'", () => {
      // Caso del proyecto sembrado por API: hay N poblacional pero ni binding
      // de archivo ni variable_mappings persistidos.
      const resultado = deriveMuestraRecorrido({
        ...baseInputs,
        inputRows: 240,
        variablesListas: false,
        poblacion: 200,
      });
      expect(resultado.estados.variables).toBe("ready");
      expect(resultado.estados.bases).toBe("ready");
      expect(resultado.highlight).toBe("calcular");
    });

    it("variables pendiente con marco/calcular/aulas listos → todo lo anterior done y pin en 'aulas'", () => {
      const resultado = deriveMuestraRecorrido({
        ...baseInputs,
        inputRows: 240,
        variablesListas: false,
        poblacion: 200,
        muestra: 132,
        aulasM1: 12,
      });
      expect(resultado.estados).toEqual({
        definir: "ready",
        bases: "ready",
        variables: "ready",
        marco: "ready",
        calcular: "ready",
        aulas: "ready",
      });
      expect(resultado.highlight).toBe("aulas");
    });

    it("solo resultado de cálculo (sin marco ni bases) → todo lo anterior done y highlight en 'aulas'", () => {
      const resultado = deriveMuestraRecorrido({
        ...baseInputs,
        tituloDefinido: false,
        muestra: 132,
      });
      expect(resultado.estados).toEqual({
        definir: "ready",
        bases: "ready",
        variables: "ready",
        marco: "ready",
        calcular: "ready",
        aulas: "pending",
      });
      expect(resultado.hayBases).toBe(true);
      expect(resultado.highlight).toBe("aulas");
    });

    it("el backfill no adelanta etapas posteriores: lo pendiente después de la última done sigue pendiente", () => {
      const resultado = deriveMuestraRecorrido({
        ...baseInputs,
        hasFileBinding: true,
        variablesListas: true,
      });
      expect(resultado.estados.marco).toBe("pending");
      expect(resultado.estados.calcular).toBe("pending");
      expect(resultado.estados.aulas).toBe("pending");
      expect(resultado.highlight).toBe("marco");
    });
  });
});
