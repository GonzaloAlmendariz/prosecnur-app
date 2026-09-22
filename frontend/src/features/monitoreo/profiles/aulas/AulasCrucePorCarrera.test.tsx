import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasCrucePorCarrera, type BloqueDeCruce } from "./AulasCrucePorCarrera";
import { railDeAulas } from "./railDeAulas";
import type { MonitoreoAulasDashboard } from "../../../../api/monitoreo";

/**
 * El cruce de alumnos por código PUCP, por la carrera a la que pertenecen.
 *
 * Lo que estas pruebas sujetan: que cuente PERSONAS y no respuestas, que las
 * que no cruzan tengan su motivo —cada uno se arregla en un sitio distinto— y
 * que la pestaña no exista en un estudio anónimo.
 */

const texto = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

const BLOQUE: BloqueDeCruce = {
  total: { consideradas: 72, personas: 62, duplicadas: 1, sin_cruce: 9, tasa: 0.875 },
  carreras: [
    { carrera: "ECONOMÍA", personas: 58, duplicadas: 1, poblacion: 358 },
    { carrera: "SOCIOLOGÍA", personas: 4, duplicadas: 0, poblacion: null },
  ],
  sin_cruce: [
    { motivo: "sin_codigo_declarado", etiqueta: "No declararon su código", respuestas: 6 },
    { motivo: "codigo_no_en_padron", etiqueta: "Su código no está en el padrón", respuestas: 3 },
  ],
};

describe("cruce de alumnos por carrera", () => {
  it("titula en PERSONAS y dice cuánto cruzó de cuánto", () => {
    const t = texto(renderToStaticMarkup(<AulasCrucePorCarrera bloque={BLOQUE} />));
    expect(t).toContain("62 alumnos distintos identificados por su código");
    expect(t).toContain("87.5 % de 72");
  });

  it("la repetición se ve donde ocurrió, no sólo en el total", () => {
    const t = texto(renderToStaticMarkup(<AulasCrucePorCarrera bloque={BLOQUE} />));
    expect(t).toContain("1 persona respondió dos veces");
    // Y en su fila: en el total sola no se puede ir a buscar.
    expect(t).toContain("ECONOMÍA · 1 repetida");
  });

  it("sin población del padrón pone un guion, no un cero", () => {
    // «No lo sé» y «son cero» no son lo mismo.
    const t = texto(renderToStaticMarkup(<AulasCrucePorCarrera bloque={BLOQUE} />));
    expect(t).toContain("de 358");
    expect(t).toContain("—");
  });

  it("nombra cada motivo de no-cruce y dice dónde mirar primero", () => {
    const t = texto(renderToStaticMarkup(<AulasCrucePorCarrera bloque={BLOQUE} />));
    expect(t).toContain("9 no se pudieron identificar");
    expect(t).toContain("No declararon su código");
    expect(t).toContain("Su código no está en el padrón");
    // La causa más cara es del estudio, no de los alumnos: se dice.
    expect(t).toContain("la columna declarada en Fuentes");
  });

  it("sin motivos no monta el bloque: un cero permanente es ruido", () => {
    const limpio: BloqueDeCruce = {
      ...BLOQUE,
      total: { ...BLOQUE.total, sin_cruce: 0, duplicadas: 0, tasa: 1 },
      sin_cruce: [],
    };
    const t = texto(renderToStaticMarkup(<AulasCrucePorCarrera bloque={limpio} />));
    expect(t).not.toContain("no se pudieron identificar");
    expect(t).not.toContain("respondió dos veces");
  });

  it("concuerda en singular: es el caso del día que se lee con calma", () => {
    const una: BloqueDeCruce = {
      ...BLOQUE,
      total: { ...BLOQUE.total, sin_cruce: 1, duplicadas: 0 },
      sin_cruce: [{ motivo: "sin_codigo_declarado", etiqueta: "No declararon su código", respuestas: 1 }],
    };
    const t = texto(renderToStaticMarkup(<AulasCrucePorCarrera bloque={una} />));
    expect(t).toContain("1 respuesta sin identificar");
    expect(t).not.toContain("1 respuestas sin identificar");
    expect(t).toContain("1 no se pudo identificar");
    expect(t).not.toContain("1 no se pudieron identificar");
  });

  it("contiene su propio vacío cuando todavía no hay respuestas", () => {
    const t = texto(renderToStaticMarkup(<AulasCrucePorCarrera bloque={null} />));
    expect(t).toContain("Todavía no hay respuestas con las que cruzar");
  });
});

