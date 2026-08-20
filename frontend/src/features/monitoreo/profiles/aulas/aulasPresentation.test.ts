import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  aulasCheckLabel,
  aulasFieldLabel,
  aulasStatusLabel,
  escalaDeProporciones,
  presentAulasRow,
  summarizeAulasValidation,
} from "./aulasPresentation";

const featureDir = path.dirname(fileURLToPath(import.meta.url));

describe("aulasPresentation", () => {
  it("presenta los campos operativos principales en español de Perú", () => {
    expect(aulasFieldLabel("titular_operational_code")).toBe("Código titular");
    // `MUESTRA` es como el Excel del equipo rotula la ola. El rótulo dejó de ser
    // «Ola» —palabra mía— para usar la columna, que es lo que ellos leen.
    expect(aulasFieldLabel("wave")).toBe("Muestra");
    // Y esta NO se traduce a «efectivas»: las válidas las cuenta el sistema
    // desde Kobo y las efectivas el encuestador en el aula. Que no cuadren es lo
    // que detecta el cuadre del parte, así que igualar los nombres borraría la
    // comparación.
    expect(aulasFieldLabel("respuestas_validas")).toBe("Respuestas válidas");
    // El código lo llama `CURSO-HORARIO` y al descriptivo `SESIONES Y AULA`:
    // estaban cruzados.
    expect(aulasFieldLabel("operational_code")).toBe("Curso-horario");
    expect(aulasFieldLabel("label")).toBe("Sesiones y aula");
  });

  it("presenta los seis controles técnicos con etiquetas operativas", () => {
    expect([
      "anonymous_responses",
      "personal_identifiers",
      "unmapped_valid_responses",
      "duplicate_responses",
      "effective_representativity",
      "sex_faculty_quota",
    ].map(aulasCheckLabel)).toEqual([
      "Respuestas anónimas",
      "Identificadores personales en la base",
      "Respuestas válidas sin curso-horario",
      "Respuestas repetidas",
      "Representatividad efectiva",
      "Cuota por sexo y facultad",
    ]);
  });

  it("traduce los estados de validación sin exponer códigos técnicos", () => {
    expect(aulasStatusLabel("ok")).toBe("Correcto");
    expect(aulasStatusLabel("review")).toBe("Revisar");
    expect(aulasStatusLabel("warning")).toBe("Advertencia");
  });

  it("presenta valores de una fila sin mutar ni renombrar sus claves", () => {
    const row = Object.freeze({
      titular_operational_code: "AULA-07",
      wave: "M1",
      respuestas_validas: 14,
      anonymous_responses: true,
      check: "anonymous_responses",
      status: "review",
      detail: "El tablero agrega por aula/collector/link. Score efectivo 100.0.",
    });

    const presented = presentAulasRow(row);

    expect(presented).not.toBe(row);
    expect(presented).toEqual({
      titular_operational_code: "AULA-07",
      wave: "M1",
      respuestas_validas: 14,
      anonymous_responses: "Sí",
      check: "Respuestas anónimas",
      status: "Revisar",
      detail: "El tablero agrega por curso-horario, origen y enlace. Puntaje efectivo 100.0.",
    });
    expect(row).toEqual({
      titular_operational_code: "AULA-07",
      wave: "M1",
      respuestas_validas: 14,
      anonymous_responses: true,
      check: "anonymous_responses",
      status: "review",
      detail: "El tablero agrega por aula/collector/link. Score efectivo 100.0.",
    });
  });

  it("un control que no se pudo ejecutar no es alerta ni cuenta como evaluado", () => {
    // El defecto que esto fija: el KPI decia «6 controles que no pasan» sobre
    // un corte donde uno de los seis no pudo ejecutarse —la fuente no trae
    // identificador de respuesta— y el de al lado prometia «11 reglas
    // evaluadas». Los tres numeros tienen que cuadrar: evaluados + sin
    // comprobar = total, y las alertas salen solo de lo evaluado.
    const resumen = summarizeAulasValidation([
      { check: "anonymous_responses", status: "ok" },
      { check: "sex_faculty_quota", status: "warning" },
      { check: "duplicate_responses", status: "sin_datos" },
    ]);
    expect(resumen).toEqual({ label: "1 alerta", count: 1, sinComprobar: 1, evaluados: 2 });
    expect(resumen.evaluados + resumen.sinComprobar).toBe(3);

    // Y el control del control: sin ninguna fila `sin_datos` las mismas dos
    // reglas dan `evaluados` igual al total, asi que el aserto de arriba no
    // pasaria igual si `sin_datos` volviera a contarse como una mas.
    expect(summarizeAulasValidation([
      { check: "anonymous_responses", status: "ok" },
      { check: "sex_faculty_quota", status: "warning" },
    ])).toEqual({ label: "1 alerta", count: 1, sinComprobar: 0, evaluados: 2 });
  });

  it("resume solo estados no correctos como alertas", () => {
    expect(summarizeAulasValidation([])).toEqual({
      label: "Sin controles disponibles",
      count: 0,
      sinComprobar: 0,
      evaluados: 0,
    });

    expect(summarizeAulasValidation([
      { check: "anonymous_responses", status: "ok" },
      { check: "personal_identifiers", status: "ok" },
    ])).toEqual({ label: "Sin alertas", count: 0, sinComprobar: 0, evaluados: 2 });

    expect(summarizeAulasValidation([
      { check: "anonymous_responses", status: "ok" },
      { check: "duplicate_responses", status: "review" },
      { check: "sex_faculty_quota", status: "warning" },
    ])).toEqual({ label: "2 alertas", count: 2, sinComprobar: 0, evaluados: 3 });

    expect(summarizeAulasValidation([
      { check: "anonymous_responses", status: "" },
      { check: "personal_identifiers", status: "estado_nuevo" },
    ])).toEqual({ label: "2 alertas", count: 2, sinComprobar: 0, evaluados: 2 });
    // Un estado vacio NO es «Por revisar»: esa palabra ya la usa el estado
    // `review` de un control, y la misma palabra para un hallazgo y para la
    // ausencia de dato hacia que las 196 aulas dijeran «Estado de ficha: Por
    // revisar» con `package_status` vacio en las 196. El conteo de arriba SI se
    // conserva: un control sin estado sigue contando como alerta.
    expect(aulasStatusLabel("")).toBe("—");
    expect(aulasStatusLabel("review")).toBe("Revisar");
  });

  it("una proporción se enseña como el porcentaje que su rótulo promete", () => {
    const filas = [
      { operational_code: "CH 1", attendance_pct: 0.694, sent_vs_population: 0.98 },
      { operational_code: "CH 2", attendance_pct: 0.367, sent_vs_population: 1.083 },
    ];
    const escala = escalaDeProporciones(filas);
    const [primera, segunda] = filas.map((f) => presentAulasRow(f, escala));

    expect(primera.attendance_pct).toBe("69.4 %");
    // El excedente sigue siendo excedente: 1.083 es el 108.3 % de su meta, no
    // el 1.1 %. Una regla por VALOR —«≤ 1 es proporción»— lo habría hundido
    // mientras su vecina de 0.98 se pintaba «98 %», así que la escala se decide
    // por columna y este caso es el que las distingue. El separador decimal es
    // el punto porque el locale del módulo es `es-PE`.
    expect(segunda.sent_vs_population).toBe("108.3 %");
  });

  it("no convierte lo que no es una proporción aunque viva en la misma hoja", () => {
    // El control de la regla anterior. `threshold_total` son ENCUESTAS —medidas
    // entre 8 y 34 en el operativo— y `valid_total` un veredicto 0/1: una
    // detección que mirase sólo la forma del número los pintaría «2400 %» y
    // «100 %». Sólo se convierte lo que la lista cerrada declara.
    const filas = [{ threshold_total: 24, valid_total: 1, valid_population: 0, women_n: 12 }];
    const [fila] = filas.map((f) => presentAulasRow(f, escalaDeProporciones(filas)));

    expect(fila.threshold_total).toBe(24);
    expect(fila.valid_total).toBe(1);
    expect(fila.valid_population).toBe(0);
    expect(fila.women_n).toBe(12);
  });

  it("una columna que ya viene en 0-100 no se multiplica otra vez", () => {
    // El libro real puede traer estas razones en cualquiera de las dos escalas
    // y el motor no las normaliza a propósito. Sin este caso, «detectar» y
    // «suponer que siempre es 0-1» pasarían el mismo test.
    const filas = [
      { women_pct: 62.5, men_pct: 37.5 },
      { women_pct: 48, men_pct: 52 },
    ];
    const [fila] = filas.map((f) => presentAulasRow(f, escalaDeProporciones(filas)));

    // Sin multiplicar, pero con la unidad que el rótulo promete: la lista dice
    // que la columna ES un porcentaje, y la escala sólo decide si hay que
    // escalarla. `progress_pct` de la tabla de cuotas es el caso real: el motor
    // ya la calcula en 0-100 y se leía «62.3» a secas.
    expect(fila.women_pct).toBe("62.5 %");
    expect(fila.men_pct).toBe("37.5 %");
  });

  it("conecta la presentación pura con las tablas y el resumen de calidad", () => {
    const page = fs.readFileSync(path.join(featureDir, "AulasMonitoreoPage.tsx"), "utf8");

    expect(page).toContain("presentAulasRow(row, enProporcion)");
    // La escala sale de TODAS las filas, no de las que sobreviven al recorte.
    expect(page).toContain("escalaDeProporciones(rows)");
    expect(page).toContain("aulasFieldLabel(column)");
    expect(page).toContain("const summary = summarizeAulasValidation(rows)");
    expect(page).toContain("<span>{summary.label}</span>");
    expect(page).not.toMatch(/\{fmt\(rows\.length\)\} alertas/);
  });
});

