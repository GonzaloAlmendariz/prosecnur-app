import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { estratosConAjusteAula, estratosConAulaExtra, estratosConAulasFijadas, estratosConMinimosCertificados, estratosConNotaOperativa, estratosDelComponente, fijasPendientes } from "../certificacionAcciones";
import { presupuestoVisitas } from "../PresupuestoVisitasCard";
import type { CalcMuestraEstrato } from "../../../../../api/calcMuestra";

// La decisión «darle un aula más» debe estar disponible en la UI y quedar
// REGISTRADA (Gonzalo: «nada puede ser manual»). El helper fija
// aulas_base_fijas = actuales + 1 en el estrato de la facultad, y el flujo
// existente (recalcular → seleccionar) la aplica.

const estrato = (label: string, extra: Partial<CalcMuestraEstrato> = {}) =>
  ({ id: label, label, N: 100, N_a: 50, N_b: 50, sub_a_label: "F", sub_b_label: "M", promedio_conglomerado: 20, tau: 0.5, ...extra }) as CalcMuestraEstrato;

describe("estratosConAulaExtra", () => {
  const estratos = [estrato("PSICOLOGÍA"), estrato("DERECHO", { aulas_base_fijas: 18 })];

  it("fija actuales+1 en la facultad objetivo y no toca las demás", () => {
    const out = estratosConAulaExtra(estratos, "PSICOLOGÍA", 7);
    expect(out?.[0].aulas_base_fijas).toBe(8);
    expect(out?.[1].aulas_base_fijas).toBe(18);
    // Inmutable: el arreglo original queda intacto.
    expect(estratos[0].aulas_base_fijas).toBeUndefined();
  });

  it("encuentra la facultad aunque la etiqueta venga con otra grafía", () => {
    const out = estratosConAulaExtra(estratos, "psicologia", 7);
    expect(out?.[0].aulas_base_fijas).toBe(8);
  });

  it("sin blanco no parchea a medias: facultad ausente o datos rotos → null", () => {
    expect(estratosConAulaExtra(estratos, "GESTIÓN", 5)).toBeNull();
    expect(estratosConAulaExtra(estratos, "PSICOLOGÍA", Number.NaN)).toBeNull();
    expect(estratosConAulaExtra([], "PSICOLOGÍA", 7)).toBeNull();
  });
});

