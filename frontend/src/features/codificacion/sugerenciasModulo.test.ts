// TXT-3: la propuesta de módulo de cada comentario se lleva a los grupos de la pregunta sólo cuando el analista la
// confirma, por el mismo flujo de grupos que ya guarda la codificación (POST /api/codificacion/grupos). El multicode de
// un texto abierto vive en `matrix_cases` (una asignación por persona), así que confirmar escribe la respuesta en el
// grupo del módulo Y el caso de cada persona que la escribió.
import { describe, expect, it } from "vitest";
import type { CodifSugerenciasSeccion, Grupo, RespuestaUnica } from "../../api/codificacion";
import {
  confirmarSugerencias,
  deshacerConfirmacion,
  estaConfirmada,
  normalizarTextoCodif,
  pendientesDelModulo,
  podarCasosSugeridos,
  quitarSugerencia,
  rotuloCortoSubtema,
  rotuloDePropuesta,
  rotuloModulo,
  sugerenciasPorRespuesta,
} from "./sugerenciasModulo";

const MOD_A = { codigo: "10", etiqueta: "A. Información general y crianza" };
const MOD_B = { codigo: "20", etiqueta: "B. Experiencia universitaria" };

const sug = (respuestas: CodifSugerenciasSeccion["respuestas"]): CodifSugerenciasSeccion => ({
  variable: "coment", base: "ccss", requiereConfirmacion: true,
  modulos: [{ ...MOD_A, seccion: "modulo_a", nTerminos: 10 }, { ...MOD_B, seccion: "modulo_b", nTerminos: 30 }],
  otro: { codigo: "80", etiqueta: "Otro" },
  respuestas,
  resumen: { escribieron: 0, conContenido: 0, conPropuesta: 0, candidatosOtro: 0, porModulo: {} },
});
const prop = (m: typeof MOD_A, palabras: string[]) => ({ ...m, seccion: "", puntaje: 2, palabras });
const fila = (idCaso: string, texto: string, propuestas: ReturnType<typeof prop>[] = [], extra: Partial<{ noRespuesta: boolean; candidatoOtro: boolean }> = {}) =>
  ({ idCaso, fila: Number(idCaso), texto, noRespuesta: false, candidatoOtro: false, propuestas, ...extra });
const unica = (texto: string, uuids: string[]): RespuestaUnica =>
  ({ texto, texto_normalizado: normalizarTextoCodif(texto), variantes: 1, frecuencia: uuids.length, uuids });

const RESPUESTAS = [
  unica("Más espacios de estudio", ["u1", "u2"]),
  unica("Que los profesores y mi familia apoyen", ["u3"]),
  unica("ninguno", ["u4"]),
  unica("Gracias", ["u5"]),
];
const SUG = sug([
  fila("1", "Más espacios de estudio", [prop(MOD_B, ["espacios", "estudio"])]),
  fila("2", "  más espacios  de ESTUDIO ", [prop(MOD_B, ["espacios", "estudio"])]),
  fila("3", "Que los profesores y mi familia apoyen", [prop(MOD_B, ["profesores"]), prop(MOD_A, ["familia"])]),
  fila("4", "ninguno", [], { noRespuesta: true }),
  fila("5", "Gracias", [], { candidatoOtro: true }),
]);

describe("normalizarTextoCodif: la misma clave que `.normalize_text` de R", () => {
  it("sin tildes, en minúsculas, con espacios colapsados y sin comillas", () => {
    expect(normalizarTextoCodif("  Más   ÁREAS \"verdes\"  ñandú ")).toBe("mas areas verdes nandu");
  });
});

describe("sugerenciasPorRespuesta: de una propuesta por persona a una por respuesta única", () => {
  const mapa = sugerenciasPorRespuesta(SUG, RESPUESTAS);

  it("junta a quienes escribieron lo mismo y conserva sus casos", () => {
    const e = mapa.get(normalizarTextoCodif("Más espacios de estudio"));
    expect(e?.casos.map((c) => c.idCaso)).toEqual(["1", "2"]);
    expect(e?.propuestas.map((p) => p.codigo)).toEqual(["20"]);
  });

  it("multicode: una respuesta puede tener más de un módulo", () => {
    expect(mapa.get(normalizarTextoCodif("Que los profesores y mi familia apoyen"))?.propuestas.map((p) => p.codigo)).toEqual(["20", "10"]);
  });

  it("la no respuesta no tiene entrada; el comentario sin vocabulario queda marcado «sin módulo claro»", () => {
    expect(mapa.has("ninguno")).toBe(false);
    expect(mapa.get("gracias")).toMatchObject({ candidatoOtro: true, propuestas: [] });
  });

  it("si el texto no casa, la persona se ubica por su identificador", () => {
    const m = sugerenciasPorRespuesta(sug([fila("u3", "texto distinto", [prop(MOD_A, ["familia"])])]), RESPUESTAS);
    expect(m.get(normalizarTextoCodif("Que los profesores y mi familia apoyen"))?.propuestas[0].codigo).toBe("10");
  });
});

