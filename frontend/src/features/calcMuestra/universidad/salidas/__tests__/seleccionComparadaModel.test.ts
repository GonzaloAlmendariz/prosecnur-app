// La selección nueva contra lo aplicado — el modelo que alimenta la tarjeta
// de Coincidencia (pedido de Gonzalo, 2026-08-19). Lo que protege: el match
// por clave de facultad (espejo del fac_key de R), los denominadores no
// mezclados y el «—» honesto cuando la referencia no conoce una facultad.
import { describe, expect, it } from "vitest";
import { seleccionComparada } from "../seleccionComparadaModel";
import type {
  CalcMuestraAulasSelection,
  CalcMuestraReferenciaAsistencia,
} from "../../../../../api/calcMuestra";

const seleccion = (rows: Array<Record<string, unknown>>): CalcMuestraAulasSelection =>
  ({ selection: rows } as unknown as CalcMuestraAulasSelection);

const referencia = (
  filas: Array<Record<string, unknown>>,
): CalcMuestraReferenciaAsistencia =>
  ({
    embudos: [{ dimension_key: "facultad", dimension_label: "Facultad", orden: 1, filas }],
  } as unknown as CalcMuestraReferenciaAsistencia);

describe("seleccionComparada", () => {
  it("agrega titulares por facultad y los casa con lo aplicado de la referencia", () => {
    const out = seleccionComparada(
      seleccion([
        { sample_role: "titular", faculty: "ARTE Y DISEÑO", eligible_n: 20, efectivas_esperadas: 11.5 },
        { sample_role: "titular", faculty: "ARTE Y DISEÑO", eligible_n: 15, efectivas_esperadas: 8.5 },
        { sample_role: "reemplazo", faculty: "ARTE Y DISEÑO", eligible_n: 99 },
        { sample_role: "titular", faculty: "DERECHO", eligible_n: 40, efectivas_esperadas: 22 },
      ]),
      referencia([
        { celda_key: "arte_y_diseno", celda_label: "ARTE Y DISEÑO", k: 9, elegibles: 165, efectivas: 120 },
        { celda_key: "derecho", celda_label: "DERECHO", k: 16, elegibles: 622, efectivas: 500 },
      ]),
    );
    expect(out.filas).toHaveLength(2);
    const ad = out.filas.find((f) => f.clave === "arte_y_diseno");
    expect(ad).toMatchObject({
      aulasNuevas: 2,
      elegiblesNuevos: 35,
      esperadasNuevas: 20,
      aulasAplicadasRef: 9,
      efectivasRef: 120,
    });
    expect(out.totales).toMatchObject({
      aulasNuevas: 3,
      aulasAplicadasRef: 25,
      esperadasNuevas: 42,
      efectivasRef: 620,
    });
    expect(out.sinReferencia).toBe(false);
  });

  it("una facultad sin referencia queda en null (—), jamás en cero inventado", () => {
    const out = seleccionComparada(
      seleccion([{ sample_role: "titular", faculty: "FACULTAD NUEVA", eligible_n: 10 }]),
      referencia([{ celda_key: "derecho", celda_label: "DERECHO", k: 16, elegibles: 1, efectivas: 1 }]),
    );
    expect(out.filas[0].aulasAplicadasRef).toBeNull();
    expect(out.filas[0].efectivasRef).toBeNull();
    expect(out.sinReferencia).toBe(true);
  });

  it("sin rol declarado cae al criterio de ola M1; sin titulares devuelve vacío", () => {
    const conOla = seleccionComparada(
      seleccion([{ wave: "M1", faculty: "DERECHO", eligible_n: 30 }]),
      null,
    );
    expect(conOla.filas).toHaveLength(1);
    expect(conOla.filas[0].esperadasNuevas).toBeNull();
    const vacia = seleccionComparada(seleccion([{ wave: "M2", faculty: "DERECHO" }]), null);
    expect(vacia.filas).toHaveLength(0);
  });
});