describe("la pestaña sólo existe en un estudio confidencial", () => {
  /**
   * Gonzalo, 2026-09-22: «esta pestaña sólo está disponible si la encuesta, en
   * vez de ser anónima, es confidencial. No todos los estudios lo son: las
   * confidenciales piden un código identificador, las anónimas no».
   */
  const tablero = (aplica: boolean | undefined) =>
    ({ cruce_por_carrera: aplica === undefined ? undefined : { aplica } } as unknown as MonitoreoAulasDashboard);

  it("con estudio confidencial la pestaña está", () => {
    const claves = railDeAulas("calidad", tablero(true)).map((t) => t.key);
    expect(claves).toContain("alumnos");
  });

  it("con estudio anónimo la pestaña NO está", () => {
    const claves = railDeAulas("calidad", tablero(false)).map((t) => t.key);
    expect(claves).not.toContain("alumnos");
    // Y las demás siguen enteras: retirar una no puede llevarse las otras.
    expect(claves).toEqual(expect.arrayContaining(["registro", "controles", "base", "abiertas"]));
  });

  it("un payload anterior sin el bloque tampoco la ofrece", () => {
    // Es el estado en el que estaban todos los estudios hasta hoy.
    expect(railDeAulas("calidad", tablero(undefined)).map((t) => t.key)).not.toContain("alumnos");
    expect(railDeAulas("calidad", null).map((t) => t.key)).not.toContain("alumnos");
  });

  it("el filtro es de ESA pestaña: no toca las otras secciones", () => {
    const avance = railDeAulas("avance", tablero(false)).map((t) => t.key);
    expect(avance.length).toBeGreaterThan(0);
  });
});

