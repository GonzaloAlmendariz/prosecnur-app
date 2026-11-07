import { describe, expect, it } from "vitest";
import {
  alternarPregunta, avisoGrupo, filasAGrupos, gruposAFilas, mismosGrupos, preguntasDelMapa, quedanLibres,
} from "./modeloAgruparLista";
import { camposDeDatos } from "./argsDatosGrafico";
import type { ArgMetadata } from "../../../api/graficos";

// La lámina de residencia de CCSS Perfil 2026 (ccss-011): A6_1 son los distritos de Lima y A6_2 los del Callao.
const CCSS = { var: "A6_1", juntar: ["A6_2"], area: "lima_callao", agrupar_lista: { Callao: ["A6_2"] } };
const MAPA = preguntasDelMapa(CCSS);

describe("agrupar en la lista del mapa de distribución", () => {
  it("las preguntas que se pueden marcar son `var` y `juntar`, sin repetir", () => {
    expect(MAPA).toEqual(["A6_1", "A6_2"]);
    expect(preguntasDelMapa({ var: "b$A6_1", juntar: ["A6_1", "A6_3"] })).toEqual(["b$A6_1", "A6_3"]);
    expect(preguntasDelMapa({})).toEqual([]);
  });
  it("lee la lista con nombre guardada (ccss-011) y el texto por líneas", () => {
    expect(gruposAFilas(CCSS.agrupar_lista)).toEqual([{ clave: "g0", rotulo: "Callao", preguntas: ["A6_2"] }]);
    // Una pregunta suelta, sin envolver en lista (lo que deja R con un vector de largo uno).
    expect(gruposAFilas({ Callao: "A6_2" })[0].preguntas).toEqual(["A6_2"]);
    expect(gruposAFilas("Callao | A6_2\nLima | A6_1, A6_3")).toEqual([
      { clave: "g0", rotulo: "Callao", preguntas: ["A6_2"] },
      { clave: "g1", rotulo: "Lima", preguntas: ["A6_1", "A6_3"] },
    ]);
    expect(gruposAFilas(null)).toEqual([]);
    expect(gruposAFilas(["A6_2"])).toEqual([]);
  });
  it("escribe la lista con nombre que lee el motor, también si estaba guardado como texto", () => {
    expect(filasAGrupos(gruposAFilas("Callao | A6_2"), MAPA)).toEqual({ Callao: ["A6_2"] });
    expect(mismosGrupos(CCSS.agrupar_lista, gruposAFilas(CCSS.agrupar_lista), MAPA)).toBe(true);
    expect(mismosGrupos("Callao | A6_2", gruposAFilas(CCSS.agrupar_lista), MAPA)).toBe(true);
  });
  it("agregar una fila: incompleta no se guarda; con rótulo y pregunta, sí", () => {
    const vacia = [{ clave: "n", rotulo: "", preguntas: [] }];
    expect(avisoGrupo(vacia, 0, MAPA)).toBe("Falta el rótulo y las preguntas: no sale.");
    expect(filasAGrupos(vacia, MAPA)).toBeNull();
    const conRotulo = [{ ...vacia[0], rotulo: "Callao" }];
    expect(avisoGrupo(conRotulo, 0, MAPA)).toBe("Marca al menos una pregunta: no sale.");
    const lista = alternarPregunta(conRotulo, 0, "A6_2");
    expect(filasAGrupos(lista, MAPA)).toEqual({ Callao: ["A6_2"] });
  });
  it("quitar: desmarcar la última pregunta o quitar la fila borra el arg (null)", () => {
    const filas = gruposAFilas(CCSS.agrupar_lista);
    expect(filasAGrupos(alternarPregunta(filas, 0, "A6_2"), MAPA)).toBeNull();
    expect(filasAGrupos([], MAPA)).toBeNull();
  });
  it("una pregunta va en una sola fila; dos filas no comparten rótulo", () => {
    const filas = [{ clave: "a", rotulo: "Callao", preguntas: ["A6_2"] }, { clave: "b", rotulo: "Lima", preguntas: [] }];
    expect(alternarPregunta(filas, 1, "A6_2")[1].preguntas).toEqual([]);
    const repetido = [filas[0], { clave: "b", rotulo: "callao", preguntas: ["A6_1"] }];
    expect(avisoGrupo(repetido, 1, MAPA)).toBe("Otra fila ya tiene este rótulo: no sale.");
    expect(filasAGrupos(repetido, MAPA)).toEqual({ Callao: ["A6_2"] });
    const compartida = gruposAFilas({ Callao: ["A6_2"], Puerto: ["A6_2"] });
    expect(avisoGrupo(compartida, 1, MAPA)).toBe("Comparte una pregunta con “Callao”: no sale.");
    expect(quedanLibres([filas[0], { clave: "c", rotulo: "Lima", preguntas: ["A6_1"] }], MAPA)).toBe(false);
    expect(quedanLibres(filas, MAPA)).toBe(true);
  });
  it("una pregunta que el mapa ya no lee se avisa y la fila no se guarda", () => {
    const filas = gruposAFilas({ Callao: ["A6_9"] });
    expect(avisoGrupo(filas, 0, MAPA)).toMatch(/el mapa ya no lee/);
    expect(filasAGrupos(filas, MAPA)).toBeNull();
  });
  it("la tarjeta lo ofrece sólo en el mapa de distribución y con su control propio, nunca como texto", () => {
    const a = (name: string, tipo_input: ArgMetadata["tipo_input"]): ArgMetadata => ({ name, label: name, tipo_input, grupo: "datos", descripcion: "" });
    const registro = [a("var", "variable"), a("juntar", "variables_list"), a("agrupar_lista", "textarea"), a("medida", "choice")];
    const campos = camposDeDatos(registro, CCSS, "p_mapa_distribucion");
    expect(campos.map((c) => c.arg.name)).toEqual(["var", "juntar", "agrupar_lista", "medida"]);
    expect(campos.find((c) => c.arg.name === "agrupar_lista")).toMatchObject({ rotulo: "Agrupar en la lista", control: "grupos_lista" });
    expect(camposDeDatos(registro, {}, "p_mapa_distribucion").map((c) => c.arg.name)).not.toContain("agrupar_lista");
    expect(camposDeDatos(registro, CCSS, "p_barras_agrupadas").map((c) => c.arg.name)).not.toContain("agrupar_lista");
  });
});
