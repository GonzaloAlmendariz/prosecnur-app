import { describe, expect, test } from "vitest";
import type { ComparativoAviso } from "../../../api/analitica";
import { gruposDeAvisos, severidadDeAviso } from "./comparativosAvisosModel";

function aviso(p: Partial<ComparativoAviso> & Pick<ComparativoAviso, "tipoOriginal">): ComparativoAviso {
  const tipo = p.tipo ?? (p.tipoOriginal as ComparativoAviso["tipo"]);
  return { mensaje: `m ${p.tipoOriginal} ${p.fila ?? ""} ${p.base ?? ""}`, ...p, tipo };
}

describe("avisos del comparativo agrupados (P-A4)", () => {
  test("severidad: lo esperado es informativo; lo que cambia denominadores, advertencia", () => {
    expect(severidadDeAviso(aviso({ tipoOriginal: "sin_variable", fila: "f1", base: "b1" }))).toBe("informativo");
    expect(severidadDeAviso(aviso({ tipoOriginal: "variable_ausente", motivo: "excluida" }))).toBe("informativo");
    expect(severidadDeAviso(aviso({ tipoOriginal: "peso_ignorado", base: "b1" }))).toBe("informativo");
    expect(severidadDeAviso(aviso({ tipoOriginal: "sin_mapa", fila: "f1", base: "b1" }))).toBe("advertencia");
    expect(severidadDeAviso(aviso({ tipoOriginal: "variable_ausente", motivo: "no_esta_en_la_base" }))).toBe("advertencia");
    expect(severidadDeAviso(aviso({ tipoOriginal: "variable_ausente" }))).toBe("advertencia");
    // Un tipo que el cliente no conoce nunca se rebaja.
    expect(severidadDeAviso(aviso({ tipoOriginal: "nuevo_del_motor", tipo: "otro" }))).toBe("advertencia");
  });

  test("agrupa por tipo, cuenta preguntas distintas y pone las advertencias primero", () => {
    const sinVariable = Array.from({ length: 66 }, (_, i) => aviso({ tipoOriginal: "sin_variable", fila: `f${i}`, base: "b2026" }));
    const sinMapa = [
      aviso({ tipoOriginal: "sin_mapa", fila: "facultad", base: "b2024" }),
      aviso({ tipoOriginal: "sin_mapa", fila: "facultad", base: "b2025" }),
      aviso({ tipoOriginal: "sin_mapa", fila: "discapacidad", base: "b2024" }),
    ];
    const grupos = gruposDeAvisos([...sinVariable, ...sinMapa]);
    expect(grupos.map((g) => [g.etiqueta, g.severidad, g.alcance, g.avisos.length])).toEqual([
      ["Sin correspondencia", "advertencia", "2 preguntas", 3],
      ["Sin variable", "informativo", "66 preguntas", 66],
    ]);
  });

  test("motivos distintos del mismo tipo van en grupos distintos", () => {
    const grupos = gruposDeAvisos([
      aviso({ tipoOriginal: "variable_ausente", motivo: "excluida", fila: "a" }),
      aviso({ tipoOriginal: "variable_ausente", motivo: "no_esta_en_la_base", fila: "b" }),
    ]);
    expect(grupos.map((g) => g.etiqueta)).toEqual(["Variable que no está en la base", "Variable excluida en Analítica"]);
  });

  test("la ponderación se cuenta por base y su acción es común al grupo", () => {
    const grupos = gruposDeAvisos([
      aviso({ tipoOriginal: "peso_ignorado", base: "b1" }),
      aviso({ tipoOriginal: "peso_ignorado", base: "b2" }),
    ]);
    expect(grupos[0].alcance).toBe("2 bases");
    expect(grupos[0].accion?.etiqueta).toBe("Ir a Ponderación");
  });

  test("sin avisos no hay grupos", () => {
    expect(gruposDeAvisos([])).toEqual([]);
  });
});
