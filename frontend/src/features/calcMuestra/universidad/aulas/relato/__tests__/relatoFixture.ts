/**
 * Selección sintética para los tests del relato (gates 2 y 3 del ADR 0067).
 *
 * Los nombres de columna son los del contrato real de la selección del motor
 * (`selection` de calc_muestra_aulas_selection_v1), no una invención del test:
 * wave, stratum, faculty, eligible_n, stratum_eligible_n, pi_design/pi_mc/
 * pi_final, probability_source, weight_classroom, sample_role,
 * selection_slot_id, replacement_order, chain_depth y las columnas opcionales
 * del descuento (discount_step, eligible_n_bruto/neto, ya_cubiertos).
 */
import type {
  CalcMuestraAulasFrame,
  CalcMuestraAulasSelection,
  CalcMuestraEstrato,
} from "../../../../../../api/client";

export function filaTitular(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    classroom_id: "CH-A",
    operational_code: "CH 1",
    course_name: "Cálculo 1 · L 8-10",
    wave: "M1",
    orden: 1,
    sample_role: "titular",
    stratum: "CIENCIAS E INGENIERIA · Mujer · G2",
    faculty: "CIENCIAS E INGENIERIA",
    size_group: "G3",
    eligible_n: 40,
    stratum_eligible_n: 120,
    pi_design: 0.2,
    pi_mc: 0.21,
    pi_final: 0.25,
    probability_source: "monte_carlo_sequential_discount",
    weight_classroom: 4,
    selection_slot_id: "slot-1",
    chain_depth: 2,
    discount_step: 2,
    eligible_n_bruto: 40,
    ya_cubiertos: 5,
    eligible_n_neto: 35,
    ...over,
  };
}

/** Dos titulares (una certeza π=1), una reserva encadenada y una bolsa extra. */
export function filasSeleccion(): Array<Record<string, unknown>> {
  return [
    filaTitular(),
    filaTitular({
      classroom_id: "CH-B",
      operational_code: "CH 2",
      course_name: "Derecho Romano · M 10-12",
      stratum: "DERECHO · Hombre · G1",
      faculty: "DERECHO",
      size_group: "G1",
      eligible_n: 18,
      stratum_eligible_n: 60,
      pi_design: 1,
      pi_mc: 1,
      pi_final: 1,
      weight_classroom: 1,
      selection_slot_id: "slot-2",
      chain_depth: 3,
      discount_step: 1,
      eligible_n_bruto: 18,
      ya_cubiertos: 0,
      eligible_n_neto: 18,
    }),
    {
      classroom_id: "CH-R1",
      operational_code: "R 2.1",
      course_name: "Derecho Civil · V 8-10",
      wave: "M2",
      sample_role: "chain_reserve",
      stratum: "DERECHO · Hombre · G1",
      faculty: "DERECHO",
      eligible_n: 22,
      stratum_eligible_n: 60,
      selection_slot_id: "slot-2",
      replacement_order: 1,
      chain_depth: 3,
      activation_weight_status: "condicional",
    },
    {
      classroom_id: "CH-X1",
      operational_code: "EX 1",
      course_name: "Extra operativa",
      wave: "M12",
      sample_role: "extra_reserve_pool",
      faculty: "DERECHO",
      eligible_n: 15,
    },
  ];
}

export function seleccionSintetica(
  over: Partial<CalcMuestraAulasSelection> = {},
): CalcMuestraAulasSelection {
  return {
    schema: "calc_muestra_aulas_selection_v1",
    selection_run_id: "run-777",
    generated_at: "2026-08-07 10:00:00",
    frame_hash: "hash-abc",
    seed: 20260619,
    selector: {},
    selector_engine: "sistematico_pps",
    selector_engine_used: "sistematico_pps",
    probability_source: "monte_carlo_sequential_discount",
    methodological_warning: [
      "Ajuste de tamaño divulgado: un estrato pidió más cursos-horario que sus elegibles.",
    ],
    sequential_discount: {
      schema: "calc_muestra_aulas_descuento_v1",
      requested: true,
      applied: true,
      mode: "sequential",
    },
    selection: filasSeleccion() as CalcMuestraAulasSelection["selection"],
    quotas: [],
    summary: [],
    ...over,
  };
}

