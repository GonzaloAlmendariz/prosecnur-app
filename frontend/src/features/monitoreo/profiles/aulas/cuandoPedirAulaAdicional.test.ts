import { describe, expect, it } from "vitest";

import { cuandoPedirAulaAdicional, MINIMO_PARA_COMPARAR } from "./cuandoPedirAulaAdicional";
import type { MonitoreoAulasEfectividadSeguimiento } from "../../../../api/monitoreo";

/**
 * Ítems 8 y 9 del dictado: cuándo pedir un aula adicional, y desde cuándo el
 * aviso tiene base. La condición de base la calcula el motor con el intervalo
 * de cada facultad; lo que este helper añade es no dejar que el silencio de una
 * facultad sin medir se lea como una buena noticia.
 */
const fila = (f: Record<string, unknown>) => f as never;

const bloque = (facultades: Array<Record<string, unknown>>) =>
  ({ total: {}, facultades } as unknown as MonitoreoAulasEfectividadSeguimiento);

describe("cuándo pedir un aula adicional", () => {
  it("separa la que no cierra ni en el mejor caso de la que todavía puede", () => {
    const a = cuandoPedirAulaAdicional(bloque([
      fila({ facultad: "DERECHO", riesgo: "riesgo_firme", aulas_aplicadas: 6, margen_restante: -188 }),
      fila({ facultad: "LETRAS", riesgo: "riesgo", aulas_aplicadas: 5, margen_restante: -1 }),
      fila({ facultad: "ARTES", riesgo: "holgado", aulas_aplicadas: 4, margen_restante: 121 }),
    ]))!;
    expect(a.pedirYa.map((f) => f.facultad)).toEqual(["DERECHO"]);
    expect(a.vigilar.map((f) => f.facultad)).toEqual(["LETRAS"]);
    expect(a.alumnosQueFaltan).toBe(188);
    expect(a.frase).toContain("hay que pedirles aula adicional");
    expect(a.frase).toContain("vigilar antes de pedir");
  });

  it("la facultad sin base no cuenta como que va bien: se dice que no se sabe", () => {
    // «Con una o dos aulas eso no es suficiente base» (Gonzalo).
    const a = cuandoPedirAulaAdicional(bloque([
      fila({ facultad: "DERECHO", riesgo: "holgado", aulas_aplicadas: 1 }),
      fila({ facultad: "LETRAS", riesgo: "holgado", aulas_aplicadas: 9 }),
    ]))!;
    expect(a.sinBase.map((f) => f.facultad)).toEqual(["DERECHO"]);
    expect(a.frase).toContain("no se sabe, no es que vayan bien");
    expect(MINIMO_PARA_COMPARAR).toBeGreaterThan(1);
  });

  it("una facultad que YA avisa no se manda a «sin base» por tener pocas aulas", () => {
    // El aviso vale igual: si con dos aulas ni el extremo optimista cierra su
    // cuota, el problema es de tamaño y no de ruido.
    const a = cuandoPedirAulaAdicional(bloque([
      fila({ facultad: "DERECHO", riesgo: "riesgo_firme", aulas_aplicadas: 2, margen_restante: -400 }),
    ]))!;
    expect(a.pedirYa).toHaveLength(1);
    expect(a.sinBase).toHaveLength(0);
  });

  it("sin ninguna en riesgo lo dice, en vez de callar", () => {
    const a = cuandoPedirAulaAdicional(bloque([
      fila({ facultad: "DERECHO", riesgo: "holgado", aulas_aplicadas: 9 }),
    ]))!;
    expect(a.frase).toContain("Ninguna facultad necesita aula adicional");
  });

  it("sin bloque no inventa una lectura", () => {
    expect(cuandoPedirAulaAdicional(null)).toBeNull();
    expect(cuandoPedirAulaAdicional({ facultades: [] } as never)).toBeNull();
  });
});
