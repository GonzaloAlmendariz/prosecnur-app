// @vitest-environment happy-dom
// E8 con la maqueta v4 (2026-11-03): tonos de la tabla frente al total, puntos enfrentados para única × múltiple,
// cajas con fechas, la diferencia de fechas en cifras, el dato imposible y las listas de la abierta.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import CruceCajas, { diferenciaEnCifras } from "../CruceCajas";
import CruceDispersion, { AvisoImposible, negativosImposibles, noPuedeSerNegativa } from "../CruceDispersion";
import CruceEnfrentados, { enfrentados } from "../CruceEnfrentados";
import CruceLista from "../CruceLista";
import CruceRecodificacion, { recodificacion } from "../CruceRecodificacion";
import { desviaciones, modeloCalor, tonoDeCelda } from "../explorarModelo";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const caja = (etiqueta: string, n: number, min: number, p25: number, mediana: number, p75: number, max: number, n_atipicos = 0) => ({ etiqueta, n, min, p25, mediana, p75, max, n_atipicos });

describe("tabla de calor: el tono frente al total (E8a)", () => {
  const tabla = {
    filas: [{ codigo: "1", etiqueta: "Hombre", n: 640 }, { codigo: "2", etiqueta: "Mujer", n: 641 }, { codigo: "9", etiqueta: "Otro", n: 2 }],
    columnas: [{ codigo: "a", etiqueta: "Ate", n: 210 }, { codigo: "b", etiqueta: "Breña", n: 20 }],
    n: [[90, 10], [120, 9], [0, 1]],
  };

  it("en % el tono son tramos de 2, 5 y 10 puntos; una columna de menos de 30 casos queda neutra y sin flecha", () => {
    const m = modeloCalor(tabla, "columna", 1283);
    const ate = m.filas.map((f) => tonoDeCelda(f.celdas[0], "columna"));
    expect(ate).toEqual(["is-bajo2", "is-sobre2", "is-parejo"]);   // 42.9 y 57.1 frente a 49.9 y 50.0: siete puntos
    const brena = m.filas.map((f) => f.celdas[1]);
    expect(brena.every((c) => c.chica && c.marca === null)).toBe(true);
    expect(brena.map((c) => tonoDeCelda(c, "columna"))).toEqual(["is-parejo", "is-parejo", "is-parejo"]);
    // …y una columna chica no aparece entre lo que se aparta del total.
    expect(desviaciones(m, 10).every((d) => !d.titulo.startsWith("Breña"))).toBe(true);
  });

  it("en n el tono es el conteo en cinco tramos", () => {
    const m = modeloCalor(tabla, "n", 1283);
    expect(tonoDeCelda(m.filas[1].celdas[0], "n")).toBe("is-n5");
    expect(tonoDeCelda(m.filas[2].celdas[0], "n")).toBe("is-n1");
  });
});

