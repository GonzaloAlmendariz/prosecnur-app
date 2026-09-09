import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasDosTasas, MonitoreoAulasDosTasasAula } from "../../../../api/monitoreo";
import { AulasSenalesPorAula } from "./AulasSenalesPorAula";
import { ptsDeBanda, senalesPorAula, tasaEnPct } from "./senalesPorAula";

/**
 * La señal por curso-horario JUNTO a la vara de su facultad (unidad B3).
 *
 * El mandato es «señalar, no descartar»: la superficie ordena lo que pide una
 * mirada —bajo primero, luego sobre—, agrega lo conforme, y a lo que no se pudo
 * contrastar le pone su motivo en vez de esconderlo. Nada de aquí recalcula:
 * tasas, banda y señal las publica `monitoreo_aulas_dos_tasas()`.
 *
 * Tras el rechazo metodológico (B1, 2026-08-31) el contraste es CONDICIONAL al
 * estado aplicado: `pendiente` y `retirada` son grupos con motivo propio —jamás
 * un «bajo» por agenda—, `descuadre` tiene nombre propio, y el encabezado
 * cuenta SOLO a los aplicados fuera de su margen.
 */

const aula = (
  codigo: string,
  senal: MonitoreoAulasDosTasasAula["senal"],
  extra: Partial<MonitoreoAulasDosTasasAula> = {},
): MonitoreoAulasDosTasasAula => ({
  codigo,
  facultad: "Ciencias",
  elegibles: 40,
  efectivas: 22,
  numerador: "plataforma",
  tasa_prevista: 0.6,
  tasa_facultad: 0.55,
  tasa_observada: 0.55,
  banda: 0.1549,
  senal,
  ...extra,
});

/**
 * Una fila NO contrastada, como la emite el motor: con estado literal, prevista
 * y elegibles, y SIN efectivas/numerador/tasa_observada/banda — esos son los
 * campos del contraste y en agenda invitarían a leer un juicio que no hay.
 */
const enAgenda = (
  codigo: string,
  senal: "pendiente" | "retirada",
  estado: string | null,
  extra: Partial<MonitoreoAulasDosTasasAula> = {},
): MonitoreoAulasDosTasasAula => ({
  codigo,
  facultad: "Ciencias",
  estado_operativo: estado,
  elegibles: 40,
  tasa_prevista: 0.6,
  tasa_facultad: 0.55,
  senal,
  ...extra,
});

const bloque = (aulas: MonitoreoAulasDosTasasAula[]): MonitoreoAulasDosTasas => ({
  aulas,
  criterio: {
    numerador: "la efectiva de plataforma primero; el parte como respaldo",
    denominador: "los elegibles de la propia aula",
    // Textos DISTINTIVOS a propósito: los asserts de M4 comprueban que la
    // vista enseña ESTE texto —el del payload— y no una copia tecleada que
    // mentiría en cuanto el motor cambie su mínimo de elegibles o su z.
    estados: "ESTADOS-DEL-MOTOR: solo se contrasta lo aplicado; lo previo viaja como `pendiente`",
    banda: "BANDA-DEL-MOTOR: con menos de 19 elegibles no se arma y mediria mas de ±24 puntos",
    vara_agregada: "la tasa de la facultad viaja al lado",
    senal: "conforme dentro de la banda; bajo/sobre solo fuera",
  },
});

