// D4: el separador entre filas del dumbbell se pone y se quita por posición; nunca lo pone nadie más.
import { describe, expect, it } from "vitest";
import { conSeparador, filasEnLaTarjeta, separadoresDe } from "./separadoresFilas";
import { mergeSlotArgsPatch } from "../../store";
import { camposDeDatos } from "../argsDatosGrafico";
import type { ArgMetadata } from "../../../../api/graficos";

describe("separadores entre filas", () => {
  it("lee un número suelto o una lista; 0 y lo inválido no son separador", () => {
    expect(separadoresDe({})).toEqual([]);
    expect(separadoresDe({ separar_tras: 0 })).toEqual([]);
    expect(separadoresDe({ separar_tras: 3 })).toEqual([3]);
    expect(separadoresDe({ separar_tras: [6, "2", 2, -1, "x", 1.5] })).toEqual([2, 6]);
  });

  it("pone y quita por posición; sin ninguno, el argumento se borra", () => {
    let args: Record<string, unknown> = { estilo: "resumen" };
    args = mergeSlotArgsPatch(args, conSeparador(args, 3, true));
    expect(args.separar_tras).toEqual([3]);
    args = mergeSlotArgsPatch(args, conSeparador(args, 1, true));
    expect(args.separar_tras).toEqual([1, 3]);
    args = mergeSlotArgsPatch(args, conSeparador(args, 3, false));
    expect(args.separar_tras).toEqual([1]);
    args = mergeSlotArgsPatch(args, conSeparador(args, 1, false));
    expect(args).not.toHaveProperty("separar_tras");
  });

  it("las filas están en la tarjeta con dos o más preguntas (grupos) o temas (bases); con `base$*`, no", () => {
    expect(filasEnLaTarjeta({ cruce: "d$ciclo", vars: ["d$p1", "d$p2"] })).toBe(true);
    expect(filasEnLaTarjeta({ cruce: "d$ciclo", vars: ["d$p1"] })).toBe(false);
    expect(filasEnLaTarjeta({ cruce: "d$ciclo", vars: ["d$*"] })).toBe(false);
    expect(filasEnLaTarjeta({ cruce: null, vars: { t1: ["a$p1", "b$p1"], t2: ["a$p2", "b$p2"] } })).toBe(true);
  });

  it("el campo numérico de Aspecto queda sólo cuando las filas no se ven y guarda una sola posición", () => {
    const args = [{ name: "separar_tras", tipo_input: "number", default: 0 }] as unknown as ArgMetadata[];
    const tiene = (v: Record<string, unknown>) => camposDeDatos(args, v, "p_dumbbell").some((c) => c.arg.name === "separar_tras");
    expect(tiene({ estilo: "resumen", cruce: "d$ciclo", vars: ["d$*"] })).toBe(true);
    expect(tiene({ estilo: "resumen", cruce: "d$ciclo", vars: ["d$p1", "d$p2"] })).toBe(false);
    expect(tiene({ estilo: "resumen", cruce: "d$ciclo", vars: ["d$*"], separar_tras: [1, 2] })).toBe(false);
    expect(tiene({ cruce: "d$ciclo", vars: ["d$*"] })).toBe(false);
  });
});