describe("los vocabularios cerrados no derivan entre R y la UI", () => {
  // El motor declara vocabularios CERRADOS —los `check` de validación y los
  // estados operativos— y la UI los traduce con diccionarios a mano que nadie
  // ataba a ellos. Al añadir `valid_response_criterion` en R, la pantalla habría
  // mostrado la clave cruda sin que nada fallara; y los estados estaban
  // completos por suerte, no por construcción. Es el patrón de lista cerrada del
  // GOAL de campo, aquí entre capas.
  //
  // Se comparan las LISTAS de los dos lados, no la salida de la función: mi
  // primer intento infería «no hay entrada» de que la etiqueta coincidiera con
  // el fallback, y marcaba como ausentes los once estados cuya etiqueta correcta
  // ES la clave capitalizada. El instrumento producía el hallazgo.
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  const raiz = path.join(aqui, "..", "..", "..", "..", "..", "..");
  const motor = fs.readFileSync(path.join(raiz, "api", "R", "monitoreo_aulas_universitarias.R"), "utf8");
  const fuente = fs.readFileSync(path.join(aqui, "aulasPresentation.ts"), "utf8");
  const fuente2 = (nombre: string) => fs.readFileSync(path.join(aqui, nombre), "utf8");

  /** Claves declaradas en un diccionario `const NOMBRE: Record<...> = { ... }`. */
  function clavesDelDiccionario(nombre: string) {
    const bloque = fuente.match(new RegExp(`const ${nombre}: Record<string, string> = \\{([\\s\\S]*?)\\n\\};`));
    expect(bloque, `no se encontró el diccionario ${nombre}`).toBeTruthy();
    return new Set([...(bloque?.[1] ?? "").matchAll(/^\s{2}([a-z_]+):/gm)].map((m) => m[1]));
  }

  function literalesDe(texto: string | undefined) {
    return [...(texto ?? "").matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
  }

  it("traduce todos los checks de validación que el motor declara", () => {
    const bloque = motor.match(/check = c\(([^)]*)\)/);
    expect(bloque, "no se encontró el vector `check = c(...)` en el motor").toBeTruthy();
    const claves = literalesDe(bloque?.[1]);
    expect(claves.length).toBeGreaterThan(5);
    const etiquetadas = clavesDelDiccionario("CHECK_LABELS");
    const faltan = claves.filter((c) => !etiquetadas.has(c));
    expect(faltan, `checks del motor sin etiqueta: ${faltan.join(", ")}`).toEqual([]);
  });

  it("traduce las columnas de las dos tablas que el usuario lee", () => {
    // Tercer vocabulario cerrado. Medido antes: de las 93 columnas que emite el
    // tablero, 38 no tenían etiqueta y habrían salido en pantalla como jerga en
    // inglés —«Contact medium», «Effective surveys»—, justo los campos que L31 y
    // L32 acababan de añadir.
    //
    // El guard se ata a los DOS vectores literales del motor que alimentan las
    // tablas que se leen: el `course_status` de Avance y las columnas publicadas
    // de brechas. No a las 93: varias son internas y nunca llegan a una tabla, y
    // exigir etiqueta para todas sería pedirla donde no se ve.
    const vectores = [
      motor.match(/cols <- intersect\(c\(([\s\S]*?)\), names\(rows\)\)/)?.[1],
      motor.match(/BRECHAS_COLUMNAS_PUBLICADAS <- c\(([\s\S]*?)\n\)/)?.[1],
    ];
    expect(vectores.filter(Boolean).length, "no se encontraron los vectores del motor").toBe(2);
    const columnas = [...new Set(vectores.flatMap((v) => literalesDe(v)))];
    expect(columnas.length).toBeGreaterThan(15);
    const etiquetadas = clavesDelDiccionario("FIELD_LABELS");
    const faltan = columnas.filter((c) => !etiquetadas.has(c));
    expect(faltan, `columnas del motor sin etiqueta: ${faltan.join(", ")}`).toEqual([]);
  });

  it("y las de las otras DOS tablas que también se leen", () => {
    // El guard de arriba se ató a los vectores del motor que alimentaban las
    // tablas «que se leen», y era cierto al escribirlo. Después llegaron dos
    // tablas más —Partes de campo y Base de control— y el guard no las siguió:
    // cubría 2 de 4. Medido al descubrirlo: las 49 columnas visibles estaban
    // todas etiquetadas, así que no había defecto vivo; lo que faltaba era la
    // red para el día que alguien publique una columna nueva ahí, que saldría
    // en inglés sin que nada fallara. Es justo lo que este archivo cuenta que
    // ya pasó una vez con 38 columnas.
    //
    // Éstas se atan a lo que la VISTA pide —las listas de columnas de la página
    // y los campos por grupo del libro— y no a otro vector del motor. Un vector
    // del motor puede publicar columnas que ninguna tabla muestra; lo que hay
    // que etiquetar es lo que se ve.
    const pagina = fuente2("AulasMonitoreoPage.tsx");
    const libro = fuente2("AulasControlDelLibro.tsx");
    const pedidas = [...pagina.matchAll(/preferredColumns=\{\[([^\]]*)\]/g)]
      .flatMap((m) => literalesDe(m[1]));
    const porGrupo = libro.match(/const CAMPOS_POR_GRUPO: Record<string, string\[\]> = \{([\s\S]*?)\n\};/);
    expect(porGrupo, "no se encontró CAMPOS_POR_GRUPO en el libro").toBeTruthy();
    const columnas = [...new Set([
      ...pedidas,
      ...literalesDe(porGrupo?.[1]),
      "operational_code",
    ])];

    // Si este número baja, el guard dejó de ver una tabla: es el fallo que
    // tuvo el de arriba y que sólo se nota contando.
    expect(columnas.length).toBeGreaterThan(40);
    const etiquetadas = clavesDelDiccionario("FIELD_LABELS");
    const faltan = columnas.filter((c) => !etiquetadas.has(c));
    expect(faltan, `columnas visibles sin etiqueta: ${faltan.join(", ")}`).toEqual([]);
  });

  it("traduce todos los estados operativos que el motor declara", () => {
    const bloque = motor.match(/monitoreo_aulas_estados <- function\(\) \{\s*c\(([^)]*)\)/);
    expect(bloque, "no se encontró `monitoreo_aulas_estados()` en el motor").toBeTruthy();
    const estados = literalesDe(bloque?.[1]);
    expect(estados.length).toBeGreaterThan(8);
    const etiquetados = clavesDelDiccionario("STATUS_LABELS");
    const faltan = estados.filter((e) => !etiquetados.has(e));
    expect(faltan, `estados del motor sin etiqueta: ${faltan.join(", ")}`).toEqual([]);
  });
});

