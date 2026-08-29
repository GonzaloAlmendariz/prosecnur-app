import { describe, expect, it } from "vitest";
import type { MonitoreoRow } from "../../../../api/monitoreo";
import { embudoDelAula } from "./embudoDelAula";

const parte = (p: Record<string, unknown>) => p as MonitoreoRow;

/**
 * Un paso que nadie declara no es un paso de cero.
 *
 * Visto en pantalla sobre «campo malo»: los 152 partes traen asistentes y
 * efectivas pero ninguno trae rechazos ni duplicados, y el embudo dibujaba
 * «De 4.386 personas en el aula quedaron 4.386 respuestas · 100 %». Afirmaba
 * conversión total sobre dos pasos que nadie anotó.
 */
describe("el embudo no inventa los pasos que faltan", () => {
  it("sin rechazos ni duplicados declarados NO dibuja la cadena", () => {
    const e = embudoDelAula([
      parte({ observed_students: 30, effective_surveys: 12 }),
      parte({ observed_students: 25, effective_surveys: 10 }),
    ]);
    expect(e.asistentes).toBe(55);
    expect(e.pasos).toHaveLength(1);              // sólo «estaban en el aula»
    expect(e.pasosSinDeclarar).toHaveLength(2);
    // Y el descuadre no se calcula: sería el hueco de los pasos, no un desajuste.
    expect(e.descuadre).toBe(0);
  });

  it("con los dos declarados la cadena entera vuelve", () => {
    const e = embudoDelAula([
      parte({ observed_students: 30, refusals: 4, duplicates: 2, effective_surveys: 24 }),
    ]);
    expect(e.pasos).toHaveLength(3);
    expect(e.pasosSinDeclarar).toHaveLength(0);
    expect(e.pasos[2]!.quedan).toBe(24);
    expect(e.descuadre).toBe(0);                  // 24 declaradas = 30 − 4 − 2
  });

  it("un CERO declarado sí es un paso: no es lo mismo que la ausencia", () => {
    const e = embudoDelAula([
      parte({ observed_students: 30, refusals: 0, duplicates: 0, effective_surveys: 30 }),
    ]);
    expect(e.pasos).toHaveLength(3);
    expect(e.pasosSinDeclarar).toHaveLength(0);
  });

  it("si falta sólo uno, se dibuja el otro y se dice cuál falta", () => {
    const e = embudoDelAula([
      parte({ observed_students: 30, refusals: 5, effective_surveys: 20 }),
    ]);
    expect(e.pasos).toHaveLength(2);
    expect(e.pasosSinDeclarar).toEqual(["los que ya habían respondido"]);
  });

  it("el descuadre sólo se afirma con la cadena completa", () => {
    // Es el número que decía «2.791 menos de lo que implica esta cadena» sobre
    // una cadena que no existía.
    const sinPasos = embudoDelAula([parte({ observed_students: 100, effective_surveys: 10 })]);
    expect(sinPasos.descuadre).toBe(0);
    const conPasos = embudoDelAula([
      parte({ observed_students: 100, refusals: 10, duplicates: 5, effective_surveys: 10 }),
    ]);
    expect(conPasos.descuadre).toBe(-75);
  });
});
