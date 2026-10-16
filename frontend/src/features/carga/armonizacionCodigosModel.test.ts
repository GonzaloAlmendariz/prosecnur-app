import { describe, expect, it } from "vitest";
import { normalizarCodigosObservados } from "../../api/codigosObservados";
import {
  codigosDeBase,
  conObservados,
  observadosDesde,
  type CargaBase,
  type CodigoBase,
  type ObservadosBase,
} from "./armonizacionCodigosModel";

const MOTIVO = "Guarda la escala para ver cuántos casos caen en cada código.";

// `anio_ingreso` de 2024: numérica, sin lista en el instrumento ni etiquetas.
const anios = observadosDesde(normalizarCodigosObservados({
  ok: [true],
  base: ["2024"],
  variable: ["anio_ingreso"],
  tipo: ["numerica"],
  codigos: [
    { codigo: [2024], etiqueta: null, n: [210] },
    { codigo: [2007], etiqueta: null, n: [3] },
  ],
  n_validos: [213],
  n_sin_dato: [4],
  truncado: [false],
}));

const sinPreview = (observados: ObservadosBase): CargaBase => ({
  tipo: "instrumento",
  motivo: MOTIVO,
  observados,
});

describe("codigosDeBase: de dónde salen los códigos de una base (F4)", () => {
  it("una numérica sin lista muestra sus valores observados con su n antes de guardar la escala", () => {
    const v = codigosDeBase(sinPreview(anios), [], "2024", "anio_ingreso", false);
    expect(v.fuente).toBe("observados");
    expect(v.codigos).toEqual([
      { codigo: "2007", etiqueta: null, n: 3 },
      { codigo: "2024", etiqueta: null, n: 210 },
    ]);
    expect(v.conConteos).toBe(true);
    // El 409 del preview ya no se lee como aviso: los casos están a la vista.
    expect(v.aviso).toBeNull();
    expect(v.nota).toBe("Los casos se cuentan en la data de 2024: todavía no hay una escala guardada. 4 casos sin dato.");
  });

  it("con escala guardada y sin preview, la nota dice que el conteo no es de lo guardado", () => {
    const truncado = { ...anios, truncado: true, nSinDato: 1 } as const;
    const v = codigosDeBase(sinPreview(truncado), [], "2024", "anio_ingreso", true);
    expect(v.nota).toBe(
      "Los casos se cuentan en la data de 2024, no con la escala guardada. 1 caso sin dato. La base tiene más valores de los que se listan.",
    );
  });

  it("la lista del instrumento prevalece sobre lo observado y conserva el motivo", () => {
    const instrumento: CodigoBase[] = [{ codigo: "1", etiqueta: "Mujer", n: null }];
    const v = codigosDeBase(sinPreview(anios), instrumento, "2024", "sexo", false);
    expect(v.fuente).toBe("instrumento");
    expect(v.codigos).toEqual(instrumento);
    expect(v.aviso).toBe(MOTIVO);
    expect(v.conConteos).toBe(false);
  });

  it("el preview manda cuando existe", () => {
    const v = codigosDeBase(
      { tipo: "listo", nTotal: 5, codigos: [{ codigo: "1", etiqueta: "Sí", n: 5 }] },
      [],
      "2024",
      "p1",
      true,
    );
    expect(v).toMatchObject({ fuente: "preview", conConteos: true, aviso: null, nota: null });
  });

  it("mientras se leen los observados, la base sigue contando", () => {
    expect(codigosDeBase(sinPreview({ estado: "leyendo" }), [], "2024", "x", false).fuente).toBe("cargando");
    expect(codigosDeBase(undefined, [], "2024", "x", false).fuente).toBe("cargando");
  });

  it("una variable de texto dice en una línea que no es comparable por categorías", () => {
    const texto = observadosDesde(normalizarCodigosObservados({ tipo: "texto", codigos: [], n_validos: 40 }));
    const v = codigosDeBase(sinPreview(texto), [], "2024", "comentario", false);
    expect(v.fuente).toBe("texto");
    expect(v.codigos).toEqual([]);
    expect(v.vacio).toBe("«comentario» es texto libre en 2024: no es una variable comparable por categorías.");
  });

  it("C5: un fallo de lectura no se presenta como base vacía", () => {
    const v = codigosDeBase(sinPreview({ estado: "error", mensaje: "Sin conexión" }), [], "2024", "x", false);
    expect(v.fuente).toBe("sin-lectura");
    expect(v.vacio).toBe("No se pudieron leer los valores de 2024: Sin conexión");
    expect(v.aviso).toBe(MOTIVO);
  });

  it("sin valores observados (todo sin dato) el vacío es legítimo y no se anota", () => {
    const vacia = { ...anios, codigos: [] };
    const v = codigosDeBase(sinPreview(vacia), [], "2024", "x", false);
    expect(v.codigos).toEqual([]);
    expect(v.nota).toBeNull();
    expect(v.vacio).toBe("La variable no tiene lista de opciones ni valores observados en esta base.");
  });
});

describe("conObservados", () => {
  it("completa una base sin preview y no pisa un preview llegado antes", () => {
    const cargas: Record<string, CargaBase> = {
      a: sinPreview({ estado: "leyendo" }),
      b: { tipo: "listo", nTotal: 0, codigos: [] },
    };
    const conA = conObservados(cargas, "a", anios);
    expect(conA.a).toEqual(sinPreview(anios));
    expect(conObservados(cargas, "b", anios)).toBe(cargas);
    expect(conObservados(cargas, "z", anios)).toBe(cargas);
  });
});