/**
 * Corrida post-hoc (engines balanceados): mismas columnas de descuento como
 * AUDITORÍA posterior — el bombo no se encogió durante el sorteo y el relato
 * no puede encogerlo (dirección goo 2026-08-07): el traslape se anota.
 */
export function seleccionPostHoc(): CalcMuestraAulasSelection {
  return seleccionSintetica({
    selector_engine: "cube_balanceado",
    selector_engine_used: "cube_balanceado",
    // Eco real del selector (calc_muestra_aulas.R L493+): balance_vars y
    // spread_vars viajan DENTRO de la selección; el relato los lee, no los asume.
    selector: {
      balance_vars: ["faculty", "size_group", "schedule"],
      spread_vars: ["program", "level"],
    },
    // Cifra oficial del balance publicada por R; el cliente la muestra tal cual.
    representativity_score: 87.4,
    representativity_distance: 0.062,
    sequential_discount: {
      schema: "calc_muestra_aulas_descuento_v1",
      requested: true,
      applied: true,
      mode: "post_hoc",
    },
  });
}

/** Corrida vieja: sin bloque de descuento ni columnas por aula (hueco real). */
export function seleccionSinOrdenDeSorteo(): CalcMuestraAulasSelection {
  const filas = filasSeleccion().map((row) => {
    const {
      discount_step: _paso,
      eligible_n_bruto: _bruto,
      eligible_n_neto: _neto,
      ya_cubiertos: _cubiertos,
      ...resto
    } = row;
    return resto;
  });
  const base = seleccionSintetica({
    selection: filas as CalcMuestraAulasSelection["selection"],
  });
  delete (base as Record<string, unknown>).sequential_discount;
  return base;
}

export const FRAME_SINTETICO = {
  audit: [
    { metric: "input_rows", value: 29090 },
    { metric: "population_n", value: 21000 },
    { metric: "classroom_included_n", value: 890 },
  ],
} as unknown as CalcMuestraAulasFrame;

export const ESTRATOS_CALCULO = [
  { label: "CIENCIAS E INGENIERIA", N: 5200 },
  { label: "DERECHO", N: 3100 },
] as unknown as CalcMuestraEstrato[];

export const SELECTOR_FIELDS = ["facultad", "sexo esperado", "tamaño del curso-horario"];

/**
 * El bombo curso a curso (`aula_frame`): las dos sorteadas + dos candidatas
 * reales con sus elegibles publicados. El `.pulso` conserva esta tabla
 * (project_pulso.R solo poda `population`), así que es el caso normal.
 */
export const BOMBO_FRAME_ROWS: Array<Record<string, unknown>> = [
  { classroom_id: "CH-A", course_name: "Cálculo 1 · L 8-10", faculty: "CIENCIAS E INGENIERIA", size_group: "G3", eligible_n: 40 },
  { classroom_id: "CH-B", course_name: "Derecho Romano · M 10-12", faculty: "DERECHO", size_group: "G1", eligible_n: 18 },
  { classroom_id: "CH-C", course_name: "Física 1 · J 8-10", faculty: "CIENCIAS E INGENIERIA", size_group: "G2", eligible_n: 33 },
  { classroom_id: "CH-D", course_name: "Derecho Civil 2 · V 10-12", faculty: "DERECHO", size_group: "G1", eligible_n: 12 },
];

/** Bombo grande para el cap de bolas: `total` candidatas DERECHO deterministas. */
export function bomboGrande(total: number): Array<Record<string, unknown>> {
  return Array.from({ length: total }, (_, i) => ({
    classroom_id: `CH-M${String(i + 1).padStart(3, "0")}`,
    course_name: `Curso masivo ${i + 1}`,
    faculty: "DERECHO",
    eligible_n: 20 + i,
  }));
}
