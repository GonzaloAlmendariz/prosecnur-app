import { describe, expect, it } from "vitest";
import { avisoLibroPublicado, avisoTraslapeRecalculado } from "./avisoLibroPublicado";

/**
 * Qué pasó con cada hoja al publicar el libro en el Sheets del operativo.
 *
 * La regla de dueño de Gonzalo —«sin sobreescribir las dos primeras hojas, que
 * las llenan desde el sheets»— se cumple en el motor, pero si la UI no la
 * CUENTA, una hoja `respetada` se lee como una hoja que falló. El aviso es la
 * regla hecha visible.
 *
 * Números chicos a propósito: `fmt` usa es-PE y el runner sin ICU degrada el
 * separador de miles; por debajo de 1.000 el texto es igual en ambos.
 */

describe("avisoLibroPublicado", () => {
  it("cuenta la hoja de la app con su acción y sus filas", () => {
    const { texto, tono } = avisoLibroPublicado({
      hojas: [{ hoja: "Base de control", accion: "actualizada", filas: 174 }],
    });
    expect(texto).toContain("«Base de control» actualizada (174 filas)");
    expect(tono).toBe("ok");
  });

  it("una respetada a la que le falta una columna lo DICE, y una al día no inventa nada", () => {
    // Respetar la hoja del equipo es correcto. Callar que la columna nueva no
    // llegó, no: medido el 2026-09-18 sobre CCSS, el libro ganó CARRERA y las
    // cuatro hojas que crecieron son las del equipo. Cuatro «respetada» y
    // ninguna señal, con el campo a cuatro días.
    const texto = avisoLibroPublicado({
      hojas: [
        { hoja: "Aulas Agendadas", accion: "respetada", filas: 45, rotulos_retenidos: ["CARRERA"] },
        { hoja: "Aulas Aplicadas (Campo)", accion: "respetada", filas: 12 },
      ],
    } as never).texto;
    expect(texto).toContain("«Aulas Agendadas» respetada (45 filas): la llena el equipo, no la app; no le llegó «CARRERA»");
    // La que no retiene nada no gana ni una palabra.
    expect(texto).toContain("«Aulas Aplicadas (Campo)» respetada (12 filas): la llena el equipo, no la app");
    expect(texto).not.toContain("«Aulas Aplicadas (Campo)» respetada (12 filas): la llena el equipo, no la app; no le llegó");
  });

  it("con muchos rótulos retenidos nombra tres y cuenta el resto", () => {
    // La cabecera entera son decenas de rótulos: un aviso que los enumera todos
    // no se lee, y un aviso que no se lee no avisa.
    const texto = avisoLibroPublicado({
      hojas: [{
        hoja: "Aulas Agendadas", accion: "respetada", filas: 45,
        rotulos_retenidos: ["CARRERA", "TELÉFONO DE DOCENTE", "SESIONES Y AULA", "MEDIO DE CONTACTO", "RECIBIÓ CORREO"],
      }],
    } as never).texto;
    expect(texto).toContain('no le llegó «CARRERA», «TELÉFONO DE DOCENTE», «SESIONES Y AULA» y 2 más');
  });

  it("una hoja respetada SIEMPRE lleva su motivo: es la regla de dueño, no un fallo", () => {
    const { texto } = avisoLibroPublicado({
      hojas: [
        { hoja: "Aulas Agendadas", accion: "respetada", filas: 45 },
        { hoja: "Aulas Aplicadas (Campo)", accion: "respetada", filas: 12 },
      ],
    });
    expect(texto).toContain("«Aulas Agendadas» respetada (45 filas): la llena el equipo");
    expect(texto).toContain("«Aulas Aplicadas (Campo)» respetada (12 filas): la llena el equipo");
  });

  it("una fila va en singular", () => {
    const { texto } = avisoLibroPublicado({
      hojas: [{ hoja: "Base de control", accion: "actualizada", filas: 1 }],
    });
    expect(texto).toContain("(1 fila)");
    expect(texto).not.toContain("(1 filas)");
  });

  it("sembrada y sin_cambios se dicen en la voz del operativo", () => {
    const { texto } = avisoLibroPublicado({
      hojas: [
        { hoja: "Aulas Agendadas", accion: "sembrada", filas: 196 },
        { hoja: "Base de control", accion: "sin_cambios", filas: 174 },
      ],
    });
    expect(texto).toContain("«Aulas Agendadas» sembrada (196 filas)");
    expect(texto).toContain("«Base de control» sin cambios");
    // `sin_cambios` es el nombre del motor, no copy: el guion bajo no sale.
    expect(texto).not.toContain("sin_cambios");
  });

  it("una acción desconocida viaja con su nombre: la lista es abierta", () => {
    // La lección de las listas cerradas: si mañana el motor declara una acción
    // nueva, el aviso la enseña en vez de tragársela.
    const { texto } = avisoLibroPublicado({
      hojas: [{ hoja: "Base de control", accion: "reescrita", filas: 174 }],
    });
    expect(texto).toContain("«Base de control» reescrita (174 filas)");
  });

  it("cuando el enlace se acaba de recordar, lo dice", () => {
    const { texto } = avisoLibroPublicado({
      hojas: [{ hoja: "Base de control", accion: "actualizada", filas: 3 }],
      destino_guardado: true,
    });
    expect(texto).toMatch(/enlace qued[óo] guardado/);
  });

  it("sin resumen por hoja no finge un verde: lo declara en tono de atención", () => {
    const { texto, tono } = avisoLibroPublicado({ hojas: [] });
    expect(tono).toBe("atencion");
    expect(texto.length).toBeGreaterThan(0);
  });
});