describe("confirmar escribe por el flujo de grupos, sin tocar lo que no confirmó", () => {
  const mapa = sugerenciasPorRespuesta(SUG, RESPUESTAS);
  const espacios = mapa.get(normalizarTextoCodif("Más espacios de estudio"))!;
  const mixta = mapa.get(normalizarTextoCodif("Que los profesores y mi familia apoyen"))!;

  it("crea el grupo del módulo con la respuesta y un caso por persona", () => {
    const { grupos } = confirmarSugerencias([], MOD_B, [espacios]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0]).toMatchObject({ codigo: "20", etiqueta: MOD_B.etiqueta, origen: "nuevo", respuestas: [espacios.clave] });
    expect(grupos[0].matrix_cases?.map((c) => [c.id_caso, c.codigo, c.origen])).toEqual([["1", "20", "sugerencia"], ["2", "20", "sugerencia"]]);
    expect(estaConfirmada(grupos, "20", espacios.clave)).toBe(true);
  });

  it("reusa el grupo que ya tiene ese código y no duplica lo ya confirmado", () => {
    const previo: Grupo[] = [{ id: "g1", codigo: "20", etiqueta: "Experiencia", respuestas: ["otra"], origen: "nuevo" }];
    const uno = confirmarSugerencias(previo, MOD_B, [espacios]).grupos;
    const dos = confirmarSugerencias(uno, MOD_B, [espacios]).grupos;
    expect(dos).toHaveLength(1);
    expect(dos[0].etiqueta).toBe("Experiencia");
    expect(dos[0].respuestas).toEqual(["otra", espacios.clave]);
    expect(dos[0].matrix_cases).toHaveLength(2);
  });

  it("la misma respuesta puede quedar en dos módulos (multicode)", () => {
    let g = confirmarSugerencias([], MOD_B, [mixta]).grupos;
    g = confirmarSugerencias(g, MOD_A, [mixta]).grupos;
    expect(estaConfirmada(g, "20", mixta.clave) && estaConfirmada(g, "10", mixta.clave)).toBe(true);
  });

  it("todas las de un módulo: sólo las que lo proponen y aún no están confirmadas", () => {
    const g = confirmarSugerencias([], MOD_B, [espacios]).grupos;
    expect(pendientesDelModulo(mapa, g, "20").map((e) => e.clave)).toEqual([mixta.clave]);
    expect(pendientesDelModulo(mapa, g, "10").map((e) => e.clave)).toEqual([mixta.clave]);
  });

  it("deshacer quita sólo lo que esa confirmación agregó; el grupo creado se va si queda vacío", () => {
    const previo: Grupo[] = [{ id: "g1", codigo: "20", etiqueta: "Experiencia", respuestas: ["otra"], origen: "nuevo" }];
    const masiva = confirmarSugerencias(previo, MOD_B, [espacios, mixta]);
    expect(deshacerConfirmacion(masiva.grupos, masiva.registro)).toStrictEqual(previo);
    const nueva = confirmarSugerencias([], MOD_A, [mixta]);
    expect(deshacerConfirmacion(nueva.grupos, nueva.registro)).toEqual([]);
  });

  it("quitar una sugerencia confirmada saca la respuesta y sus casos de ese módulo, no del otro", () => {
    let g = confirmarSugerencias([], MOD_B, [mixta]).grupos;
    g = confirmarSugerencias(g, MOD_A, [mixta]).grupos;
    g = quitarSugerencia(g, "20", mixta.clave);
    expect(estaConfirmada(g, "20", mixta.clave)).toBe(false);
    expect(estaConfirmada(g, "10", mixta.clave)).toBe(true);
    expect(g.find((x) => x.codigo === "20")?.matrix_cases ?? []).toEqual([]);
  });

  it("al guardar, un caso sugerido cuya respuesta ya no está en el grupo se poda; los importados se respetan", () => {
    const { grupos } = confirmarSugerencias([], MOD_B, [espacios]);
    const importado = { id_caso: "9", respuesta: "x", codigo: "20", etiqueta: "B", obs: "" };
    const tocado: Grupo[] = [{ ...grupos[0], respuestas: [], matrix_cases: [...(grupos[0].matrix_cases ?? []), importado] }];
    expect(podarCasosSugeridos(tocado)[0].matrix_cases).toEqual([importado]);
    expect(podarCasosSugeridos(grupos)).toBe(grupos);
  });
});

