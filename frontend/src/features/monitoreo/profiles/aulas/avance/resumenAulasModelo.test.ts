import { describe, expect, it } from "vitest";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import {
  construirResumenAulas,
  fechaCorta,
  MARCA_RESUMEN_AULAS,
  readinessDelResumen,
  techoDelEje,
} from "./resumenAulasModelo";

type Fila = {
  facultad: string;
  cuota: number | null;
  validas: number;
  estado?: string;
};

function fila({ facultad, cuota, validas, estado = "ok" }: Fila) {
  const brecha = cuota == null ? null : Math.max(0, cuota - validas);
  return {
    facultad,
    faculty_key: facultad.toLowerCase(),
    cuota,
    tau_prevista: null,
    respuestas_validas: validas,
    brecha,
    avance_pct: cuota ? Math.round((1000 * validas) / cuota) / 10 : null,
    fuente_fila: "diseno",
    estado,
    fuera_universo: 0,
    respuestas_sin_sexo: 0,
  };
}

/** HSVG 2026: eje facultad, muestra 2,500, meta operativa 3,750, 3,327 cuentan. */
function hsvg(): MonitoreoAulasDashboard {
  return {
    avance_cuota: {
      schema: "monitoreo_aulas_avance_cuota_v1",
      fuente: "design_targets",
      vigencia: "vigente",
      motivo: "",
      eje: { clave: "facultad", columna: "facultad", etiqueta: "Facultad", etiqueta_plural: "Facultades", etiqueta_sin: "Sin facultad", atribucion: "aula", fuente_valor: "plan", motivo: "" },
      tasa_esperada: null,
      tasa_fuente: "tau_disenio",
      meta_diseno: 2500,
      sobremuestra: 1250,
      meta_operativa: 3750,
      total: {
        cuota: 2500, respuestas_validas: 3327, brecha: 0, avance_pct: 133.1,
        fuera_universo: 0, huerfanas: 0, sin_eje: 0, duplicadas: 0, sin_celda: 0,
        invariante: {
          ok: true, suma: 3327, total: 3327, solapadas: 0,
          partes: { en_celdas: 3327, duplicadas: 0, sin_eje: 0, fuera_universo: 0, huerfanas: 0, sin_celda: 0 },
        },
      },
      facultades: [
        fila({ facultad: "Educación", cuota: 24, validas: 56 }),
        fila({ facultad: "ESTUDIOS GENERALES CIENCIAS", cuota: 403, validas: 443 }),
        fila({ facultad: "Derecho", cuota: 363, validas: 445 }),
      ],
    },
    ritmo_diario: {
      dias: [
        { fecha: "2026-09-07", validas: 200, acumulado: 200 },
        { fecha: "2026-09-08", validas: 466, acumulado: 666 },
        { fecha: "2026-10-01", validas: 2661, acumulado: 3327 },
      ],
      dias_con_campo: 21,
      mejor_dia: { fecha: "2026-09-09", validas: 466 },
      media_diaria: 158,
      meta: 2500,
    },
  } as unknown as MonitoreoAulasDashboard;
}

/** CCSS Perfil 2026: eje nivel, sin sobremuestra, falta 5 en el nivel 9. */
function ccss(): MonitoreoAulasDashboard {
  return {
    avance_cuota: {
      schema: "monitoreo_aulas_avance_cuota_v1",
      fuente: "design_targets",
      vigencia: "vigente",
      motivo: "",
      eje: { clave: "nivel", columna: "nivel", etiqueta: "Nivel", etiqueta_plural: "Niveles", etiqueta_sin: "Sin nivel", atribucion: "persona", fuente_valor: "padron", motivo: "" },
      tasa_esperada: null,
      tasa_fuente: "",
      meta_operativa: null,
      total: {
        cuota: 400, respuestas_validas: 465, brecha: 5, avance_pct: 116.2,
        fuera_universo: 0, huerfanas: 2, sin_eje: 22, duplicadas: 15, sin_celda: 140,
        invariante: { ok: true, suma: 644, total: 644, solapadas: 0 },
      },
      facultades: [
        fila({ facultad: "8", cuota: 97, validas: 107 }),
        fila({ facultad: "5", cuota: null, validas: 140, estado: "fuera_del_diseno" }),
        fila({ facultad: "9", cuota: 62, validas: 57 }),
      ],
    },
  } as unknown as MonitoreoAulasDashboard;
}

