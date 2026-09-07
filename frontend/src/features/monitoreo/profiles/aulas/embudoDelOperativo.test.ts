// «Enorme diferencia si la comparamos con Cálculo de cursos-horario» —Gonzalo.
//
// Cálculo tiene un mapa del recorrido que va de las filas leídas a los titulares
// con la merma en cada arista, y contesta «¿de dónde salió este número?» sin
// salir de la pantalla. Monitoreo enseñaba KPIs sueltos sin decir cómo se
// encadenan.
import { describe, expect, it } from "vitest";
import { embudoDelOperativo, explicacionDelEmbudo } from "./embudoDelOperativo";

describe("embudoDelOperativo", () => {
  it("encadena el plan con lo aplicado y declara lo que falta", () => {
    const e = embudoDelOperativo({ aulas_titulares: 193, aulas_aplicadas: 40 });
    expect(e.map((x) => x.id)).toEqual(["plan", "aplicadas"]);
    expect(e[0].valor).toBe("193");
    // La merma es lo que separa un paso del siguiente, dicho sin acusar.
    expect(e[0].merma).toEqual({ n: 153, label: "sin aplicar todavía" });
  });

  it("sin plan no dibuja un embudo de ceros", () => {
    // Un embudo vacío ocupa el sitio de un vacío que sí podría decir qué falta.
    expect(embudoDelOperativo({ aulas_aplicadas: 0 })).toEqual([]);
    expect(embudoDelOperativo(null)).toEqual([]);
  });

  it("las respuestas sólo entran cuando la plataforma trajo algo", () => {
    // Sin fuentes conectadas, dos escalones en cero dirían que se perdió todo.
    const sin = embudoDelOperativo({ aulas_titulares: 193, aulas_aplicadas: 40 });
    expect(sin.map((x) => x.id)).not.toContain("recibidas");

    const con = embudoDelOperativo({
      aulas_titulares: 193, aulas_aplicadas: 40,
      respuestas_total: 900, respuestas_validas: 860, filter_rejected: 40,
    });
    expect(con.map((x) => x.id)).toEqual(["plan", "aplicadas", "recibidas", "validas"]);
    // Sin nada declarado como fuera del operativo, la merma dice su única
    // causa: el criterio de efectividad.
    expect(con[2].merma).toEqual({ n: 40, label: "no pasan el criterio de efectividad" });
  });

  it("la merma es la diferencia con la etapa de abajo, no `filter_rejected`", () => {
    // **El caso real, medido en pantalla sobre HSVG2026 con los filtros del
    // instrumento sembrados**: el embudo decía «1 811 recibidas · −67
    // descartadas» encima de «1 637 que cuentan», y 1 811 − 1 637 = 174.
    //
    // `filter_rejected` sale de `.monitoreo_aulas_filter_passed()`, que no mira
    // la cadena de filtros declarada: busca una columna llamada `apto`,
    // `elegible`, `consent` o `consentimiento` y cuenta sobre ella. El
    // instrumento de este estudio abre con la pregunta de consentimiento, así
    // que la columna se llama así y la merma pasó a ser la de ESE filtro.
    //
    // El fixture de arriba no distingue las dos cuentas porque es coherente
    // consigo mismo (900 − 860 = 40). Éste sí: son 174 contra 67.
    const e = embudoDelOperativo({
      aulas_titulares: 174, aulas_aplicadas: 78,
      respuestas_total: 1811, respuestas_validas: 1637, filter_rejected: 67,
    });
    expect(e[2].merma?.n).toBe(174);
  });

  it("la merma separa lo que no era del estudio de lo que no pasó el criterio", () => {
    // **Dos noticias distintas en la misma cifra.** El primer día de HSVG2026
    // el embudo decía «−60 descartadas por el filtro»: 36 habían llegado por el
    // QR de capacitación o de prueba —no son del operativo y no hay nada que
    // arreglar— y 24 sí salieron de un aula y no pasaron el criterio, que es lo
    // único sobre lo que el campo puede actuar.
    const e = embudoDelOperativo({
      aulas_titulares: 174, aulas_aplicadas: 8,
      respuestas_total: 253, respuestas_validas: 193,
      respuestas_fuera_del_operativo: 36,
    });
    expect(e[2].merma?.n).toBe(60);
    expect(e[2].merma?.label).toContain("36 fuera del operativo");
    expect(e[2].merma?.label).toContain("24 no pasan el criterio");
  });

  it("nunca da una merma negativa", () => {
    // Si por lo que sea llegaran más válidas que recibidas, un «−12
    // descartadas» negativo se leería como que aparecieron respuestas.
    const e = embudoDelOperativo({
      aulas_titulares: 10, aulas_aplicadas: 5,
      respuestas_total: 100, respuestas_validas: 112,
    });
    expect(e[2].merma).toBeUndefined();
  });

  it("los reemplazos activados se declaran en la procedencia del plan", () => {
    // Es la cifra que explica por qué el plan de hoy no es el sorteo de ayer, y
    // llega como argumento: `reemplazos_usados` del payload NO sirve —cuenta
    // reservas cuyo estado operativo ya salió del inicial, no titulares
    // sustituidos—. Medido sobre `campo_malo`: decía «174 con reemplazo
    // activado» mientras Consultas contaba «Cerraron con reemplazo 3».
    const e = embudoDelOperativo(
      { aulas_titulares: 193, aulas_aplicadas: 12, reemplazos_usados: 174 },
      7,
    );
    expect(e[0].detalle).toContain("7 con reemplazo activado");
    // El control que importa: el número del payload no puede colarse.
    expect(e[0].detalle).not.toContain("174");
  });

  it("sin reemplazos no inventa la frase", () => {
    const e = embudoDelOperativo({ aulas_titulares: 193, aulas_aplicadas: 12 });
    expect(e[0].detalle).toBe("titulares sorteados");
  });

  it("un plan cerrado no declara merma", () => {
    const e = embudoDelOperativo({ aulas_titulares: 50, aulas_aplicadas: 50 });
    expect(e[0].merma).toBeUndefined();
  });

  it("las cifras rotas no ensucian el embudo", () => {
    const e = embudoDelOperativo({
      aulas_titulares: 10, aulas_aplicadas: -3 as unknown as number,
      respuestas_total: Number.NaN as unknown as number,
    });
    expect(e[1].valor).toBe("0");
    expect(e.map((x) => x.id)).not.toContain("recibidas");
  });
});

