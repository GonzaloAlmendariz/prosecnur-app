// «Elegir cifra» (modeloElegirCifra.ts): las cifras de todas las láminas de resumen agrupadas por lámina, con columnas por
// medida; la búsqueda sin tildes; el orden por valor o por la lámina; y el recorrido con el teclado por la rejilla.
import { describe, expect, it } from "vitest";
import type { CifraClave } from "../../../../api/graficosCifras";
import {
  agruparCifras, buscarCifras, celdaDe, cifrasVisibles, encabezadoMedida, filaConVarias, idCelda, moverActiva, ordenarCifras,
  partirRotulo, rejillaDeOpciones, esDiferencia, valorDeFila, type CifrasLeidas,
} from "./modeloElegirCifra";

const cifra = (clave: string, rotulo: string, texto: string, valor: number | null, unidad = "%"): CifraClave => ({ clave, rotulo, texto, valor, unidad });
const listas = (cifras: CifraClave[]): CifrasLeidas => ({ cifras, cargando: false, error: null });

const DIVERGENTES = listas([
  cifra("t2b:Biblioteca", "Biblioteca: acuerdo", "61%", 61),
  cifra("sin_info:Biblioteca", "Biblioteca: Sin información", "9%", 9),
  cifra("t2b:Atención: trámites", "Atención: trámites: acuerdo", "74%", 74),
  cifra("sin_info:Atención: trámites", "Atención: trámites: Sin información", "3%", 3),
  cifra("t2b:Comedor", "Comedor: acuerdo", "48%", 48),
]);
const FORTALEZAS = listas([
  cifra("valor:Tutoría", "Tutoría (fortalezas)", "82%", 82),
  cifra("valor:Sílabo", "Sílabo (fortalezas)", "70%", 70),
  cifra("valor:Laboratorios", "Laboratorios (alertas)", "35%", null),
]);
const BRECHAS = { id: "s2", nombre: "Lámina 2: Brechas, escala bajo 60%" };
const FUERTES = { id: "s5", nombre: "Lámina 5: Fortalezas y alertas, docentes" };

describe("agrupar por lámina", () => {
  it("parte el rótulo por el último «: » (la pregunta puede traer dos puntos)", () => {
    expect(partirRotulo("Atención: trámites: acuerdo")).toEqual({ entidad: "Atención: trámites", medida: "acuerdo" });
    expect(partirRotulo("Tutoría (fortalezas)")).toEqual({ entidad: "Tutoría (fortalezas)", medida: "" });
    expect(encabezadoMedida("acuerdo")).toBe("Acuerdo");
  });

  it("una fila por pregunta y una columna por medida; la que falta queda vacía", () => {
    const g = agruparCifras(BRECHAS, DIVERGENTES);
    expect(g.estado).toBe("listo");
    expect(g.medidas).toEqual(["acuerdo", "Sin información"]);
    expect(g.filas.map((f) => f.entidad)).toEqual(["Biblioteca", "Atención: trámites", "Comedor"]);
    expect(g.filas[2].celdas.map((c) => c?.cifra.texto ?? null)).toEqual(["48%", null]);
    expect(g.filas[0].celdas[1]?.id).toBe(idCelda("s2", "sin_info:Biblioteca"));
  });

  it("dice si la lámina todavía carga, falló o no dibujó cifras", () => {
    expect(agruparCifras(BRECHAS, undefined).estado).toBe("cargando");
    expect(agruparCifras(BRECHAS, { cifras: null, cargando: false, error: "Sin datos" })).toMatchObject({ estado: "error", error: "Sin datos" });
    expect(agruparCifras(BRECHAS, listas([])).estado).toBe("sin-cifras");
  });
});

describe("buscar", () => {
  const grupos = [agruparCifras(BRECHAS, DIVERGENTES), agruparCifras(FUERTES, FORTALEZAS)];

  it("sin tildes ni mayúsculas, por todas las palabras", () => {
    const r = buscarCifras(grupos, "atencion TRAMITES");
    expect(r.map((g) => g.lamina)).toEqual(["s2"]);
    expect(r[0].filas.map((f) => f.entidad)).toEqual(["Atención: trámites"]);
  });

  it("el nombre de la lámina trae todas sus filas; vacía devuelve todo", () => {
    expect(buscarCifras(grupos, "fortalezas docentes")[0].filas).toHaveLength(3);
    expect(cifrasVisibles(buscarCifras(grupos, ""))).toBe(8);
    expect(buscarCifras(grupos, "inexistente")).toEqual([]);
  });

  it("también por la cifra misma", () => {
    expect(buscarCifras(grupos, "74%")[0].filas.map((f) => f.entidad)).toEqual(["Atención: trámites"]);
  });
});

