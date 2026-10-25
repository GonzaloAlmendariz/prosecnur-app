// O3b-b (TXT-8/9): la tarjeta de aprobación de citas de `p_citas`. El backend (texto_citas.R) acepta en
// `citas_aprobadas` ids u objetos {id, texto, sic}; `texto` sólo vale si es un recorte o una corrección leve. La tarjeta
// valida antes de guardar con la misma regla, para explicar el porqué en vez de que la lámina dibuje el original.
import { describe, expect, it } from "vitest";
import {
  TOPE_CITAS,
  aprobar,
  armarRecorte,
  emitirAprobadas,
  leerAprobadas,
  mover,
  quitar,
  segmentosCita,
  validarEdicion,
} from "./modeloCitas";

const ORIG = "Los docentes deberían tener más pdoer de decisión. Algunos del curso de estadística son muy malos y no explican nada.";

describe("leer y emitir citas_aprobadas", () => {
  it("lee ids sueltos y objetos; emite objetos sin campos vacíos", () => {
    const l = leerAprobadas(["c1", { id: "c2", texto: "Uno." }, { id: "c3", sic: true }, { id: "c4", sic: ["pdoer"] }, { id: "c1" }, 7, null]);
    expect(l).toEqual([{ id: "c1" }, { id: "c2", texto: "Uno." }, { id: "c3", sic: true }, { id: "c4", sic: ["pdoer"] }]);
    expect(emitirAprobadas(l)).toEqual([{ id: "c1" }, { id: "c2", texto: "Uno." }, { id: "c3", sic: true }, { id: "c4", sic: ["pdoer"] }]);
    expect(leerAprobadas(undefined)).toEqual([]);
  });
  it("aprueba hasta cinco, quita y ordena", () => {
    let l = leerAprobadas([]);
    for (const id of ["a", "b", "c", "d", "e", "f"]) l = aprobar(l, id);
    expect(l.map((c) => c.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(TOPE_CITAS).toBe(5);
    expect(aprobar(l, "a")).toBe(l);
    l = mover(quitar(l, "b"), "e", -1);
    expect(l.map((c) => c.id)).toEqual(["a", "c", "e", "d"]);
    expect(mover(l, "a", -1).map((c) => c.id)).toEqual(["a", "c", "e", "d"]);
  });
});

describe("recortar por oraciones y fragmentos", () => {
  it("corta en oraciones y en comas", () => {
    expect(segmentosCita("Hola, mundo. Adiós.")).toEqual(["Hola,", "mundo.", "Adiós."]);
  });
  it("arma el texto con «[…]» donde se quita algo; sin coma colgando", () => {
    const seg = segmentosCita("la gente en cpol es buena, pero falta apoyo. Gracias por todo.");
    expect(armarRecorte(seg, [true, false, true])).toBe("la gente en cpol es buena […] Gracias por todo.");
    expect(armarRecorte(seg, [false, true, false])).toBe("[…] pero falta apoyo. […]");
    expect(armarRecorte(seg, [true, true, true])).toBe("la gente en cpol es buena, pero falta apoyo. Gracias por todo.");
    expect(armarRecorte(seg, [false, false, false])).toBe("");
  });
  it("el recorte armado pasa la validación del backend", () => {
    const seg = segmentosCita(ORIG);
    const t = armarRecorte(seg, seg.map((_, i) => i === 0));
    expect(validarEdicion(ORIG, t)).toMatchObject({ ok: true, tipo: ["recorte"] });
  });
});

describe("validarEdicion: espejo de .citas_validar_edicion", () => {
  it("acepta correcciones leves", () => {
    expect(validarEdicion(ORIG, ORIG.replace("pdoer", "poder"))).toMatchObject({ ok: true, tipo: ["correccion"] });
    expect(validarEdicion("No hay adceso a la biblioteca", "No hay acceso a la biblioteca").ok).toBe(true);
    expect(validarEdicion("ojala sirva la encuesta", "ojalá sirva la encuesta").ok).toBe(true);
  });
  it("acepta recortes con o sin «[…]» y las dos cosas a la vez", () => {
    expect(validarEdicion(ORIG, "Los docentes deberían tener más pdoer de decisión.")).toMatchObject({ ok: true, tipo: ["recorte"] });
    expect(validarEdicion(ORIG, "Los docentes deberían tener más pdoer [...] decisión.")).toMatchObject({ ok: true, texto: "Los docentes deberían tener más pdoer […] decisión." });
    expect(validarEdicion(ORIG, "Los docentes deberían tener más poder de decisión.")).toMatchObject({ ok: true, tipo: ["recorte", "correccion"] });
  });
  it("rechaza lo que no es leve y dice por qué", () => {
    expect(validarEdicion(ORIG, "La facultad es excelente y todos los cursos son buenos.")).toMatchObject({ ok: false });
    expect(validarEdicion(ORIG, ORIG.replace("más pdoer", "mucho más poder")).motivo).toContain("«mucho»");
    expect(validarEdicion(ORIG, "Los docentes deberían tener más pdoer").motivo).toBe("termina a media frase sin «[…]»");
    expect(validarEdicion(ORIG, ORIG.replace("malos", "buenos")).ok).toBe(false);
    expect(validarEdicion("No hay sillas suficientes en el aula", "Sí hay sillas suficientes en el aula").ok).toBe(false);
    expect(validarEdicion(ORIG, "  ").motivo).toBe("viene vacía");
  });
});
