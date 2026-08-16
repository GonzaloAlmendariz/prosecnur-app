/**
 * El recorte de cada criterio de alumno cruza al cliente.
 *
 * El motor lo publica desde hace tiempo y no estaba ni tipado: el desglose no
 * llegaba a ninguna pantalla. La UI mostraba el agregado —cuántos estudiantes
 * quedan— pero no cuánto se llevó cada criterio, que es lo que hace falta para
 * decidir uno. Y por eso `level`, activo y recortando 0, sólo se detectaba
 * calculándolo a mano.
 *
 * Lo que estos tests fijan es la distinción entre «no se midió» y «midió cero»,
 * que es justo lo que este dato existe para hacer visible.
 */
import { describe, expect, it } from "vitest";
import { normalizeCalcMuestraCriteriosAlumnoReporte } from "../calcMuestra";

describe("normalizeCalcMuestraCriteriosAlumnoReporte", () => {
  it("publica el recorte de cada criterio con su capa", () => {
    // Forma real del motor, con los envoltorios de array que produce jsonlite.
    const r = normalizeCalcMuestraCriteriosAlumnoReporte({
      activa: [true],
      criterios: {
        age: { layer: ["marco"], filas_pasan: [123360] },
        level: { layer: ["marco"], filas_pasan: [136284] },
      },
    });

    expect(r).not.toBeNull();
    expect(r?.activa).toBe(true);
    expect(r?.criterios).toHaveLength(2);
    const porId = Object.fromEntries((r?.criterios ?? []).map((c) => [c.id, c]));
    expect(porId.age.filas_pasan).toBe(123360);
    expect(porId.age.layer).toBe("marco");
    // El criterio que no recorta: pasa TODO, y ése es el dato que lo delata.
    expect(porId.level.filas_pasan).toBe(136284);
  });

  it("un frame sin el reporte devuelve null, no un reporte vacío", () => {
    // La distinción que importa: «no se midió» no puede parecerse a «midió 0».
    expect(normalizeCalcMuestraCriteriosAlumnoReporte(null)).toBeNull();
    expect(normalizeCalcMuestraCriteriosAlumnoReporte(undefined)).toBeNull();
    expect(normalizeCalcMuestraCriteriosAlumnoReporte({})).toBeNull();
    expect(normalizeCalcMuestraCriteriosAlumnoReporte({ activa: [false] })).toBeNull();
    expect(normalizeCalcMuestraCriteriosAlumnoReporte({ criterios: {} })).toBeNull();
  });

  it("un criterio sin conteo se descarta en vez de publicar un cero", () => {
    // Publicar 0 afirmaría que el criterio no dejó pasar a nadie — lo contrario
    // de lo que significa un conteo ausente.
    const r = normalizeCalcMuestraCriteriosAlumnoReporte({
      activa: [true],
      criterios: {
        age: { layer: ["marco"], filas_pasan: [100] },
        roto: { layer: ["marco"], filas_pasan: ["NA"] },
        vacio: { layer: ["marco"] },
      },
    });

    expect(r?.criterios.map((c) => c.id)).toEqual(["age"]);
  });

  it("la capa cae a marco cuando no viene declarada", () => {
    // `marco` es la capa que recorta: ante la duda, la lectura conservadora es
    // que el criterio SÍ afecta al marco, no que es decorativo.
    const r = normalizeCalcMuestraCriteriosAlumnoReporte({
      criterios: { age: { filas_pasan: [10] }, otro: { layer: ["NA"], filas_pasan: [20] } },
    });

    expect(r?.criterios.every((c) => c.layer === "marco")).toBe(true);
  });

  it("acepta los valores sin envolver en array", () => {
    const r = normalizeCalcMuestraCriteriosAlumnoReporte({
      activa: true,
      criterios: { formation: { layer: "instrumento", filas_pasan: 125003 } },
    });

    expect(r?.criterios[0]).toEqual({ id: "formation", layer: "instrumento", filas_pasan: 125003, evaluable: true });
  });
});

describe("evaluable", () => {
  it("lo transporta cuando el motor lo publica", () => {
    const r = normalizeCalcMuestraCriteriosAlumnoReporte({
      activa: true, filas_total: 100,
      criterios: {
        age: { layer: "marco", filas_pasan: 80, evaluable: true },
        formation: { layer: "marco", filas_pasan: 100, evaluable: false },
      },
    });
    const porId = Object.fromEntries((r?.criterios ?? []).map((c) => [c.id, c]));
    expect(porId.age.evaluable).toBe(true);
    expect(porId.formation.evaluable).toBe(false);
  });

  it("un frame anterior al contrato se lee como medible", () => {
    // Asumir lo contrario marcaría como no medidos criterios que sí corrieron,
    // que es el error opuesto al que este dato existe para evitar.
    const r = normalizeCalcMuestraCriteriosAlumnoReporte({
      activa: true, filas_total: 100,
      criterios: { age: { layer: "marco", filas_pasan: 80 } },
    });
    expect(r?.criterios[0]?.evaluable).toBe(true);
  });

  it("lee la forma EXACTA que serializa el motor", () => {
    // Medido contra el JSON real: `{"evaluable":[false]}`, booleano envuelto en
    // array, no la cadena "FALSE". Fijarlo con la forma inventada y no con la
    // que llega es como se cuela un normalizador que pasa sus tests y falla en
    // producción.
    const r = normalizeCalcMuestraCriteriosAlumnoReporte({
      activa: [true], filas_total: [2],
      criterios: { formation: { layer: ["marco"], filas_pasan: [2], evaluable: [false] } },
    });
    expect(r?.criterios[0]?.evaluable).toBe(false);
    expect(r?.filas_total).toBe(2);
  });

  it("lee tambien el FALSE en texto", () => {
    const r = normalizeCalcMuestraCriteriosAlumnoReporte({
      activa: true, filas_total: 100,
      criterios: { age: { layer: "marco", filas_pasan: 100, evaluable: ["FALSE"] } },
    });
    expect(r?.criterios[0]?.evaluable).toBe(false);
  });
});