describe("cableado de la acción", () => {
  const card = readFileSync(join(__dirname, "..", "CertificacionFacultadCard.tsx"), "utf8");
  const desk = readFileSync(join(__dirname, "..", "..", "UniversidadDesk.tsx"), "utf8");

  it("la tarjeta ofrece +1 aula en filas comprometidas y el Desk la registra", () => {
    expect(card).toMatch(/filaComprometida\(f\)/);
    expect(card).toMatch(/onAgregarAula\(f\.facultad, f\.aulas_titulares\)/);
    // Los estratos ya NO se leen del componente normalizado: ése llega con el
    // marco del otro y escribir de vuelta borraba sus fijaciones.
    expect(desk).toMatch(/estratosConAulaExtra\(estratosPropiosDe\(compActivo\.id/);
    expect(desk).not.toMatch(/estratosCon\w+\(comp\w+\.marco\?\.estratos/);
    expect(desk).toMatch(/onComponente\(compActivo\.id, \{ marco: \{ estratos: nuevos \} \}\)/);
    expect(desk).toMatch(/onAgregarAula=\{onAgregarAulaFacultad\}/);
  });

  it("nada queda apagado con un guard constante", () => {
    expect(card).not.toMatch(/\{\s*false\s*&&/);
  });
});

describe("estratosConAjusteAula (el par ±1)", () => {
  const estratos = [
    { label: "DERECHO", aulas_base_fijas: undefined },
    { label: "PSICOLOGÍA", aulas_base_fijas: undefined },
  ] as never;

  it("baja fija actuales−1 y sube fija actuales+1, solo en la facultad tocada", () => {
    const menos = estratosConAjusteAula(estratos, "DERECHO", 18, -1);
    expect(menos?.[0].aulas_base_fijas).toBe(17);
    expect(menos?.[1].aulas_base_fijas).toBeUndefined();
    const mas = estratosConAjusteAula(estratos, "DERECHO", 18, 1);
    expect(mas?.[0].aulas_base_fijas).toBe(19);
  });

  it("no baja de 1: excluir una facultad del sorteo es otra decisión con otra puerta", () => {
    expect(estratosConAjusteAula(estratos, "DERECHO", 1, -1)).toBeNull();
  });

  it("la tarjeta ofrece el stepper con onAjustarAula y la leyenda explica el ×N", () => {
    const card = readFileSync(
      new URL("../CertificacionFacultadCard.tsx", import.meta.url),
      "utf8",
    );
    expect(card).toMatch(/onAjustarAula\(f\.facultad, f\.aulas_titulares, -1\)/);
    expect(card).toMatch(/onAjustarAula\(f\.facultad, f\.aulas_titulares, 1\)/);
    expect(card).toMatch(/cmv2-cert-leyenda/);
    expect(card).toMatch(/por cada alumno de cuota/);
  });
});

describe("fijasPendientes (el letrero del click-test)", () => {
  it("lista la fija que el resultado aun no refleja, con ambos numeros", () => {
    const pendientes = fijasPendientes(
      [{ label: "PSICOLOGÍA", aulas_base_fijas: 8 }, { label: "DERECHO" }] as never,
      [{ estrato: "PSICOLOGÍA", aulas_base: 7 }, { estrato: "DERECHO", aulas_base: 18 }],
    );
    expect(pendientes).toEqual([{ facultad: "PSICOLOGÍA", fijada: 8, calculada: 7 }]);
  });

  it("la fija ya aplicada (resultado coincide) NO es pendiente", () => {
    const pendientes = fijasPendientes(
      [{ label: "PSICOLOGÍA", aulas_base_fijas: 8 }] as never,
      [{ estrato: "PSICOLOGÍA", aulas_base: 8 }],
    );
    expect(pendientes).toEqual([]);
  });

  it("sin fijas o sin estratos devuelve vacio", () => {
    expect(fijasPendientes([{ label: "X" }] as never, [])).toEqual([]);
    expect(fijasPendientes(null, null)).toEqual([]);
  });
});

describe("presupuestoVisitas (opción B: el techo manda)", () => {
  const tit = (n: number, p: number) => Array.from({ length: n }, () => ({ p_aplicada_ref: p }));

  it("plan = titulares + activaciones esperadas, con estado contra el techo", () => {
    const p = presupuestoVisitas(200, tit(190, 0.935));
    // Semantica corregida (2026-08-20, pregunta de Gonzalo): las GESTIONES
    // (titulares + activaciones de cadena) son otra cuenta que la vara del
    // techo; el techo juzga VISITAS FISICAS (titulares + reintentos en aula,
    // 2/196 medido 2025). 190 titulares -> 2 reintentos -> 192 fisicas.
    expect(p?.gestiones).toBe(202);
    expect(p?.visitasFisicas).toBe(192);
    expect(p?.estado).toBe("dentro");
    // El estado juzga por fisicas: excedido/rozando contra el techo real.
    expect(presupuestoVisitas(191, tit(190, 0.935))?.estado).toBe("excedido");
    expect(presupuestoVisitas(195, tit(190, 0.935))?.estado).toBe("rozando");
    expect(presupuestoVisitas(240, tit(190, 0.935))?.estado).toBe("dentro");
  });

  it("sin techo declarado (0) o sin titulares no pinta presupuesto", () => {
    expect(presupuestoVisitas(0, tit(190, 0.9))).toBeNull();
    expect(presupuestoVisitas(200, [])).toBeNull();
  });

  it("sin calibración declara que no puede estimar, sin inventar activaciones", () => {
    const p = presupuestoVisitas(200, [{ otra: 1 }, { otra: 2 }] as never);
    expect(p?.activacionesEsperadas).toBeNull();
    expect(p?.gestiones).toBeNull();
  });
});

// El panel de certeza dice «esta facultad necesita 19 y el diseño pide 16» en
// la sección Cálculo, y el stepper ±1 vive en Aulas · Selección: el hallazgo
// aparece en un sitio y la acción esta en otro, y llevar 16 a 19 son tres
// clics. `certificacionAcciones` existe para volverlo «un clic donde aparece
// el hallazgo», que es lo que dice su propia cabecera.
describe("estratosConAulasFijadas", () => {
  const base = [estrato("DERECHO"), estrato("PSICOLOGÍA")];

  it("fija el numero de una facultad de un golpe, sin pasar por el delta", () => {
    const out = estratosConAulasFijadas(base, "DERECHO", 19);
    expect(out?.find((e) => e.label === "DERECHO")?.aulas_base_fijas).toBe(19);
    expect(out?.find((e) => e.label === "PSICOLOGÍA")?.aulas_base_fijas).toBeUndefined();
  });

  it("respeta el piso de 1: bajar a cero es excluir la facultad, y eso es otra puerta", () => {
    expect(estratosConAulasFijadas(base, "DERECHO", 0)).toBeNull();
    expect(estratosConAulasFijadas(base, "DERECHO", -3)).toBeNull();
  });

  it("empareja la facultad por su clave normalizada, con tildes y ñ", () => {
    expect(estratosConAulasFijadas(base, "psicologia", 6)?.find((e) => e.label === "PSICOLOGÍA")?.aulas_base_fijas).toBe(6);
  });

  it("devuelve null si la facultad no esta en el marco o no hay estratos", () => {
    expect(estratosConAulasFijadas(base, "GASTRONOMÍA", 4)).toBeNull();
    expect(estratosConAulasFijadas([], "DERECHO", 4)).toBeNull();
    expect(estratosConAulasFijadas(null, "DERECHO", 4)).toBeNull();
  });
});

describe("estratosDelComponente (el marco compartido se comía las fijaciones)", () => {
  // El caso real de HSVG2026: el componente de universidad NO tiene ninguna
  // fijación y el de facultad tiene quince, que son las que sostienen el
  // objetivo de 174 con el que ya se sorteó. `universityComponents` reparte el
  // marco del PRIMERO a los dos, así que la UI veía el de facultad con cero.
  const universidad = {
    id: "cmp-x",
    marco: { estratos: [{ label: "ARQUITECTURA Y URBANISMO" }, { label: "DERECHO" }] },
  };
  const facultad = {
    id: "cmp-x-fac",
    marco: {
      estratos: [
        { label: "ARQUITECTURA Y URBANISMO", aulas_base_fijas: 8 },
        { label: "DERECHO", aulas_base_fijas: 19 },
      ],
    },
  };
  const estudio = [universidad, facultad] as never;

  it("devuelve los estratos del componente pedido, no los del que se le pasa de respaldo", () => {
    const propios = estratosDelComponente(estudio, "cmp-x-fac", universidad.marco.estratos as never);
    expect(propios?.map((e) => (e as { aulas_base_fijas?: number }).aulas_base_fijas)).toEqual([8, 19]);
  });

  it("un ajuste sobre una facultad CONSERVA las fijaciones de las demás", () => {
    // El mutante que mata: con el respaldo (los estratos de universidad) el
    // resultado traía UNA sola fijación y DERECHO=19 desaparecía.
    const nuevos = estratosConAjusteAula(
      estratosDelComponente(estudio, "cmp-x-fac", universidad.marco.estratos as never),
      "ARQUITECTURA Y URBANISMO",
      8,
      1,
    );
    const fijas = (nuevos ?? []).filter((e) => Number((e as { aulas_base_fijas?: unknown }).aulas_base_fijas) > 0);
    expect(fijas).toHaveLength(2);
    expect(fijas.map((e) => `${e.label}=${(e as { aulas_base_fijas?: number }).aulas_base_fijas}`)).toEqual([
      "ARQUITECTURA Y URBANISMO=9",
      "DERECHO=19",
    ]);
  });

  it("cae al respaldo sólo cuando el componente todavía no tiene estratos propios", () => {
    expect(estratosDelComponente(estudio, "cmp-nuevo", universidad.marco.estratos as never))
      .toEqual(universidad.marco.estratos);
    expect(estratosDelComponente(estudio, "cmp-nuevo", null)).toBeNull();
    expect(estratosDelComponente(null, "cmp-x-fac", null)).toBeNull();
  });
});

describe("el origen del número de titulares", () => {
  // Gonzalo, 2026-08-27: «esa agregación se puede llamar agregación operativa,
  // ya que no sigue un criterio estadístico como tal». Sin declararlo, los tres
  // orígenes producen enteros idénticos: en HSVG2026 `max(fórmula, certeza)` da
  // 173 y el final es 174, y ese aula no se distinguía de las otras 173.
  const estratos = [{ label: "DERECHO", aulas_base_fijas: 18 }] as never;

  it("el stepper declara la agregación como operativa", () => {
    expect(estratosConAjusteAula(estratos, "DERECHO", 18, 1)?.[0])
      .toMatchObject({ aulas_base_fijas: 19, aulas_base_origen: "operativa" });
    expect(estratosConAulaExtra(estratos, "DERECHO", 18)?.[0])
      .toMatchObject({ aulas_base_fijas: 19, aulas_base_origen: "operativa" });
  });

  it("«Llevar a N» declara que el número lo pide la certificación", () => {
    expect(estratosConAulasFijadas(estratos, "DERECHO", 18)?.[0])
      .toMatchObject({ aulas_base_fijas: 18, aulas_base_origen: "certificacion" });
  });

  it("el motivo se escribe sin tocar el número", () => {
    const out = estratosConNotaOperativa(
      [{ label: "DERECHO", aulas_base_fijas: 19, aulas_base_origen: "operativa" }] as never,
      "DERECHO",
      "  va muy justa en la celda de mujeres  ",
    );
    expect(out?.[0]).toMatchObject({
      aulas_base_fijas: 19,
      aulas_base_origen: "operativa",
      aulas_base_nota: "va muy justa en la celda de mujeres",
    });
  });

  it("sin blanco no parchea a medias", () => {
    expect(estratosConNotaOperativa(estratos, "GESTIÓN", "x")).toBeNull();
    expect(estratosConNotaOperativa(null, "DERECHO", "x")).toBeNull();
  });
});

describe("estratosConMinimosCertificados", () => {
  // Las seis facultades cortas de HSVG 2026 al 95%, medidas el 2026-08-27, mas
  // las tres donde la certeza dice que sobran aulas.
  const base = [
    estrato("DERECHO"), estrato("ESTUDIOS GENERALES LETRAS"), estrato("CIENCIAS CONTABLES"),
    estrato("GESTIÓN Y ALTA DIRECCIÓN"), estrato("LETRAS Y CIENCIAS HUMANAS"), estrato("PSICOLOGÍA"),
    estrato("CIENCIAS E INGENIERIA"), estrato("ARTE Y DISEÑO"), estrato("ARQUITECTURA Y URBANISMO"),
  ];
  const minimos = [
    { label: "DERECHO", aulas: 18, brecha: 2 },
    { label: "ESTUDIOS GENERALES LETRAS", aulas: 20, brecha: 2 },
    { label: "CIENCIAS CONTABLES", aulas: 3, brecha: 1 },
    { label: "GESTIÓN Y ALTA DIRECCIÓN", aulas: 7, brecha: 1 },
    { label: "LETRAS Y CIENCIAS HUMANAS", aulas: 4, brecha: 1 },
    { label: "PSICOLOGÍA", aulas: 6, brecha: 1 },
    { label: "CIENCIAS E INGENIERIA", aulas: 34, brecha: -3 },
    { label: "ARTE Y DISEÑO", aulas: 13, brecha: -2 },
    { label: "ARQUITECTURA Y URBANISMO", aulas: 7, brecha: -1 },
  ];

  it("fija las seis que faltan y declara que las puso la certificacion", () => {
    const out = estratosConMinimosCertificados(base, minimos);
    expect(out).not.toBeNull();
    const fijadas = out!.filter((e) => Number(e.aulas_base_fijas) > 0);
    expect(fijadas.map((e) => e.label).sort()).toEqual([
      "CIENCIAS CONTABLES", "DERECHO", "ESTUDIOS GENERALES LETRAS",
      "GESTIÓN Y ALTA DIRECCIÓN", "LETRAS Y CIENCIAS HUMANAS", "PSICOLOGÍA",
    ]);
    expect(fijadas.every((e) => e.aulas_base_origen === "certificacion")).toBe(true);
    expect(out!.find((e) => e.label === "DERECHO")?.aulas_base_fijas).toBe(18);
  });

  it("no baja las tres donde la certeza dice que sobran", () => {
    const out = estratosConMinimosCertificados(base, minimos);
    for (const label of ["CIENCIAS E INGENIERIA", "ARTE Y DISEÑO", "ARQUITECTURA Y URBANISMO"]) {
      const fila = out!.find((e) => e.label === label);
      expect(fila?.aulas_base_fijas).toBeFalsy();
      expect(fila?.aulas_base_origen ?? "").toBe("");
    }
  });

  it("sin ninguna que subir no escribe nada", () => {
    expect(estratosConMinimosCertificados(base, minimos.filter((m) => m.brecha < 0))).toBeNull();
    expect(estratosConMinimosCertificados(base, [])).toBeNull();
    expect(estratosConMinimosCertificados([], minimos)).toBeNull();
  });

  it("una facultad que no esta en los estratos no inventa una fila", () => {
    const out = estratosConMinimosCertificados(
      [estrato("DERECHO")],
      [{ label: "DERECHO", aulas: 18, brecha: 2 }, { label: "NO EXISTE", aulas: 9, brecha: 4 }],
    );
    expect(out).toHaveLength(1);
    expect(out![0].aulas_base_fijas).toBe(18);
  });
});

// El caso que motivó `aulas_base_certificada`, medido en HSVG 2026 el
// 2026-08-27: Derecho tenía 18 por certificación —la fórmula pedía 16— y al
// subirlo a 19 con el stepper quedaba entero como `operativa`. El total seguía
// dando 174, pero la descomposición decía 6 aulas de certificación y 3
// operativas cuando eran 8 y 1: un campo solo puede nombrar UN dueño, y el
// estrato tenía dos decisiones encima.
describe("un estrato con dos decisiones encima no pierde la primera", () => {
  const certificado = () => [
    estrato("DERECHO", { aulas_base_fijas: 18, aulas_base_certificada: 18, aulas_base_origen: "certificacion" }),
  ];

  it("la certificación sella hasta dónde llegó", () => {
    const out = estratosConAulasFijadas([estrato("DERECHO")], "DERECHO", 18);
    expect(out?.[0].aulas_base_fijas).toBe(18);
    expect(out?.[0].aulas_base_certificada).toBe(18);
    expect(out?.[0].aulas_base_origen).toBe("certificacion");
  });

  it("aplicar los mínimos en bloque también lo sella", () => {
    const out = estratosConMinimosCertificados(
      [estrato("DERECHO"), estrato("PSICOLOGÍA")],
      [{ label: "DERECHO", aulas: 18, brecha: 2 }, { label: "PSICOLOGÍA", aulas: 6, brecha: 1 }],
    );
    expect(out?.find((e) => e.label === "DERECHO")?.aulas_base_certificada).toBe(18);
    expect(out?.find((e) => e.label === "PSICOLOGÍA")?.aulas_base_certificada).toBe(6);
  });

  it("subirlo por encima conserva lo certificado y sólo el margen es operativo", () => {
    const out = estratosConAjusteAula(certificado(), "DERECHO", 18, 1);
    expect(out?.[0].aulas_base_fijas).toBe(19);
    // Sin esto, la descomposición atribuye las 3 aulas a la agregación
    // operativa cuando 2 las pidió la certificación.
    expect(out?.[0].aulas_base_certificada).toBe(18);
    expect(out?.[0].aulas_base_origen).toBe("operativa");
  });

  it("volver exactamente al número certificado devuelve el origen a la certificación", () => {
    const subido = estratosConAjusteAula(certificado(), "DERECHO", 18, 1)!;
    const devuelto = estratosConAjusteAula(subido, "DERECHO", 19, -1);
    expect(devuelto?.[0].aulas_base_fijas).toBe(18);
    expect(devuelto?.[0].aulas_base_certificada).toBe(18);
    // Ya no queda decisión del analista encima: el dueño vuelve a ser la
    // certificación, no una «operativa» que no agregó nada.
    expect(devuelto?.[0].aulas_base_origen).toBe("certificacion");
  });

  it("sin certificación previa, el ajuste sigue siendo operativo a secas", () => {
    const out = estratosConAjusteAula([estrato("PSICOLOGÍA")], "PSICOLOGÍA", 5, 1);
    expect(out?.[0].aulas_base_fijas).toBe(6);
    expect(out?.[0].aulas_base_certificada).toBe(0);
    expect(out?.[0].aulas_base_origen).toBe("operativa");
  });
});
