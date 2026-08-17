/**
 * Las dos tarjetas comparativas que pidió Gonzalo: «hay que separar criterios
 * generales y luego el card de cada facultad con sus criterios específicos y
 * todas sus cuentas y compararlos con el 2025, sus cuentas y sus métodos».
 *
 * Y el comparativo es «no sólo de números sino de método»: por eso la tarjeta
 * general dice, decisión a decisión, si coincide con el estudio anterior.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  normalizeCalcMuestraReferenciaCriterios,
  type CalcMuestraAulasEstrato,
} from "../../../../../api/calcMuestra";
import { CriteriosGeneralesCard } from "../CriteriosGeneralesCard";
import { FichaPorFacultadCard } from "../FichaPorFacultadCard";
import {
  claveFicha,
  claveMotor,
  criteriosPropiosDeFacultad,
  fichaDeFacultad,
} from "../fichaFacultadModel";

/** Cifras reales del libro de referencia de 2025. */
const REF_CRUDO = {
  schema: "calc_muestra_referencia_criterios_v1",
  periodo: "2025-2",
  estudio: "HSVBG2025_referencia_para_motor.xlsx",
  general: {
    muestra: "2500", ratio_sobremuestra: "1.5", aulas_marco: "1097",
    aulas_dimensionadas: "170", metodo_seleccion: "Sistemático sobre el marco",
    tasa_respuesta_asumida: "0.7038",
  },
  por_facultad: [
    {
      faculty_key: "letras_y_ciencias_humanas", facultad: "LETRAS Y CIENCIAS HUMANAS",
      poblacion: 225, cuota: 25, aulas_sorteadas: 9, aulas_titulares: 4,
      alumnos_por_ch: 12.5,
    },
  ],
};

const FILA = {
  estrato: "LETRAS Y CIENCIAS HUMANAS", N: 225, cuota: 26, avg_conglomerado: 16,
  tau: 0.53, aulas_base: 4, aulas_reemplazo: 0, aulas_total: 4, tipo_aula: "G1",
  precision_e: null,
  margen: {
    aulas_disponibles: 12, aulas_requeridas: 4, aulas_sobrantes: 8,
    reservas_sostenibles: 2, reservas_pedidas: 11, estado: "reservas_cortas",
    aviso: "LETRAS Y CIENCIAS HUMANAS sostiene 2 reservas por titular con 12 aulas para 4 titulares, por debajo de las 11 que pide el diseño.",
  },
} as unknown as CalcMuestraAulasEstrato;

describe("normalizador de la referencia histórica de criterios", () => {
  it("conserva el método general y las cuentas por facultad", () => {
    const r = normalizeCalcMuestraReferenciaCriterios(REF_CRUDO);
    expect(r?.periodo).toBe("2025-2");
    expect(r?.general.muestra).toBe("2500");
    expect(r?.por_facultad[0].cuota).toBe(25);
  });

  it("una fila sin facultad se descarta y sin filas no hay bloque", () => {
    expect(normalizeCalcMuestraReferenciaCriterios({ por_facultad: [{ cuota: 10 }] })).toBeNull();
    expect(normalizeCalcMuestraReferenciaCriterios(null)).toBeNull();
  });
});

describe("tarjeta de criterios generales", () => {
  const FILAS = [
    { concepto: "Muestra de diseño", hoy: "2500", claveHistorica: "muestra" },
    { concepto: "Método de selección", hoy: "cube balanceado", claveHistorica: "metodo_seleccion" },
    { concepto: "Aulas a visitar", hoy: "226", claveHistorica: "aulas_dimensionadas" },
  ];

  it("dice decisión a decisión si coincide con el estudio anterior", () => {
    const html = renderToStaticMarkup(
      <CriteriosGeneralesCard
        filas={FILAS}
        referencia={normalizeCalcMuestraReferenciaCriterios(REF_CRUDO)}
      />,
    );
    // La muestra coincide; el método y las aulas no.
    expect(html).toContain('data-igual="true"');
    expect(html).toContain('data-igual="false"');
    expect(html).toContain("<strong>2</strong> de 3 decisiones cambiaron");
    expect(html).toContain("2025-2");
  });

  it("sin histórico lo dice en vez de dejar la columna en blanco", () => {
    // Un hueco se lee como «igual».
    const html = renderToStaticMarkup(
      <CriteriosGeneralesCard filas={FILAS} referencia={null} />,
    );
    expect(html).toContain("Sin histórico cargado");
    expect(html).toContain("sin referencia");
    expect(html).not.toContain('data-igual="true"');
  });
});

