import { describe, expect, it } from "vitest";

import type { FrecuenciasPreview } from "../../../api/analitica";
import {
  causaSinTablas, cifraDePesos, cifraDeSecciones, cifraDeTablas, motivoSinGenerar, OPCIONES_DE_ORDEN,
} from "./cifrasDeFrecuencias";
import { respuestaReal, respuestaSinPesos, respuestaVacia } from "./ejemploDeVistaPrevia.test-util";
import type { Lectura } from "./useLecturaPorBase";

const lectura = (datos: FrecuenciasPreview | null, extra: Partial<Lectura<FrecuenciasPreview>> = {}): Lectura<FrecuenciasPreview> => ({
  fase: datos ? "lista" : "leyendo", datos, causa: "", codigo: "", reintentar: () => undefined, ...extra,
});
const fallo = (codigo = "", causa = "Tiempo de espera agotado.") => lectura(null, { fase: "error", codigo, causa });

describe("cifras de la banda de Frecuencias", () => {
  it("las tablas del archivo son el total del servicio, no un conteo propio", () => {
    expect(cifraDeTablas(lectura(respuestaReal())).valor).toBe("26");
    const otro = respuestaReal();
    otro.total_variables = 1310;
    expect(cifraDeTablas(lectura(otro)).valor).toBe("1,310");
  });

  it("mientras se lee o si falla la lectura no publica un cero", () => {
    expect(cifraDeTablas(lectura(null))).toEqual({ valor: "Leyendo" });
    expect(cifraDeTablas(fallo())).toMatchObject({ valor: "Sin leer", tono: "alerta" });
    expect(`${cifraDeTablas(lectura(null)).valor}${cifraDeTablas(fallo()).valor}${cifraDePesos(fallo()).valor}`).not.toMatch(/\d/);
  });

  it("los pesos son los que aplicó el motor, con la regla de la base y su n efectivo", () => {
    const con = cifraDePesos(lectura(respuestaReal()));
    expect(con).toMatchObject({ valor: "Con ponderación", tono: "acento" });
    expect(con.titulo).toBe("Porcentajes, N y estadísticos ponderados; los casos que respondieron, sin ponderar. n efectivo: 499.");
    expect(cifraDePesos(lectura(respuestaSinPesos()))).toEqual({ valor: "Sin ponderación" });
    const sinAplicar = respuestaSinPesos();
    sinAplicar.ponderacion.configurada = true;
    expect(cifraDePesos(lectura(sinAplicar))).toMatchObject({ valor: "Sin aplicar", tono: "alerta" });
  });

  it("las secciones dicen cuántas se ven de cuántas hay, o que son las del formulario", () => {
    expect(cifraDeSecciones({ modo: "declaradas", activas: 8 }, 9).valor).toBe("8 de 9 visibles");
    expect(cifraDeSecciones({ modo: "instrumento" }, 0).valor).toBe("Las del formulario");
  });
});

describe("por qué no se puede generar", () => {
  const instrumento = { modo: "instrumento" } as const;

  it("con tablas no hay motivo, aunque la vista previa se esté releyendo o falle por otra causa", () => {
    expect(motivoSinGenerar(lectura(respuestaReal()), instrumento)).toBeUndefined();
    expect(motivoSinGenerar(lectura(respuestaReal(), { fase: "leyendo" }), instrumento)).toBeUndefined();
    expect(motivoSinGenerar(fallo(), instrumento)).toBeUndefined();
  });

  it("sin base preparada, mientras se lee la primera vez o sin tablas, dice la causa", () => {
    // Junto al botón, la frase corta: la causa entera y la acción van en la vista previa.
    expect(motivoSinGenerar(fallo("E_NO_RP_DATA", "El estudio no tiene base analítica preparada."), instrumento))
      .toBe("Falta preparar la base.");
    expect(motivoSinGenerar(lectura(null), instrumento)).toBe("Leyendo las tablas del archivo");
    expect(motivoSinGenerar(lectura(respuestaVacia()), { modo: "declaradas", activas: 0 })).toContain("Todas las secciones están ocultas");
    expect(motivoSinGenerar(lectura(respuestaVacia()), instrumento)).toContain("ninguna variable de las secciones configuradas");
  });

  it("la causa del vacío es la misma que la del botón", () => {
    expect(causaSinTablas(instrumento, respuestaVacia())).toBe(motivoSinGenerar(lectura(respuestaVacia()), instrumento));
    const sinAviso = respuestaVacia();
    sinAviso.avisos = [];
    expect(causaSinTablas(instrumento, sinAviso)).toBe("No hay variables que tabular. Incluye alguna en la pestaña Datos.");
  });
});

describe("orden de las respuestas", () => {
  it("ofrece los tres valores que entiende el motor, cada uno una vez", () => {
    expect(OPCIONES_DE_ORDEN.map((o) => o.valor).sort()).toEqual(["asc", "desc", "original"]);
    expect(OPCIONES_DE_ORDEN.map((o) => o.rotulo)).toEqual(["Formulario", "Mayor a menor", "Menor a mayor"]);
  });
});