describe("el detalle: quién respondió, cuándo y desde dónde", () => {
  /**
   * Gonzalo, 2026-09-22: «esto debe ser más específico, ¿has revisado cómo lo
   * hace acreditación? Es bastante específico con hora y todo». Su tabla de
   * casos de plataforma publica actor/caso, estado, fecha y hora, canal y
   * cruce, una fila por caso. El agregado contesta «cuántos»; esto contesta
   * «quién, cuándo y desde qué curso-horario».
   */
  const conDetalle: BloqueDeCruce = {
    ...BLOQUE,
    alumnos: [
      {
        codigo: "20243380", carrera: "ECONOMÍA", nivel: "6", sexo: "M",
        fecha: "2026-09-22", hora: "11:40", curso_horario: "CH 7",
        estado: "identificado",
      },
      {
        codigo: "20240596", carrera: "ECONOMÍA", nivel: "5", sexo: "F",
        fecha: "2026-09-22", hora: "09:12", curso_horario: "CH 45",
        estado: "repetida",
      },
      {
        codigo: "", carrera: "", nivel: "", sexo: "",
        fecha: "2026-09-22", hora: "08:00", curso_horario: "CH 45",
        estado: "sin_identificar",
        motivo: "sin_codigo_declarado", motivo_etiqueta: "No declararon su código",
      },
    ],
  };

  it("cada fila trae código, carrera, nivel, hora y curso-horario", () => {
    const t = texto(renderToStaticMarkup(<AulasCrucePorCarrera bloque={conDetalle} />));
    expect(t).toContain("20243380");
    expect(t).toContain("nivel 6");
    expect(t).toContain("2026-09-22 · 11:40");
    expect(t).toContain("CH 7");
  });

  it("tres estados con tres palabras: repetida no es sin identificar", () => {
    const t = texto(renderToStaticMarkup(<AulasCrucePorCarrera bloque={conDetalle} />));
    expect(t).toContain("Identificado");
    expect(t).toContain("Ya había respondido");
    expect(t).toContain("Sin identificar");
  });

  it("el motivo va pegado a SU fila, no sólo al conteo de arriba", () => {
    const t = texto(renderToStaticMarkup(<AulasCrucePorCarrera bloque={conDetalle} />));
    // Aparece dos veces: en el bloque de motivos y en la fila que lo sufre.
    expect(t.match(/No declararon su código/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("sin marca de tiempo pone un guion y la fila sigue diciendo quién", () => {
    const sinHora: BloqueDeCruce = {
      ...conDetalle,
      alumnos: [{ ...conDetalle.alumnos![0], fecha: "", hora: "" }],
    };
    const t = texto(renderToStaticMarkup(<AulasCrucePorCarrera bloque={sinHora} />));
    expect(t).toContain("20243380");
    expect(t).toContain("—");
  });

  it("el recorte se DICE: en silencio haría creer que son todas", () => {
    const cortado: BloqueDeCruce = { ...conDetalle, truncado: true, tope: 3 };
    const t = texto(renderToStaticMarkup(<AulasCrucePorCarrera bloque={cortado} />));
    expect(t).toContain("se enseñan las 3 últimas de 72");
  });

  it("un rechazo se lee como rechazo, no como que no declaro su codigo", () => {
    // Gonzalo, sobre CH 18: «no es identificable porque fue un rechazo, eso la
    // tabla de acreditación ya lo sabe mostrar bien». Son dos preguntas y van
    // en dos columnas: qué pasó con la encuesta, y si se pudo atar a alguien.
    const conRechazo: BloqueDeCruce = {
      ...conDetalle,
      alumnos: [{
        codigo: "", carrera: "", nivel: "", sexo: "",
        fecha: "2026-09-22", hora: "09:56", curso_horario: "CH 18",
        respuesta: "rechaza", respuesta_etiqueta: "Rechazó participar", estado: "sin_identificar",
        motivo: "rechazo_participar", motivo_etiqueta: "Rechazó participar",
      }],
    };
    const t = texto(renderToStaticMarkup(<AulasCrucePorCarrera bloque={conRechazo} />));
    expect(t).toContain("Rechazó participar");
    expect(t).not.toContain("No declararon su código · CH 18");
    // **Una vez por fila.** Con la columna de Respuesta diciendo el rechazo,
    // repetirlo en la de Cruce obliga a leer dos veces para entender que es
    // una sola cosa: «Rechazó participar · Sin identificar · Rechazó participar».
    expect(t).not.toContain("Sin identificar · Rechazó participar");
  });

  it("las NO efectivas salen con su estado y sin afirmar su cruce", () => {
    // Gonzalo, 2026-09-22: «que la tabla incluya las no efectivas con su
    // estado». De una descartada no se dice «sin identificar»: nunca iba a
    // contar, y el rótulo se leería como un problema que arreglar.
    const conNoEfectivas: BloqueDeCruce = {
      ...conDetalle,
      alumnos: [
        { ...conDetalle.alumnos![0], respuesta: "efectiva", respuesta_etiqueta: "Efectiva" },
        {
          codigo: "", carrera: "", nivel: "", sexo: "",
          fecha: "2026-09-15", hora: "17:50", curso_horario: "",
          respuesta: "fuera_operativo", respuesta_etiqueta: "Fuera del operativo",
          estado: "",
        },
      ],
    };
    const t = texto(renderToStaticMarkup(<AulasCrucePorCarrera bloque={conNoEfectivas} />));
    expect(t).toContain("Fuera del operativo");
    expect(t).toContain("Efectiva");
    // El chip de su estado existe y lleva su cuenta.
    expect(t).toContain("Fuera del operativo 1");
  });

  it("un estado del embudo que este estudio no produce NO se pinta en cero", () => {
    // Cinco estados dejados todos en gris son ruido; el cruce, que tiene tres y
    // siempre significan algo, sí conserva el suyo.
    const t = texto(renderToStaticMarkup(<AulasCrucePorCarrera bloque={conDetalle} />));
    expect(t).not.toContain("Sin curso-horario del plan 0");
    expect(t).not.toContain("No pasa el criterio 0");
  });

  it("sin detalle el panel sigue entero: es un añadido, no un requisito", () => {
    const t = texto(renderToStaticMarkup(<AulasCrucePorCarrera bloque={BLOQUE} />));
    expect(t).toContain("62 alumnos distintos");
    expect(t).not.toContain("uno por uno");
  });
});
