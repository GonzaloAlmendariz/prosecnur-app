import { describe, expect, it } from "vitest";

import { numerica, respuestaReal, respuestaRecortada, respuestaSinPesos, respuestaVacia, tablaReal } from "./ejemploDeVistaPrevia.test-util";
import { siguienteVersionGuardada } from "./useConfigGuardada";
import {
  avisosDelMotor, cabeceraDeCasos, causaDelArchivoVacio, causaSinTabla, codigoDeLaTabla, esLaVariable, partesDeBase,
  esConteoDeCasos, ponderacionSinAplicar, porcentajeDeBase, rotuloDelTotal, rotuloDeFuente, rotuloMostrarMas, seccionesDeLaHoja,
  siguienteLimite, textoCasos, textoDeBase, textoDelRecorte, textoEstadistico, textoPorcentaje, tienePie,
} from "./vistaPreviaModelo";
import { DEFAULT_CONFIG } from "../store";

describe("cifras de la vista previa: se formatean como el archivo, no se calculan", () => {
  it("el porcentaje de filas y total lleva dos decimales fijos", () => {
    // M5_district, smp, sin pesos: la proporción real es 0.173031956...
    expect(textoPorcentaje(tablaReal("M5_district", false).filas[0].pct)).toBe("17.30");
    expect(textoPorcentaje(0.17303)).toBe("17.30");
    expect(textoPorcentaje(1)).toBe("100.00");
    expect(textoPorcentaje(0)).toBe("0.00");
    expect(textoPorcentaje(0.00335498732449302)).toBe("0.34");
    expect(textoPorcentaje(null)).toBe("");
  });

  it("los casos de filas y total siempre enteros, como el #,##0 del archivo", () => {
    expect(textoCasos(1.75)).toBe("2");
    expect(textoCasos(558.114538684673)).toBe("558");
    expect(textoCasos(53764)).toBe("53,764");
    expect(textoCasos(null)).toBe("");
  });

  it("los estadísticos con un decimal fijo, salvo Casos válidos, entero", () => {
    expect(textoEstadistico(18)).toBe("18.0");
    expect(textoEstadistico(47.8)).toBe("47.8");
    expect(textoEstadistico(1283, true)).toBe("1,283");
    expect(textoEstadistico(null)).toBe("Sin dato");
  });

  it("Casos válidos se reconoce por su nombre", () => {
    expect(esConteoDeCasos("Casos válidos")).toBe(true);
    expect(esConteoDeCasos("Promedio")).toBe(false);
  });

  it("el porcentaje de la base, con un decimal", () => {
    expect(porcentajeDeBase(560 / 1283)).toBe("43.6");
    expect(porcentajeDeBase(1)).toBe("100.0");
    expect(porcentajeDeBase(0)).toBe("0.0");
  });

  it("si respondieron algunos pero no todos, la base no redondea a 100.0 ni a 0.0", () => {
    expect(porcentajeDeBase(1999 / 2001)).toBe("99.9");
    expect(porcentajeDeBase(1 / 2500)).toBe("0.1");
    expect(porcentajeDeBase(1250 / 1283)).toBe("97.4");
  });

  it("con pesos la base dice el conteo sin ponderar, nunca casos ponderados", () => {
    const empleo = tablaReal("M4_employment");
    const medios = tablaReal("D1_information");
    expect(textoDeBase(empleo.base)).toBe("Respondieron 1,283 de 1,283 casos (100.0 %)");
    expect(textoDeBase(medios.base)).toBe("Marcaron alguna opción 560 de 1,283 casos (43.6 %)");
    expect(textoDeBase({ n: 1250, de: 1283, denominador: "respondieron" })).toBe("Respondieron 1,250 de 1,283 casos (97.4 %)");
    expect(textoDeBase({ n: 552, de: 1283, denominador: "marcaron_alguna_opcion" })).toBe("Marcaron alguna opción 552 de 1,283 casos (43.0 %)");
    expect(`${textoDeBase(empleo.base)}${textoDeBase(medios.base)}`).not.toContain("ponderados");
  });

  it("sin pesos la base dice la proporción para no repetir el Total", () => {
    expect(textoDeBase({ n: 1250, de: 1283, denominador: "respondieron" })).toBe("Respondieron 1,250 de 1,283 casos (97.4 %)");
    expect(textoDeBase({ n: 552, de: 1283, denominador: "marcaron_alguna_opcion" })).toBe("Marcaron alguna opción 552 de 1,283 casos (43.0 %)");
    expect(textoDeBase(tablaReal("D1_information", false).base)).toBe("Marcaron alguna opción 560 de 1,283 casos (43.6 %)");
  });

  it("concordancia con un caso y bases sin universo", () => {
    expect(textoDeBase({ n: 1, de: 1, denominador: "respondieron" })).toBe("Respondieron 1 de 1 caso (100.0 %)");
    expect(textoDeBase({ n: 1, de: 1, denominador: "respondieron" })).toBe("Respondieron 1 de 1 caso (100.0 %)");
    expect(textoDeBase({ n: 1, de: 0, denominador: "respondieron" })).toBe("Respondieron 1 caso");
    expect(textoDeBase({ n: null, de: 10, denominador: "respondieron" })).toBeUndefined();
    expect(textoDeBase({ n: 5, de: 10, denominador: null })).toBeUndefined();
  });

  it("la numérica no lleva línea de base: su base va en la celda Casos válidos", () => {
    const base = numerica().base;
    expect(textoDeBase(base)).toBeUndefined();
    expect(partesDeBase(base)).toEqual({ n: 1283, de: "de 1,283 casos (100.0 %)" });
    expect(partesDeBase({ n: 1, de: 1, denominador: "casos_validos" })?.de).toBe("de 1 caso (100.0 %)");
  });

  it("el total de la múltiple dice quiénes forman el 100 % y la cabecera dice si hay pesos", () => {
    expect(rotuloDelTotal(tablaReal("D1_information"))).toBe("Total (marcaron alguna opción)");
    expect(rotuloDelTotal(tablaReal("M4_employment"))).toBe("Total");
    expect(cabeceraDeCasos(true)).toBe("N ponderado");
    expect(cabeceraDeCasos(false)).toBe("Casos");
  });
});

