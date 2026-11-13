// "Valor distinto al habitual en su grupo": la frase en vivo (las mismas
// palabras que el motor, test-reglas-custom-moda-grupo.R), lo que se guarda, la
// validación del borrador y lo que dice el conteo previo.
import { describe, expect, it } from "vitest";
import { normalizarPruebaDeRegla } from "../../../api/validacionAuditoria";
import { fraseDeReglaPropia, fraseEnTexto } from "../customRuleNarrative";
import { borradorInicial, cuerpoAGuardar, reducirBorrador, validarBorrador, variablesEfectivas } from "./borradorDeRegla";
import { causaDeModa, paramsDeModa, textoDeEjemploDeModa, textoDeLecturaDeModa, validarModa, variablesDeModa } from "./modeloModa";
import { metaDeTipo, tiposDelGrupo } from "./tiposDeRegla";

const frase = (params: Record<string, unknown>) => {
  const piezas = fraseDeReglaPropia({ tipo: "moda_en_grupo", variables: variablesDeModa(params), params });
  return piezas ? fraseEnTexto(piezas) : null;
};

describe("tesela y modelo", () => {
  it("la tesela está en Coherencia de la encuesta, con dos preguntas", () => {
    expect(metaDeTipo("moda_en_grupo")?.rotulo).toBe("Valor distinto al habitual en su grupo");
    expect(metaDeTipo("moda_en_grupo")?.nVars).toBe(2);
    expect(tiposDelGrupo("coherencia", null).map((t) => t.key)).toContain("moda_en_grupo");
  });

  it("valida las preguntas y los umbrales con los límites del motor", () => {
    expect(validarModa({ grupo: "", valor: "k" })).toMatch(/Elige la variable que forma el grupo/);
    expect(validarModa({ grupo: "k", valor: "k" })).toMatch(/deben ser distintas/);
    expect(validarModa({ grupo: "d", valor: "k", apoyo_min: 0 })).toMatch(/entre 1 y 100 % del grupo/);
    expect(validarModa({ grupo: "d", valor: "k", apoyo_min: 101 })).toMatch(/entre 1 y 100 % del grupo/);
    expect(validarModa({ grupo: "d", valor: "k", n_min: 1 })).toMatch(/entero desde 2/);
    expect(validarModa({ grupo: "d", valor: "k", n_min: 5.5 })).toMatch(/entero desde 2/);
    expect(validarModa({ grupo: "d", valor: "k", apoyo_min: 70, n_min: 8 })).toBe("");
    expect(validarModa({ grupo: "d", valor: "k", apoyo_min: "", n_min: "" })).toBe("");
  });

  it("guarda los umbrales por defecto cuando no se escriben y lee el valor primero", () => {
    expect(paramsDeModa({ grupo: " d ", valor: "k" })).toEqual({ grupo: "d", valor: "k", apoyo_min: 60, n_min: 5 });
    expect(variablesDeModa({ grupo: "d", valor: "k" })).toEqual(["k", "d"]);
  });

  it("la frase dice las mismas palabras que el motor", () => {
    expect(frase({ grupo: "zz_dist", valor: "cod_x" })).toBe(
      "Se marca el caso cuyo cod_x no coincide con el valor más común entre los casos con el mismo zz_dist. Solo se revisan los grupos de 5 casos o más donde ese valor reúne al menos el 60 %.",
    );
    expect(frase({ grupo: "zz_dist", valor: "cod_x", apoyo_min: 75, n_min: 10 })).toMatch(/grupos de 10 casos o más donde ese valor reúne al menos el 75 %\./);
    expect(frase({ grupo: "", valor: "cod_x" })).toBeNull();
  });

  it("el borrador arranca con los umbrales escritos, valida y guarda valor y grupo", () => {
    let b = borradorInicial({ inicial: null });
    b = reducirBorrador(b, { tipo: "elegir-tipo", valor: "moda_en_grupo" });
    expect(b.params).toEqual({ grupo: "", valor: "", apoyo_min: 60, n_min: 5 });
    expect(validarBorrador(b)).toMatch(/Elige la variable que forma el grupo/);
    b = reducirBorrador(b, { tipo: "params", valor: { ...b.params, grupo: "zz_dist", valor: "cod_x" } });
    expect(validarBorrador(b)).toBe("");
    expect(variablesEfectivas(b)).toEqual(["cod_x", "zz_dist"]);
    const cuerpo = cuerpoAGuardar(b, null);
    expect(cuerpo?.variables).toEqual(["cod_x", "zz_dist"]);
    expect(cuerpo?.params).toEqual({ grupo: "zz_dist", valor: "cod_x", apoyo_min: 60, n_min: 5 });
  });
});

describe("conteo previo", () => {
  it("lee la causa de cada caso y la lectura por estado, con lo que no se evalúa", () => {
    const p = normalizarPruebaDeRegla({
      estado: "evaluada",
      evaluada: true,
      n_filas: 42,
      n_base: 42,
      n_casos: 2,
      ejemplos: [
        {
          id_caso: "c10",
          valores: [],
          moda: { estado: "marca", causa: "Ubigeo 150133 en COMAS; en ese grupo el valor más común es 150110 (9 de 10 casos).", moda: "150110", n_moda: 9, n_grupo: 10 },
        },
      ],
      moda: {
        n_filas: 42, n_ok: 14, n_marcadas: 2, n_grupo_chico: 8, n_empate: 6, n_sin_apoyo: 10, n_sin_datos: 2,
        n_grupos: 6, n_grupos_evaluables: 2, n_grupos_chicos: 2, n_grupos_empate: 1, n_grupos_sin_apoyo: 1,
        apoyo_min: 60, n_min: 5,
        ejemplo: { grupo: "RIMAC", n_grupo: 184, n_moda: 174, moda: "150128", n_marcadas: 10, valor_rotulo: "ubigeo" },
      },
    });
    expect(causaDeModa(p.ejemplos[0].moda!)).toBe("Ubigeo 150133 en COMAS; en ese grupo el valor más común es 150110 (9 de 10 casos).");
    expect(p.ejemplos[0].moda?.nModa).toBe(9);
    expect(textoDeLecturaDeModa(p.moda!)).toEqual([
      "14 casos coinciden con el valor más común de su grupo y 2 no coinciden, en 2 grupos revisados.",
      "En RIMAC, 174 de 184 casos tienen 150128 como ubigeo; se marcan los 10 que tienen otro valor.",
      "Grupos que no se revisan: 8 casos en 2 grupos de menos de 5 casos; 6 casos en 1 grupo con empate entre dos valores; 10 casos en 1 grupo donde ningún valor llega al 60 %.",
      "2 casos sin grupo o sin valor, que esta regla no revisa.",
    ]);
  });

  it("el ejemplo sin etiqueta nombra el valor y uno solo marcado va en singular", () => {
    expect(textoDeEjemploDeModa({ grupo: "ATE", nGrupo: 8, nModa: 7, moda: "150103", nMarcadas: 1, valorRotulo: null })).toBe(
      "En ATE, 7 de 8 casos tienen el valor 150103; se marca el que tiene otro valor.",
    );
  });

  it("una prueba sin lectura de moda no la inventa", () => {
    const p = normalizarPruebaDeRegla({ estado: "evaluada", evaluada: true, n_filas: 3, n_base: 3, n_casos: 0, ejemplos: [] });
    expect(p.moda).toBeUndefined();
  });
});