// Patrón 5 del catálogo: la explicación debajo de las cifras.
//
// Cálculo pone bajo su cadena de conversión un párrafo que explica por qué el
// divisor son elegibles y por qué las reservas no cambian la muestra. Ninguna
// pantalla de Monitoreo explicaba lo que enseña.
//
// Cada frase corresponde a una regla del motor, así que estos asertos defienden
// que lo dicho siga siendo verdad.
describe("explicacionDelEmbudo", () => {
  it("nombra las tres fuentes y dice cuál mueve la cifra", () => {
    // **La frase decía «cuando su parte de campo lo declara», y el parte de
    // campo es justo lo que NO la mueve.** En esta app «parte de campo» es el
    // artefacto del libro —la hoja que el jefe de campo transcribe desde las
    // fichas de papel, que la pantalla de al lado rotula «3 con parte en el
    // libro»—. `aulas_aplicadas` cuenta `operational_status`, y ese lo escribe
    // el registro de la APP: medido, tres partes «Aplicada» importados dejaban
    // `aulas_aplicadas = 0`.
    //
    // Quien lee la explicación, importa el libro y ve «Aplicadas 0» concluye
    // que la app está rota. Este test defiende que la frase distinga los tres
    // caminos y no vuelva a prometer el que no manda.
    //
    // **Y desde el 2026-09-07 los tres SÍ cuentan.** La definición cambió el
    // primer día de campo: con ocho aulas produciendo encuestas la cifra decía
    // UNA, porque sólo miraba el registro de la app. Lo que este test defiende
    // ahora es que la frase nombre los tres caminos y no vuelva a prometer que
    // uno de ellos no mueve la cifra — una explicación que sobrevive al cambio
    // que describe deja de explicar y pasa a desmentir el número que tiene
    // encima.
    const [primera] = explicacionDelEmbudo({ aulas_titulares: 193 });
    expect(primera).toContain("alguien lo registra en esta app");
    expect(primera).toContain("parte");
    expect(primera).toContain("respuestas");
    expect(primera).toContain("basta con uno");
    // Y ninguna versión de «este camino no cuenta».
    expect(primera).not.toContain("no la mueve");
    expect(primera).not.toContain("sólo el primero");
  });

  it("dice que una reserva sustituye, no suma", () => {
    const frases = explicacionDelEmbudo({ aulas_titulares: 193 });
    expect(frases.join(" ")).toContain("no uno más");
    expect(frases.join(" ")).toContain("193");
  });

  it("con reservas ya activadas lo cuenta, sin cambiar el total del plan", () => {
    const frases = explicacionDelEmbudo(
      { aulas_titulares: 193, reemplazos_usados: 174 },
      7,
    );
    expect(frases.join(" ")).toContain("ya han entrado 7");
    expect(frases.join(" ")).not.toContain("174");
    expect(frases.join(" ")).toContain("no se suma a él");
  });

  it("la regla de los filtros sólo se explica si hay respuestas", () => {
    const sin = explicacionDelEmbudo({ aulas_titulares: 193 });
    expect(sin.join(" ")).not.toContain("filtros");

    const con = explicacionDelEmbudo({ aulas_titulares: 193, respuestas_total: 900 });
    expect(con.join(" ")).toContain("todos los filtros");
    // Y la abstención del motor: una columna ausente no descarta la respuesta.
    expect(con.join(" ")).toContain("no se aplica y se avisa aparte");
  });

  it("sin plan no explica nada", () => {
    expect(explicacionDelEmbudo({})).toEqual([]);
    expect(explicacionDelEmbudo(null)).toEqual([]);
  });
});