describe("rótulos de lo que el servicio entrega como valor interno", () => {
  it("la fuente se rotula; un valor desconocido no se muestra", () => {
    expect(rotuloDeFuente("adaptados")).toBe("Base codificada");
    expect(rotuloDeFuente("originales")).toBe("Base cargada");
    expect(rotuloDeFuente("otra")).toBeNull();
    expect(rotuloDeFuente(null)).toBeNull();
  });

  it("cada motivo de una variable sin tabla dice su causa", () => {
    expect(causaSinTabla("excluida")).toBe("está excluida del análisis.");
    expect(causaSinTabla("fuera_del_archivo")).toContain("no entra al archivo");
    expect(causaSinTabla("desconocida")).toBe("no está en la base ni en el formulario.");
  });

  it("los avisos que ya se dicen en su lugar no se repiten", () => {
    const p = respuestaReal();
    p.avisos = [
      { codigo: "variables_sin_tabla", mensaje: "1 variable pedida no tiene tabla en el archivo: p9." },
      { codigo: "motor", mensaje: "La columna de pesos tiene valores vacíos." },
      { codigo: "sin_tablas", mensaje: "El archivo no tendría tablas." },
    ];
    expect(avisosDelMotor(p)).toEqual(["La columna de pesos tiene valores vacíos."]);
    expect(causaDelArchivoVacio(p)).toBe("El archivo no tendría tablas.");
    expect(causaDelArchivoVacio(respuestaReal())).toBeNull();
    expect(causaDelArchivoVacio(respuestaVacia())).toContain("ninguna variable de las secciones configuradas");
  });

  it("la ponderación sin aplicar es la activada que no dejó pesos", () => {
    expect(ponderacionSinAplicar(respuestaReal())).toBe(false);
    expect(ponderacionSinAplicar(respuestaSinPesos())).toBe(false);
    const sinAplicar = respuestaSinPesos();
    sinAplicar.ponderacion.configurada = true;
    expect(ponderacionSinAplicar(sinAplicar)).toBe(true);
  });

  it("el código de la tabla es el de la pregunta, no el de su recodificación", () => {
    const t = { ...respuestaReal().tablas[1], variable: "M4_employment_recod", variable_origen: "M4_employment" };
    expect(codigoDeLaTabla(t)).toBe("M4_employment");
    expect(esLaVariable(t, "M4_employment")).toBe(true);
    expect(esLaVariable(t, "M4_employment_recod")).toBe(true);
    expect(esLaVariable(t, "E1_age")).toBe(false);
  });
});

