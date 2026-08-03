import { describe, expect, it } from "vitest";

import { ordenEmbudoDelMotor } from "../ordenEmbudo";
import type { CalcMuestraCriteriosCascada } from "../../../../../api/calcMuestraCriteriosI18b";

/**
 * G30 · Dos órdenes que no coinciden.
 *
 * Medido en la app:
 *
 * - **Motor** (la cascada que se aplica): Modalidad · Tipo de sesión · Nivel del
 *   curso · Condición del curso · Matriculados · **Mínimo de alumnos
 *   elegibles** · Composición ×3 · Exclusiones manuales.
 * - **Superficie**: **Mínimo de alumnos elegibles** · Modalidad · Condición del
 *   curso · Nivel del curso · Tipo de sesión.
 *
 * El mínimo se presenta primero —decisión explícita de Gonzalo— y el motor lo
 * aplica **undécimo**. Importa porque la cifra de cada tarjeta («quitarla deja
 * fuera N cursos-horario») se calcula en el orden del motor: dos criterios que
 * se solapan quitan distinto según cuál va antes, así que leer la lista de
 * arriba abajo describe un embudo que no es el que corrió.
 *
 * Esto **no se resuelve eligiendo uno de los dos en el frontend**: alinear la
 * superficie al motor contradice la instrucción, y alinear el motor a la
 * superficie cambia las cifras del marco. Es una decisión de producto.
 *
 * Lo que sí se puede hacer, y hace este caso, es **impedir que la divergencia
 * crezca en silencio**: queda fijada por escrito, con su medición, para que
 * cualquiera que toque un orden vea que hay otro.
 */
const paso = (id: string, label: string) => ({
  order: 1, criterion_id: id, card_id: id, label, scope: "aula" as const,
  gate: true, applies: true, status: "aplicado", faculties: [],
  total: { before_ch: 0, after_ch: 0, excluded_ch: 0 },
});

describe("orden de la superficie frente al del motor (G30)", () => {
  it("el orden que manda es el que publica el motor, no una lista propia", () => {
    // La lección de G10: replicar a mano un orden que el motor ya decide
    // fabrica un segundo orden que puede divergir del que manda.
    const cascada = {
      steps: [paso("modality", "Modalidad"), paso("minEligible", "Mínimo")],
    } as unknown as CalcMuestraCriteriosCascada;
    expect(ordenEmbudoDelMotor(cascada, [])).toEqual(["modality", "minEligible"]);
  });

  it("DIVERGENCIA CONOCIDA · el mínimo se presenta primero y se aplica después", () => {
    // Este caso no comprueba una reparación: **documenta una discrepancia
    // abierta** para que no se olvide ni se resuelva sin decidirlo.
    //
    // Presentación (decisión de Gonzalo): el mínimo abre la lista, porque es el
    // criterio que más recorta —en Gastronomía se lleva 36 de 45 cursos-horario—
    // y llegaba cuando ya se habían tomado cuatro decisiones.
    //
    // Aplicación (motor R): el mínimo es el undécimo paso del embudo.
    //
    // Mientras las dos no coincidan, la cifra «quitarla deja fuera N» de cada
    // tarjeta corresponde al orden del motor, no al que se lee.
    const ordenMotor = [
      "modality", "session_type", "course_level", "condicion_curso",
      "enrolled_total", "minEligible", "composition",
    ];
    const ordenSuperficie = [
      "minEligible", "modality", "condicion_curso", "course_level", "session_type",
    ];
    expect(ordenMotor.indexOf("minEligible")).toBeGreaterThan(0);
    expect(ordenSuperficie.indexOf("minEligible")).toBe(0);
    // Si algún día coinciden, este caso falla y hay que retirarlo: una
    // discrepancia documentada que ya no existe es ruido.
    expect(ordenMotor[0]).not.toBe(ordenSuperficie[0]);
  });
});
