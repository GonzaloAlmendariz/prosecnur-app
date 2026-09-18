import { describe, expect, it } from "vitest";

import { deudaPorFacultad, repartoDeDeudas } from "./deudaPorFacultad";
import type { MonitoreoAulasEfectividadSeguimiento } from "../../../../api/monitoreo";

/**
 * «No siempre es que le esté yendo mal a nivel general, sino le puede estar
 * yendo mal en un sexo en particular» (Gonzalo, 2026-09-10). Ése es el matiz
 * que la cifra global esconde, y el que este helper existe para publicar.
 */
const bloque = {
  total: {},
  facultades: [
    { facultad: "ARTES ESCÉNICAS", faculty_key: "artes", aulas_aplicadas: 3, tau_previsto: 0.74, tau_observado: 0.581 },
    { facultad: "CIENCIAS SOCIALES", faculty_key: "sociales", aulas_aplicadas: 5, tau_previsto: 0.548, tau_observado: 0.496 },
    { facultad: "DERECHO", faculty_key: "derecho", aulas_aplicadas: 6, tau_previsto: 0.568, tau_observado: 0.581 },
    { facultad: "EDUCACIÓN", faculty_key: "educacion", aulas_aplicadas: 0, tau_previsto: 0.623, tau_observado: null },
  ],
} as unknown as MonitoreoAulasEfectividadSeguimiento;

const porSexo = [
  { faculty_key: "artes", sexo: "F", diferencia: -4 },
  { faculty_key: "artes", sexo: "M", diferencia: -6 },
  { faculty_key: "sociales", sexo: "F", diferencia: -7 },
  { faculty_key: "sociales", sexo: "M", diferencia: 0 },
  { faculty_key: "derecho", sexo: "F", diferencia: 1 },
  { faculty_key: "derecho", sexo: "M", diferencia: 2 },
];

describe("cómo le va a cada facultad", () => {
  it("distingue deber en los dos sexos de deber en uno solo", () => {
    const filas = deudaPorFacultad(bloque, porSexo);
    const por = Object.fromEntries(filas.map((f) => [f.clave, f]));
    expect(por.artes.veredicto).toBe("debe_en_los_dos");
    // El caso que la cifra global esconde: −7 en total, y toda de un lado.
    expect(por.sociales.veredicto).toBe("debe_mujeres");
    expect(por.derecho.veredicto).toBe("por_encima");
  });

  it("la que no tiene campo no se cuenta como que va bien", () => {
    const por = Object.fromEntries(deudaPorFacultad(bloque, porSexo).map((f) => [f.clave, f]));
    expect(por.educacion.veredicto).toBe("sin_campo");
    expect(por.educacion.frase).toContain("de ésta no se sabe");
  });

  it("ordena por lo que más se debe, y deja sin campo al final", () => {
    expect(deudaPorFacultad(bloque, porSexo).map((f) => f.clave))
      .toEqual(["artes", "sociales", "derecho", "educacion"]);
  });

  it("la frase nombra el sexo que falta, no sólo el total", () => {
    const sociales = deudaPorFacultad(bloque, porSexo).find((f) => f.clave === "sociales")!;
    expect(sociales.frase).toContain("en lo previsto en hombres");
    expect(sociales.frase).toContain("7 mujeres");
  });

  it("sin celdas por sexo no inventa un reparto", () => {
    const filas = deudaPorFacultad(bloque, []);
    expect(filas.every((f) => f.mujeres === 0 && f.hombres === 0)).toBe(true);
  });

  it("el reparto cuenta aparte las que deben de un solo sexo", () => {
    const r = repartoDeDeudas(deudaPorFacultad(bloque, porSexo));
    expect(r.total).toBe(4);
    expect(r.conCampo).toBe(3);
    expect(r.deben).toBe(2);
    expect(r.deUnSoloSexo).toBe(1);
    expect(r.sinCampo).toBe(1);
  });

  it("sin bloque devuelve una lista vacía", () => {
    expect(deudaPorFacultad(null, porSexo)).toEqual([]);
  });
});

/**
 * **Las frases que sólo dicen algo con más de un grupo.**
 *
 * Visto en pantalla el 2026-09-18 sobre CCSS, que tiene UNA facultad: el reparto
 * decía «1 facultades» —plural cableado— y debajo «ninguna se compara con la
 * media», que sin media no enuncia nada. Dos veces mal en la misma línea, con la
 * cifra correcta. La regla de que la deuda no se compensa entre facultades es
 * real (ADR 0079) y se queda donde vale; lo que no vale es decirla donde no hay
 * entre quiénes.
 *
 * Se prueba por RENDER y no sobre el helper: el defecto estaba en la copia, y un
 * test del helper lo habría dejado pasar.
 */
describe("las frases de comparación se callan con un solo grupo", () => {
  it("con una sola facultad no promete un reparto que no existe", async () => {
    const { AulasComoVaCadaFacultad } = await import("./AulasComoVaCadaFacultad");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const bloque = {
      total: {},
      facultades: [{
        facultad: "CIENCIAS SOCIALES", faculty_key: "ciencias sociales",
        aulas_aplicadas: 0, tau_observado: null,
      }],
    } as never;
    const html = renderToStaticMarkup(
      <AulasComoVaCadaFacultad bloque={bloque} porSexo={[]} />,
    );
    expect(html).toContain("El estudio tiene una sola facultad");
    expect(html).not.toContain("no se compensa entre facultades");
  });

  it("con varias, la regla del ADR 0079 sigue dicha", async () => {
    const { AulasComoVaCadaFacultad } = await import("./AulasComoVaCadaFacultad");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const bloque = {
      total: {},
      facultades: [
        { facultad: "DERECHO", faculty_key: "derecho", aulas_aplicadas: 3, tau_observado: 0.5 },
        { facultad: "LETRAS", faculty_key: "letras", aulas_aplicadas: 2, tau_observado: 0.4 },
      ],
    } as never;
    const html = renderToStaticMarkup(
      <AulasComoVaCadaFacultad bloque={bloque} porSexo={[]} />,
    );
    expect(html).toContain("no se compensa entre facultades");
  });
});