describe("recorte de la hoja", () => {
  it("se piden 50 más, sin pasar del total ni del tope del servicio", () => {
    expect(siguienteLimite(50, 120)).toBe(100);
    expect(siguienteLimite(100, 120)).toBe(120);
    expect(siguienteLimite(120, 120)).toBeNull();
    expect(siguienteLimite(500, 900)).toBeNull();
    expect(siguienteLimite(480, 900)).toBe(500);
  });

  it("el texto y el botón dicen cuántas se ven y cuántas faltan", () => {
    expect(textoDelRecorte(50, 120)).toBe("Se ven 50 de 120 tablas.");
    expect(textoDelRecorte(1, 1)).toBe("Se ven 1 de 1 tabla.");
    expect(rotuloMostrarMas(50, 100, 120)).toBe("Mostrar 50 más");
    expect(rotuloMostrarMas(100, 120, 120)).toBe("Mostrar las 20 que faltan");
    expect(rotuloMostrarMas(119, 120, 120)).toBe("Mostrar la que falta");
  });

  it("el pie solo aparece cuando tiene algo que decir", () => {
    expect(tienePie(respuestaReal(), [])).toBe(false);
    // Que la hoja venga recortada ya no se dice: la tabla es de una pregunta y la lista ofrece las demás.
    expect(tienePie(respuestaRecortada(), [])).toBe(false);
    expect(tienePie(respuestaReal(), [{ variable: "p9", motivo: "excluida" }])).toBe(true);
    const dosBases = respuestaReal();
    dosBases.base.n_bases = 2;
    expect(tienePie(dosBases, [])).toBe(true);
    // Mientras se relee, la cuenta de bases puede ser de antes de hidratar: no se dice.
    expect(tienePie(dosBases, [], true)).toBe(false);
  });
});

describe("secciones de la hoja", () => {
  it("agrupa en el orden en que llegan y marca las que el archivo escribe", () => {
    const tablas = respuestaReal().tablas;
    tablas[2].seccion.rotulo = "EXPOSICIÓN A ACCIONES DEL PROYECTO";
    const secciones = seccionesDeLaHoja(tablas);
    expect(secciones.map((s) => [s.nombre, s.enElArchivo, s.tablas.map((t) => t.variable)])).toEqual([
      ["Datos Generales", false, ["E1_age", "M4_employment"]],
      ["Exposición a acciones del proyecto", true, ["D1_information"]],
    ]);
    // Una sección que vuelve después de otra es otro grupo: el orden manda.
    const vuelve = seccionesDeLaHoja([tablas[0], tablas[2], tablas[1]]);
    expect(vuelve.map((s) => s.nombre)).toEqual(["Datos Generales", "Exposición a acciones del proyecto", "Datos Generales"]);
    expect(new Set(vuelve.map((s) => s.clave)).size).toBe(3);
  });
});

describe("versión de la config guardada", () => {
  const otra = { ...DEFAULT_CONFIG, frecuencias: { ...DEFAULT_CONFIG.frecuencias, orden: "desc" as const } };
  it("solo cuenta una versión nueva cuando la config está guardada y su contenido es otro", () => {
    const inicio = siguienteVersionGuardada({ config: null, firma: null, version: null }, DEFAULT_CONFIG, false);
    expect(inicio.version).toBeNull();
    const primera = siguienteVersionGuardada(inicio, DEFAULT_CONFIG, true);
    expect(primera.version).toBe(0);
    expect(siguienteVersionGuardada(primera, DEFAULT_CONFIG, true)).toBe(primera);
    // Un cambio sin guardar no cuenta.
    expect(siguienteVersionGuardada(primera, otra, false)).toBe(primera);
    expect(siguienteVersionGuardada(primera, otra, true).version).toBe(1);
    // Otra config con el mismo contenido (una rehidratación igual) no cuenta.
    expect(siguienteVersionGuardada(primera, JSON.parse(JSON.stringify(DEFAULT_CONFIG)), true).version).toBe(0);
  });
});
