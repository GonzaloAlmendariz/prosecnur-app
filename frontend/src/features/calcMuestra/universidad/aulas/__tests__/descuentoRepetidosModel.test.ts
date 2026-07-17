/**
 * Contrato del modelo puro del descuento secuencial de repetidos y de los
 * avisos de estado de la mesa (Oleada III, schema calc_muestra_aulas_descuento_v1):
 * - resumen bruto/neto por estrato derivado de las filas titulares del motor
 *   (sin recálculos) y fallback al bloque por_estrato del engine;
 * - gating de columnas netas SOLO cuando la corrida trae las claves nuevas;
 * - warning estructurado `descuento_sin_ids` (warning_code congelado);
 * - aviso de job no aplicado por marco viejo (stale_job_result del backend).
 * Tolerancia a ausencia obligatoria: payloads viejos ⇒ null/[] y UI como hoy.
 */
import { describe, expect, it } from "vitest";
import {
  buildDescuentoResumen,
  DESCUENTO_SIN_IDS_CODE,
  DISCOUNT_CELL_KEYS,
  discountCellText,
  findDescuentoSinIds,
  hasDiscountColumns,
  isBalancedEngine,
  normalizeDescuentoResumenBloque,
  normalizeStaleJobAviso,
  resolveDiscountMode,
} from "../descuentoRepetidosModel";

const FILA_DERECHO_A = {
  classroom_id: "der101",
  faculty: "DERECHO",
  eligible_n: 40,
  eligible_n_bruto: 40,
  eligible_n_neto: 40,
  aporte_neto: 40,
  ya_cubiertos: 0,
};

const FILA_DERECHO_B = {
  classroom_id: "der202",
  faculty: "DERECHO",
  eligible_n: 35,
  eligible_n_bruto: 35,
  eligible_n_neto: 22,
  aporte_neto: 22,
  ya_cubiertos: 13,
};

const FILA_ARTE = {
  classroom_id: "art301",
  faculty: "ARTE Y DISEÑO",
  eligible_n: 18,
  eligible_n_bruto: 18,
  eligible_n_neto: 15,
  aporte_neto: 15,
  ya_cubiertos: 3,
};

/** Fila de una corrida VIEJA (sin claves de descuento). */
const FILA_LEGACY = {
  classroom_id: "leg001",
  faculty: "DERECHO",
  eligible_n: 50,
  duplicate_overlap: 4,
};

describe("buildDescuentoResumen (resumen bruto/neto por estrato)", () => {
  it("agrupa por facultad y suma bruto, neto, ya cubiertos y aporte neto", () => {
    const resumen = buildDescuentoResumen([FILA_DERECHO_A, FILA_DERECHO_B, FILA_ARTE]);
    expect(resumen).not.toBeNull();
    expect(resumen!.estratos).toHaveLength(2);
    // Orden alfabético es-PE: ARTE Y DISEÑO antes que DERECHO.
    expect(resumen!.estratos[0]).toEqual({
      estrato: "ARTE Y DISEÑO",
      aulas: 1,
      bruto: 18,
      neto: 15,
      yaCubiertos: 3,
      aporteNeto: 15,
    });
    expect(resumen!.estratos[1]).toEqual({
      estrato: "DERECHO",
      aulas: 2,
      bruto: 75,
      neto: 62,
      yaCubiertos: 13,
      aporteNeto: 62,
    });
    expect(resumen!.total).toEqual({ aulas: 3, bruto: 93, neto: 77, yaCubiertos: 16, aporteNeto: 77 });
  });

  it("devuelve null con payloads viejos (sin claves de descuento) — la UI queda como hoy", () => {
    expect(buildDescuentoResumen([FILA_LEGACY])).toBeNull();
    expect(buildDescuentoResumen([])).toBeNull();
  });
});

describe("normalizeDescuentoResumenBloque (por_estrato del engine)", () => {
  it("mapea las claves congeladas del bloque y deja el aporte en null (el engine no lo suma)", () => {
    const resumen = normalizeDescuentoResumenBloque({
      schema: "calc_muestra_aulas_descuento_v1",
      requested: true,
      applied: true,
      mode: "sequential",
      por_estrato: [
        { stratum: "DERECHO", aulas_seleccionadas: 2, eligible_bruto_total: 75, eligible_neto_total: 62, ya_cubiertos_total: 13 },
        { stratum: "ARTE Y DISEÑO", aulas_seleccionadas: 1, eligible_bruto_total: 18, eligible_neto_total: 15, ya_cubiertos_total: 3 },
      ],
    });
    expect(resumen).not.toBeNull();
    expect(resumen!.estratos.map((e) => e.estrato)).toEqual(["ARTE Y DISEÑO", "DERECHO"]);
    expect(resumen!.estratos[1]).toMatchObject({ aulas: 2, bruto: 75, neto: 62, yaCubiertos: 13, aporteNeto: null });
    expect(resumen!.total).toMatchObject({ aulas: 3, bruto: 93, neto: 77, yaCubiertos: 16, aporteNeto: null });
  });

  it("devuelve null sin bloque o con por_estrato vacío/incompleto", () => {
    expect(normalizeDescuentoResumenBloque(undefined)).toBeNull();
    expect(normalizeDescuentoResumenBloque(null)).toBeNull();
    expect(normalizeDescuentoResumenBloque({ schema: "calc_muestra_aulas_descuento_v1", mode: "off" })).toBeNull();
    expect(
      normalizeDescuentoResumenBloque({
        schema: "calc_muestra_aulas_descuento_v1",
        por_estrato: [{ stratum: "DERECHO" }],
      }),
    ).toBeNull();
  });
});

