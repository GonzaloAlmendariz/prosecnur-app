import { describe, expect, it } from "vitest";
import type { CalcMuestraReferenciaAsistenciaCadenaSeleccion } from "../../../../../api/calcMuestra";
import { construirRankingDesempeno } from "../rankingDesempenoModel";

function escalon(over: Record<string, unknown>) {
  return {
    posicion: 1,
    semana: 2,
    rol: "Titular",
    curso_horario: "CH-1",
    estado: "aplicado",
    efectivas: 20,
    efectivas_mujeres: null,
    efectivas_hombres: null,
    elegibles: 30,
    rendimiento: 20 / 30,
    motivo: null,
    motivo_codigo: null,
    ...over,
  };
}

function cadena(over: Record<string, unknown>): CalcMuestraReferenciaAsistenciaCadenaSeleccion {
  return {
    cadena: 1,
    facultad: "DERECHO",
    titular: "CH-1",
    nombre_curso: "Derecho Civil",
    horario: "0901",
    efectivas_mujeres: null,
    efectivas_hombres: null,
    escalones: [escalon({})],
    escalones_trabajados: 1,
    aplicados: 1,
    resuelta_en: 1,
    semana_inicio: 2,
    semana_fin: 2,
    efectivas: 20,
    elegibles: 30,
    rendimiento: 20 / 30,
    ...over,
  } as CalcMuestraReferenciaAsistenciaCadenaSeleccion;
}

const MARCO = [
  {
    classroom_id: "CH-1", condicion_curso: "OBLIGATORIO", course_level_num: 6,
    sex_top_1: "F", sex_top_1_n: 20, sex_top_2: "M", sex_top_2_n: 8,
  },
  { classroom_id: "ch-2", condicion_curso: "ELECTIVO", course_level_num: 3 },
];