describe("ordenar", () => {
  const grupos = [agruparCifras(BRECHAS, DIVERGENTES), agruparCifras(FUERTES, FORTALEZAS)];

  it("por valor: dentro de cada lámina, de mayor a menor por su primera columna, sin valor al final", () => {
    const r = ordenarCifras(grupos, "valor");
    expect(r.map((g) => g.lamina)).toEqual(["s2", "s5"]);
    expect(r[0].filas.map((f) => f.entidad)).toEqual(["Atención: trámites", "Biblioteca", "Comedor"]);
    expect(r[1].filas.map((f) => f.entidad)).toEqual(["Tutoría (fortalezas)", "Sílabo (fortalezas)", "Laboratorios (alertas)"]);
  });

  it("C5: las diferencias en puntos van por su tamaño, no por su signo; los porcentajes, por su valor", () => {
    const contraste = agruparCifras({ id: "s7", nombre: "Lámina 7: Contraste" }, listas([
      cifra("diferencia:Biblioteca", "Biblioteca: diferencia (Docentes menos Estudiantes)", "+9", 9, "pts"),
      cifra("valor:Biblioteca:Docentes", "Biblioteca: Docentes", "70%", 70),
      cifra("diferencia:Comedor", "Comedor: diferencia (Docentes menos Estudiantes)", "−14", -14, "pts"),
      cifra("valor:Comedor:Docentes", "Comedor: Docentes", "40%", 40),
      cifra("diferencia:Tutoría", "Tutoría: diferencia (Docentes menos Estudiantes)", "+3", 3, "pts"),
      cifra("valor:Tutoría:Docentes", "Tutoría: Docentes", "90%", 90),
    ]));
    expect(ordenarCifras([contraste], "valor")[0].filas.map((f) => f.entidad)).toEqual(["Comedor", "Biblioteca", "Tutoría"]);
    expect(esDiferencia({ clave: "diferencia:x", unidad: "" })).toBe(true);
    expect(esDiferencia({ clave: "t2b:x", unidad: "%" })).toBe(false);
    expect(valorDeFila(ordenarCifras(grupos, "valor")[0].filas[0])).toBe(74);
  });

  it("orden de la lámina: el que publicó el motor", () => {
    const r = ordenarCifras(ordenarCifras(grupos, "valor"), "lamina");
    expect(r[0].filas.map((f) => f.entidad)).toEqual(["Biblioteca", "Atención: trámites", "Comedor"]);
  });
});

describe("el teclado recorre la rejilla", () => {
  const grupos = [agruparCifras(BRECHAS, DIVERGENTES), agruparCifras(FUERTES, FORTALEZAS)];
  const rejilla = rejillaDeOpciones(grupos);
  const id = (l: string, c: string) => idCelda(l, c);

  it("abajo entra por la primera y pasa de una lámina a la siguiente conservando la columna posible", () => {
    expect(moverActiva(rejilla, null, "abajo")).toBe(id("s2", "t2b:Biblioteca"));
    expect(moverActiva(rejilla, null, "arriba")).toBe(id("s5", "valor:Laboratorios"));
    expect(moverActiva(rejilla, id("s2", "sin_info:Biblioteca"), "abajo")).toBe(id("s2", "sin_info:Atención: trámites"));
    expect(moverActiva(rejilla, id("s2", "sin_info:Atención: trámites"), "abajo")).toBe(id("s2", "t2b:Comedor"));
    expect(moverActiva(rejilla, id("s2", "t2b:Comedor"), "abajo")).toBe(id("s5", "valor:Tutoría"));
  });

  it("izquierda y derecha no salen de la fila; no da la vuelta", () => {
    expect(moverActiva(rejilla, id("s2", "t2b:Biblioteca"), "derecha")).toBe(id("s2", "sin_info:Biblioteca"));
    expect(moverActiva(rejilla, id("s2", "sin_info:Biblioteca"), "derecha")).toBe(id("s2", "sin_info:Biblioteca"));
    expect(moverActiva(rejilla, id("s2", "t2b:Biblioteca"), "arriba")).toBe(id("s2", "t2b:Biblioteca"));
    expect(moverActiva(rejilla, id("s2", "t2b:Comedor"), "inicio")).toBe(id("s2", "t2b:Biblioteca"));
    expect(moverActiva(rejilla, id("s2", "t2b:Comedor"), "fin")).toBe(id("s5", "valor:Laboratorios"));
  });

  it("sabe qué fila tiene varias medidas y encuentra la celda de un id", () => {
    expect(filaConVarias(rejilla, id("s2", "t2b:Biblioteca"))).toBe(true);
    expect(filaConVarias(rejilla, id("s2", "t2b:Comedor"))).toBe(false);
    expect(filaConVarias(rejilla, null)).toBe(false);
    expect(celdaDe(grupos, id("s5", "valor:Sílabo"))?.cifra.texto).toBe("70%");
    expect(moverActiva([], null, "abajo")).toBeNull();
  });
});