/**
 * A1 (loop estética-aulas-sheets, 2026-09-07). Desde `732c4221` publicar LEE
 * las hojas del equipo antes de escribir y el recibo trae `lectura_previa`;
 * el día 1 de campo el encargado llevaba siete partes tecleados y la Base de
 * control publicada enseñaba uno, y nada en pantalla decía si se había leído.
 * El aviso cuenta esa lectura: qué trajo, o por qué no pudo y qué hacer.
 */
describe("avisoLibroPublicado: la lectura previa", () => {
  const hojas = [{ hoja: "Base de control", accion: "actualizada", filas: 9 }];

  it("cuenta lo que se leyó del equipo antes de escribir, delante de las hojas", () => {
    const { texto, tono } = avisoLibroPublicado({
      hojas,
      lectura_previa: {
        ok: true,
        omitida: false,
        error: "",
        resumen: { unidades: 174, partes_de_campo: 7, filas_de_control: 9 },
      },
    });
    expect(texto).toMatch(/^Antes de escribir se leyó lo del equipo: 7 partes de campo y 9 filas de control\./);
    expect(texto).toContain("Libro publicado:");
    expect(tono).toBe("ok");
  });

  it("uno va en singular", () => {
    const { texto } = avisoLibroPublicado({
      hojas,
      lectura_previa: { ok: true, resumen: { partes_de_campo: 1, filas_de_control: 1 } },
    });
    expect(texto).toContain("1 parte de campo y 1 fila de control");
  });

  it("si la lectura falló lo dice con su causa y la salida, y el libro se publicó igual", () => {
    const { texto, tono } = avisoLibroPublicado({
      hojas,
      lectura_previa: { ok: false, omitida: false, error: "HTTP 403", resumen: {} },
    });
    expect(texto).toContain("No se pudo leer el Sheets antes de publicar (HTTP 403)");
    expect(texto).toContain("se publicó con lo que la app ya tenía");
    expect(texto).toContain("Traer respuestas");
    expect(texto).toContain("Libro publicado:");
    expect(tono).toBe("atencion");
  });

  it("omitida (quien llamó ya había leído) o ausente (recibo viejo): no inventa una lectura", () => {
    const omitida = avisoLibroPublicado({ hojas, lectura_previa: { omitida: true } });
    expect(omitida.texto).not.toMatch(/ley[óo]|leer/);
    const ausente = avisoLibroPublicado({ hojas });
    expect(ausente.texto).not.toMatch(/ley[óo]|leer/);
    expect(omitida.tono).toBe("ok");
  });

  it("sin em dashes en el texto visible", () => {
    const { texto } = avisoLibroPublicado({
      hojas,
      lectura_previa: { ok: false, error: "HTTP 403", resumen: {} },
    });
    expect(texto).not.toContain("\u2014");
  });
});

