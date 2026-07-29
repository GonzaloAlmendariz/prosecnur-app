import { describe, expect, it } from "vitest";

import {
  balanceDeCruce,
  filasDeCruce,
  grupoDeCruce,
  lecturaDeCruce,
} from "./balanceDeCruce";

const cruzo = { cruzo: true, prioridad: "recuperable" as const };
const recuperable = { cruzo: false, prioridad: "recuperable" as const };
const revisable = { cruzo: false, prioridad: "revisable" as const };
const esperable = { cruzo: false, prioridad: "esperable" as const };

describe("grupoDeCruce", () => {
  it("un caso que cruzó no se clasifica por recuperabilidad", () => {
    expect(grupoDeCruce(cruzo)).toBe("cruzaron");
  });

  it("los no cruces heredan la escala de la bandeja", () => {
    expect(grupoDeCruce(recuperable)).toBe("recuperables");
    expect(grupoDeCruce(revisable)).toBe("por-revisar");
    expect(grupoDeCruce(esperable)).toBe("explicados");
  });
});

describe("balanceDeCruce", () => {
  it("cuadra: cruzaron + sin cruce es el total", () => {
    const balance = balanceDeCruce([cruzo, cruzo, recuperable, revisable, esperable]);
    expect(balance.total).toBe(5);
    expect(balance.cruzaron).toBe(2);
    expect(balance.sinCruce).toBe(3);
    expect(balance.cruzaron + balance.sinCruce).toBe(balance.total);
  });

  it("desglosa el no cruce sin solaparse", () => {
    const balance = balanceDeCruce([recuperable, recuperable, revisable, esperable]);
    expect(balance.recuperables).toBe(2);
    expect(balance.porRevisar).toBe(1);
    expect(balance.explicados).toBe(1);
    expect(balance.recuperables + balance.porRevisar + balance.explicados).toBe(balance.sinCruce);
  });

  it("sin casos no inventa cifras", () => {
    const balance = balanceDeCruce([]);
    expect(balance).toEqual({ total: 0, cruzaron: 0, sinCruce: 0, recuperables: 0, porRevisar: 0, explicados: 0 });
  });
});

describe("lecturaDeCruce", () => {
  it("nombra lo recuperable, que es sobre lo único que se puede actuar", () => {
    const texto = lecturaDeCruce(balanceDeCruce([cruzo, recuperable, esperable]));
    expect(texto).toContain("1 de 3 cruzaron");
    expect(texto).toContain("1 son recuperables");
  });

  it("cuando no hay nada que rescatar lo dice, en vez de callar", () => {
    const texto = lecturaDeCruce(balanceDeCruce([cruzo, esperable]));
    expect(texto).toContain("Ninguno de los no cruces suma");
  });

  it("si todo cruzó no menciona no cruces", () => {
    const texto = lecturaDeCruce(balanceDeCruce([cruzo, cruzo]));
    expect(texto).toBe("2 de 2 cruzaron con la base.");
  });

  it("sin datos no afirma nada", () => {
    expect(lecturaDeCruce(balanceDeCruce([]))).toContain("Sin registros");
  });
});

describe("filasDeCruce", () => {
  const id = (x: { cruzo: boolean; prioridad: "recuperable" | "revisable" | "esperable" }) => x;

  it("pone los recuperables primero y los que ya cruzaron al final", () => {
    const filas = filasDeCruce([cruzo, esperable, recuperable], id);
    const grupos = filas.filter((f) => f.tipo === "grupo").map((f) => (f.tipo === "grupo" ? f.clave : ""));
    expect(grupos).toEqual(["recuperables", "explicados", "cruzaron"]);
  });

  it("cada encabezado declara el total real de su grupo", () => {
    const filas = filasDeCruce([recuperable, recuperable, cruzo], id);
    const cabecera = filas.find((f) => f.tipo === "grupo" && f.clave === "recuperables");
    expect(cabecera?.tipo === "grupo" && cabecera.total).toBe(2);
  });

  it("no emite grupos vacíos", () => {
    const filas = filasDeCruce([cruzo, cruzo], id);
    expect(filas.filter((f) => f.tipo === "grupo")).toHaveLength(1);
  });

  it("el límite es por grupo: ningún grupo queda inalcanzable por culpa del primero", () => {
    // El defecto real: 247 recuperables agotaban un tope global de 160 y los
    // casos que sí cruzaron no se podían ver nunca.
    const muchos = Array.from({ length: 200 }, () => recuperable);
    const filas = filasDeCruce([...muchos, cruzo, cruzo], id, 3);
    const grupos = filas.filter((f) => f.tipo === "grupo");
    expect(grupos).toHaveLength(2);
    expect(filas.filter((f) => f.tipo === "caso")).toHaveLength(5);
  });

  it("cada cabecera declara su total real aunque el recorte muestre menos", () => {
    const filas = filasDeCruce([recuperable, recuperable, recuperable], id, 1);
    const grupo = filas.find((f) => f.tipo === "grupo");
    expect(grupo?.tipo === "grupo" && grupo.total).toBe(3);
    expect(filas.filter((f) => f.tipo === "caso")).toHaveLength(1);
  });

  it("sin casos no devuelve filas", () => {
    expect(filasDeCruce([], id)).toEqual([]);
  });
});