describe("construirRankingDesempeno", () => {
  it("rankea por rendimiento POR FACULTAD y une tipo/ciclo del marco vigente", () => {
    const ranking = construirRankingDesempeno(
      [
        cadena({}),
        cadena({
          cadena: 2, titular: "CH-2", nombre_curso: "Procesal",
          escalones: [escalon({ curso_horario: "CH-2", efectivas: 28, elegibles: 30, rendimiento: 28 / 30, semana: 1 })],
        }),
        cadena({
          cadena: 3, facultad: "GESTIÓN",
          escalones: [escalon({ curso_horario: "CH-9", efectivas: 15, elegibles: 20, rendimiento: 0.75, semana: null })],
        }),
      ],
      MARCO,
    );
    expect(ranking).not.toBeNull();
    // Derecho primero: su mejor aula (93%) supera a la de Gestión (75%).
    expect(ranking!.grupos.map((g) => g.facultad)).toEqual(["DERECHO", "GESTIÓN"]);
    const derecho = ranking!.grupos[0]!;
    expect(derecho.filas[0]).toMatchObject({
      cursoHorario: "CH-2", rendimiento: 28 / 30, tipo: "ELECTIVO", ciclo: 3, semana: 1,
    });
    // El join es case-insensitive (los códigos reales mezclan mayúsculas).
    expect(derecho.filas[1]).toMatchObject({ cursoHorario: "CH-1", tipo: "OBLIGATORIO", ciclo: 6 });
    // Los sexos: quiénes respondieron (2025, del escalón) y los elegibles de
    // HOY (sex_top del marco) — la base 2025 no trae el denominador por sexo.
    expect(derecho.filas[1]).toMatchObject({
      elegiblesHoyMujeres: 20, elegiblesHoyHombres: 8,
    });
    // CH-9 no existe en el marco vigente: tipo/ciclo/sexo null, no inventados.
    expect(ranking!.grupos[1]!.filas[0]).toMatchObject({
      tipo: null, ciclo: null, semana: null,
      elegiblesHoyMujeres: null, elegiblesHoyHombres: null,
    });
    // La cobertura declara el join y el fechado: 3 aplicadas, 2 con semana, 2 en el catálogo.
    expect(ranking!.cobertura).toMatchObject({ aplicadas: 3, conSemana: 2, conJoin: 2 });
  });

  it("el join normaliza guion vs guion bajo — medido: 0 de 194 con la clave cruda", () => {
    const ranking = construirRankingDesempeno(
      [cadena({
        escalones: [escalon({ curso_horario: "DER268-0901" })],
      })],
      [{ classroom_id: "der268_0901", condicion_curso: "OBLIGATORIO", course_level_num: 0 }],
    );
    expect(ranking!.cobertura.conJoin).toBe(1);
    expect(ranking!.grupos[0]!.filas[0]).toMatchObject({ tipo: "OBLIGATORIO", ciclo: 0 });
  });

  it("un desborde (más efectivas que elegibles) no compite y se declara", () => {
    // ADR 0060: efectivas puede superar a elegibles por error de la base; un
    // 129% de asistencia rankeado premia la medición rota, no el aula.
    const ranking = construirRankingDesempeno(
      [
        cadena({}),
        cadena({
          cadena: 2,
          escalones: [escalon({ curso_horario: "CH-DESB", efectivas: 40, elegibles: 31, rendimiento: 40 / 31 })],
        }),
      ],
      MARCO,
    );
    expect(ranking!.grupos[0]!.filas.map((f) => f.cursoHorario)).toEqual(["CH-1"]);
    expect(ranking!.cobertura.desbordadas).toBe(1);
  });

  it("descarta por mínimo de elegibles y LO CUENTA — un aula chica no gana por ruido", () => {
    const ranking = construirRankingDesempeno(
      [
        cadena({}),
        cadena({
          cadena: 2,
          escalones: [escalon({ curso_horario: "CH-CHICO", efectivas: 5, elegibles: 5, rendimiento: 1 })],
        }),
      ],
      MARCO,
      { minElegibles: 15 },
    );
    const derecho = ranking!.grupos[0]!;
    // El aula perfecta de 5 alumnos NO encabeza el ranking…
    expect(derecho.filas.map((f) => f.cursoHorario)).toEqual(["CH-1"]);
    // …y su descarte queda declarado, no escondido.
    expect(ranking!.cobertura.descartadasPorMinimo).toBe(1);
  });

  it("solo rankea lo APLICADO: reservas y caídas no rindieron nada", () => {
    const ranking = construirRankingDesempeno(
      [cadena({
        escalones: [
          escalon({}),
          escalon({ posicion: 2, curso_horario: "CH-R", estado: "reserva", rendimiento: 1, elegibles: 99 }),
          escalon({ posicion: 3, curso_horario: "CH-C", estado: "cayo", rendimiento: 1, elegibles: 99 }),
        ],
      })],
      MARCO,
    );
    expect(ranking!.cobertura.aplicadas).toBe(1);
    expect(ranking!.grupos[0]!.filas).toHaveLength(1);
  });

  it("sin cadenas o sin aplicadas devuelve null: la tarjeta explica el vacío", () => {
    expect(construirRankingDesempeno(null, MARCO)).toBeNull();
    expect(construirRankingDesempeno([], MARCO)).toBeNull();
    expect(construirRankingDesempeno(
      [cadena({ escalones: [escalon({ estado: "reserva" })] })], MARCO,
    )).toBeNull();
  });

  it("los que respondieron por sexo salen del escalón 2025, no del marco", () => {
    const ranking = construirRankingDesempeno(
      [cadena({
        escalones: [escalon({ efectivas_mujeres: 12, efectivas_hombres: 8 })],
      })],
      MARCO,
    );
    expect(ranking!.grupos[0]!.filas[0]).toMatchObject({
      efectivasMujeres: 12, efectivasHombres: 8,
      elegiblesHoyMujeres: 20, elegiblesHoyHombres: 8,
    });
  });

  it("respeta el tope por facultad con desempate estable", () => {
    const escalones = [0.9, 0.9, 0.8, 0.7].map((r, i) =>
      escalon({ posicion: i + 1, curso_horario: `CH-${i}`, rendimiento: r, elegibles: 20 + i, efectivas: Math.round((20 + i) * r) }));
    const ranking = construirRankingDesempeno(
      [cadena({ escalones })], null, { topPorFacultad: 3 },
    );
    const filas = ranking!.grupos[0]!.filas;
    expect(filas).toHaveLength(3);
    // Empate a 0.9: gana el de más elegibles (más evidencia detrás del mismo %).
    expect(filas[0]!.cursoHorario).toBe("CH-1");
    expect(ranking!.grupos[0]!.consideradas).toBe(4);
  });
});