describe("la adopción de la hoja de los aplicadores se dice", () => {
  it("cuenta lo adoptado, con el nombre de la hoja", () => {
    const { texto, tono } = avisoLibroPublicado({
      hojas: [{ hoja: "Base de control", accion: "actualizada", filas: 10 }],
      adopcion_distribucion: { ok: true, hoja: "Semana 1", adoptadas: 90 },
    });
    expect(texto).toContain("90 asignaciones");
    expect(texto).toContain("Semana 1");
    expect(tono).toBe("ok");
  });

  it("con una pestaña por semana las nombra TODAS, no la primera", () => {
    // Adoptar es lo que congela el reparto. Decir «Semana 1» cuando se
    // congelaron dos deja sin contar justo la semana que las diecinueve
    // personas ya tienen leída.
    const { texto } = avisoLibroPublicado({
      hojas: [{ hoja: "Base de control", accion: "actualizada", filas: 10 }],
      adopcion_distribucion: {
        ok: true,
        hoja: "Semana 1",
        hojas: ["Semana 1", "Semana 2"],
        adoptadas: 140,
      },
    });
    expect(texto).toContain("«Semana 1» y «Semana 2»");
    expect(texto).toContain("140 asignaciones");
  });

  it("sin lista de hojas sigue nombrando la única que trae", () => {
    const { texto } = avisoLibroPublicado({
      hojas: [{ hoja: "Base de control", accion: "actualizada", filas: 10 }],
      adopcion_distribucion: { ok: true, hoja: "Semana 1", hojas: [], adoptadas: 3 },
    });
    expect(texto).toContain("«Semana 1»");
  });

  it("sin destino recordado AVISA, porque Asignación se rehízo a ciegas", () => {
    // Publicar rehace «Asignación de aplicadores». Si no leyó la hoja de los 22,
    // lo hace con un sorteo nuevo que no tiene por qué caer donde cayó el
    // comunicado: el 2026-09-09 eso dejó 38 de 85 aulas con dos aplicadores
    // distintos entre las dos hojas.
    const { texto, tono } = avisoLibroPublicado({
      hojas: [{ hoja: "Base de control", accion: "actualizada", filas: 10 }],
      adopcion_distribucion: { ok: false, omitida: true, motivo: "sin_destino" },
    });
    expect(texto).toContain("no recuerda su enlace");
    expect(tono).toBe("atencion");
  });

  it("el tono se lo lleva el peor: una adopción fallida no se pinta de verde", () => {
    const { tono } = avisoLibroPublicado({
      hojas: [{ hoja: "Base de control", accion: "actualizada", filas: 10 }],
      lectura_previa: { ok: true, omitida: false, resumen: { partes_de_campo: 3 } },
      adopcion_distribucion: { ok: false, motivo: "error", error: "403" },
    });
    expect(tono).toBe("atencion");
  });

  it("un recibo sin ese campo no menciona la adopción", () => {
    const { texto } = avisoLibroPublicado({
      hojas: [{ hoja: "Base de control", accion: "actualizada", filas: 10 }],
    });
    expect(texto).not.toContain("adoptó");
  });
});

