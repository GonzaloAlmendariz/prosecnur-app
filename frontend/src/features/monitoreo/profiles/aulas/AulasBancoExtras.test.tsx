import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

import { AulasBancoExtras } from "./AulasBancoExtras";

/**
 * **El banco se abre por el eje de cuotas, no por una columna fija.**
 *
 * El panel existe para contestar «me falta gente de esta celda, ¿qué aula extra
 * me la aporta?». Abriéndolo siempre por facultad, un estudio cuya cuota es por
 * nivel lo ve colapsado: un solo grupo, una cabecera que promete un desglose que
 * no hace, y la frase del vacío nombrando una cuota que ese estudio no tiene.
 *
 * Gonzalo, 2026-09-18: «una particularidad es eso; la app debe ser útil para
 * cualquier estudio, y por eso la importancia de que sea generalista y de
 * configuración».
 *
 * El reagrupamiento se hace AQUÍ y no en el motor: `banco_extras.por_facultad`
 * lo cruzan contra la facultad de un aula la ficha (`dondeSeSaca`) y la alerta
 * de anticipación, y moverlo en el motor les cambiaría una clave de la junta y
 * no la otra.
 */
const NIVEL = {
  clave: "nivel", etiqueta: "Nivel", etiqueta_plural: "Niveles",
  etiqueta_sin: "Sin nivel", columna: "level", atribucion: "persona",
};
const FACULTAD = {
  clave: "facultad", etiqueta: "Facultad", etiqueta_plural: "Facultades",
  etiqueta_sin: "Sin facultad", columna: "faculty", atribucion: "aula",
};

const extra = (operational_code: string, faculty: string, level: string, mujeres: number, hombres: number) => ({
  operational_code, course_name: `Curso ${operational_code}`, faculty, stratum: faculty,
  level, teacher: "—", disponible: true,
  eligible_n: mujeres + hombres, mujeres, hombres,
});

const banco = {
  total: 4, disponibles: 4, elegibles: 100, mujeres: 55, hombres: 45,
  // Lo que publica el motor: agrupado por facultad, con su cero declarado.
  por_facultad: [
    { faculty: "CIENCIAS SOCIALES", extras: 4, disponibles: 4, elegibles: 100, mujeres: 55, hombres: 45 },
    { faculty: "DERECHO", extras: 0, disponibles: 0, elegibles: 0, mujeres: 0, hombres: 0 },
  ],
  extras: [
    extra("EXTRA 1", "CIENCIAS SOCIALES", "6", 20, 10),
    extra("EXTRA 2", "CIENCIAS SOCIALES", "7", 15, 15),
    extra("EXTRA 3", "CIENCIAS SOCIALES", "7", 10, 10),
    extra("EXTRA 4", "CIENCIAS SOCIALES", "9", 10, 10),
  ],
};

const pinta = (eje?: unknown) =>
  renderToStaticMarkup(<AulasBancoExtras banco={banco} eje={eje as never} />);

describe("AulasBancoExtras: el banco se abre por el eje declarado", () => {
  it("sin eje declarado no se mueve un byte: HSVG sigue viendo facultades", () => {
    // Identidad, no plausibilidad: el eje por defecto ES facultad, así que
    // declararlo y no declararlo tienen que dar el mismo markup.
    expect(pinta(undefined)).toBe(pinta(FACULTAD));
    const html = pinta(undefined);
    expect(html).toContain("<th>Facultad</th>");
    // Las que TIENEN extras: 1 de las 2 listadas.
    expect(html).toContain("en <strong>1</strong> facultad");
    expect(html).toContain("CIENCIAS SOCIALES");
    // El cero declarado del motor sigue a la vista.
    expect(html).toContain("DERECHO");
  });

  it("con el eje en nivel abre por nivel, y la cabecera lo dice con su palabra", () => {
    const html = pinta(NIVEL);
    expect(html).toContain("<th>Nivel</th>");
    // Tres niveles, no «1 facultad»: es el desglose que el panel promete.
    expect(html).toContain("en <strong>3</strong> niveles");
    // Y los grupos son los niveles, ordenados por cuántos extras tienen.
    expect(html.indexOf(">7<")).toBeGreaterThan(-1);
    expect(html).not.toContain("<th>Facultad</th>");
  });

  it("reagrupando no se pierde «cuántas quedan», que es con lo que se decide llamar", () => {
    // `disponibles` es lo que QUEDA, y un grupo sin ese dato se lee como «no se
    // sabe». Al rehacer los grupos se recuenta desde las filas, no se descarta.
    const html = pinta(NIVEL);
    // El nivel 7 tiene dos extras y las dos están dormidas.
    expect(html).toMatch(/>7<[\s\S]{0,200}>2</);
  });

  it("el vacío nombra la cuota del estudio, no una fija", () => {
    const sin = { ...banco, total: 0, extras: [], por_facultad: [] };
    const html = renderToStaticMarkup(<AulasBancoExtras banco={sin} eje={NIVEL as never} />);
    expect(html).toContain("la cuota por nivel");
    expect(html).not.toContain("la cuota por facultad");
  });
});