describe("única × múltiple en puntos enfrentados (E8b, E8c)", () => {
  // Réplica de E2_sex × d1_information: 258 hombres y 301 mujeres responden; «Otro» tiene un caso.
  const soSm = {
    filas: [{ codigo: "1", etiqueta: "Hombre", n: 258 }, { codigo: "2", etiqueta: "Mujer", n: 301 }, { codigo: "3", etiqueta: "Otro", n: 1 }],
    columnas: [{ codigo: "a", etiqueta: "Redes sociales", n: 355 }, { codigo: "b", etiqueta: "Otro", n: 33 }, { codigo: "c", etiqueta: "Amigos o familiares", n: 101 }],
    n: [[164, 15, 34], [190, 18, 67], [1, 0, 0]],
  };

  it("cada % divide entre los casos del grupo; el total, entre la base; «Otro» al final y el grupo chico aparte", () => {
    const d = enfrentados(soSm, "so", "sm", 560)!;
    expect(d.grupos.map((g) => g.etiqueta)).toEqual(["Hombre", "Mujer"]);
    expect(d.chicos).toEqual([{ etiqueta: "Otro", n: 1 }]);
    expect(d.opciones.map((o) => o.etiqueta)).toEqual(["Redes sociales", "Amigos o familiares", "Otro"]);
    const amigos = d.opciones[1];
    expect(amigos.valores[0]).toBeCloseTo((100 * 34) / 258, 6);
    expect(amigos.valores[1]).toBeCloseTo((100 * 67) / 301, 6);
    expect(amigos.total).toBeCloseTo((100 * 101) / 560, 6);
  });

  it("el sentido inverso (múltiple × única) da los mismos puntos", () => {
    const smSo = {
      filas: soSm.columnas.map((c) => ({ ...c })),
      columnas: soSm.filas.map((f) => ({ codigo: f.codigo, etiqueta: f.etiqueta, n: f.n })),
      n: soSm.columnas.map((_, j) => soSm.n.map((fila) => fila[j])),
    };
    expect(enfrentados(smSo, "sm", "so", 560)).toEqual(enfrentados(soSm, "so", "sm", 560));
  });

  it("en el borde: un grupo de 29 casos es chico, uno de 30 se dibuja; todos chicos o base 0, a la tabla", () => {
    const borde = { ...soSm, filas: [{ codigo: "1", etiqueta: "A", n: 30 }, { codigo: "2", etiqueta: "B", n: 30 }, { codigo: "3", etiqueta: "C", n: 29 }] };
    const d = enfrentados(borde, "so", "sm", 89)!;
    expect(d.grupos.map((g) => g.etiqueta)).toEqual(["A", "B"]);
    expect(d.chicos.map((g) => g.etiqueta)).toEqual(["C"]);
    const chicos = { ...soSm, filas: soSm.filas.map((f) => ({ ...f, n: 10 })) };
    expect(enfrentados(chicos, "so", "sm", 30)).toBeNull();
    expect(enfrentados(soSm, "so", "sm", 0)).toBeNull();
  });

  it("múltiple × única sin los casos de cada opción vuelve a la tabla, no a un total en 0 %", () => {
    const smSo = {
      filas: soSm.columnas.map((c) => ({ ...c, n: null })),
      columnas: soSm.filas.map((f) => ({ codigo: f.codigo, etiqueta: f.etiqueta, n: f.n })),
      n: soSm.columnas.map((_, j) => soSm.n.map((fila) => fila[j])),
    };
    expect(enfrentados(smSo, "sm", "so", 560)).toBeNull();
  });

  it("con más de tres grupos firmes, o sin los casos por grupo, vuelve a la tabla", () => {
    const muchos = { ...soSm, filas: [1, 2, 3, 4].map((i) => ({ codigo: String(i), etiqueta: `G${i}`, n: 100 })), n: [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]] };
    expect(enfrentados(muchos, "so", "sm", 400)).toBeNull();
    expect(enfrentados({ ...soSm, filas: soSm.filas.map((f) => ({ ...f, n: null })) }, "so", "sm", 560)).toBeNull();
    expect(enfrentados(soSm, "so", "so", 560)).toBeNull();
  });

  it("destaca la opción con 5 puntos o más de brecha, con sus dos cifras", () => {
    act(() => root.render(<CruceEnfrentados datos={enfrentados(soSm, "so", "sm", 560)!} />));
    expect(host.querySelectorAll(".vx-svg-fila-destacada")).toHaveLength(1);
    expect(host.querySelector(".vx-svg-categoria.is-fuerte")?.textContent).toBe("Amigos o familiares");
    expect(Array.from(host.querySelectorAll("text.vx-svg-valor")).map((t) => t.textContent)).toEqual(["13%", "22%"]);
    expect(host.textContent).toContain("«Otro» (1 caso) no se dibuja");
  });
});

describe("cajas y fechas (E8e, E8f, E8g)", () => {
  it("con una fecha, el eje es el de dos líneas de Monitoreo y la mediana dice su día", () => {
    act(() => root.render(<CruceCajas origen="2026-06-28" grupos={[caja("Hombre", 640, 0, 1, 2, 3, 5), caja("Mujer", 641, 0, 1, 2, 4, 5)]} />));
    expect(Array.from(host.querySelectorAll("text.mon-eje-fecha.is-mes")).map((t) => t.textContent)).toEqual(["jun", "jul"]);
    expect(Array.from(host.querySelectorAll("text.vx-svg-valor")).map((t) => t.textContent)).toEqual(["30 jun", "30 jun"]);
  });

  it("un grupo con menos de 30 casos se atenúa", () => {
    act(() => root.render(<CruceCajas grupos={[caja("Hombre", 640, 18, 29, 40, 52, 91), caja("Otro", 2, 43, 44, 44, 45, 45)]} />));
    expect(host.querySelectorAll(".vx-svg-grupo.is-chico")).toHaveLength(1);
  });

  it("dos fechas que casi siempre coinciden se dicen en cifras; con diferencias variadas, en caja", () => {
    expect(diferenciaEnCifras(caja("d", 1283, -1, 0, 0, 0, 0, 2))).toEqual({ coinciden: 1281, distintos: 2, pctCoinciden: (100 * 1281) / 1283 });
    expect(diferenciaEnCifras(caja("d", 10, 0, 0, 0, 0, 0))).toEqual({ coinciden: 10, distintos: 0, pctCoinciden: 100 });
    expect(diferenciaEnCifras(caja("d", 10, 0, 1, 3, 4, 9))).toBeNull();
    expect(diferenciaEnCifras(caja("d", 50, 0, 0, 0, 0, 3, 1))?.distintos).toBe(1);
    expect(diferenciaEnCifras(caja("d", 50, -2, 0, 0, 0, 0, 1))?.distintos).toBe(1);   // una diferencia negativa también es «otro día»
  });
});

