import { describe, expect, it } from "vitest";
import type { InstrumentoDrillResult } from "../../../../api/validacion";
import { tablaDeCasos, type ColumnaDeCaso, type FilaDeCaso } from "../modeloHallazgos";
import {
  CLAVE_LECTURA_DE_FECHAS,
  CLAVE_PATRON_DE_BATERIA,
  compactarTabla,
  detalleDeFormato,
  disposicionDeTabla,
  formatoEsperado,
  ladoDelDesborde,
  lecturaDeFecha,
  motivoDeFecha,
  rotuloDeRespuestas,
  tituloDeRespuesta,
  valorCorto,
} from "./modeloTablaDeCasos";

const ctx = (clave: string, rotulo: string): ColumnaDeCaso => ({ clave, rotulo, tipo: "contexto", numerica: false });
const pregunta = (clave: string, rotulo = clave): ColumnaDeCaso => ({ clave, rotulo, tipo: "pregunta", numerica: false });
const items = Array.from({ length: 14 }, (_, i) => pregunta(`p29_${i + 1}`, `Ítem ${i + 1} de la batería`));
const contexto = [ctx("ctx:numero_encuesta", "N.º de encuesta"), ctx("ctx:recopilador", "Recopilador"), ctx("ctx:digitador", "Digitador")];
const patron: ColumnaDeCaso = { clave: "bateria:patron", rotulo: "En la batería", tipo: "falla", numerica: false };

