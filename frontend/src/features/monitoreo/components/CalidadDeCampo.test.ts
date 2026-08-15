import { describe, expect, test } from "vitest";

import type { MonitoreoCalidadCampoAlerta } from "../../../api/monitoreo";
import { agruparPorTipo, rotuloDeTipo, textoDelVacio } from "./CalidadDeCampo";

function alerta(
  tipo: string,
  actor: string,
  severidad = "advertencia",
): MonitoreoCalidadCampoAlerta {
  return { tipo, actor, severidad, mensaje: `${actor} · ${tipo}` };
}

// M6 del GOAL de calidad de campo. Lo que estos contratos defienden no es el
// pixel sino la distinción: un bloque vacío tiene que decir CUÁL de los vacíos
// es, porque «falta declarar quién recolecta» y «el campo está limpio» se ven
// igual y significan lo contrario.

describe("el vacío del bloque se explica", () => {
  test("distingue falta de declaración de campo limpio", () => {
    const sinRol = textoDelVacio("sin_rol_de_agente");
    const limpio = textoDelVacio("sin_hallazgos");

    expect(sinRol).not.toBeNull();
    expect(limpio).not.toBeNull();
    expect(sinRol?.titulo).not.toBe(limpio?.titulo);
    // Y el que se puede resolver dice dónde se resuelve.
    expect(sinRol?.detalle).toContain("Validación");
  });

  test("los cuatro motivos del backend tienen texto", () => {
    // Si el backend suma un motivo y acá no se traduce, el bloque se queda mudo
    // justo cuando tenía algo que explicar.
    for (const motivo of [
      "sin_datos",
      "sin_rol_de_agente",
      "sin_llaves_de_identidad",
      "sin_hallazgos",
    ]) {
      expect(textoDelVacio(motivo), motivo).not.toBeNull();
    }
  });

  test("un motivo desconocido no inventa una explicación", () => {
    expect(textoDelVacio("algo_que_no_existe")).toBeNull();
  });
});

describe("tres casos del mismo problema son un problema", () => {
  test("agrupa por tipo sin perder ningún caso", () => {
    // Medido en un proyecto real: 3 variantes del nombre del encuestador
    // ocupaban 300 px encima del gráfico de avance. Son un problema, no tres.
    const grupos = agruparPorTipo([
      alerta("identidad_agente", "Mary"),
      alerta("identidad_agente", "JORGE DE SOLAR"),
      alerta("identidad_agente", "957130752"),
      alerta("cruce_identidad", "Silbia"),
    ]);
    expect(grupos.map((g) => g.tipo)).toEqual(["identidad_agente", "cruce_identidad"]);
    expect(grupos[0].items).toHaveLength(3);
    expect(grupos.flatMap((g) => g.items)).toHaveLength(4);
  });

  test("respeta el orden del backend, que ya puso lo bloqueante primero", () => {
    const grupos = agruparPorTipo([
      alerta("formulario_desactualizado", "Mary Berrocal", "bloqueante"),
      alerta("identidad_agente", "Mary"),
    ]);
    expect(grupos[0].tipo).toBe("formulario_desactualizado");
    expect(grupos[0].severidad).toBe("bloqueante");
  });

  test("un caso bloqueante tiñe a su grupo aunque el resto no lo sea", () => {
    // Si el grupo se quedara con la severidad del primero, un aviso irreversible
    // se leería como una advertencia más.
    const grupos = agruparPorTipo([
      alerta("formulario_desactualizado", "Luis"),
      alerta("formulario_desactualizado", "Rosa", "bloqueante"),
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].severidad).toBe("bloqueante");
  });
});

describe("cada señal se nombra por lo que es", () => {
  test("los seis tipos tienen rótulo propio", () => {
    const tipos = [
      "formulario_desactualizado",
      "identidad_agente",
      "envio_sin_padron",
      "padron_sin_envio",
      "cruce_identidad",
      "abierta_sin_contenido",
    ];
    const rotulos = tipos.map(rotuloDeTipo);
    expect(new Set(rotulos).size).toBe(tipos.length);
    expect(rotulos.every((r) => r.length > 0)).toBe(true);
  });

  test("ningún rótulo repite una alerta de avance", () => {
    // M6: mezclarlas haría que una brecha de cuota y un formulario
    // desactualizado se lean igual.
    const avance = ["Brecha relevante", "Brecha menor", "Sin meta"];
    for (const tipo of ["formulario_desactualizado", "cruce_identidad"]) {
      expect(avance).not.toContain(rotuloDeTipo(tipo));
    }
  });
});