describe("las hojas que encogen", () => {
  it("las nombra con sus dos cifras y pone el aviso en atención", () => {
    // El 2026-09-12 una publicación dejó «Base de control» sin 3.555 celdas y
    // el recibo dijo «actualizada» igual: encoger y actualizar se veían lo
    // mismo, que es lo que hace que nadie mire.
    const { texto, tono } = avisoLibroPublicado({
      hojas: [{ hoja: "Base de control", accion: "actualizada", filas: 40 }],
      encogidas: [{ hoja: "Base de control", antes: 88, ahora: 40 }],
    });
    expect(texto).toContain("«Base de control» de 88 filas a 40 filas");
    expect(texto).toContain("menos contenido");
    expect(tono).toBe("atencion");
  });

  it("sin ninguna, ni una palabra de más", () => {
    const { texto, tono } = avisoLibroPublicado({
      hojas: [{ hoja: "Base de control", accion: "actualizada", filas: 40 }],
      encogidas: [],
    });
    expect(texto).not.toContain("menos contenido");
    expect(tono).toBe("ok");
  });
});

/**
 * El recibo de releer el cruce. Dice las tres cosas que decide quien lo pulsa:
 * cuántas unidades comparten algo, de qué tipo, y **si el libro vivo se pudo
 * leer** — lo tercero no es un detalle técnico: sin él el cruce no puede
 * afirmar quién fue contactado, y callarlo sería dar por medido lo que no se
 * midió.
 */
describe("avisoTraslapeRecalculado", () => {
  const base = {
    traslape: {
      unidades: 136, con_traslape: 68, etiqueta: "HSVG",
      por_veredicto: {
        "AULA EN EL PLAN DE HSVG": 32, "AULA YA APLICADA EN HSVG": 12,
        "DOCENTE EN EL PLAN DE HSVG": 20, "DOCENTE YA CONTACTADO EN HSVG": 4,
      },
    },
    libro_leido: true, aulas_del_otro: 1392,
  };

  it("resume con las cifras del cruce y ordena de mayor a menor", () => {
    const a = avisoTraslapeRecalculado(base);
    expect(a.texto).toContain("68 de 136 unidades comparten algo");
    // El primero es el que más pesa: la lista existe para eso.
    expect(a.texto.indexOf("32 aula en el plan")).toBeLessThan(a.texto.indexOf("4 docente ya contactado"));
    expect(a.tono).toBe("ok");
  });

  it("sin libro vivo lo DICE, y baja el tono sin llamarlo error", () => {
    // No es un fallo del cruce: es un alcance menor. Los planes se cruzan igual.
    const a = avisoTraslapeRecalculado({ ...base, libro_leido: false });
    expect(a.texto).toContain("no a quién ya contactaron");
    expect(a.tono).toBe("atencion");
  });

  it("cero unidades manda a revisar la fuente, no a repetir el cruce", () => {
    const a = avisoTraslapeRecalculado({ traslape: { unidades: 0 }, libro_leido: true });
    expect(a.texto).toContain("revisa la fuente declarada");
    expect(a.tono).toBe("atencion");
  });
});

describe("avisoTraslapeRecalculado: la cola que repite el estudio", () => {
  const con = (por: Record<string, number>) => avisoTraslapeRecalculado({
    traslape: { unidades: 136, con_traslape: 68, etiqueta: "HSVG", por_veredicto: por },
    libro_leido: true,
  }).texto;

  it("recorta «de HSVG» y «en HSVG»: la frase ya lo dijo", () => {
    // Se vio en la app: cuatro veredictos seguidos repetían el nombre cinco
    // veces en una frase, y en minúscula salía «hsvg», que no se escribe así.
    const texto = con({ "AULA EN EL PLAN DE HSVG": 32, "AULA YA APLICADA EN HSVG": 12 });
    expect(texto).toContain("32 aula en el plan");
    expect(texto).toContain("12 aula ya aplicada");
    expect(texto).not.toContain("hsvg");
    // Y el nombre sigue estando UNA vez, al principio y bien escrito.
    expect(texto).toContain("Cruce con HSVG");
  });

  it("una redacción que no casa se muestra entera, no a medias", () => {
    // Mutilar por una posición adivinada sería peor que repetir el nombre.
    expect(con({ "COMPARTEN ALGO CON OTRA COSA": 5 })).toContain("5 comparten algo con otra cosa");
  });
});
