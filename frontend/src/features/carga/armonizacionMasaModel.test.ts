// F2: agrupar muchos códigos de una base en una categoría de la escala sin un
// selector por código.
import { describe, expect, test } from "vitest";
import {
  borradorDesde,
  filasDeMapa,
  reducirArmonizacion,
  resumenEsAviso,
  resumenMapa,
  textoResumenMapa,
} from "./armonizacionModel";
import {
  DESTINO_SIN_MAPA,
  accionAsignarMarcados,
  alternarMarca,
  codigosSinMapa,
  marcadosVigentes,
  marcarSinMapa,
  textoMarcados,
} from "./armonizacionMasaModel";

const ESCALA = [
  { codigo: "1", etiqueta: "Lima" },
  { codigo: "2", etiqueta: "Provincias" },
];
const DEPARTAMENTOS = [
  { codigo: "15", etiqueta: "Lima", n: 300 },
  { codigo: "1", etiqueta: "Amazonas", n: 4 },
  { codigo: "4", etiqueta: "Arequipa", n: 30 },
  { codigo: "8", etiqueta: "Cusco", n: 12 },
];
const conocidos = DEPARTAMENTOS.map((d) => d.codigo);

function borradorExplicito() {
  return borradorDesde(
    { escala: ESCALA, por_base: { b2025: { comparable: true, mapa: { "15": "1" } } } },
    ["b2025"],
  );
}

describe("marcar códigos", () => {
  test("alternar marca y desmarca sin mutar", () => {
    const vacio = new Set<string>();
    const uno = alternarMarca(vacio, "4", true);
    expect([...uno]).toEqual(["4"]);
    expect(vacio.size).toBe(0);
    expect([...alternarMarca(uno, "4", false)]).toEqual([]);
  });

  test("los vigentes siguen el orden de la tabla y olvidan códigos que ya no están", () => {
    const filas = filasDeMapa(DEPARTAMENTOS, borradorExplicito().porBase.b2025, ESCALA);
    expect(marcadosVigentes(new Set(["8", "99", "1"]), filas)).toEqual(["1", "8"]);
  });

  test("«Marcar todos los sin mapa» suma los sin mapa a lo ya marcado", () => {
    const filas = filasDeMapa(DEPARTAMENTOS, borradorExplicito().porBase.b2025, ESCALA);
    expect(codigosSinMapa(filas)).toEqual(["1", "4", "8"]);
    expect([...marcarSinMapa(new Set(["15"]), filas)].sort()).toEqual(["1", "15", "4", "8"]);
  });

  test("texto del contador", () => {
    expect(textoMarcados(0)).toBe("Ningún código marcado");
    expect(textoMarcados(1)).toBe("1 marcado");
    expect(textoMarcados(26)).toBe("26 marcados");
  });
});

describe("asignar los marcados", () => {
  test("sin marcados o sin categoría no hay acción", () => {
    expect(accionAsignarMarcados("b2025", [], "2", conocidos)).toBeNull();
    expect(accionAsignarMarcados("b2025", ["4"], "", conocidos)).toBeNull();
  });

  test("lleva todos los marcados a la categoría en una sola acción", () => {
    const accion = accionAsignarMarcados("b2025", ["1", "4", "8"], "2", conocidos);
    expect(accion).not.toBeNull();
    const b = reducirArmonizacion(borradorExplicito(), accion!);
    expect(b.porBase.b2025.mapa).toEqual({ "15": "1", "1": "2", "4": "2", "8": "2" });
  });

  test("«Sin mapa» quita el destino de los marcados", () => {
    let b = reducirArmonizacion(borradorExplicito(), accionAsignarMarcados("b2025", ["1", "4"], "2", conocidos)!);
    b = reducirArmonizacion(b, accionAsignarMarcados("b2025", ["4"], DESTINO_SIN_MAPA, conocidos)!);
    expect(b.porBase.b2025.mapa).toEqual({ "15": "1", "1": "2" });
  });

  test("con la identidad implícita, asignar unos escribe antes la identidad de los demás", () => {
    // Mapa vacío: el 1 de la base cae en el 1 de la escala por número. Asignar
    // el 4 y el 8 no puede dejar al 1 sin mapa.
    const b0 = borradorDesde({ escala: ESCALA, por_base: { b2025: { comparable: true, mapa: {} } } }, ["b2025"]);
    const b = reducirArmonizacion(b0, accionAsignarMarcados("b2025", ["4", "8"], "2", conocidos)!);
    expect(b.porBase.b2025.mapa).toEqual({ "1": "1", "4": "2", "8": "2" });
  });
});

describe("F3: una agrupación no es una etiqueta distinta", () => {
  test("varios códigos en el mismo destino no se acusan; el destino 1:1 con otra etiqueta sí", () => {
    const b = borradorDesde(
      { escala: ESCALA, por_base: { b2025: { comparable: true, mapa: { "15": "1", "1": "2", "4": "2", "8": "2" } } } },
      ["b2025"],
    );
    const filas = filasDeMapa(DEPARTAMENTOS, b.porBase.b2025, ESCALA);
    expect(filas.map((f) => [f.codigo, f.agrupado, f.etiquetaDistinta])).toEqual([
      ["15", false, false],
      ["1", true, false],
      ["4", true, false],
      ["8", true, false],
    ]);
    const r = resumenMapa(filas);
    expect(r).toMatchObject({ etiquetaDistinta: 0, agrupados: 3, categoriasAgrupadas: 1 });
    expect(textoResumenMapa(r, true)).toBe("3 códigos agrupados en 1 categoría.");
  });

  test("un solo código en un destino con otra etiqueta sigue avisándose", () => {
    const b = borradorDesde(
      { escala: ESCALA, por_base: { b2025: { comparable: true, mapa: { "15": "1", "4": "2" } } } },
      ["b2025"],
    );
    const filas = filasDeMapa(DEPARTAMENTOS, b.porBase.b2025, ESCALA);
    const r = resumenMapa(filas);
    expect(r.etiquetaDistinta).toBe(1);
    expect(r.agrupados).toBeUndefined();
    expect(textoResumenMapa(r, true)).toContain("1 código con etiqueta distinta a la de su destino.");
  });
});

describe("checklist A6: códigos sin etiqueta", () => {
  test("no se dice que caen «en su misma etiqueta»: se pide revisar el destino y es aviso", () => {
    const escala = [{ codigo: "1", etiqueta: "Frases" }, { codigo: "2", etiqueta: "Tocamientos" }];
    const entrada = { comparable: true, nota: "", mapa: {} };
    const filas = filasDeMapa([{ codigo: "1", etiqueta: null, n: 530 }, { codigo: "2", etiqueta: null, n: 77 }], entrada, escala);
    const r = resumenMapa(filas);
    expect(r.sinEtiqueta).toBe(2);
    expect(textoResumenMapa(r, false)).toBe(
      "2 códigos no traen etiqueta en esta base: revisa que cada uno vaya a su categoría. Sin mapa explícito cada código cae en el código igual de la escala.",
    );
    expect(resumenEsAviso(r, true)).toBe(true);
  });
});
