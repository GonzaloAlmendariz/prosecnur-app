import { describe, expect, it } from "vitest";
import { normalizarVistaPrevia } from "../../../api/cargaActualizar";
import previa from "../../../api/cargaActualizar.fixture.json";
import { ApiError } from "../../../api/core";
import { PANELES_CARGA, PANEL_ACTUALIZAR_FUENTE } from "../panelesCarga";
import {
  cifrasDeCasos,
  errorDeActualizacion,
  hayPerdidas,
  itemsQueSeConservan,
  lineaDeRespaldo,
  lineaDeTotales,
  modoDeActualizacion,
  rotuloDeDecision,
  rotuloDeItem,
  searchConActualizarFuente,
} from "./actualizarFuenteModel";
import { estadoDelPaso } from "./PasosDeActualizacion";

const v = normalizarVistaPrevia(previa);
const fila = { enEstudio: true, recibeNuevaVersion: false, sourceKind: null, integrada: false };

describe("modoDeActualizacion", () => {
  it("archivo si la base recibe una versión nueva desde un archivo", () => {
    expect(modoDeActualizacion({ ...fila, recibeNuevaVersion: true })).toBe("archivo");
  });
  it("plataforma para SurveyMonkey y Kobo", () => {
    expect(modoDeActualizacion({ ...fila, sourceKind: "surveymonkey" })).toBe("plataforma");
    expect(modoDeActualizacion({ ...fila, sourceKind: "kobo_asset" })).toBe("plataforma");
  });
  it("ninguno para una base integrada, fuera del estudio o un .sav publicado", () => {
    expect(modoDeActualizacion({ ...fila, recibeNuevaVersion: true, integrada: true })).toBeNull();
    expect(modoDeActualizacion({ ...fila, recibeNuevaVersion: true, enEstudio: false })).toBeNull();
    expect(modoDeActualizacion({ ...fila, sourceKind: "formulario_publicado_sav" })).toBeNull();
  });
});

describe("cifras de las respuestas", () => {
  it("salen de la vista previa real", () => {
    expect(cifrasDeCasos(v.casos)?.map((c) => [c.rotulo, c.valor])).toEqual([
      ["Nueva", "+1"], ["Editada", "1"], ["Ya no vienen", "10"], ["Sin cambios", "29"],
    ]);
    expect(lineaDeTotales(v.casos)).toBe("40 respuestas en la base cargada y 31 en la versión nueva.");
  });
  it("sin emparejar no hay cifras: va la causa", () => {
    expect(cifrasDeCasos({ ...v.casos, nuevos: null })).toBeNull();
  });
});

describe("trabajo ya hecho y decisiones", () => {
  it("rotula con su cifra y sin cifra si el motor no la cuenta", () => {
    expect(rotuloDeItem({ clave: "r", que: "Reglas propias", n: 1, causa: null })).toBe("Reglas propias (1)");
    expect(rotuloDeItem({ clave: "f", que: "Formulario", n: null, causa: "x" })).toBe("Formulario");
  });
  it("en Se conserva omite lo que vale cero y deja lo que el motor no cuenta", () => {
    expect(itemsQueSeConservan(v.fases[0]!.seConserva).map((i) => i.clave)).toEqual(["formulario"]);
  });
  it("la columna Se pierde aparece solo si alguna fase pierde algo", () => {
    expect(hayPerdidas(v.fases)).toBe(true);
    expect(hayPerdidas(v.fases.map((f) => ({ ...f, sePierde: [] })))).toBe(false);
  });
  it("nombra la decisión como Validación", () => {
    expect(rotuloDeDecision(v.decisiones[0]!)).toBe("Excluir los casos, regla R2");
  });
});

describe("copia y errores", () => {
  it("dice qué se recupera o por qué no", () => {
    expect(lineaDeRespaldo({ creadoEn: null, archivo: "data_2026.xlsx", nFilas: 40, legible: true, causa: null }))
      .toBe('Se puede volver a "data_2026.xlsx", con 40 respuestas.');
    expect(lineaDeRespaldo({ creadoEn: null, archivo: null, nFilas: null, legible: false, causa: "La copia anterior está dañada y no se puede leer." }))
      .toBe("La copia anterior está dañada y no se puede leer.");
  });
  it("traduce el error del identificador con la causa del motor y sin el código", () => {
    const e = new ApiError("E_CARGA_ACTUALIZAR_IDENTIFICADOR", 'La versión nueva repite 1 identificador en "_uuid" (por ejemplo "u01"); cada caso tiene que tener uno distinto.');
    const r = errorDeActualizacion(e, "x");
    expect(r.titulo).toBe("La versión nueva no identifica bien a sus casos");
    expect(r.causa).toMatch(/^La versión nueva repite 1 identificador/);
    expect(r.causa).not.toContain("E_CARGA");
  });
  it("un error sin código conocido conserva el título por defecto", () => {
    expect(errorDeActualizacion(new Error("falló"), "No se pudo comparar la versión nueva")).toEqual({ titulo: "No se pudo comparar la versión nueva", causa: "falló" });
  });
});

describe("dirección y pasos", () => {
  it("abre el panel con la base en foco y está declarado en Carga", () => {
    expect(searchConActualizarFuente("?seccion=carga&pestana=bases", "2026")).toContain("panel=actualizar-fuente");
    expect(searchConActualizarFuente("?seccion=carga", "2026")).toContain("foco=2026");
    expect(PANELES_CARGA).toContain(PANEL_ACTUALIZAR_FUENTE);
  });
  it("marca el paso actual y los hechos", () => {
    expect([0, 1, 2].map((i) => estadoDelPaso(i, "que-cambia"))).toEqual(["hecho", "actual", "pendiente"]);
    expect([0, 1, 2].map((i) => estadoDelPaso(i, "hecho"))).toEqual(["hecho", "hecho", "hecho"]);
  });
});
