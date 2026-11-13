// "Combinación fuera de catálogo": la frase en vivo (las mismas palabras que el
// catálogo del motor, test-reglas-custom-catalogo.R), lo que se guarda, la
// validación del borrador y lo que dice el conteo previo.
import { describe, expect, it } from "vitest";
import { normalizarPruebaDeRegla } from "../../../api/validacionAuditoria";
import { normalizarPropuesta } from "../../../api/catalogoUbigeo";
import { fraseDeReglaPropia, fraseEnTexto } from "../customRuleNarrative";
import { borradorInicial, cuerpoAGuardar, reducirBorrador, validarBorrador, variablesEfectivas } from "./borradorDeRegla";
import { ariaDeLaPregunta, candidatosEnTexto, paramsDeCombinacion, textoDeLecturaDeCatalogo, validarCombinacion, variablesDeCombinacion } from "./modeloCombinacion";
import { columnasDelGrupo, parteDeLaColumna } from "./panel/CamposDeCombinacion";
import { textoDeCausaDeCatalogo } from "./panel/CasosQueMarca";
import { metaDeTipo, tiposDelGrupo } from "./tiposDeRegla";

const frase = (params: Record<string, unknown>) => {
  const piezas = fraseDeReglaPropia({ tipo: "combinacion_catalogo", variables: variablesDeCombinacion(params), params });
  return piezas ? fraseEnTexto(piezas) : null;
};

describe("tesela y modelo", () => {
  it("la tesela está habilitada en Coherencia de la encuesta", () => {
    expect(metaDeTipo("combinacion_catalogo")?.rotulo).toBe("Combinación fuera de catálogo");
    expect(tiposDelGrupo("coherencia", null).map((t) => t.key)).toContain("combinacion_catalogo");
  });

  it("cualquier subconjunto de papeles desde dos, con nombres de columna arbitrarios", () => {
    expect(validarCombinacion({ roles: { distrito: "zz9" } })).toMatch(/al menos dos preguntas de lugar/);
    expect(validarCombinacion({ roles: { distrito: "zz9", ubigeo: "zz9" } })).toMatch(/dos niveles/);
    expect(validarCombinacion({ roles: { ubigeo: "k", distrito: "q" } })).toBe("");
    expect(variablesDeCombinacion({ roles: { ubigeo: "k", provincia: "x", distrito: "q" } })).toEqual(["q", "x", "k"]);
    expect(paramsDeCombinacion({ roles: { ubigeo: "k", distrito: "q", departamento: "" }, omitir: "VENEZUELA, NO RECUERDA" })).toEqual({
      catalogo: "ubigeo_peru",
      roles: { distrito: "q", ubigeo: "k" },
      omitir: ["VENEZUELA", "NO RECUERDA"],
      marcar_incompletos: false,
    });
  });

  it("la frase dice las mismas palabras que el motor", () => {
    expect(frase({ roles: { ubigeo: "cod_x", distrito: "domic" } })).toBe(
      "Se marca cuando la combinación de distrito domic y ubigeo cod_x no existe en Ubigeos del Perú (INEI), o algún nombre no se reconoce.",
    );
    expect(frase({ roles: { departamento: "lugar_a", provincia: "zz_prov", distrito: "qq9" }, omitir: ["VENEZUELA"] })).toBe(
      'Se marca cuando la combinación de departamento lugar_a, provincia zz_prov y distrito qq9 no existe en Ubigeos del Perú (INEI), o algún nombre no se reconoce. No se revisan los casos con "VENEZUELA".',
    );
    expect(frase({ roles: { distrito: "qq9" } })).toBeNull();
  });

  it("el borrador arranca sin papeles, valida y guarda las variables de los papeles", () => {
    let b = borradorInicial({ inicial: null });
    b = reducirBorrador(b, { tipo: "elegir-tipo", valor: "combinacion_catalogo" });
    expect(b.params).toEqual({ catalogo: "ubigeo_peru", roles: {} });
    expect(validarBorrador(b)).toMatch(/al menos dos preguntas de lugar/);
    b = reducirBorrador(b, { tipo: "params", valor: { ...b.params, roles: { ubigeo: "k", distrito: "q" } } });
    expect(validarBorrador(b)).toBe("");
    expect(variablesEfectivas(b)).toEqual(["q", "k"]);
    const cuerpo = cuerpoAGuardar(b, null);
    expect(cuerpo?.variables).toEqual(["q", "k"]);
    expect(cuerpo?.params).toEqual({ catalogo: "ubigeo_peru", roles: { distrito: "q", ubigeo: "k" }, omitir: [], marcar_incompletos: false });
  });
});

