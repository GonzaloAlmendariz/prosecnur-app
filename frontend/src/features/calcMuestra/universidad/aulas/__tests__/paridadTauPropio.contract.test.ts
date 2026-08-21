/**
 * El τ propio por facultad se calcula DOS VECES, en dos runtimes: en R
 * (`.cm_tau_por_facultad`, api/R/calc_muestra_aulas_tau_facultad.R) y en el
 * front (`tauPropioPorFacultad`, sustentoDimensionamientoModel.ts).
 *
 * Medido el 2026-08-21: hoy NO divergen. Los dos acumulan Σefectivas/Σelegibles
 * sobre los escalones «aplicado», agrupan por la misma clave de facultad y
 * exigen el mismo k. Las claves se compararon sobre los 16 nombres reales del
 * estudio (con ñ, tildes, puntos y guiones) y salieron idénticas: R quita la ñ
 * explícitamente y el front vía NFD, donde la tilde de la ñ cae en el rango de
 * diacríticos que borra.
 *
 * Lo que este contrato protege es lo único que puede romperse sin que nadie se
 * entere: que alguien mueva el umbral en un lado y no en el otro. Un k distinto
 * cambia qué facultades reciben razón propia, y por tanto cuántas aulas se
 * visitan, sin que ningún test de cálculo se ponga rojo.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = resolve(__dirname, "../../../../../..", "..");
const leer = (rel: string) => readFileSync(resolve(RAIZ, rel), "utf8");

describe("el umbral del τ propio es el mismo en los dos runtimes", () => {
  it("R y el front declaran el mismo k mínimo", () => {
    const motor = leer("api/R/calc_muestra_aulas_tau_facultad.R");
    const front = leer(
      "frontend/src/features/calcMuestra/universidad/aulas/sustentoDimensionamientoModel.ts",
    );
    const kMotor = /\.cm_tau_k_minimo\s*<-\s*(\d+)L/.exec(motor)?.[1];
    const kFront = /K_MINIMO_TAU_PROPIO\s*=\s*(\d+)/.exec(front)?.[1];
    expect(kMotor, "no se encontró el umbral en el motor").toBeDefined();
    expect(kFront, "no se encontró el umbral en el front").toBeDefined();
    expect(
      kFront,
      `el umbral divergió: motor k=${kMotor}, front k=${kFront}. Cambiar uno sin el otro ` +
        "hace que la pantalla muestre una razón propia que el motor no reconoce, o al revés.",
    ).toBe(kMotor);
  });

  it("el umbral que ve la UI del marco es el mismo", () => {
    // `UMBRAL_RESPALDO_FINO` decide si la tarjeta de tasas advierte que una
    // facultad tiene poco respaldo. Su comentario dice ser «el mismo umbral con
    // el que el motor decide si publica el τ propio»: si deja de serlo, la
    // advertencia y el cálculo hablan de cosas distintas.
    const motor = leer("api/R/calc_muestra_aulas_tau_facultad.R");
    const tasas = leer(
      "frontend/src/features/calcMuestra/universidad/calculo/tasaFacultadModel.ts",
    );
    const kMotor = /\.cm_tau_k_minimo\s*<-\s*(\d+)L/.exec(motor)?.[1];
    const kUi = /UMBRAL_RESPALDO_FINO\s*=\s*(\d+)/.exec(tasas)?.[1];
    expect(kUi).toBe(kMotor);
  });

  it("ninguno de los dos cálculos cuenta escalones que no se aplicaron", () => {
    // El denominador es la trampa: contar escalones no aplicados metería aulas
    // que nunca se visitaron y hundiría la razón de esa facultad.
    const motor = leer("api/R/calc_muestra_aulas_tau_facultad.R");
    const front = leer(
      "frontend/src/features/calcMuestra/universidad/aulas/sustentoDimensionamientoModel.ts",
    );
    expect(motor).toMatch(/identical\(escalon\$estado,\s*"aplicado"\)/);
    expect(front).toMatch(/escalon\.estado\s*!==\s*"aplicado"/);
  });
});