describe("construirResumenAulas", () => {
  it("la cifra protagonista de HSVG: 3,327 de 2,500, muestra cumplida y la meta operativa", () => {
    const m = construirResumenAulas(hsvg());
    expect(m.estado).toBe("listo");
    expect(m.protagonista.cuentan).toBe(3327);
    expect(m.protagonista.muestra).toBe(2500);
    expect(m.protagonista.avanceTexto).toBe("133 %");
    expect(m.protagonista.proporcion).toBe(1);
    expect(m.protagonista.chip).toEqual({ tono: "ok", texto: "Muestra cumplida" });
    expect(m.protagonista.secundarios).toEqual([
      { rotulo: "Meta operativa de 3,750", valor: "88.7 %" },
      { rotulo: "Faltan para cumplirla", valor: "423" },
    ]);
  });

  it("CCSS: la falta de UNA celda se nombra con su nivel aunque el total pase de 100 %", () => {
    const m = construirResumenAulas(ccss());
    expect(m.protagonista.chip).toEqual({ tono: "aviso", texto: "Faltan 5 en el nivel 9" });
    // Sin sobremuestra declarada no se inventa un techo.
    expect(m.protagonista.secundarios.map((s) => [s.rotulo, s.valor])).toEqual([
      ["Efectivas del estudio", "644"],
      ["Sobremuestra", "Sin declarar"],
    ]);
  });

  it("las seis partes del invariante, con las palabras del eje", () => {
    const m = construirResumenAulas(ccss());
    expect(m.invariante.total).toBe(644);
    expect(m.invariante.partes.map((p) => [p.rotulo, p.valor])).toEqual([
      ["Efectivas en celdas de la cuota", 465],
      ["Respondieron dos veces", 15],
      ["Sin nivel en el padrón", 22],
      ["Fuera del universo", 0],
      ["Sin curso-horario del plan", 2],
      ["En niveles sin meta", 140],
    ]);
    expect(m.invariante.descuadre).toBeNull();
  });

  it("una parte que no viajó se dice «—», no 0", () => {
    const d = ccss();
    const total = d.avance_cuota!.total as unknown as Record<string, unknown>;
    delete total.duplicadas;
    delete total.invariante;
    const m = construirResumenAulas(d);
    expect(m.invariante.partes.find((p) => p.clave === "duplicadas")?.valor).toBeNull();
    // Sin el total del motor ni todas las partes, el total tampoco se inventa.
    expect(m.invariante.total).toBeNull();
  });

  it("las partes del motor mandan sobre los campos hermanos", () => {
    const m = construirResumenAulas(hsvg());
    expect(m.invariante.partes[0]).toMatchObject({ rotulo: "Efectivas en celdas de la cuota", valor: 3327, principal: true });
    expect(m.invariante.partes[2].rotulo).toBe("Sin facultad");
  });

  it("dice el descuadre cuando las partes no suman", () => {
    const d = hsvg();
    d.avance_cuota!.total.invariante = { ok: false, suma: 3320, total: 3327, solapadas: 0 };
    expect(construirResumenAulas(d).invariante.descuadre).toBe("Las partes suman 3,320 y las efectivas son 3,327");
  });

  it("las tarjetas van de menor a mayor avance y las de fuera del diseño al final", () => {
    const m = construirResumenAulas(ccss());
    expect(m.grupos.titulo).toBe("Por nivel");
    expect(m.grupos.tarjetas.map((t) => [t.nombre, t.avanceTexto, t.lectura, t.tono])).toEqual([
      ["Nivel 9", "91.9 %", "57 de 62, faltan 5", "aviso"],
      ["Nivel 8", "110.3 %", "107 de 97", "ok"],
      ["Nivel 5", "—", "140 efectivas fuera del diseño", "neutro"],
    ]);
    // El foco lleva el valor del motor, no el rótulo.
    expect(m.grupos.tarjetas[0].valor).toBe("9");
  });

  it("los nombres de facultad en mayúsculas se normalizan", () => {
    const m = construirResumenAulas(hsvg());
    expect(m.grupos.titulo).toBe("Por facultad");
    expect(m.grupos.tarjetas.map((t) => t.nombre)).toEqual(["Estudios Generales Ciencias", "Derecho", "Educación"]);
    expect(m.grupos.tarjetas.every((t) => t.relleno <= 100)).toBe(true);
  });

  it("la serie diaria: resumen, metas en el eje y techo redondo", () => {
    const m = construirResumenAulas(hsvg());
    expect(m.ritmo.tipo).toBe("serie");
    if (m.ritmo.tipo !== "serie") return;
    expect(m.ritmo.resumen).toBe("21 días con campo; el día con más efectivas, el 9 set con 466");
    expect(m.ritmo.metas.map((x) => [x.rotulo, x.valor, x.y])).toEqual([
      ["Muestra", 2500, 24.75],
      ["Meta operativa", 3750, 4.125],
    ]);
    expect(m.ritmo.marcasY.map((x) => x.texto)).toEqual(["0", "1,000", "2,000", "3,000", "4,000"]);
    // El 0 de la curva queda arriba de la banda del día: las dos zonas no se pisan.
    expect(m.ritmo.marcasY[0].y).toBeLessThan(m.ritmo.bandaDia);
  });

  it("las barras del día van en su banda, a escala propia, con su cifra y su fecha", () => {
    const m = construirResumenAulas(hsvg());
    if (m.ritmo.tipo !== "serie") throw new Error("se esperaba serie");
    const { dias, bandaDia, marcasX } = m.ritmo;
    expect(dias.every((d) => d.yDia >= bandaDia && d.yDia <= 100)).toBe(true);
    // El día más alto llena casi toda la banda: su barra se lee, no es ruido al pie.
    const alto = dias.reduce((a, d) => (d.validas > a.validas ? d : a));
    expect(alto.rotuloDia).toBe("2,661");
    expect(100 - alto.yDia).toBeGreaterThan((100 - bandaDia) * 0.6);
    expect(dias.find((d) => d.validas === 466)?.rotuloDia).toBe("466");
    expect(dias.filter((d) => d.validas === 0).every((d) => d.rotuloDia === "")).toBe(true);
    // Fechas bajo las barras: la primera y la última siempre, sin pasar de 14.
    expect(marcasX[0].texto).toBe("7 set");
    expect(marcasX[marcasX.length - 1].texto).toBe("1 oct");
    expect(marcasX.length).toBeLessThanOrEqual(14);
    expect(marcasX.every((x, i) => i === 0 || x.x > marcasX[i - 1].x)).toBe(true);
    expect(m.ritmo.trazo.startsWith("M")).toBe(true);
  });

  it("sin la serie en el payload se declara desconexión, no un gráfico en cero", () => {
    const m = construirResumenAulas(ccss());
    expect(m.ritmo).toEqual({ tipo: "sin-dato", causa: expect.stringContaining("serie diaria") });
  });

  it("sin respuestas: anillo en 0 y «Aún no hay efectivas»", () => {
    const d = ccss();
    Object.assign(d.avance_cuota!.total, {
      respuestas_validas: 0, avance_pct: 0, brecha: 400, huerfanas: 0, sin_eje: 0, duplicadas: 0, sin_celda: 0,
      invariante: { ok: true, suma: 0, total: 0, solapadas: 0 },
    });
    d.ritmo_diario = { dias: [], dias_con_campo: 0, mejor_dia: null, media_diaria: 0, meta: 400 };
    const m = construirResumenAulas(d);
    expect(m.estado).toBe("sin-efectivas");
    expect(m.protagonista.proporcion).toBe(0);
    expect(m.protagonista.chip.texto).toBe("Aún no hay efectivas");
    expect(m.ritmo.tipo).toBe("sin-dias");
    expect(readinessDelResumen(m, false)).toBe("vacio:sin-efectivas");
  });

  it("sin tablero o sin el bloque de avance, «—» con su causa", () => {
    const sin = construirResumenAulas(null);
    expect(sin.estado).toBe("sin-tablero");
    expect(sin.protagonista.avanceTexto).toBe("—");
    const sinBloque = construirResumenAulas({} as MonitoreoAulasDashboard);
    expect(sinBloque.estado).toBe("sin-avance");
    expect(sinBloque.protagonista.causa).toMatch(/no trae el avance/);
    expect(sinBloque.invariante.partes.every((p) => p.valor == null)).toBe(true);
    expect(sinBloque.grupos.vacio).not.toBeNull();
  });
});

describe("readinessDelResumen", () => {
  it("false sólo mientras carga; la dirección cuando pintó; vacio:<motivo> si no hay contenido", () => {
    expect(readinessDelResumen(null, true)).toBe("false");
    expect(readinessDelResumen(construirResumenAulas(hsvg()), false)).toBe(MARCA_RESUMEN_AULAS);
    expect(MARCA_RESUMEN_AULAS).toBe("monitoreo-aulas-avance-resumen");
    expect(readinessDelResumen(construirResumenAulas(null), false)).toBe("vacio:sin-tablero");
  });
});

describe("ayudas de presentación", () => {
  it("techo redondo del eje", () => {
    expect(techoDelEje(3750)).toBe(4000);
    expect(techoDelEje(644)).toBe(800);
    expect(techoDelEje(0)).toBe(4);
  });

  it("fecha corta sin pasar por Date", () => {
    expect(fechaCorta("2026-09-07")).toBe("7 set");
    expect(fechaCorta("2026-10-01T10:00:00")).toBe("1 oct");
    expect(fechaCorta("ayer")).toBe("ayer");
  });
});
