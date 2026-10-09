import { describe, expect, it } from "vitest";
import { brechaDeLaFacultad, cuotaDeLaFacultad } from "./brechaDeLaFacultad";
import { candidatosDeReemplazo } from "./candidatosDeReemplazo";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

const celda = (faculty: string, sex: string, missing: number, extra = {}) =>
  ({ faculty, sex, sex_key: sex, missing, ...extra }) as Record<string, unknown>;

describe("brechaDeLaFacultad", () => {
  it("lee el `missing` que el motor ya calculo, por sexo", () => {
    const b = brechaDeLaFacultad(
      [celda("DERECHO", "F", 40), celda("DERECHO", "M", 3), celda("LETRAS", "F", 99)],
      "DERECHO",
    );
    expect(b).toEqual({ mujeres: 40, hombres: 3 });
  });

  it("casa la facultad sin distinguir caja ni espacios, como agendaPorFacultad", () => {
    expect(brechaDeLaFacultad([celda("Derecho", "F", 7)], "  derecho ")).toEqual({
      mujeres: 7, hombres: 0,
    });
  });

  it("sin la facultad devuelve undefined, NO un cero", () => {
    // La distincion que el popover necesita: con cero pinta «0 %» a los tres
    // candidatos y eso se lee como «ninguno ayuda» en vez de «aqui no se mide».
    expect(brechaDeLaFacultad([celda("LETRAS", "F", 5)], "DERECHO")).toBeUndefined();
    expect(brechaDeLaFacultad([], "DERECHO")).toBeUndefined();
    expect(brechaDeLaFacultad(undefined, "DERECHO")).toBeUndefined();
  });

  it("una facultad cubierta da cero, que NO es lo mismo que no medirla", () => {
    expect(brechaDeLaFacultad([celda("DERECHO", "F", 0), celda("DERECHO", "M", 0)], "DERECHO"))
      .toEqual({ mujeres: 0, hombres: 0 });
  });

  it("ignora sexos que no son F/M y `missing` no numerico", () => {
    const b = brechaDeLaFacultad(
      [celda("DERECHO", "X", 50), celda("DERECHO", "F", Number.NaN), celda("DERECHO", "M", 6)],
      "DERECHO",
    );
    expect(b).toEqual({ mujeres: 0, hombres: 6 });
  });

  it("suma varias celdas del mismo sexo en la misma facultad", () => {
    expect(brechaDeLaFacultad([celda("DERECHO", "F", 4), celda("DERECHO", "F", 6)], "DERECHO"))
      .toEqual({ mujeres: 10, hombres: 0 });
  });
});

describe("la brecha CAMBIA a quien se ofrece", () => {
  // La comprobacion que da sentido al productor. Sin ella los tests de arriba
  // solo dicen que una funcion suma: lo que importa es que el orden del popover
  // se mueva, porque durante todo este tiempo `ayudaCon()` devolvia 0 y el
  // parecido decidia solo.
  //
  // Los dos candidatos van en la MISMA facultad y el mismo rol a proposito: el
  // popover agrupa por origen y ordena dentro de cada grupo, asi que comparar
  // uno de la cadena con uno de otra facultad no mide el orden, mide el orden
  // de los grupos. (Primer intento de este test: fallaba por eso.)
  const fila = (p: Partial<MonitoreoAulasPlanRow> & Record<string, unknown>) =>
    ({ ...p }) as MonitoreoAulasPlanRow;

  const caido = fila({
    operational_code: "CH 1", classroom_id: "CH 1", faculty: "DERECHO",
    sample_role: "titular", eligible_n: 30,
  });
  // Mismo tamaño que el caido —mejor parecido— pero casi solo hombres.
  const gemelaHombres = fila({
    operational_code: "R 1", classroom_id: "R 1", faculty: "DERECHO",
    sample_role: "extra_reserve_pool", eligible_n: 30,
    sex_top_1: "M", sex_top_1_n: 28, sex_top_2_n: 2, tasa_efectividad_aula: 0.6,
  });
  // Peor parecido en tamaño, pero casi solo mujeres.
  const otraMujeres = fila({
    operational_code: "R 2", classroom_id: "R 2", faculty: "DERECHO",
    sample_role: "extra_reserve_pool", eligible_n: 44,
    sex_top_1: "F", sex_top_1_n: 40, sex_top_2_n: 4, tasa_efectividad_aula: 0.6,
  });
  const banco = [caido, gemelaHombres, otraMujeres];

  /** El primero del grupo donde caen los dos candidatos comparables. */
  const primeroDelGrupo = (brecha?: { mujeres: number; hombres: number }) => {
    const grupos = candidatosDeReemplazo(banco, caido, brecha ?? { mujeres: 0, hombres: 0 });
    const grupo = Object.values(grupos).find((g) =>
      g.mejores.some((c) => String(c.fila.operational_code) === "R 1") &&
      g.mejores.some((c) => String(c.fila.operational_code) === "R 2"));
    expect(grupo, "los dos candidatos tienen que caer en el mismo grupo").toBeDefined();
    return String(grupo!.mejores[0]?.fila.operational_code ?? "");
  };

  it("sin brecha manda el parecido: gana la gemela aunque sobren hombres", () => {
    expect(primeroDelGrupo()).toBe("R 1");
  });

  it("con la brecha en mujeres el orden se invierte", () => {
    const brecha = brechaDeLaFacultad(
      [{ faculty: "DERECHO", sex_key: "F", missing: 40 },
       { faculty: "DERECHO", sex_key: "M", missing: 0 }],
      "DERECHO",
    );
    expect(brecha).toEqual({ mujeres: 40, hombres: 0 });
    expect(primeroDelGrupo(brecha)).toBe("R 2");
  });
});

describe("la cuota se lee del campo que el motor publica de verdad", () => {
  // Medido el 2026-09-12 contra el operativo: las 30 celdas de
  // `quotas_sex_faculty` traen `observed` —223 sobre una meta de 398, con
  // `missing` 175— y ninguna trae `achieved`. El código preguntaba por
  // `achieved`, así que la rama principal era código muerto y todo pasaba por
  // el respaldo `target - missing`.
  const cuotaCelda = (extra: Record<string, unknown>) =>
    ({ faculty: "DERECHO", sex_key: "F", target: 398, ...extra }) as Record<string, unknown>;

  it("lee `observed`, que es el nombre real", () => {
    const c = cuotaDeLaFacultad([cuotaCelda({ observed: 223, missing: 175 })], "DERECHO");
    expect(c?.logrado.mujeres).toBe(223);
  });

  it("sin `observed` cae al respaldo y no inventa", () => {
    // La rama que SÍ se usaba: meta menos lo que falta, la misma resta del motor.
    const c = cuotaDeLaFacultad([cuotaCelda({ missing: 175 })], "DERECHO");
    expect(c?.logrado.mujeres).toBe(223);
  });

  it("un payload viejo con `achieved` sigue funcionando", () => {
    const c = cuotaDeLaFacultad([cuotaCelda({ achieved: 200, missing: 198 })], "DERECHO");
    expect(c?.logrado.mujeres).toBe(200);
  });

  it("`observed` manda sobre `achieved` si llegaran los dos", () => {
    const c = cuotaDeLaFacultad([cuotaCelda({ observed: 223, achieved: 1, missing: 175 })], "DERECHO");
    expect(c?.logrado.mujeres).toBe(223);
  });
});
