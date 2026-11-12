import { describe, expect, it } from "vitest";
import type { InstrumentoDrillResult } from "../../../../api/validacion";
import { tablaDeCasos, type ColumnaDeCaso } from "../modeloHallazgos";
import {
  CLAVE_LECTURA_DE_FECHAS,
  CLAVE_PATRON_DE_BATERIA,
  disposicionDeTabla,
  ladoDelDesborde,
  lecturaEnUnaLinea,
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

describe("lo leído de una fecha en una línea", () => {
  const esperado = (hecho: string, choque: string | null) => ({ anomalia_tipo: null, subtipo: "fechas", sujeto: null, hecho, choque, accion: null, texto: null });
  it("con lo registrado distinto de lo leído: original → leído, y el motivo aparte", () => {
    expect(lecturaEnUnaLinea(esperado("registró \"08.11.2026\" (08/11/2026) en fecha", "posterior al cierre del operativo (31/10/2026)"))).toEqual({
      lectura: "08.11.2026 → 08/11/2026",
      motivo: "posterior al cierre del operativo (31/10/2026)",
    });
  });
  it("con lo registrado igual a lo leído o sin poder leerlo, el valor; otro enunciado, entero", () => {
    expect(lecturaEnUnaLinea(esperado("registró 10:15 en la hora armada con h, mi y ampm", "anterior a \"10.3\" (10:30) en Hora de inicio"))?.lectura).toBe("10:15");
    expect(lecturaEnUnaLinea(esperado("registró \"32.13.2026\" en fecha", "que no se puede leer como dd.mm.aaaa"))?.lectura).toBe("32.13.2026");
    expect(lecturaEnUnaLinea(esperado("pasaron 3 horas entre Inicio (10:00) y Fin (13:00)", "más que el máximo de 90 minutos"))).toBeNull();
    expect(lecturaEnUnaLinea(null)).toBeNull();
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

describe("desborde horizontal", () => {
  it("dice hacia dónde queda contenido fuera de la vista", () => {
    expect(ladoDelDesborde(0, 630, 630)).toBe("ninguno");
    expect(ladoDelDesborde(0, 630, 724)).toBe("derecha");
    expect(ladoDelDesborde(40, 630, 724)).toBe("ambos");
    expect(ladoDelDesborde(94, 630, 724)).toBe("izquierda");
  });
});