describe("una columna de porcentaje lo dice en su rótulo", () => {
  // `quota_pct` era el ÚNICO `_pct` del mapa cuya etiqueta no llevaba el «%»:
  // se leía «Cuota», pegada a «Faltantes cuota» —que sí es un conteo—, así que
  // la cabecera prometía la cuota del curso y debajo había la parte de ella ya
  // conseguida.
  // La lista vive sin exportar en el módulo; se lee del fuente para no abrir su
  // superficie pública sólo por un test.
  const fuente = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "aulasPresentation.ts"),
    "utf8",
  );
  const lista = (fuente.match(/const COLUMNAS_DE_PORCENTAJE = new Set\(\[([\s\S]*?)\]\)/) ?? [])[1] ?? "";
  const campos = [...lista.matchAll(/"(\w+)"/g)].map((m) => m[1]);

  it("se encontró la lista de porcentajes", () => {
    expect(campos.length).toBeGreaterThan(6);
  });

  it("todo campo de la lista lleva «%» o «vs» en su rótulo", () => {
    const sinMarca = campos
      .map((campo) => [campo, aulasFieldLabel(campo)] as const)
      .filter(([campo, rotulo]) => rotulo && rotulo !== campo && !/%|vs/i.test(rotulo))
      .map(([campo, rotulo]) => `${campo} → «${rotulo}»`);
    expect(sinMarca).toEqual([]);
  });

  it("«% Cuota» ya no se confunde con la cuota del curso", () => {
    expect(aulasFieldLabel("quota_pct")).toBe("% Cuota");
    expect(aulasFieldLabel("quota_missing")).toBe("Faltantes cuota");
  });
});