describe("gating de columnas netas en la tabla de titulares", () => {
  it("solo enciende las columnas cuando alguna fila trae claves del descuento", () => {
    expect(hasDiscountColumns([FILA_DERECHO_A, FILA_LEGACY])).toBe(true);
    expect(hasDiscountColumns([FILA_LEGACY])).toBe(false);
    expect(hasDiscountColumns([])).toBe(false);
  });

  it("las celdas son presence-aware: '—' cuando la fila no trae la clave", () => {
    expect(discountCellText(FILA_DERECHO_B, [...DISCOUNT_CELL_KEYS.neto])).toBe("22");
    expect(discountCellText(FILA_DERECHO_B, [...DISCOUNT_CELL_KEYS.cubiertos])).toBe("13");
    // La fila legacy no trae neto/cubiertos: nunca se pinta un 0 inventado.
    expect(discountCellText(FILA_LEGACY, [...DISCOUNT_CELL_KEYS.neto])).toBe("—");
    expect(discountCellText(FILA_LEGACY, [...DISCOUNT_CELL_KEYS.cubiertos])).toBe("—");
    // El bruto cae a eligible_n: es la misma métrica antes del descuento.
    expect(discountCellText(FILA_LEGACY, [...DISCOUNT_CELL_KEYS.bruto])).toBe("50");
  });
});

describe("resolveDiscountMode (bloque sequential_discount del engine)", () => {
  it("normaliza sequential y post_hoc; 'off', ausencia o basura ⇒ null", () => {
    expect(resolveDiscountMode({ sequential_discount: { schema: "calc_muestra_aulas_descuento_v1", mode: "sequential" } })).toBe("sequential");
    expect(resolveDiscountMode({ sequential_discount: { schema: "calc_muestra_aulas_descuento_v1", mode: "post_hoc" } })).toBe("post_hoc");
    expect(resolveDiscountMode({ sequential_discount: { schema: "calc_muestra_aulas_descuento_v1", mode: "off" } })).toBeNull();
    expect(resolveDiscountMode({ sequential_discount: null })).toBeNull();
    expect(resolveDiscountMode(null)).toBeNull();
    expect(resolveDiscountMode(undefined)).toBeNull();
  });
});

describe("findDescuentoSinIds (warning_code congelado)", () => {
  it("detecta el código y prefiere el detalle humano de warnings", () => {
    const aviso = findDescuentoSinIds({
      sequential_discount: {
        schema: "calc_muestra_aulas_descuento_v1",
        requested: true,
        applied: false,
        mode: "off",
        warning_code: "descuento_sin_ids",
        warnings: ["La base no trae códigos de estudiante parseables."],
      },
    });
    expect(aviso).not.toBeNull();
    expect(aviso!.code).toBe(DESCUENTO_SIN_IDS_CODE);
    expect(aviso!.message).toBe("La base no trae códigos de estudiante parseables.");
  });

  it("usa un mensaje por defecto cuando el bloque no trae detalle", () => {
    const aviso = findDescuentoSinIds({
      sequential_discount: { schema: "calc_muestra_aulas_descuento_v1", warning_code: "descuento_sin_ids" },
    });
    expect(aviso).not.toBeNull();
    expect(aviso!.message.length).toBeGreaterThan(0);
  });

  it("no dispara con warning_code vacío, otro código o sin bloque", () => {
    expect(findDescuentoSinIds({ sequential_discount: { schema: "calc_muestra_aulas_descuento_v1", warning_code: "" } })).toBeNull();
    expect(findDescuentoSinIds({ sequential_discount: { schema: "calc_muestra_aulas_descuento_v1", warning_code: "otro_codigo" } })).toBeNull();
    expect(findDescuentoSinIds({ sequential_discount: null })).toBeNull();
    expect(findDescuentoSinIds(null)).toBeNull();
  });
});

describe("isBalancedEngine (aclaración post-hoc del toggle)", () => {
  it("marca los engines balanceados y deja fuera al resto", () => {
    expect(isBalancedEngine("cube_balanceado")).toBe(true);
    expect(isBalancedEngine("local_pivotal_balanceado")).toBe(true);
    expect(isBalancedEngine("pps_balanceado")).toBe(true);
    expect(isBalancedEngine("sistematico_pps")).toBe(false);
    expect(isBalancedEngine("pool_controlado")).toBe(false);
    expect(isBalancedEngine("manual_auditable")).toBe(false);
    expect(isBalancedEngine("")).toBe(false);
    expect(isBalancedEngine(null)).toBe(false);
  });
});

describe("normalizeStaleJobAviso (resultado no aplicado por marco viejo)", () => {
  it("normaliza el registro del backend con la etiqueta humana del job", () => {
    const aviso = normalizeStaleJobAviso({
      job_id: "job-123",
      kind: "calc_muestra_aulas_seleccionar",
      frame_hash: "abc123def456",
      detected_at: "2026-07-16T10:00:00Z",
    });
    expect(aviso).toEqual({
      jobId: "job-123",
      kind: "calc_muestra_aulas_seleccionar",
      kindLabel: "Seleccionar cursos-horario titulares",
      frameHash: "abc123def456",
      detectedAt: "2026-07-16T10:00:00Z",
    });
  });

  it("conserva el kind crudo como etiqueta cuando no está mapeado", () => {
    const aviso = normalizeStaleJobAviso({ job_id: "job-9", kind: "job_futuro" });
    expect(aviso!.kindLabel).toBe("job_futuro");
  });

  it("devuelve null con null, objeto vacío o sin identidad", () => {
    expect(normalizeStaleJobAviso(null)).toBeNull();
    expect(normalizeStaleJobAviso(undefined)).toBeNull();
    expect(normalizeStaleJobAviso({})).toBeNull();
    expect(normalizeStaleJobAviso({ frame_hash: "solo-hash" })).toBeNull();
  });
});
