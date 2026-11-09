// Normalizador de las cifras con clave (POST /api/graficos/resumenes/cifras, ADR 0135 §6).
import { describe, expect, it } from "vitest";
import {
  errorDeEntrada,
  normalizarCifras,
  normalizarCifrasConDetalle,
  normalizarCifrasDetalleLote,
  normalizarCifrasLote,
  normalizarDetalleCifras,
} from "./graficosCifras";
import { ApiError } from "./core";

describe("normalizarCifras", () => {
  it("lee las cifras del motor con su texto tal cual y desempaca vectores de uno", () => {
    expect(normalizarCifras({
      ok: true,
      tipo: ["contraste/1"],
      cifras: [
        { clave: "diferencia:Biblioteca", rotulo: "Biblioteca: diferencia (Docentes menos Estudiantes)", texto: "+12", valor: 12, unidad: "pts" },
        { clave: ["valor:Biblioteca:Docentes"], rotulo: "Biblioteca: Docentes", texto: "68%", valor: "68", unidad: "%" },
      ],
      avisos: [],
    })).toEqual({
      tipo: "contraste/1",
      cifras: [
        { clave: "diferencia:Biblioteca", rotulo: "Biblioteca: diferencia (Docentes menos Estudiantes)", texto: "+12", valor: 12, unidad: "pts" },
        { clave: "valor:Biblioteca:Docentes", rotulo: "Biblioteca: Docentes", texto: "68%", valor: 68, unidad: "%" },
      ],
      avisos: [],
    });
  });

  it("sin clave o sin texto la cifra no pasa; una clave repetida tampoco; un valor ilegible queda en null", () => {
    const r = normalizarCifras({ cifras: [
      { clave: "", texto: "1" }, { clave: "a", texto: "" }, { clave: "b", texto: "3", valor: "x" }, { clave: "b", texto: "4" },
    ], avisos: "La lámina no dibujó cifras con estos datos." });
    expect(r.cifras).toEqual([{ clave: "b", rotulo: "b", texto: "3", valor: null, unidad: "" }]);
    expect(r.avisos).toEqual(["La lámina no dibujó cifras con estos datos."]);
    expect(normalizarCifras(null)).toEqual({ tipo: "", cifras: [], avisos: [] });
  });
});

describe("normalizarCifrasLote", () => {
  it("lee cada lámina por su id, en orden, con su error E_* aparte y sin tumbar a las demás", () => {
    const r = normalizarCifrasLote({
      ok: true,
      por_lamina: {
        cob: { tipo: "cobertura/1", cifras: [{ clave: "tasa:Docentes", rotulo: "Docentes: tasa", texto: "80%", valor: 80 }], avisos: [] },
        mala: { tipo: "", cifras: [], avisos: [], error: { code: ["E_CIFRAS_INVALIDO"], message: "El gráfico no publica cifras." } },
        sin_frase: { error: { code: "E_INTERNAL" } },
      },
    });
    expect(Object.keys(r)).toEqual(["cob", "mala", "sin_frase"]);
    expect(r.cob.error).toBeNull();
    expect(r.cob.cifras.cifras[0]).toEqual({ clave: "tasa:Docentes", rotulo: "Docentes: tasa", texto: "80%", valor: 80, unidad: "" });
    expect(r.mala.error).toEqual({ code: "E_CIFRAS_INVALIDO", message: "El gráfico no publica cifras." });
    expect(r.sin_frase.error?.message).toBe("No se pudieron leer las cifras de esta lámina.");
    expect(r.sin_frase.cifras).toEqual({ tipo: "", cifras: [], avisos: [] });
  });

  it("un cuerpo ilegible da un lote vacío; una entrada ausente o con error es un ApiError", () => {
    expect(normalizarCifrasLote(null)).toEqual({});
    expect(normalizarCifrasLote({ por_lamina: [] })).toEqual({});
    const ausente = errorDeEntrada(undefined);
    expect(ausente).toBeInstanceOf(ApiError);
    expect(ausente?.code).toBe("E_CIFRAS_INVALIDO");
    expect(errorDeEntrada({ cifras: { tipo: "", cifras: [], avisos: [] }, error: { code: "E_X", message: "m" } })?.code).toBe("E_X");
    expect(errorDeEntrada({ cifras: { tipo: "", cifras: [], avisos: [] }, error: null })).toBeNull();
  });
});

