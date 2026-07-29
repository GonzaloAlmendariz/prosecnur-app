import { describe, expect, test } from "vitest";
import { corteAcreditacion } from "./corteAdapters";
import { construirCorte } from "./corteContract";

// Regresión del 2026-07-28, vista en `acrconta` por el usuario.
//
// La sección Teléfono pintaba este embudo:
//
//     1.277 snapshot  →  0 PROCESABLES  →  534 efectivas
//     −1.277 registros fuera del universo declarado por actor
//
// mientras Modelo, sobre el MISMO corte, decía `1.277 → 519 → 418`.
//
// Cero elegibles con 534 válidas es imposible: no puede haber más efectivas que
// casos que pasaron el filtro. La cadena que lo producía:
//
//   1. `advanceCardsFromRows` usa `rowNumber(row, COL_UNIVERSO, 0)`, así que una
//      fila sin columna de universo da 0 en silencio.
//   2. El adaptador sumaba esos ceros y pasaba `procesable: 0` —no `null`—
//      porque solo miraba si HABÍA tarjetas, no si alguna declaraba universo.
//      `meta`, tres líneas más abajo, sí distinguía ese caso.
//   3. El contrato no detectaba la incoherencia: su guard es `base > oficial`,
//      y `0 > 534` es falso, así que ni avisaba ni generaba salto.
//
// El resultado no era solo feo: el salto reportaba «−1.277 fuera del universo»,
// acusando de descarte a la totalidad del snapshot.

describe("el embudo no puede tener más oficiales que procesables", () => {
  test("tarjetas sin universo declarado dejan el procesable indeterminado, no en cero", () => {
    const corte = corteAcreditacion(
      { n_rows: 1277 } as never,
      [
        { universe: 0, effective: 141, meta: 108 },
        { universe: 0, effective: 173, meta: 126 },
        { universe: 0, effective: 52, meta: 38 },
        { universe: 0, effective: 168, meta: 15 },
      ],
    );

    expect(corte.oficial).toBe(534);
    // `null` es «no determinado», que es la verdad. Un 0 afirma que ningún
    // registro pasó el filtro, y eso contradice las 534 efectivas.
    expect(corte.procesable).toBeNull();
    // Y sin procesable no se puede acusar a 1.277 registros de quedar fuera.
    expect(corte.saltos.some((salto) => salto.a === "procesable")).toBe(false);
  });

  test("un universo declarado de verdad se respeta", () => {
    const corte = corteAcreditacion(
      { n_rows: 1277 } as never,
      [
        { universe: 270, effective: 178, meta: 108 },
        { universe: 180, effective: 173, meta: 126 },
        { universe: 53, effective: 52, meta: 38 },
        { universe: 16, effective: 15, meta: 15 },
      ],
    );
    expect(corte.procesable).toBe(519);
    expect(corte.oficial).toBe(418);
    expect(corte.saltos.find((salto) => salto.a === "procesable")?.descartados).toBe(758);
  });

  test("el contrato no deja pasar un oficial mayor que el procesable", () => {
    // Guard del contrato, independiente del adaptador: ninguna superficie puede
    // volver a pintar este embudo, venga el dato de donde venga.
    const corte = construirCorte({ ingesta: 1277, procesable: 0, oficial: 534 });
    expect(corte.oficial).toBe(534);
    expect(corte.procesable).toBeNull();
  });

  test("procesable igual a oficial es válido y no se toca", () => {
    const corte = construirCorte({ ingesta: 1277, procesable: 534, oficial: 534 });
    expect(corte.procesable).toBe(534);
    expect(corte.saltos.some((salto) => salto.a === "oficial")).toBe(false);
  });

  test("un cero legítimo sobrevive cuando tampoco hay oficiales", () => {
    const corte = construirCorte({ ingesta: 1277, procesable: 0, oficial: 0 });
    expect(corte.procesable).toBe(0);
    expect(corte.saltos.find((salto) => salto.a === "procesable")?.descartados).toBe(1277);
  });
});