describe("senalesPorAula agrupa sin descartar", () => {
  it("sin bloque lo declara: backend viejo no es un vacío mudo", () => {
    expect(senalesPorAula(null).estado).toBe("sin_bloque");
    expect(senalesPorAula(undefined).estado).toBe("sin_bloque");
  });

  it("con el bloque presente pero sin cursos-horario, distingue esa causa", () => {
    expect(senalesPorAula(bloque([])).estado).toBe("sin_cursos");
  });

  it("los señalados van primero: bajo, luego sobre, y el desvío mayor delante", () => {
    const res = senalesPorAula(bloque([
      aula("CH A", "conforme"),
      aula("CH B", "sobre", { tasa_observada: 0.7 }),
      aula("CH C", "bajo", { tasa_observada: 0.4 }),
      aula("CH D", "bajo", { tasa_observada: 0.55 }),
      aula("CH E", "sobre", { tasa_observada: 0.9 }),
      aula("CH F", "sin_banda", { elegibles: 3, banda: null }),
    ]));
    if (res.estado !== "medido") throw new Error(`estado inesperado: ${res.estado}`);
    // Bajo primero (el más hundido delante), después sobre (el más pasado delante).
    expect(res.senalados.map((a) => a.codigo)).toEqual(["CH C", "CH D", "CH E", "CH B"]);
    expect(res.conformes.map((a) => a.codigo)).toEqual(["CH A"]);
    expect(res.sinMedir.map((g) => g.senal)).toEqual(["sin_banda"]);
    expect(res.sinMedir[0].aulas.map((a) => a.codigo)).toEqual(["CH F"]);
  });

  it("cada grupo sin contrastar declara su motivo, y los tres motivos difieren", () => {
    const res = senalesPorAula(bloque([
      aula("CH 1", "sin_previsto", { tasa_prevista: null, banda: null }),
      aula("CH 2", "sin_datos", { efectivas: null, numerador: null, tasa_observada: null }),
      aula("CH 3", "sin_banda", { elegibles: 3, banda: null }),
    ]));
    if (res.estado !== "medido") throw new Error(`estado inesperado: ${res.estado}`);
    expect(res.senalados).toEqual([]);
    expect(res.conformes).toEqual([]);
    expect(res.sinMedir.map((g) => g.senal)).toEqual(["sin_banda", "sin_previsto", "sin_datos"]);
    const motivos = res.sinMedir.map((g) => g.motivo);
    for (const motivo of motivos) expect(motivo.length).toBeGreaterThan(10);
    expect(new Set(motivos).size).toBe(motivos.length);
  });

  it("una señal que no reconoce no se traga: viaja aparte con su nombre", () => {
    // La lista cerrada que descarta en silencio es el patrón más caro del repo.
    const res = senalesPorAula(bloque([
      aula("CH 1", "conforme"),
      aula("CH 2", "senal_futura"),
    ]));
    if (res.estado !== "medido") throw new Error(`estado inesperado: ${res.estado}`);
    expect(res.desconocidos.map((a) => a.codigo)).toEqual(["CH 2"]);
    expect(res.desconocidos[0].senal).toBe("senal_futura");
    // Y la cuenta total no pierde a nadie.
    expect(res.medidos).toBe(2);
  });
});

describe("los grupos del contraste condicionado (B1: solo lo aplicado se contrasta)", () => {
  it("pendiente y retirada van a su grupo con su estado literal, jamás a «bajo» ni a desconocidos", () => {
    const res = senalesPorAula(bloque([
      aula("CH B", "bajo", { tasa_observada: 0.4 }),
      enAgenda("CH P", "pendiente", "agendada"),
      enAgenda("CH Q", "pendiente", "en_campo"),
      enAgenda("CH R", "retirada", "sin_acceso"),
    ]));
    if (res.estado !== "medido") throw new Error(`estado inesperado: ${res.estado}`);
    expect(res.senalados.map((a) => a.codigo)).toEqual(["CH B"]);
    expect(res.pendientes.map((a) => a.codigo)).toEqual(["CH P", "CH Q"]);
    expect(res.pendientes.map((a) => a.estadoOperativo)).toEqual(["agendada", "en_campo"]);
    expect(res.retiradas.map((a) => a.codigo)).toEqual(["CH R"]);
    expect(res.retiradas[0].estadoOperativo).toBe("sin_acceso");
    // Reconocidos: no viajan como «señal que esta vista no reconoce».
    expect(res.desconocidos).toEqual([]);
    // Y nadie sale del conteo por su señal.
    expect(res.medidos).toBe(4);
  });

  it("el descuadre tiene nombre propio: no es «sobre» ni engrosa a los señalados", () => {
    const res = senalesPorAula(bloque([
      aula("CH D", "descuadre", { efectivas: 55, tasa_observada: 1.375 }),
      aula("CH A", "conforme"),
    ]));
    if (res.estado !== "medido") throw new Error(`estado inesperado: ${res.estado}`);
    expect(res.descuadres.map((a) => a.codigo)).toEqual(["CH D"]);
    expect(res.senalados).toEqual([]);
    expect(res.desconocidos).toEqual([]);
  });

  it("una fila pendiente sin estado escrito queda sin literal, no con uno inventado", () => {
    const res = senalesPorAula(bloque([
      enAgenda("CH P", "pendiente", null),
    ]));
    if (res.estado !== "medido") throw new Error(`estado inesperado: ${res.estado}`);
    expect(res.pendientes).toHaveLength(1);
    expect(res.pendientes[0].estadoOperativo).toBeNull();
  });

  it("dos filas sin código no comparten clave (N5)", () => {
    const res = senalesPorAula(bloque([
      aula("", "conforme"),
      aula("", "conforme"),
    ]));
    if (res.estado !== "medido") throw new Error(`estado inesperado: ${res.estado}`);
    const claves = res.conformes.map((a) => a.clave);
    expect(new Set(claves).size).toBe(2);
    // El rótulo visible sigue diciendo que falta el código; la clave es otra cosa.
    expect(res.conformes[0].codigo).toBe("(sin código)");
  });

  it("los textos del criterio viajan tal cual del payload (M4)", () => {
    const res = senalesPorAula(bloque([aula("CH A", "conforme")]));
    if (res.estado !== "medido") throw new Error(`estado inesperado: ${res.estado}`);
    expect(res.criterio.banda).toContain("BANDA-DEL-MOTOR");
    expect(res.criterio.estados).toContain("ESTADOS-DEL-MOTOR");
  });
});