describe("ficha por facultad", () => {
  const ficha = (ref: unknown) =>
    fichaDeFacultad(FILA, 149, 12, 16, normalizeCalcMuestraReferenciaCriterios(ref));

  it("arma los seis pasos con su columna del estudio anterior", () => {
    const f = ficha(REF_CRUDO);
    expect(f.pasos).toHaveLength(6);
    expect(f.pasos[0]).toMatchObject({ n: 1, hoy: 225, antes: 225 });
    expect(f.pasos[1]).toMatchObject({ n: 2, hoy: 26, antes: 25 });
    expect(f.pasos[2]).toMatchObject({ n: 3, hoy: 12, antes: 9 });
    expect(f.pasos[4]).toMatchObject({ n: 5, hoy: 4, antes: 4 });
    expect(f.reservasSostenibles).toBe(2);
    expect(f.reservasPedidas).toBe(11);
  });

  it("sin histórico la columna anterior es null, no 0", () => {
    // Un 0 se leería como «el estudio anterior no visitó ninguna».
    const f = ficha(null);
    expect(f.pasos[1].antes).toBeNull();
    expect(f.pasos[4].antes).toBeNull();
  });

  it("empareja la facultad aunque cambien acentos y puntuación", () => {
    expect(claveFicha("GASTRONOMÍA, HOTELERÍA Y TURISMO")).toBe(
      claveFicha("GASTRONOMIA HOTELERIA Y TURISMO"),
    );
    // CONTROL: dos facultades distintas NO se funden.
    expect(claveFicha("ESTUDIOS GENERALES LETRAS")).not.toBe(
      claveFicha("ESTUDIOS GENERALES CIENCIAS"),
    );
  });

  it("la tarjeta resume si le alcanzan las aulas antes de abrirla", () => {
    const html = renderToStaticMarkup(
      <FichaPorFacultadCard fichas={[ficha(REF_CRUDO)]} periodo="2025-2" />,
    );
    expect(html).toContain("necesita 4");
    expect(html).toContain("tiene 12");
    expect(html).toContain("2 reservas por titular de 11");
    expect(html).toContain('data-alcanza="true"');
  });

  it("marca la facultad a la que NO le alcanzan las aulas", () => {
    const corta = fichaDeFacultad(
      { ...FILA, estrato: "ESTUDIOS GENERALES LETRAS", cuota: 389,
        margen: { ...(FILA.margen ?? {}), aulas_requeridas: 49, aulas_disponibles: 12,
                  aulas_sobrantes: 0, reservas_sostenibles: 0 } } as unknown as CalcMuestraAulasEstrato,
      482, 12, 15, null,
    );
    const html = renderToStaticMarkup(<FichaPorFacultadCard fichas={[corta]} />);
    expect(html).toContain('data-alcanza="false"');
    expect(html).toContain("necesita 49");
    expect(html).toContain("tiene 12");
  });

  it("sin fichas no dibuja nada", () => {
    expect(renderToStaticMarkup(<FichaPorFacultadCard fichas={[]} />)).toBe("");
  });
});

/**
 * Montaje, por contrato sobre la fuente.
 *
 * El mutante del montaje sobrevivió TRES veces hoy: con las tarjetas
 * desmontadas, más de 1.400 tests seguían en verde. Aquí no se puede renderizar
 * `UniversidadDesk` —pide una docena de props y un modelo completo—, así que se
 * comprueba el cableado sobre el archivo, que es el patrón que el repo ya usa
 * para las rutas (`auditReadyRoutes.contract.test.ts`).
 *
 * Es más débil que renderizar, pero mata al mutante: si alguien quita el
 * montaje, este test cae.
 */
describe("contrato: las dos tarjetas están cableadas en el desk", () => {
  const fuente = readFileSync(
    new URL("../../UniversidadDesk.tsx", import.meta.url),
    "utf8",
  );

  it("la tarjeta de criterios generales se importa y se pinta", () => {
    expect(fuente).toContain('from "./criterios/CriteriosGeneralesCard"');
    expect(fuente).toMatch(/<CriteriosGeneralesCard[\s\S]*?referencia=\{referenciaCriterios\}/);
  });

  it("la ficha por facultad se importa y se pinta", () => {
    expect(fuente).toContain('from "./criterios/FichaPorFacultadCard"');
    expect(fuente).toMatch(/<FichaPorFacultadCard[\s\S]*?fichas=\{fichasFacultad\}/);
  });

  it("la referencia se lee del bloque `aulas` del payload", () => {
    // Vive dentro de `aulas` y no al lado de `referencia_asistencia` porque
    // `CalcMuestraPage.tsx` está congelada y no debe crecer para pasar una prop.
    expect(fuente).toContain("aulasState?.referencia_criterios");
  });
});