describe("disposición de la tabla de casos", () => {
  // Ítem 33 (QA2, 2026-11-12): 14 preguntas repartidas en 652 px daban columnas de 47 px.
  it("una batería de 14 preguntas pone sus respuestas en una fila dentro del caso, no en 14 columnas", () => {
    const d = disposicionDeTabla([...contexto, ...items, patron]);
    expect(d.enFila.map((c) => c.clave)).toEqual(items.map((c) => c.clave));
    expect(d.columnas.map((c) => c.clave)).toEqual(["ctx:numero_encuesta", "ctx:recopilador", "ctx:digitador", "bateria:patron"]);
    expect(rotuloDeRespuestas(d.enFila)).toBe("Respuestas de p29_1 a p29_14");
  });

  it("una batería va en fila aunque el motor publique pocas de sus preguntas", () => {
    const d = disposicionDeTabla([...contexto, ...items.slice(0, 3), patron]);
    expect(d.enFila).toHaveLength(3);
    const drill = {
      regla: { familia: "bateria", variable_roles: { target: "p29_1", compare: ["p29_2"], labels: {} }, value_labels: {} },
      casos: [{ p29_1: 1, p29_2: 1 }],
      case_ids: ["c1"],
      esperado: [{ hecho: "respondió 1 en las 2 preguntas de la batería" }],
    } as unknown as InstrumentoDrillResult;
    expect(tablaDeCasos(drill, null).columnas.map((c) => c.clave)).toContain(CLAVE_PATRON_DE_BATERIA);
  });

  it("cada columna tiene un ancho mínimo: ninguna pista empieza en cero", () => {
    const d = disposicionDeTabla([...contexto, ...items, patron]);
    expect(d.plantilla).not.toMatch(/minmax\(0/);
    expect(d.plantilla.split(/\s+(?![^(]*\))/)).toHaveLength(2 + d.columnas.length);
    expect(d.anchoMinimo).toMatch(/^calc\(\d+px \+ 5 \* var\(--pulso-space-3\)/);
  });

  it("hasta cuatro preguntas siguen como columnas (las horas armadas con hora, minutos y AM/PM)", () => {
    const horas = [pregunta("h_ini"), pregunta("h"), pregunta("mi"), pregunta("ampm")];
    const lectura: ColumnaDeCaso = { clave: CLAVE_LECTURA_DE_FECHAS, rotulo: "Leído", tipo: "falla", numerica: false };
    const d = disposicionDeTabla([...horas, lectura]);
    expect(d.enFila).toEqual([]);
    expect(d.columnas).toHaveLength(5);
  });
});

describe("respuestas en código corto", () => {
  it("toma el código de la respuesta y deja la etiqueta para el título", () => {
    expect(valorCorto("Fuertemente en desacuerdo (1)")).toEqual({ corto: "1", completo: "Fuertemente en desacuerdo (1)" });
    expect(valorCorto("Vacía")).toEqual({ corto: "Vacía", completo: "Vacía" });
    expect(valorCorto(undefined).corto).toBe("Sin dato");
    expect(tituloDeRespuesta(items[0], "Fuertemente en desacuerdo (1)")).toBe("p29_1 Ítem 1 de la batería: Fuertemente en desacuerdo (1)");
    expect(tituloDeRespuesta(pregunta("p5"), "3")).toBe("p5: 3");
  });
});

const esperado = (hecho: string, choque: string | null) => ({ anomalia_tipo: null, subtipo: null, sujeto: null, hecho, choque, accion: null, texto: null });

describe("lo leído de una fecha", () => {
  it("separa lo leído del texto original y reconoce la pregunta, con o sin ella en el enunciado", () => {
    expect(lecturaDeFecha("registró \"08.11.2026\" (08/11/2026) en Fecha de la entrevista")).toEqual({ valor: "08.11.2026", original: null, rotulo: "Fecha de la entrevista", diferencia: false });
    expect(lecturaDeFecha("registró \"01.11.2026\" (01/11/2026)")).toEqual({ valor: "01.11.2026", original: null, rotulo: null, diferencia: false });
    expect(lecturaDeFecha("registró 10:15 en la hora armada con h, mi y ampm")?.valor).toBe("10:15");
    expect(lecturaDeFecha("registró \"32.13.2026\" en fecha")).toEqual({ valor: "32.13.2026", original: null, rotulo: "fecha", diferencia: false });
    expect(lecturaDeFecha("pasaron 3 horas entre Inicio (10:00) y Fin (13:00)")).toEqual({ valor: "3 horas", original: null, rotulo: null, diferencia: true });
    expect(lecturaDeFecha("otra cosa")).toBeNull();
    expect(lecturaDeFecha(null)).toBeNull();
  });

  it("el motivo se nombra como lo dice el operativo, para decirlo una vez", () => {
    expect(motivoDeFecha("posterior al cierre del operativo (31/10/2026)")).toEqual({ encabezado: "Cierre del operativo: 31.10.2026", corto: "después del cierre" });
    expect(motivoDeFecha("anterior al inicio del operativo (08/10/2026)")?.encabezado).toBe("Inicio del operativo: 08.10.2026");
    expect(motivoDeFecha("que no se puede leer como dd.mm.aaaa")?.encabezado).toBe("Formato esperado: dd.mm.aaaa");
    expect(motivoDeFecha("anterior a \"10.3\" (10:30) en Hora de inicio")?.encabezado).toBe("Anterior a Hora de inicio");
    expect(motivoDeFecha("más que el máximo de 90 minutos")?.encabezado).toBe("Máximo: 90 minutos");
    expect(motivoDeFecha("")).toBeNull();
  });

  // Ítem 49 (QA30b, 2026-11-13): la regla propia de fecha (periodo de campo) repetía el motivo en 3 o 4
  // líneas por fila, con fechas ISO, porque su enunciado ("se registró el …, fuera del periodo de campo
  // (del 2026-08-12 al 2026-11-04)") no era ninguno de los reconocidos.
  it("el periodo de campo se lee y se dice una vez, con las fechas como dd.mm.aaaa", () => {
    expect(lecturaDeFecha("se registró el 08.11.2026")).toEqual({ valor: "08.11.2026", original: null, rotulo: null, diferencia: false });
    expect(lecturaDeFecha("no tiene fecha en Fecha de la entrevista")).toEqual({ valor: "Sin fecha", original: null, rotulo: "Fecha de la entrevista", diferencia: false });
    expect(motivoDeFecha("fuera del periodo de campo (del 2026-08-12 al 2026-11-04)")).toEqual({
      encabezado: "Periodo de campo: del 12.08.2026 al 04.11.2026",
      corto: "fuera del periodo",
    });
    expect(motivoDeFecha("fuera del periodo permitido (desde el 2026-08-12)")?.encabezado).toBe("Periodo permitido: desde el 12.08.2026");
    expect(motivoDeFecha("fuera del periodo permitido (hasta el 2026-11-04)")?.encabezado).toBe("Periodo permitido: hasta el 04.11.2026");
    expect(motivoDeFecha("posterior al cierre del operativo (31/10/2026)")?.encabezado).toBe("Cierre del operativo: 31.10.2026");
  });

  it("la columna de lo leído es la que arma tablaDeCasos para una regla de fechas", () => {
    const drill = {
      regla: { familia: "rango_fecha", variable_roles: { target: "fecha", compare: [], labels: {} }, value_labels: {} },
      casos: [{ fecha: "08.11.2026" }],
      case_ids: ["c1"],
      esperado: [{ subtipo: "fechas", hecho: "registró \"08.11.2026\" (08/11/2026) en fecha", choque: "posterior al cierre del operativo (31/10/2026)" }],
    } as unknown as InstrumentoDrillResult;
    expect(tablaDeCasos(drill, null).columnas.map((c) => c.clave)).toContain(CLAVE_LECTURA_DE_FECHAS);
  });
});

describe("la tabla de casos dice cada cosa una vez (ítem 37)", () => {
  const nEnc = ctx("ctx:numero_encuesta", "N.º de encuesta");
  const reco = ctx("ctx:recopilador", "Recopilador");
  const fila = (i: number, valores: Record<string, string>, e: ReturnType<typeof esperado> | null = null): FilaDeCaso => ({
    id: `principal::idx::${40 + i}`, clave: `f${i}`, valores: { "ctx:numero_encuesta": String(40 + i), "ctx:recopilador": ["Ana", "Luis"][i % 2], ...valores }, contexto: null, esperado: e,
  });

  // La captura de Gonzalo (2026-11-12): 37 filas con 'registró "01.11.2026" (01/11/2026), posterior al
  // cierre del operativo (31/10/2026)' en negrita sobre naranja, al lado de "Fecha de la entrevista".
  it("fechas: el motivo común sube al encabezado y la celda es la fecha leída con el original en gris", () => {
    const columnas: ColumnaDeCaso[] = [nEnc, reco, pregunta("fecha", "Fecha de la entrevista"), { clave: CLAVE_LECTURA_DE_FECHAS, rotulo: "Leído", tipo: "falla", numerica: false }];
    const filas = [1, 2, 3].map((d, i) => fila(i, { fecha: `0${d}.11.2026` }, esperado(`registró "0${d}.11.2026" (0${d}/11/2026)`, "posterior al cierre del operativo (31/10/2026)")));
    const t = compactarTabla(columnas, filas);
    expect(t.columnaDelCaso?.clave).toBe("ctx:numero_encuesta");
    expect(t.columnas.map((c) => [c.rotulo, c.detalle])).toEqual([
      ["Recopilador", null],
      ["Fecha de la entrevista", "Cierre del operativo: 31.10.2026"],
    ]);
    expect(t.celdas.get("f0")?.[CLAVE_LECTURA_DE_FECHAS]).toEqual({
      valor: "01.11.2026", original: null, nota: null,
      titulo: "registró \"01.11.2026\" (01.11.2026), posterior al cierre del operativo (31.10.2026)",
    });
    expect(t.comunes).toEqual([]);
  });

  it("periodo de campo: ninguna fila repite el motivo y el encabezado lo dice una vez", () => {
    const columnas: ColumnaDeCaso[] = [nEnc, pregunta("fecha", "Fecha de la entrevista"), { clave: CLAVE_LECTURA_DE_FECHAS, rotulo: "Leído", tipo: "falla", numerica: false }];
    const filas = [8, 9, 10].map((d, i) => fila(i, { fecha: `${String(d).padStart(2, "0")}.11.2026` }, esperado(`se registró el ${String(d).padStart(2, "0")}.11.2026`, "fuera del periodo de campo (del 2026-08-12 al 2026-11-04)")));
    const t = compactarTabla(columnas, filas);
    expect(t.columnas.map((c) => [c.rotulo, c.detalle])).toEqual([["Fecha de la entrevista", "Periodo de campo: del 12.08.2026 al 04.11.2026"]]);
    expect(t.celdas.get("f1")?.[CLAVE_LECTURA_DE_FECHAS]).toMatchObject({ valor: "09.11.2026", original: null, nota: null });
    expect(t.celdas.get("f1")?.[CLAVE_LECTURA_DE_FECHAS].titulo).toBe("se registró el 09.11.2026, fuera del periodo de campo (del 12.08.2026 al 04.11.2026)");
  });

  it("fechas: con casos a ambos lados del operativo, el lado va en la fila", () => {
    const columnas: ColumnaDeCaso[] = [nEnc, pregunta("fecha", "Fecha"), { clave: CLAVE_LECTURA_DE_FECHAS, rotulo: "Leído", tipo: "falla", numerica: false }];
    const filas = [
      fila(0, { fecha: "01/11/2026" }, esperado("registró 01/11/2026 en Fecha", "posterior al cierre del operativo (31/10/2026)")),
      fila(1, { fecha: "01/10/2026" }, esperado("registró 01/10/2026 en Fecha", "anterior al inicio del operativo (08/10/2026)")),
    ];
    const t = compactarTabla(columnas, filas);
    expect(t.columnas.find((c) => c.clave === CLAVE_LECTURA_DE_FECHAS)?.detalle).toBeNull();
    expect(t.celdas.get("f1")?.[CLAVE_LECTURA_DE_FECHAS]).toMatchObject({ valor: "01.10.2026", original: null, nota: "antes del inicio" });
  });

  it("fechas: un enunciado que no se reconoce va entero y la pregunta se queda", () => {
    const columnas: ColumnaDeCaso[] = [pregunta("fecha", "Fecha"), { clave: CLAVE_LECTURA_DE_FECHAS, rotulo: "Leído", tipo: "falla", numerica: false }];
    const t = compactarTabla(columnas, [fila(0, { fecha: "x", [CLAVE_LECTURA_DE_FECHAS]: "algo distinto" }, esperado("algo distinto", null))]);
    expect(t.columnas.map((c) => c.rotulo)).toEqual(["Fecha", "Leído"]);
    expect(t.celdas.get("f0")?.[CLAVE_LECTURA_DE_FECHAS].valor).toBe("algo distinto");
  });

  it("valor más común: el valor en la celda y el peso del grupo en gris", () => {
    const columnas: ColumnaDeCaso[] = [nEnc, pregunta("cod_x", "Ubigeo"), pregunta("moda:comun", "Más común en el grupo")];
    const filas = [
      fila(0, { cod_x: "150133", "moda:comun": "150110 (9 de 10 casos)" }, esperado("", "Ubigeo 150133 en Comas; en ese grupo el valor más común es 150110 (9 de 10 casos).")),
      fila(1, { cod_x: "150142", "moda:comun": "150143 (4 de 5 casos)" }, esperado("", "Ubigeo 150142 en Lima; en ese grupo el valor más común es 150143 (4 de 5 casos).")),
    ];
    const t = compactarTabla(columnas, filas);
    expect(t.celdas.get("f0")?.["moda:comun"]).toMatchObject({ valor: "150110", nota: "9 de 10 casos" });
    expect(t.celdas.get("f1")?.["moda:comun"]).toMatchObject({ valor: "150143", nota: "4 de 5 casos" });
  });

  it("formato: la respuesta es lo que falla, con su largo en gris y lo esperado una vez", () => {
    expect(detalleDeFormato("respondió \"80105\" en Ubigeo (5 dígitos)")).toBe("5 dígitos");
    expect(formatoEsperado("que no es un número de 6 dígitos")).toBe("Formato esperado: un número de 6 dígitos");
    const columnas: ColumnaDeCaso[] = [nEnc, pregunta("formato:ubigeo", "Ubigeo"), { clave: "formato:motivo", rotulo: "Formato", tipo: "falla", numerica: false }];
    const filas = ["80105", "0801"].map((u, i) => fila(i, { "formato:ubigeo": u }, esperado(`respondió "${u}" en Ubigeo (${u.length} dígitos)`, "que no es un número de 6 dígitos")));
    const t = compactarTabla(columnas, filas);
    expect(t.columnas).toEqual([{ clave: "formato:ubigeo", rotulo: "Ubigeo", tipo: "falla", numerica: false, detalle: "Formato esperado: un número de 6 dígitos" }]);
    expect(t.celdas.get("f1")?.["formato:ubigeo"]).toMatchObject({ valor: "0801", nota: "4 dígitos" });
  });

  it("batería: la respuesta repetida en la fila y el alcance arriba", () => {
    const columnas: ColumnaDeCaso[] = [nEnc, ...items.slice(0, 2), patron];
    const filas = ["\"Mucho\" (4)", "\"Poco\" (2)"].map((v, i) => fila(i, {}, esperado(`respondió ${v} en las 14 preguntas de la batería`, "")));
    const t = compactarTabla(columnas, filas);
    const col = t.columnas.find((c) => c.clave === CLAVE_PATRON_DE_BATERIA);
    expect([col?.rotulo, col?.detalle]).toEqual(["Respuesta repetida", "En las 14 preguntas"]);
    expect(t.celdas.get("f0")?.[CLAVE_PATRON_DE_BATERIA]).toMatchObject({ valor: "Mucho (4)", nota: null });
    const parcial = compactarTabla(columnas, [fila(0, {}, esperado("respondió \"Mucho\" (4) en 12 de las 14 preguntas de la batería", ""))]);
    expect(parcial.celdas.get("f0")?.[CLAVE_PATRON_DE_BATERIA]).toMatchObject({ valor: "Mucho (4)", nota: "12 de 14" });
    expect(parcial.columnas.find((c) => c.clave === CLAVE_PATRON_DE_BATERIA)?.detalle).toBeNull();
  });

  it("una columna igual en todos los casos sale de la tabla y se dice una vez; con un caso, no", () => {
    const columnas: ColumnaDeCaso[] = [nEnc, reco, pregunta("p8", "¿Trabaja actualmente?"), { clave: "p10", rotulo: "Sector", tipo: "falla", numerica: false }];
    const filas = [0, 1, 2].map((i) => fila(i, { p8: "Sí", p10: "Vacía" }));
    const t = compactarTabla(columnas, filas);
    expect(t.columnas.map((c) => c.clave)).toEqual(["ctx:recopilador"]);
    expect(t.comunes.map((c) => [c.rotulo, c.celda.valor, c.falla])).toEqual([["¿Trabaja actualmente?", "Sí", false], ["Sector", "Vacía", true]]);
    expect(compactarTabla(columnas, filas.slice(0, 1)).comunes).toEqual([]);
  });

  it("sin N.º de encuesta declarado, el caso conserva su columna propia", () => {
    expect(compactarTabla([reco, { clave: "p2", rotulo: "Edad", tipo: "falla", numerica: true }], [fila(0, { p2: "99" })]).columnaDelCaso).toBeNull();
  });
});

describe("desborde horizontal", () => {
  it("dice hacia dónde queda contenido fuera de la vista", () => {
    expect(ladoDelDesborde(0, 630, 630)).toBe("ninguno");
    expect(ladoDelDesborde(0, 630, 724)).toBe("derecha");
    expect(ladoDelDesborde(40, 630, 724)).toBe("ambos");
    expect(ladoDelDesborde(94, 630, 724)).toBe("izquierda");
  });
});