describe("dispersión y dato imposible (E8h)", () => {
  it("reconoce por nombre o rótulo lo que no puede ser negativo, sin inventar en lo demás", () => {
    expect(noPuedeSerNegativa("duracion_total")).toBe(true);
    expect(noPuedeSerNegativa("E1_age", "¿Cuál es su edad?")).toBe(true);
    expect(noPuedeSerNegativa("saldo", "Saldo de la cuenta")).toBe(false);
    expect(noPuedeSerNegativa("p12", "¿Cómo ve la sociedad peruana?")).toBe(false);
    expect(noPuedeSerNegativa("p3", "Puntaje en la segunda medición")).toBe(false);
    expect(noPuedeSerNegativa("dif_tiempo", "Cambio en el tiempo de espera")).toBe(false);
    expect(negativosImposibles([[1, -3], [2, 4]], true)).toBe(1);
    expect(negativosImposibles([[1, -3]], false)).toBe(0);
    expect(negativosImposibles([[-5, 3], [2, 4]], true, 0)).toBe(1);
  });

  it("con muestra, el aviso habla de los valores dibujados y no de «los N valores»", () => {
    act(() => root.render(<AvisoImposible imposibles={3000} dibujados={3000} n={5200} rotulo="duracion_total" />));
    expect(host.textContent).toContain("3,000 de los 3,000 valores dibujados");
    act(() => root.render(<AvisoImposible imposibles={37} dibujados={37} n={37} rotulo="duracion_total" />));
    expect(host.textContent).toContain("los 37 valores de duracion_total");
  });

  it("una duración imposible en el eje horizontal también apaga la tendencia", () => {
    act(() => root.render(<CruceDispersion puntos={[[-200, 20], [-250, 30], [-100, 40]]} tendencia={{ pendiente: 1, intercepto: 0 }} n={3} rotuloX="duracion_total" rotuloY="Edad" noNegativaX />));
    expect(host.querySelector(".vx-svg-tendencia")).toBeNull();
  });

  it("con valores imposibles sombrea bajo 0 y no dibuja la tendencia", () => {
    act(() => root.render(<CruceDispersion puntos={[[20, -200], [30, -250], [40, -100]]} tendencia={{ pendiente: 1, intercepto: 0 }} n={3} rotuloX="Edad" rotuloY="duracion_total" noNegativaY />));
    expect(host.querySelector(".vx-svg-imposible")).toBeTruthy();
    expect(host.querySelector(".vx-svg-tendencia")).toBeNull();
    expect(host.textContent).toContain("Base chica: 3 casos.");
  });
});

it("las listas de la abierta comparten la escala entre grupos (E8m)", () => {
  act(() => root.render(<CruceLista grupos={[
    { etiqueta: "Hombre", respuestas: [{ texto: "Barrio", n: 1 }, { texto: "Oscar", n: 1 }] },
    { etiqueta: "Mujer", respuestas: [{ texto: "Barrio", n: 2 }, { texto: "Colegio", n: 1 }] },
  ]} />));
  const anchos = Array.from(host.querySelectorAll<HTMLElement>(".vx-texto-barra > i")).map((i) => i.style.width);
  expect(anchos).toEqual(["50%", "50%", "100%", "50%"]);
  expect(host.querySelectorAll("li.is-mayor")).toHaveLength(1);
  expect(host.querySelector("h5")?.textContent).toBe("Hombre2 respuestas");
});

describe("una múltiple contra su recodificación (E8d)", () => {
  // Réplica de d1_information × d1_information_recod: de 33 «Otro», 30 pasan a categorías nuevas y 3 se quedan.
  const tabla = {
    filas: [{ codigo: "a", etiqueta: "Redes", n: 355 }, { codigo: "b", etiqueta: "Radio", n: 26 }, { codigo: "o", etiqueta: "Otro", n: 33 }],
    columnas: [
      { codigo: "a", etiqueta: "Redes", n: 355 }, { codigo: "b", etiqueta: "Radio", n: 26 }, { codigo: "o", etiqueta: "Otro", n: 3 },
      { codigo: "e", etiqueta: "Espacios públicos", n: 12 }, { codigo: "t", etiqueta: "Trabajo", n: 18 },
    ],
    n: [[355, 4, 1, 2, 3], [4, 26, 0, 1, 0], [2, 1, 3, 12, 18]],
  };

  it("separa lo intacto de adónde fueron los casos de la opción que cambió", () => {
    const r = recodificacion(tabla)!;
    expect(r.intactas.map((o) => o.etiqueta)).toEqual(["Redes", "Radio"]);
    expect(r.cambios).toEqual([{ etiqueta: "Otro", n: 33, quedan: 3, destinos: [{ etiqueta: "Trabajo", n: 18 }, { etiqueta: "Espacios públicos", n: 12 }] }]);
    act(() => root.render(<CruceRecodificacion datos={r} />));
    expect(host.textContent).toContain("Adónde fueron los 33 casos de «Otro»");
    expect(host.textContent).toContain("Sigue en «Otro»");
  });

  it("dos múltiples distintas no son una recodificación", () => {
    expect(recodificacion({ ...tabla, columnas: tabla.columnas.map((c) => ({ ...c, etiqueta: `${c.etiqueta} (2)` })) })).toBeNull();
    expect(recodificacion({ ...tabla, n: [[300, 4, 1, 2, 3], [4, 20, 0, 1, 0], [2, 1, 3, 12, 18]] })).toBeNull();
  });
});