describe("la escala de una columna la decide su grueso, no su tope", () => {
  // `% Cuota` es lo conseguido sobre lo que el plan pide, así que pasarse del
  // 100 % es normal. Con la regla del máximo, una sola fila que doblara su
  // cuota (2.0) tumbaba la columna ENTERA: las 140 filas pasaban de «80 %» a
  // «0.8 %». La mediana no se mueve por un dato.

  it("con dos datos y uno pasado no se puede decidir, y no se decide", () => {
    // Honestidad del método: la mediana de [0.8, 2.4] es 1.6. Con dos
    // observaciones no hay grueso que mirar, y la columna no se escala.
    expect(escalaDeProporciones([{ quota_pct: 0.8 }, { quota_pct: 2.4 }]).has("quota_pct")).toBe(false);
  });

  it("una columna en 0-1 con una fila que se pasa sigue siendo proporción", () => {
    const filas = [
      { quota_pct: 0.8 }, { quota_pct: 0.6 }, { quota_pct: 0.9 },
      { quota_pct: 0.7 }, { quota_pct: 2.4 },
    ];
    expect(escalaDeProporciones(filas).has("quota_pct")).toBe(true);
  });

  it("una columna que ya viene en 0-100 NO se vuelve a multiplicar", () => {
    const filas = [
      { quota_pct: 80 }, { quota_pct: 60 }, { quota_pct: 90 },
      { quota_pct: 70 }, { quota_pct: 240 },
    ];
    expect(escalaDeProporciones(filas).has("quota_pct")).toBe(false);
  });

  it("la regla vieja del máximo fallaba en el primer caso", () => {
    // El control del control: con el máximo estas cinco filas NO eran
    // proporción y las cinco se imprimían divididas por cien.
    const filas = [
      { quota_pct: 0.8 }, { quota_pct: 0.6 }, { quota_pct: 0.9 },
      { quota_pct: 0.7 }, { quota_pct: 2.4 },
    ];
    expect(Math.max(...filas.map((f) => f.quota_pct))).toBeGreaterThan(1.5);
    expect(escalaDeProporciones(filas).has("quota_pct")).toBe(true);
  });
});