// La forma que escribe el motor (graficos_cifras_detalle.R) para una divergente de una fila.
const detalleDivergente = {
  forma: "divergentes",
  version: ["divergentes/1"],
  base: { n_ponderado: 45.14, n_casos: [33], texto: "Base: 33" },
  redondeo: { metodo: "estandar", decimales: 0 },
  categorias: [
    { clave: "En desacuerdo", rotulo: "En desacuerdo", especial: false, lado: "neg" },
    { clave: "De acuerdo", rotulo: "De acuerdo", especial: false, lado: "pos" },
    { clave: "No sabe", rotulo: "No sabe", especial: true, lado: "sin_inf" },
    { clave: "", rotulo: "sin clave" },
  ],
  filas: [{
    clave: "Biblioteca", rotulo: "Biblioteca", es_total: false, base: { n_ponderado: 45.14, n_casos: 33 },
    valores: [{ categoria: "En desacuerdo", texto: "36%", valor: 36, proporcion: 0.357 }, { categoria: "De acuerdo", texto: "46%", valor: "46", proporcion: null },
              { categoria: "No sabe", texto: "18%", valor: 18, proporcion: 0.18 }, { texto: "sin categoría" }],
    sumas: { lamina: { valor: 100, texto: "100%" }, estandar: { valor: 101, texto: "101%" }, reparto: { valor: 100, texto: "100%", aplica: [true] } },
    caja: { rotulo: "Acuerdo", categorias: ["De acuerdo"], valor: 46, texto: "46%", origen: "lamina" },
    lados: { negativo: { valor: 36, texto: "36%" }, neutro: { valor: 0, texto: "0%" }, positivo: { valor: 46, texto: "46%" },
             sin_informacion: { valor: 18, texto: "18%" } },
  }, { rotulo: "fila sin clave" }],
};

describe("normalizarDetalleCifras", () => {
  it("lee la divergente con sus lados, su caja y sus sumas; desempaca vectores de uno y descarta lo que no tiene clave", () => {
    const d = normalizarDetalleCifras(detalleDivergente);
    expect(d).not.toBeNull();
    expect(d?.forma).toBe("divergentes");
    expect(d?.version).toBe("divergentes/1");
    expect(d?.base).toEqual({ nPonderado: 45.14, nCasos: 33, texto: "Base: 33" });
    expect(d?.categorias.map((c) => [c.clave, c.lado, c.especial])).toEqual([
      ["En desacuerdo", "neg", false], ["De acuerdo", "pos", false], ["No sabe", "sin_inf", true],
    ]);
    expect(d?.filas).toHaveLength(1);
    const f = d!.filas[0];
    expect(f.valores).toEqual([
      { categoria: "En desacuerdo", texto: "36%", valor: 36, proporcion: 0.357 },
      { categoria: "De acuerdo", texto: "46%", valor: 46, proporcion: null },
      { categoria: "No sabe", texto: "18%", valor: 18, proporcion: 0.18 },
    ]);
    expect(f.sumas?.reparto).toEqual({ valor: 100, texto: "100%", aplica: true });
    expect(f.caja).toEqual({ valor: 46, texto: "46%", rotulo: "Acuerdo", categorias: ["De acuerdo"], origen: "lamina" });
    expect(f.lados?.sinInformacion).toEqual({ valor: 18, texto: "18%" });
  });

  it("null del motor, una forma desconocida o una fila sin sumas, caja ni lados quedan en null", () => {
    expect(normalizarDetalleCifras(null)).toBeNull();
    expect(normalizarDetalleCifras([])).toBeNull();
    expect(normalizarDetalleCifras({ forma: "pie", filas: [] })).toBeNull();
    const d = normalizarDetalleCifras({
      forma: "categorica", base: { n_ponderado: null, n_casos: "x" }, redondeo: { metodo: "otro", decimales: -1 },
      filas: [{ clave: "total", valores: [], sumas: null, caja: null, lados: null }],
    });
    expect(d?.base).toEqual({ nPonderado: null, nCasos: null, texto: "" });
    expect(d?.redondeo).toEqual({ metodo: "estandar", decimales: 0 });
    expect(d?.filas[0]).toEqual({ clave: "total", rotulo: "total", esTotal: false, base: { nPonderado: null, nCasos: null },
                                  valores: [], sumas: null, caja: null, lados: null });
  });

  it("el pedido suelto y el lote conservan las cifras con clave y suman el detalle de cada entrada", () => {
    const suelto = normalizarCifrasConDetalle({ ok: true, tipo: "divergentes/1", cifras: [], avisos: [], detalle: detalleDivergente });
    expect(suelto.tipo).toBe("divergentes/1");
    expect(suelto.detalle?.filas[0].clave).toBe("Biblioteca");
    expect(normalizarCifrasConDetalle({ tipo: "", cifras: [], avisos: ["La lámina no publica el detalle."], detalle: null }).detalle).toBeNull();
    const lote = normalizarCifrasDetalleLote({ ok: true, por_lamina: {
      antes: { tipo: "divergentes/1", cifras: [], avisos: [], detalle: detalleDivergente },
      despues: { tipo: "divergentes/1", cifras: [], avisos: [], detalle: { ...detalleDivergente, base: { n_ponderado: 40, n_casos: 29, texto: "Base: 29" } } },
      mala: { tipo: "", cifras: [], avisos: [], detalle: null, error: { code: "E_CIFRAS_INVALIDO", message: 'El gráfico "p_pie" no publica el detalle de sus cifras.' } },
    } });
    expect(Object.keys(lote)).toEqual(["antes", "despues", "mala"]);
    expect(lote.antes.detalle?.base.nCasos).toBe(33);
    expect(lote.despues.detalle?.base.nCasos).toBe(29);
    expect(lote.mala.detalle).toBeNull();
    expect(lote.mala.error?.code).toBe("E_CIFRAS_INVALIDO");
  });
});