/**
 * Los criterios que rigen SÓLO en una facultad.
 *
 * Gonzalo: «los criterios no son generales, son por facultad». Dos cosas se
 * declaran así hoy: el mínimo de elegibles propio y las excepciones de tipo de
 * sesión —«en arquitectura y arte y diseño el taller tiene muchas más clases con
 * muchos más alumnos»—. Sin verlas, la ficha muestra cuentas sin decir de qué
 * reglas salen.
 */
describe("criterios propios de una facultad", () => {
  const SUITE = {
    minEligible: { threshold: 15, byFaculty: { arte_y_diseno: 10 } },
    byVariable: {
      session_type: {
        scope: "aula", categories: ["teorico"],
        exceptions: {
          arte_y_diseno: { categories: ["taller"], op: "add" },
          artes_escenicas: { categories: ["taller"], op: "replace" },
        },
      },
    },
  };

  it("lee el mínimo propio y dice cuál es el general", () => {
    const c = criteriosPropiosDeFacultad("ARTE Y DISEÑO", SUITE, 15);
    const min = c.find((x) => x.clase === "minimo");
    expect(min?.etiqueta).toBe("Mínimo propio: 10 elegibles");
    expect(min?.detalle).toBe("el general es 15");
  });

  it("distingue una excepción que SUMA de una que SUSTITUYE", () => {
    const suma = criteriosPropiosDeFacultad("ARTE Y DISEÑO", SUITE, 15)
      .find((x) => x.clase === "excepcion");
    expect(suma?.etiqueta).toBe("session_type: además taller");
    expect(suma?.detalle).toContain("se suman");

    const sustituye = criteriosPropiosDeFacultad("ARTES ESCÉNICAS", SUITE, 15)
      .find((x) => x.clase === "excepcion");
    expect(sustituye?.etiqueta).toBe("session_type: sólo taller");
    expect(sustituye?.detalle).toContain("sustituye");
  });

  it("CONTROL: una facultad sin reglas propias no inventa ninguna", () => {
    expect(criteriosPropiosDeFacultad("DERECHO", SUITE, 15)).toHaveLength(0);
    expect(criteriosPropiosDeFacultad("ARTE Y DISEÑO", null, 15)).toHaveLength(0);
  });

  it("la clave usa el formato del MOTOR, con la ñ a n", () => {
    // Con otra normalización los criterios propios quedarían invisibles sin que
    // nada fallara.
    expect(claveMotor("ARTE Y DISEÑO")).toBe("arte_y_diseno");
    expect(claveMotor("GASTRONOMÍA, HOTELERÍA Y TURISMO")).toBe(
      "gastronomia_hoteleria_y_turismo",
    );
    // El apóstrofe se BORRA, no se vuelve guion bajo: el motor hace lo mismo en
    // una línea aparte, y `d_onofrio` no indexaría nada.
    expect(claveMotor("D'ONOFRIO")).toBe("donofrio");
    // CONTROL: dos facultades parecidas no colapsan.
    expect(claveMotor("ESTUDIOS GENERALES LETRAS")).not.toBe(
      claveMotor("ESTUDIOS GENERALES CIENCIAS"),
    );
  });

  it("la ficha los pinta, y dice cuándo no hay", () => {
    const con = fichaDeFacultad(
      { ...FILA, estrato: "ARTE Y DISEÑO" } as unknown as CalcMuestraAulasEstrato,
      320, 55, 17, null, SUITE, 15,
    );
    const html = renderToStaticMarkup(<FichaPorFacultadCard fichas={[con]} />);
    expect(html).toContain("Criterios propios:");
    expect(html).toContain("Mínimo propio: 10 elegibles");
    expect(html).toContain("session_type: además taller");

    // CONTROL: una facultad sin reglas propias no anuncia ninguna.
    const sin = fichaDeFacultad(FILA, 149, 12, 16, null, SUITE, 15);
    const htmlSin = renderToStaticMarkup(<FichaPorFacultadCard fichas={[sin]} />);
    expect(htmlSin).not.toContain("Criterios propios:");
  });
});