/**
 * **Y el rótulo de la etapa tampoco puede prometer el parte.**
 *
 * La prosa del embudo se corrigió porque decía «cuenta como aplicado cuando su
 * parte de campo lo declara» sobre una cifra que el parte no mueve. El detalle
 * de la etapa «Aplicadas en campo» decía «con parte de campo registrado» y se
 * quedó atrás, en el MISMO archivo: visto en pantalla en Fuentes, «0 · con
 * parte de campo registrado» con tres partes importados.
 *
 * Un test por superficie no basta cuando la misma frase vive en dos sitios del
 * mismo módulo; este cubre las dos a la vez.
 */
describe("embudoDelOperativo · las dos superficies dicen lo mismo del parte", () => {
  it("la etapa de aplicadas nombra los tres caminos", () => {
    // **Antes prohibía nombrar el parte aquí**, y con razón: la cifra sólo
    // contaba el registro de la app. Desde el 2026-09-07 el parte SÍ la mueve
    // —igual que las respuestas—, así que lo que este test defiende es lo que
    // no cambió: que el detalle de la etapa y la prosa de más abajo digan lo
    // MISMO. Ya pasó una vez que se arregló una y la otra se quedó atrás, en
    // este mismo archivo.
    const etapas = embudoDelOperativo({ aulas_titulares: 193, aulas_aplicadas: 0 });
    const aplicadas = etapas.find((e) => e.id === "aplicadas");
    expect(aplicadas?.detalle).toContain("parte");
    expect(aplicadas?.detalle).toContain("respuestas");
  });

  it("y el detalle de la etapa concuerda con la prosa del recorrido", () => {
    const etapas = embudoDelOperativo({
      aulas_titulares: 193, aulas_aplicadas: 12, respuestas_total: 300, respuestas_validas: 280,
    });
    const detalle = String(etapas.find((e) => e.id === "aplicadas")?.detalle ?? "");
    const [prosa] = explicacionDelEmbudo({ aulas_titulares: 193 });
    // Los dos caminos que la versión anterior negaba, nombrados en las dos.
    for (const camino of ["parte", "respuestas"]) {
      expect(detalle).toContain(camino);
      expect(prosa).toContain(camino);
    }
    // Y ninguna vuelve a decir que uno de ellos no cuenta.
    for (const texto of [detalle, prosa]) {
      expect(texto).not.toContain("no la mueve");
      expect(texto).not.toContain("sólo el primero");
    }
  });
});
