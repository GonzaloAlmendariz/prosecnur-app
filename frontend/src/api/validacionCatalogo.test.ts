import { describe, expect, it } from "vitest";
import { normalizarCatalogoCompleto, normalizarCatalogoDeReglas, sinEvaluarDelFormulario } from "./validacionCatalogo";

describe("catálogo de reglas (M3)", () => {
  it("cuenta las del formulario sin evaluar y no inventa la cifra si falta", () => {
    const c = normalizarCatalogoDeReglas({
      plan_construido: true,
      n_total: 5,
      n_sin_evaluar: 3,
      familias: [
        { origen: "formulario", familia: "salto", nombre: "Saltos", n: 3, n_sin_evaluar: 2 },
        { origen: "formulario", familia: "calculo", nombre: "Valores calculados", n: 1, n_sin_evaluar: 0 },
        { origen: "propia", familia: "rango_num", nombre: "Valor fuera de rango", n: 1, n_sin_evaluar: 1 },
      ],
      reglas: [],
    });
    expect(sinEvaluarDelFormulario(c)).toBe(2);
    expect(sinEvaluarDelFormulario(normalizarCatalogoDeReglas({ familias: [{ origen: "formulario" }] }))).toBeNull();
    expect(normalizarCatalogoDeReglas(null).n_total).toBeNull();
  });

  it("junta las preguntas de las frases sin repetir y sin repetir el código como etiqueta", () => {
    const c = normalizarCatalogoDeReglas({
      reglas: [
        { frase: [{ pregunta: "p4", etiqueta: "Año de egreso", tipo: "numerica" }, { texto: " es obligatoria." }] },
        { frase: [{ pregunta: "p4", etiqueta: "Año de egreso", tipo: "numerica" }, { pregunta: "dni", etiqueta: "dni", tipo: "rara" }] },
      ],
    });
    expect(c.preguntas).toEqual([
      { codigo: "p4", etiqueta: "Año de egreso", tipo: "numerica" },
      { codigo: "dni", etiqueta: null, tipo: "texto" },
    ]);
  });
});

describe("catálogo entero de la mesa de Reglas (V1)", () => {
  const regla = (cambios: Record<string, unknown>) => ({
    id: "VR_1", id_motor: "VR_1", origen: "formulario", familia: "salto", nombre: "Salto",
    frase: [{ pregunta: "p1", etiqueta: "Edad", tipo: "numerica" }, { texto: " se responde cuando " }, { valor: "Sí", codigo: "1" }],
    activa: true, ...cambios,
  });

  it("conserva los espacios de la frase y lee preguntas y valores", () => {
    const c = normalizarCatalogoCompleto({ reglas: [regla({})] });
    expect(c.reglas[0].frase).toEqual([
      { tipo: "pregunta", codigo: "p1", etiqueta: "Edad", tipoPregunta: "numerica" },
      { tipo: "texto", texto: " se responde cuando " },
      { tipo: "valor", valor: "Sí", codigo: "1" },
    ]);
  });

  it("una cifra que falta queda en null, no en 0", () => {
    const c = normalizarCatalogoCompleto({ plan_construido: true, reglas: [], familias: [] });
    expect(c.n_total).toBeNull();
    expect(c.n_activas).toBeNull();
    expect(c.por_origen.formulario).toBeNull();
  });

  it("no descarta una regla sin id ni una de origen desconocido: las muestra y lo avisa", () => {
    const c = normalizarCatalogoCompleto({
      reglas: [regla({}), regla({ id: "", id_motor: "X" }), regla({ id: "VR_3", origen: "otro" })],
      avisos: [{ codigo: "valor_fuera_de_opciones", id_regla: "VR_1", texto: "Aviso del motor." }],
    });
    expect(c.reglas.map((r) => r.id)).toEqual(["VR_1", "sin-id-2", "VR_3"]);
    expect(c.reglas[1]).toMatchObject({ id_motor: null, se_puede_desactivar: false });
    expect(c.reglas[2].origen).toBe("formulario");
    expect(c.avisos.map((a) => a.codigo)).toEqual(["valor_fuera_de_opciones", "lectura_sin_id", "lectura_origen_desconocido"]);
    expect("anomalia" in c.reglas[0]).toBe(false);
  });
});