describe("conteo previo y propuesta", () => {
  it("lee la causa, el estado y el candidato de cada caso, y la lectura por estado", () => {
    const p = normalizarPruebaDeRegla({
      estado: "evaluada",
      evaluada: true,
      n_filas: 8,
      n_base: 8,
      n_casos: 2,
      ejemplos: [
        {
          id_caso: "c01",
          valores: [],
          catalogo: {
            estado: "error",
            causa: "Los Olivos no es un distrito de Sullana (Piura)",
            candidatos: [{ rol: "provincia", valor: "Lima", entidad: { ubigeo: null, departamento: "Lima", provincia: "Lima", distrito: null }, causa: "Los Olivos está en ese lugar" }],
            a_investigar: false,
            notas: [],
          },
        },
        { id_caso: "c03", valores: [], catalogo: { estado: "no_reconocido", causa: 'Nombre no reconocido: "AV COSTANERA"', candidatos: [], a_investigar: true, notas: [] } },
      ],
      catalogo: {
        n_filas: 8, n_ok: 2, n_incompletas: 1, n_error: 2, n_no_reconocido: 3, n_omitidas: 0, n_sin_datos: 1,
        n_a_investigar: 1, n_ubigeo_sin_cero: 1, no_reconocidos: [{ papel: "distrito", valor: "AV COSTANERA", n: 1 }],
      },
    });
    const [c01, c03] = p.ejemplos;
    expect(textoDeCausaDeCatalogo(c01.catalogo!)).toBe(
      "Error: Los Olivos no es un distrito de Sullana (Piura). Propuesta: Provincia Lima (Los Olivos está en ese lugar)",
    );
    expect(textoDeCausaDeCatalogo(c03.catalogo!)).toBe('Nombre no reconocido: "AV COSTANERA". A investigar');
    expect(candidatosEnTexto(c03.catalogo!)).toBe("A investigar");
    expect(textoDeLecturaDeCatalogo(p.catalogo!)).toEqual([
      "3 encuestas calzan, 2 con error, 3 con un nombre no reconocido, 1 sin datos.",
      "1 encuesta tiene una pregunta de lugar vacía y el resto coincide con el catálogo.",
      "1 ubigeo viene sin el cero inicial y se lee con él.",
      'Nombres no reconocidos más frecuentes: "AV COSTANERA" (1).',
    ]);
  });

  it("la propuesta trae los grupos y la parte de cada columna que casa con cada nivel", () => {
    const pr = normalizarPropuesta({
      estado: "propuesta",
      base_nombre: "Lugares",
      catalogo: "ubigeo_peru",
      catalogo_nombre: "Ubigeos del Perú (INEI)",
      n_filas: 8,
      propuesta: { departamento: "p1_1", provincia: "p1_2", distrito: "p1_3", ubigeo: null },
      propuestas: [
        { roles: { departamento: "p1_1", provincia: "p1_2", distrito: "p1_3", ubigeo: null }, coherencia: 0.95 },
        { roles: { departamento: null, provincia: null, distrito: "distrito", ubigeo: "ubigeo" }, coherencia: 0.9 },
      ],
      columnas: [{ columna: "p1_3", n_valores: 999, parte: { departamento: 0.1, provincia: 0.15, distrito: 0.9149, ubigeo: 0 } }],
    });
    expect(columnasDelGrupo(pr.propuestas[1].papeles)).toBe("distrito y ubigeo");
    expect(parteDeLaColumna(pr, "p1_3", "distrito")).toBe("91 % son distritos del catálogo");
    expect(parteDeLaColumna(pr, "otra", "distrito")).toBe("");
  });
});

describe("ítem 45.8: nombre accesible de cada papel", () => {
  it("concuerda con el género del nivel", () => {
    expect(ariaDeLaPregunta("departamento")).toBe("Pregunta del departamento");
    expect(ariaDeLaPregunta("provincia")).toBe("Pregunta de la provincia");
    expect(ariaDeLaPregunta("distrito")).toBe("Pregunta del distrito");
    expect(ariaDeLaPregunta("ubigeo")).toBe("Pregunta del ubigeo");
  });
});
