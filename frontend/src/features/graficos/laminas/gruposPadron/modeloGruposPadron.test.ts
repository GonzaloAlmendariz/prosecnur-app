// Grupos internos de las aperturas (ADR 0135 §6): tope de cuatro en el orden de elección, la línea «Base:» con el formato
// del motor (`.base_frase`) y el aviso del grupo chico con el texto del pie (`.dumbbell_nota_grupo_chico`).
import { describe, expect, it } from "vitest";
import {
  alternarGrupo, baseDeGrupo, filasGrupos, incluidosEnOrden, lineaBase, notaGrupoChico, rotuloEnBase, textoTope, unidadDeCruce,
} from "./modeloGruposPadron";

const OPCIONES = [
  { codigo: "1", etiqueta: "TC" }, { codigo: "2", etiqueta: "TP" }, { codigo: "3", etiqueta: "Contratado" },
  { codigo: "4", etiqueta: "Visitante" }, { codigo: "5", etiqueta: "Otro" },
];
const CONTEOS = new Map([["1", 24], ["2", 91], ["3", 139], ["4", 115], ["5", 4]]);

describe("filasGrupos y alternarGrupo", () => {
  it("encender agrega al final; con cuatro, las demás quedan bloqueadas", () => {
    let args: Record<string, unknown> = { grupos: ["2", "1"] };
    args = { ...args, ...alternarGrupo(args, "3", true) };
    args = { ...args, ...alternarGrupo(args, "4", true) };
    expect(args.grupos).toEqual(["2", "1", "3", "4"]);
    expect(alternarGrupo(args, "5", true)).toEqual({ grupos: ["2", "1", "3", "4"] });
    const filas = filasGrupos(OPCIONES, CONTEOS, args);
    expect(filas.find((f) => f.codigo === "5")).toMatchObject({ incluido: false, bloqueado: true, chico: true });
    expect(textoTope(incluidosEnOrden(filas, args).length)).toBe("4 de 4");
    expect(alternarGrupo(args, "1", false)).toEqual({ grupos: ["2", "3", "4"] });
  });

  it("sin conteo no hay n ni grupo chico", () => {
    const [f] = filasGrupos(OPCIONES, null, { grupos: ["1"] });
    expect(f).toMatchObject({ n: null, chico: false });
  });
});

describe("lineaBase", () => {
  it("escribe la base como el motor: sólo los casos, dentro de su público y en el orden de la lámina", () => {
    const args = { grupos: ["1", "2"], universos: "TP: 103", universos_no_confiables: "TC: 30" };
    const inc = incluidosEnOrden(filasGrupos(OPCIONES, CONTEOS, args), args);
    expect(lineaBase(inc, "docentes")).toBe("Base: 24 docentes de TC y 91 de TP");
    expect(lineaBase(inc)).toBe("Base: 24 de TC y 91 de TP");
    const tres = { grupos: ["3", "4", "1"] };
    expect(lineaBase(incluidosEnOrden(filasGrupos(OPCIONES, CONTEOS, tres), tres), "docentes"))
      .toBe("Base: 139 docentes de contratado, 115 de visitante y 24 de TC");
  });

  it("nombra la sigla declarada y conserva los nombres propios, como el motor", () => {
    expect(rotuloEnBase("Tiempo completo (TC)")).toBe("TC");
    expect(rotuloEnBase("Departamento Académico")).toBe("Departamento Académico");
    expect(rotuloEnBase("Segundo ciclo")).toBe("segundo ciclo");
  });

  it("un padrón que no cubre los casos no da cobertura", () => {
    expect(baseDeGrupo(120, { valor: 100, confiable: true })).toBe("120");
    expect(baseDeGrupo(1234, { valor: 2000, confiable: true })).toBe("1,234 (62%)");
  });

  it("sin dos grupos o sin conteo no hay vista previa", () => {
    const uno = incluidosEnOrden(filasGrupos(OPCIONES, CONTEOS, { grupos: ["1"] }), { grupos: ["1"] });
    expect(lineaBase(uno)).toBeNull();
    const sin = incluidosEnOrden(filasGrupos(OPCIONES, null, { grupos: ["1", "2"] }), { grupos: ["1", "2"] });
    expect(lineaBase(sin)).toBeNull();
  });
});

describe("notaGrupoChico", () => {
  it("el texto del pie del motor, en singular y en plural", () => {
    const args = { grupos: ["1", "2"] };
    const inc = incluidosEnOrden(filasGrupos(OPCIONES, CONTEOS, args), args);
    expect(notaGrupoChico(inc, unidadDeCruce("docentes$dedicacion"))).toBe("Grupo chico: 24 docentes TC.");
    const dos = { grupos: ["1", "5"] };
    expect(notaGrupoChico(incluidosEnOrden(filasGrupos(OPCIONES, CONTEOS, dos), dos), "docentes"))
      .toBe("Grupos chicos: 24 docentes TC; 4 docentes Otro.");
    expect(notaGrupoChico(incluidosEnOrden(filasGrupos(OPCIONES, CONTEOS, { grupos: ["2"] }), { grupos: ["2"] }), "docentes")).toBeNull();
  });

  it("la unidad es la base del cruce en minúscula", () => {
    expect(unidadDeCruce("Docentes$ciclo")).toBe("docentes");
    expect(unidadDeCruce("ciclo")).toBe("casos");
  });
});
