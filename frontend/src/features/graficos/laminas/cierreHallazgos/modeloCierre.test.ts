// El cierre con hallazgos en el editor (ADR 0135 §6): qué láminas ofrecen cifras, cómo se guarda cada hallazgo con su
// referencia viva y qué avisa una fila cuya lámina o cifra ya no está. Nada se sugiere: la frase nace vacía.
import { describe, expect, it } from "vitest";
import type { Slide } from "../../../../api/graficos";
import {
  avisoCantidad, avisoHallazgo, cifraConUnidad, completos, conCifra, conLamina, escribirHallazgos, filasIniciales, hallazgoNuevo,
  leerHallazgos, mismosHallazgos, nombreDeOrigen, origenesDelPlan, SIN_CIFRA, SIN_ORIGEN,
} from "./modeloCierre";

const lamina = (id: string, graficador: string | null, extra: Record<string, unknown> = {}): Slide => ({
  id, tipo: "p_slide_1_grafico",
  payload: { titulo: "", grafico: graficador ? { graficador, args: graficador === "p_dumbbell" ? { estilo: "resumen", cruce: null } : {} } : null, ...extra },
});

const PLAN: Slide[] = [
  { id: "s0", tipo: "p_slide_portada", payload: { titulo: "Informe" } },
  lamina("s1", "p_panorama", { meta: { antetitulo: "Panorama" } }),
  lamina("s2", "p_barras_agrupadas"),
  lamina("s3", "p_dumbbell", { titulo: "Dónde difieren" }),
  { id: "s4", tipo: "p_slide_cierre_hallazgos", payload: { hallazgos: [] } },
];

const CIFRAS = [
  { clave: "diferencia:Biblioteca", rotulo: "Biblioteca: diferencia", texto: "+12", valor: 12, unidad: "pts" },
  { clave: "valor:Biblioteca:Docentes", rotulo: "Biblioteca: Docentes", texto: "68%", valor: 68, unidad: "%" },
];

describe("las láminas de origen", () => {
  it("sólo las que publican cifras, en su orden y sin el cierre", () => {
    const o = origenesDelPlan(PLAN);
    expect(o.map((x) => [x.id, x.numero, x.graficador])).toEqual([["s1", 2, "p_panorama"], ["s3", 4, "p_dumbbell"]]);
  });

  it("se nombran por su título o, sin él, por su tarjeta; nunca por una ref cruda", () => {
    const [panorama, contraste] = origenesDelPlan(PLAN);
    expect(panorama.nombre).toBe("Lámina 2: Panorama de públicos");
    expect(contraste.nombre).toBe("Lámina 4: Dónde difieren");
    expect(nombreDeOrigen(lamina("x", null, { meta: { antetitulo: "Cobertura" } }), 7, null)).toBe("Lámina 7: Cobertura");
  });
});

describe("los hallazgos guardados", () => {
  it("se leen y se escriben con la cifra que se leyó al elegirla; una fila vacía no viaja", () => {
    const hs = leerHallazgos([{ lamina: "s3", cifra: "diferencia:Biblioteca", texto: "La biblioteca divide", cifra_al_escribir: "+12" }], (i) => `k${i}`);
    expect(hs).toEqual([{ clave: "k0", lamina: "s3", cifra: "diferencia:Biblioteca", texto: "La biblioteca divide", cifraAlEscribir: "+12" }]);
    expect(escribirHallazgos([...hs, hallazgoNuevo("k1")])).toEqual([
      { lamina: "s3", cifra: "diferencia:Biblioteca", texto: "La biblioteca divide", cifra_al_escribir: "+12" },
    ]);
  });

  it("el editor abre con tres filas como mínimo y las vacías no cuentan como cambio", () => {
    const filas = filasIniciales([], (i) => `k${i}`);
    expect(filas).toHaveLength(3);
    expect(filas.every((f) => f.texto === "" && f.cifra === "")).toBe(true);
    expect(mismosHallazgos([], filas)).toBe(true);
    expect(mismosHallazgos(undefined, filas)).toBe(true);
  });

  it("cambiar de lámina borra la cifra; elegir una cifra guarda cómo se leía", () => {
    const h = conCifra(conLamina(hallazgoNuevo("a"), "s3"), CIFRAS[0]);
    expect(h).toMatchObject({ lamina: "s3", cifra: "diferencia:Biblioteca", cifraAlEscribir: "+12", texto: "" });
    expect(conLamina(h, "s1")).toMatchObject({ lamina: "s1", cifra: "", cifraAlEscribir: "" });
  });
});

describe("los avisos de una fila", () => {
  const origenes = origenesDelPlan(PLAN);
  const base = { clave: "a", lamina: "s3", cifra: "diferencia:Biblioteca", texto: "La biblioteca divide", cifraAlEscribir: "+12" };

  it("la lámina de origen que ya no está se avisa sin inventar cifra", () => {
    expect(avisoHallazgo({ ...base, lamina: "borrada" }, origenes, null)).toBe(SIN_ORIGEN);
  });

  it("la cifra que ya no está se avisa sólo cuando ya se leyeron las de su lámina", () => {
    const sinEsa = { ...base, cifra: "diferencia:Comedor" };
    expect(avisoHallazgo(sinEsa, origenes, null)).toBeNull();
    expect(avisoHallazgo(sinEsa, origenes, CIFRAS)).toBe(SIN_CIFRA);
    expect(avisoHallazgo(base, origenes, CIFRAS)).toBeNull();
  });

  it("dice lo que falta y una fila vacía no avisa", () => {
    expect(avisoHallazgo(hallazgoNuevo("v"), origenes, null)).toBeNull();
    expect(avisoHallazgo({ ...base, texto: "" }, origenes, CIFRAS)).toBe("Falta la frase");
    expect(avisoHallazgo({ ...base, cifra: "" }, origenes, null)).toBe("Falta elegir la cifra");
  });

  it("cuenta las completas y pide de tres a cinco", () => {
    expect(completos([base, { ...base, clave: "b", texto: "" }, hallazgoNuevo("c")], origenes)).toBe(1);
    expect(avisoCantidad(2)).toBe("Van de 3 a 5 hallazgos; hay 2");
    expect(avisoCantidad(3)).toBeNull();
  });

  it("la cifra se escribe con su unidad cuando la lámina la da por entendida", () => {
    expect(cifraConUnidad(CIFRAS[0])).toBe("+12 pts");
    expect(cifraConUnidad(CIFRAS[1])).toBe("68%");
  });
});