describe("rotuloModulo: el módulo en palabras llanas", () => {
  it("«MÓDULO B. EXPERIENCIA UNIVERSITARIA» se lee «B · Experiencia universitaria»", () => {
    expect(rotuloModulo("MÓDULO B. EXPERIENCIA UNIVERSITARIA")).toEqual({ letra: "B", nombre: "Experiencia universitaria", corto: "B · Experiencia universitaria", grupo: "B. Experiencia universitaria" });
  });
  it("una etiqueta sin el patrón queda como está", () => {
    expect(rotuloModulo("Datos del hogar")).toEqual({ letra: "", nombre: "Datos del hogar", corto: "Datos del hogar", grupo: "Datos del hogar" });
  });
});

// TXT-17: un subtema (módulo partido, TXT-11) trae como etiqueta el enunciado entero de su batería. La banda y los chips
// van con un rótulo corto, de 2 a 4 palabras, derivado del enunciado; el enunciado completo queda en el tooltip.
describe("rotuloCortoSubtema: de 2 a 4 palabras desde el enunciado de la batería", () => {
  const casos: Array<[string, string]> = [
    ["Experiencia universitaria: preguntas generales", "Preguntas generales"],
    ["¿Con qué frecuencia utilizas las siguientes redes sociales y plataformas digitales?", "Redes sociales y plataformas"],
    ["¿Con qué frecuencia utilizas las siguientes herramientas de inteligencia artificial…", "Herramientas de inteligencia artificial"],
    ["¿Cómo te definirías como estudiante en los siguientes bloques? Selecciona la opción que…", "Como estudiante"],
    ["¿Cómo valoras los recursos que ofrece la Facultad?", "Recursos de la Facultad"],
    ["¿Qué tan de acuerdo estás con las siguientes afirmaciones sobre tu comodidad para…", "Tu comodidad"],
    ["¿Qué tan de acuerdo estás con las siguientes afirmaciones sobre la relación entre…", "La relación"],
    ["¿Qué tan de acuerdo estás con la siguiente afirmación sobre los horarios de atención…", "Horarios de atención"],
    ["EXPERIENCIA LABORAL", "Experiencia laboral"],
  ];
  it.each(casos)("«%s» → «%s»", (enunciado, corto) => {
    expect(rotuloCortoSubtema(enunciado)).toBe(corto);
  });
  it("nunca pasa de cuatro palabras ni termina en una palabra vacía", () => {
    for (const [e] of casos) {
      const r = rotuloCortoSubtema(e).split(" ");
      expect(r.length).toBeLessThanOrEqual(4);
      expect(["de", "la", "el", "y", "para", "entre", "con"]).not.toContain(r[r.length - 1].toLowerCase());
    }
    expect(rotuloCortoSubtema("Uno dos tres cuatro cinco seis siete")).toBe("Uno dos tres cuatro");
  });
  it("dos subtemas fusionados («a / b») acortan cada parte", () => {
    expect(rotuloCortoSubtema("EXPERIENCIA LABORAL / ¿Cómo valoras los recursos que ofrece la Facultad?")).toBe("Experiencia laboral / Recursos de la Facultad");
  });
  it("vacío no inventa nada", () => {
    expect(rotuloCortoSubtema("  ")).toBe("");
  });
});

describe("rotuloDePropuesta: el subtema se nombra con la letra de su módulo y su rótulo corto", () => {
  // TXT-21: el grupo que crea «Confirmar» se llama igual que lo que muestra la banda: es la etiqueta que ven los gráficos.
  it("con padre: «B · Redes sociales y plataformas», también como nombre del grupo, y el enunciado entero para el tooltip", () => {
    const r = rotuloDePropuesta({ etiqueta: "¿Con qué frecuencia utilizas las siguientes redes sociales y plataformas digitales?", padreEtiqueta: "MÓDULO B. EXPERIENCIA UNIVERSITARIA" });
    expect(r.corto).toBe("B · Redes sociales y plataformas");
    expect(r.grupo).toBe(r.corto);
    expect(r.completo).toBe("¿Con qué frecuencia utilizas las siguientes redes sociales y plataformas digitales?");
  });
  it("lo que repite el nombre del módulo no distingue: «Experiencia laboral» en «Experiencia universitaria» es «B · Laboral»", () => {
    expect(rotuloDePropuesta({ etiqueta: "EXPERIENCIA LABORAL", padreEtiqueta: "MÓDULO B. EXPERIENCIA UNIVERSITARIA" }).corto).toBe("B · Laboral");
    expect(rotuloDePropuesta({ etiqueta: "EXPERIENCIA UNIVERSITARIA", padreEtiqueta: "MÓDULO B. EXPERIENCIA UNIVERSITARIA" }).corto).toBe("B · Universitaria");
  });
  it("sin padre es el rótulo de módulo de siempre", () => {
    const r = rotuloDePropuesta({ etiqueta: "MÓDULO B. EXPERIENCIA UNIVERSITARIA" });
    expect(r.corto).toBe("B · Experiencia universitaria");
    expect(r.completo).toBe("MÓDULO B. EXPERIENCIA UNIVERSITARIA");
  });
});
