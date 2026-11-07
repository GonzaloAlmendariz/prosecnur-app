// Mata: una fórmula que no evalúa lo que la frase dice, un sorteo con varios once(random()) que sortean distinto,
// pesos que no suman 100 aceptados y un literal con apóstrofo que rompe la fórmula. El oráculo es el evaluador de Probar.
import { describe, expect, it } from "vitest";
import { calcularValores } from "../../shell/simulador/calculosPrueba";
import { evaluarCalculo } from "../../logic/probarCalculo";
import type { BuilderNode } from "../../types";
import { aFormula, deFormula, faltantes, filasAuxiliares, intencionVacia, literalDe, type Intencion } from "./modeloCalculo";

const evaluar = (f: string | null, r: Record<string, string>) => {
  const res = evaluarCalculo(f ?? "", r);
  return res.estado === "ok" ? res.valor : "(no evaluable)";
};

describe("armador de cálculos por intención", () => {
  it("un valor según respuestas", () => {
    const i: Intencion = {
      tipo: "segun",
      casos: [
        { pregunta: "edad", operador: "<", valor: "18", resultado: "menor" },
        { pregunta: "medios", operador: "marcó", valor: "radio", resultado: "oye radio" },
      ],
      siNo: "otro",
    };
    const f = aFormula(i);
    expect(f).toBe("if(${edad} < 18, 'menor', if(selected(${medios}, 'radio'), 'oye radio', 'otro'))");
    expect(evaluar(f, { edad: "15", medios: "" })).toBe("menor");
    expect(evaluar(f, { edad: "30", medios: "tv radio" })).toBe("oye radio");
    expect(evaluar(f, { edad: "30", medios: "tv" })).toBe("otro");
  });

  it("una cuenta con números y un promedio", () => {
    expect(evaluar(aFormula({ tipo: "operar", operacion: "sumar", preguntas: ["a", "b"], constante: "1" }), { a: "2", b: "3" })).toBe("6");
    expect(evaluar(aFormula({ tipo: "operar", operacion: "promedio", preguntas: ["a", "b"], constante: "" }), { a: "2", b: "4" })).toBe("3");
  });

  it("cuántas opciones marcó y unir textos", () => {
    expect(evaluar(aFormula({ tipo: "contar", pregunta: "m" }), { m: "a b c" })).toBe("3");
    expect(evaluar(aFormula({ tipo: "unir", partes: [{ tipo: "texto", valor: "Hola " }, { tipo: "pregunta", valor: "nom" }] }), { nom: "Ana" })).toBe("Hola Ana");
  });

  it("un sorteo lee UN número al azar guardado aparte y respeta los pesos", () => {
    const i: Intencion = { tipo: "sortear", azar: "s_azar", valores: [{ valor: "A", peso: "20" }, { valor: "B", peso: "80" }] };
    const f = aFormula(i)!;
    expect(f).not.toContain("random");
    const filas = filasAuxiliares(i);
    expect(filas).toEqual([{ name: "s_azar", calculation: "once(random())" }]);
    const nodos = [...filas, { name: "s", calculation: f }].map((x, k) => ({ ...x, kind: "calculate", rowIndex: k }) as unknown as BuilderNode);
    let a = 0;
    for (let semilla = 0; semilla < 2000; semilla += 1) if (calcularValores(nodos, {}, semilla).s === "A") a += 1;
    expect(a / 2000).toBeGreaterThan(0.17);
    expect(a / 2000).toBeLessThan(0.23);
  });

  it("lo que falta se dice y no hay fórmula", () => {
    expect(aFormula(intencionVacia("segun"))).toBeNull();
    expect(faltantes({ tipo: "sortear", azar: "z", valores: [{ valor: "A", peso: "30" }, { valor: "B", peso: "30" }] })[0]).toMatch(/sumar 100/);
    expect(faltantes(intencionVacia("sortear")).join(" ")).toMatch(/número al azar/);
  });

  it("los literales no rompen la fórmula", () => {
    expect(literalDe("12")).toBe("12");
    expect(literalDe("l'atelier")).toBe(`"l'atelier"`);
  });

  it("un código de opción va entre comillas aunque sea un número", () => {
    const base = { tipo: "segun" as const, siNo: "otro" };
    expect(aFormula({ ...base, casos: [{ pregunta: "medios", operador: "marcó", valor: "1", resultado: "tv" }] }))
      .toBe("if(selected(${medios}, '1'), 'tv', 'otro')");
    expect(aFormula({ ...base, casos: [{ pregunta: "sexo", operador: "=", valor: "2", resultado: "m", codigo: true }] }))
      .toBe("if(${sexo} = '2', 'm', 'otro')");
    expect(aFormula({ ...base, casos: [{ pregunta: "edad", operador: "<", valor: "18", resultado: "menor" }] }))
      .toBe("if(${edad} < 18, 'menor', 'otro')");
  });
});

describe("de la fórmula a la intención", () => {
  const ida: Intencion[] = [
    { tipo: "segun", casos: [{ pregunta: "edad", operador: "<", valor: "18", resultado: "menor" }], siNo: "adulto" },
    { tipo: "segun", casos: [{ pregunta: "medios", operador: "marcó", valor: "1", resultado: "tv" }, { pregunta: "sexo", operador: "=", valor: "2", resultado: "m", codigo: true }], siNo: "otro" },
    { tipo: "operar", operacion: "sumar", preguntas: ["hijos", "hijas"], constante: "" },
    { tipo: "operar", operacion: "promedio", preguntas: ["a", "b", "c"], constante: "" },
    { tipo: "operar", operacion: "multiplicar", preguntas: ["horas"], constante: "60" },
    { tipo: "contar", pregunta: "medios" },
    { tipo: "sortear", azar: "az", valores: [{ valor: "A", peso: "" }, { valor: "B", peso: "" }, { valor: "C", peso: "" }] },
    { tipo: "sortear", azar: "az", valores: [{ valor: "A", peso: "30" }, { valor: "B", peso: "70" }] },
    { tipo: "unir", partes: [{ tipo: "texto", valor: "Hola " }, { tipo: "pregunta", valor: "nombre" }] },
  ];
  it("cada intención armada se lee de vuelta igual", () => {
    for (const i of ida) expect(deFormula(aFormula(i)!)).toEqual(i);
  });
  it("lee las fórmulas reales del conjoint", () => {
    expect(deFormula("if(int(${cj_t1A_edad_r} * 3) = 0, '1', if(int(${cj_t1A_edad_r} * 3) = 1, '2', '3'))")?.tipo).toBe("sortear");
    expect(deFormula("if(${cj_t1A_edad} = 1, '35 años', if(${cj_t1A_edad} = 2, '50 años', '65 años'))")?.tipo).toBe("segun");
  });
  it("lo que no sabe reescribir idéntico queda para la edición a mano", () => {
    expect(deFormula("once(random())")).toBeNull();
    expect(deFormula("int((today() - ${nac}) div 365.25)")).toBeNull();
    expect(deFormula("if(${a} = 1 and ${b} = 2, 'x', 'y')")).toBeNull();
    expect(deFormula("${a} + ${b} * 2")).toBeNull();
  });
});