describe("los formatos de la superficie", () => {
  it("la banda se dice en puntos enteros, como el panel de facultad", () => {
    // 0,1549 de proporción son ±15 puntos: la misma regla que `margenError`.
    expect(ptsDeBanda(0.1549)).toBe("± 15 pts");
    expect(ptsDeBanda(null)).toBeNull();
    expect(ptsDeBanda(undefined)).toBeNull();
    // Una banda que redondea a cero no dice nada: mejor callarla que fingirla.
    expect(ptsDeBanda(0.0004)).toBeNull();
  });

  it("una tasa se enseña como porcentaje y la ausente como raya", () => {
    // Separador decimal tolerante: el runner sin ICU degrada `es-PE` a inglés.
    expect(tasaEnPct(0.55)).toMatch(/^55[.,]0 %$/);
    expect(tasaEnPct(null)).toBe("—");
    expect(tasaEnPct(Number.NaN)).toBe("—");
  });
});

describe("AulasSenalesPorAula proyecta sin veredictos", () => {
  const texto = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

  it("sin bloque pinta un vacío declarado, no revienta ni calla", () => {
    const html = renderToStaticMarkup(<AulasSenalesPorAula bloque={null} />);
    expect(html).toContain("mon-profile-muted");
    expect(html).toContain('data-qa-geometry-member="true"');
    expect(texto(html)).toContain("todavía no publica");
  });

  it("una fila señalada lleva las DOS varas: la suya y la de su facultad", () => {
    const html = renderToStaticMarkup(
      <AulasSenalesPorAula bloque={bloque([
        aula("CH C", "bajo", { tasa_observada: 0.4, tasa_facultad: 0.52 }),
        aula("CH A", "conforme"),
      ])} />,
    );
    const plano = texto(html);
    expect(plano).toContain("CH C");
    // Observada, prevista con su banda y la vara agregada, en la misma fila.
    expect(plano).toMatch(/40[.,]0 %/);
    expect(plano).toMatch(/60[.,]0 %/);
    expect(plano).toMatch(/52[.,]0 %/);
    expect(plano).toContain("± 15 pts");
    // N6: el denominador de la tasa son los ELEGIBLES del aula, no «alumnos».
    expect(plano).toContain("22 efectivas de 40 elegibles");
    expect(plano).not.toContain("alumnos");
    // La palabra prohibida: la señal no es un veredicto de validez.
    expect(plano.toLowerCase()).not.toContain("válida");
    expect(plano.toLowerCase()).not.toContain("no cumple");
  });

  it("el encabezado cuenta SOLO aplicados fuera de su margen: la agenda no suma (hallazgo 2)", () => {
    const html = renderToStaticMarkup(
      <AulasSenalesPorAula bloque={bloque([
        aula("CH B", "bajo", { tasa_observada: 0.4 }),
        aula("CH A", "conforme"),
        enAgenda("CH P1", "pendiente", "agendada"),
        enAgenda("CH P2", "pendiente", "en_campo"),
        enAgenda("CH R", "retirada", "reemplazada"),
      ])} />,
    );
    const plano = texto(html);
    // 1 de 2 (bajo + conforme): ni los 2 pendientes ni el retirado entran al
    // numerador o al denominador — el rótulo viejo prometía rendimiento y
    // entregaba agenda.
    expect(plano).toContain("De los 2 cursos-horario aplicados");
    expect(plano).toContain("1 se sale del suyo");
    expect(plano).not.toContain("3 se salen");
    expect(plano).not.toContain("De los 5");
    // El estado literal de cada uno, visible en su grupo.
    expect(plano).toContain("agendada");
    expect(plano).toContain("en_campo");
    expect(plano).toContain("reemplazada");
  });

  it("pendientes y retiradas se pliegan con su porqué y el criterio del motor acompaña", () => {
    const html = renderToStaticMarkup(
      <AulasSenalesPorAula bloque={bloque([
        enAgenda("CH P1", "pendiente", "agendada"),
        enAgenda("CH P2", "pendiente", "planificada"),
        enAgenda("CH R", "retirada", "cancelada"),
      ])} />,
    );
    const plano = texto(html);
    expect(plano).toContain("2 cursos-horario aún sin aplicar");
    expect(plano).toContain("ya no se aplicará");
    // La clasificación por estado la dice el motor (M4), no una copia local.
    expect(plano).toContain("ESTADOS-DEL-MOTOR");
    // Lo que se espera del pendiente, sin una observada fantasma.
    //
    // **Se pide por FACULTAD y no por curso-horario desde el 2026-09-09**: los
    // pendientes se listaban uno a uno y en el operativo real eran 161
    // renglones en cuatro columnas de texto micro. Gonzalo: «toda la parte de
    // abajo de aquí también». Lo que el contrato exige sigue igual —la prevista
    // y los elegibles del pendiente, y NUNCA una observada— sólo que del grupo;
    // los elegibles ahora son la suma, y la prevista va ponderada por ellos
    // (`pendientesPorFacultad.ts`), no promediada.
    // La fixture trae uno agendado y otro planificado, y el grupo los declara
    // POR SEPARADO: son dos remedios distintos —uno se espera, el otro se
    // agenda— y un total indistinto los borraría.
    expect(plano).toMatch(/2 cursos-horario \(\s*1 agendada\s*,\s*1 planificada\s*\)/);
    expect(plano).toMatch(/80 elegibles/);
    expect(plano).toMatch(/prevista 60[.,]0 %/);
    // Y sigue sin publicar una observada para algo que no se ha aplicado.
    expect(plano).not.toMatch(/va en .*%.*planificada/);
  });

  it("el umbral de la banda sale del payload, no de un «±25 puntos» tecleado (M4)", () => {
    const html = renderToStaticMarkup(
      <AulasSenalesPorAula bloque={bloque([
        aula("CH F", "sin_banda", { elegibles: 3, banda: null }),
      ])} />,
    );
    const plano = texto(html);
    expect(plano).not.toContain("±25");
    expect(plano).not.toContain("± 25");
    expect(plano).toContain("BANDA-DEL-MOTOR");
    // Los acentos graves con que el motor marca campos no llegan a pantalla.
    expect(plano).not.toContain("`");
  });

  it("la columna agregada se rotula «Prevista de su facultad» (M3)", () => {
    const html = renderToStaticMarkup(
      <AulasSenalesPorAula bloque={bloque([
        aula("CH C", "bajo", { tasa_observada: 0.4 }),
      ])} />,
    );
    const plano = texto(html);
    // Es la tasa de DISEÑO de la facultad; «vara» a secas era una palabra para
    // dos cosas al lado de un panel que habla en observadas.
    expect(plano).toContain("Prevista de su facultad");
    expect(plano).not.toContain("Vara de su facultad");
  });

  it("el descuadre se enseña con sus cuentas y no infla el encabezado", () => {
    const html = renderToStaticMarkup(
      <AulasSenalesPorAula bloque={bloque([
        aula("CH D", "descuadre", { efectivas: 55, tasa_observada: 1.375 }),
      ])} />,
    );
    const plano = texto(html);
    expect(plano.toLowerCase()).toContain("descuadr");
    // La inconsistencia se dice con los números que no cuadran, no con una tasa.
    expect(plano).toContain("55 efectivas de 40 elegibles");
    expect(plano).not.toContain("se salen del suyo");
  });

  it("el numerador de respaldo se declara en su fila, no se confunde con plataforma", () => {
    const html = renderToStaticMarkup(
      <AulasSenalesPorAula bloque={bloque([
        aula("CH P", "bajo", { numerador: "parte", tasa_observada: 0.3 }),
      ])} />,
    );
    expect(texto(html)).toContain("del parte");
  });

  it("lo conforme se agrega colapsado: es mayoría y no pide acción", () => {
    const html = renderToStaticMarkup(
      <AulasSenalesPorAula bloque={bloque([
        aula("CH A", "conforme"),
        aula("CH B", "conforme"),
        aula("CH C", "bajo", { tasa_observada: 0.4 }),
      ])} />,
    );
    expect(html).toContain("<details");
    expect(texto(html)).toContain("2 dentro de su margen");
  });

  it("con todo sin_previsto explica el hueco del diseño sin contar sobre cero", () => {
    const html = renderToStaticMarkup(
      <AulasSenalesPorAula bloque={bloque([
        aula("CH 1", "sin_previsto", { tasa_prevista: null, banda: null }),
        aula("CH 2", "sin_previsto", { tasa_prevista: null, banda: null }),
      ])} />,
    );
    const plano = texto(html);
    expect(plano).toContain("no publicó");
    // Un denominador de cero disfrazado de conteo es el vacío que diagnostica mal.
    expect(plano).not.toMatch(/\bde (los |las )?0\b/);
  });
});
