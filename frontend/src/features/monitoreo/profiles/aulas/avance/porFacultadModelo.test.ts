import { describe, expect, it } from "vitest";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import {
  claveDeGrupo,
  construirPorFacultad,
  MARCA_POR_FACULTAD_AULAS,
  readinessDePorFacultad,
} from "./porFacultadModelo";

const EJE_FACULTAD = {
  clave: "facultad", columna: "faculty", etiqueta: "Facultad", etiqueta_plural: "Facultades",
  etiqueta_sin: "Sin facultad", atribucion: "aula", fuente_valor: "plan", motivo: "",
};
const EJE_NIVEL = {
  clave: "nivel", columna: "level", etiqueta: "Nivel", etiqueta_plural: "Niveles",
  etiqueta_sin: "Sin nivel", atribucion: "persona", fuente_valor: "padron", motivo: "",
};

function celda(faculty: string, sex: string, cuota: number, logrado: number, proyeccion: number, estado = "asegurada", etiqueta = "Llega con todo el plan, con margen") {
  return { faculty, sex, grano: "", cuota, logrado, proyeccion, estado, etiqueta, brecha: 0 };
}

function filaCuota(facultad: string, cuota: number | null, validas: number, estado = "ok") {
  return {
    facultad, faculty_key: facultad.toLowerCase(), cuota, tau_prevista: null, respuestas_validas: validas,
    brecha: cuota == null ? null : Math.max(0, cuota - validas),
    avance_pct: cuota ? Math.round((1000 * validas) / cuota) / 10 : null,
    fuente_fila: "diseno", estado, fuera_universo: 0, respuestas_sin_sexo: 0,
  };
}

function tasa(n: number, elegibles: number, efectivas: number) {
  return { n, elegibles, efectivas, tasa: elegibles > 0 ? Math.round((10000 * efectivas) / elegibles) / 10000 : null };
}

function desenlace(total: number) {
  return { total, declarados: total, aplicados: total, agendados: 0, sin_agendar: 0 };
}

function plan(codigo: string, faculty: string, rol: string, sample_status = "", titular = "") {
  return {
    operational_code: codigo, faculty, sample_role: rol, sample_status,
    titular_operational_code: titular,
  };
}

/** HSVG 2026, recortado: eje facultad, dos facultades, celdas por sexo. */
function hsvg(): MonitoreoAulasDashboard {
  return {
    avance_cuota: {
      eje: EJE_FACULTAD,
      total: { cuota: 528, respuestas_validas: 643, brecha: 0, avance_pct: 121.8 },
      facultades: [filaCuota("CIENCIAS E INGENIERIA", 528, 643), filaCuota("EDUCACION", 24, 56)],
    },
    avance_sexo_facultad: [
      celda("EDUCACION", "M", 4, 6, 6.9),
      celda("CIENCIAS E INGENIERIA", "M", 398, 472, 508.4),
      celda("CIENCIAS E INGENIERIA", "F", 130, 171, 176.2),
      celda("EDUCACION", "F", 20, 18, 21.3, "ajustada", "Llega con todo el plan, sin margen: hay que vigilarla"),
    ],
    reemplazos_por_tipo: {
      reemplazadas: desenlace(4), complementadas: desenlace(0), refuerzos: desenlace(6),
      caidos_sin_relevo: 0, sin_aula_utilizada: 0, total: 10,
    },
    refuerzos: {
      ok: true,
      rendimiento: {
        titulares: tasa(154, 5372, 2827),
        reemplazo: tasa(14, 468, 269),
        complemento: tasa(0, 0, 0),
        refuerzo: tasa(0, 0, 0),
        adicional: tasa(20, 704, 231),
        banco: tasa(7, 310, 76),
      },
    },
    agenda: [
      plan("CH 1", "CIENCIAS E INGENIERIA", "titular"),
      plan("R 1.1", "CIENCIAS E INGENIERIA", "chain_reserve", "activada", "CH 1"),
      plan("R 1.2", "CIENCIAS E INGENIERIA", "chain_reserve", "en_reserva", "CH 1"),
      plan("R 1.3", "CIENCIAS E INGENIERIA", "chain_reserve", "en_reserva", "CH 1"),
      plan("CH 2", "EDUCACION", "titular"),
      plan("R 2.1", "EDUCACION", "chain_reserve", "en_reserva", "CH 2"),
      plan("X 1", "EDUCACION", "extra_reserve_pool", "en_reserva"),
    ],
  } as unknown as MonitoreoAulasDashboard;
}

/** CCSS Perfil 2026-II: eje nivel por persona, sin celdas por sexo. */
function ccss(): MonitoreoAulasDashboard {
  return {
    avance_cuota: {
      eje: EJE_NIVEL,
      total: { cuota: 400, respuestas_validas: 465, brecha: 5, avance_pct: 116.2 },
      facultades: [
        filaCuota("10", null, 45, "fuera_del_diseno"),
        filaCuota("9", 62, 57),
        filaCuota("6", 119, 152),
        filaCuota("5", null, 95, "fuera_del_diseno"),
      ],
      composicion: {
        schema: "x", caracter: "referencial", nota: "", fuente: "padron", personas: 451,
        dimensiones: {
          sexo: {
            dimension: "sexo", etiqueta: "Sexo", poblacion_total: 1000, obtenidas_total: 451,
            filas: [
              { categoria: "F", poblacion: 526, poblacion_pct: 52.6, obtenidas: 244, obtenidas_pct: 54 },
              { categoria: "M", poblacion: 474, poblacion_pct: 47.4, obtenidas: 207, obtenidas_pct: 46 },
            ],
          },
        },
      },
    },
    avance_sexo_facultad: [
      { faculty: "9", sex: "", grano: "eje", cuota: 62, logrado: 57, proyeccion: 70, estado: "asegurada", etiqueta: "x" },
    ],
  } as unknown as MonitoreoAulasDashboard;
}

describe("construirPorFacultad · HSVG (eje facultad)", () => {
  const m = construirPorFacultad(hsvg());

  it("rotula por el eje y queda lista", () => {
    expect(m.estado).toBe("listo");
    expect(m.rotulo).toBe("Por facultad");
    expect(readinessDePorFacultad(m, false)).toBe(MARCA_POR_FACULTAD_AULAS);
    expect(MARCA_POR_FACULTAD_AULAS).toBe("monitoreo-aulas-avance-porfacultad");
  });

  it("cuota por facultad y sexo: agrupa, ordena el peor primero y cuenta los que cumplen", () => {
    if (m.cuota.tipo !== "sexo") throw new Error("se esperaba la tabla por sexo");
    expect(m.cuota.titulo).toBe("Cuota por facultad y sexo");
    expect(m.cuota.sub).toBe("4 grupos; 3 ya cumplen y 1 todavía no");
    // Educación tiene una celda «ajustada»: va antes aunque pida menos.
    expect(m.cuota.grupos.map((g) => g.nombre)).toEqual(["Educación", "Ciencias e Ingeniería"]);
    const ci = m.cuota.grupos[1];
    expect(ci.valor).toBe("CIENCIAS E INGENIERIA");
    expect(ci.filas.map((f) => f.sexo)).toEqual(["Mujeres", "Hombres"]);
  });

  it('"Al cierre" es la proyección del motor en personas enteras hacia abajo, con su frase', () => {
    if (m.cuota.tipo !== "sexo") throw new Error("se esperaba la tabla por sexo");
    const mujeres = m.cuota.grupos[1].filas[0];
    expect(mujeres).toMatchObject({ logradas: 171, cuota: 130, alCierre: "176", relleno: 100, cumple: true, tono: "ok" });
    expect(mujeres.lectura).toBe("Llega con todo el plan, con margen");
    const educacionF = m.cuota.grupos[0].filas[0];
    expect(educacionF).toMatchObject({ logradas: 18, cuota: 20, alCierre: "21", cumple: false, tono: "aviso", relleno: 90 });
  });

  it("la franja lee los desenlaces del libro", () => {
    if (m.lateral.tipo !== "operativo") throw new Error("se esperaba el lateral operativo");
    expect(m.lateral.franja.cifras.map((c) => [c.rotulo, c.valor])).toEqual([
      ["Reemplazos", "4"], ["Complementos", "0"], ["Refuerzos", "6"], ["Caídos sin relevo", "0"],
    ]);
    expect(m.lateral.franja.vacio).toBeNull();
  });

  it('qué rindió cada tipo, con "—" donde no hay elegibles', () => {
    if (m.lateral.tipo !== "operativo") throw new Error("se esperaba el lateral operativo");
    expect(m.lateral.rendimiento.filas.map((f) => [f.tipo, f.aulas, f.elegibles, f.efectivas, f.tasa])).toEqual([
      ["Titulares", "154", "5,372", "2,827", "52.6 %"],
      ["Reemplazos", "14", "468", "269", "57.5 %"],
      ["Complementos", "0", "0", "0", "—"],
      ["Refuerzos", "0", "0", "0", "—"],
      ["Adicionales sin declarar", "20", "704", "231", "32.8 %"],
      ["Banco de extras", "7", "310", "76", "24.5 %"],
    ]);
  });

  it("consumo de la reserva: usadas de su total, la más usada primero, sin el banco de extras", () => {
    if (m.lateral.tipo !== "operativo") throw new Error("se esperaba el lateral operativo");
    expect(m.lateral.consumo.filas.map((f) => [f.nombre, f.usadas, f.total, Math.round(f.carril)])).toEqual([
      ["Ciencias e Ingeniería", 1, 3, 100],
      ["Educación", 0, 1, 33],
    ]);
    expect(m.lateral.consumo.sub).toBe("1 usada de 4");
  });
});

describe("construirPorFacultad · CCSS (eje nivel)", () => {
  const m = construirPorFacultad(ccss());

  it("se rotula por nivel y no usa las celdas del eje como si fueran por sexo", () => {
    expect(m.rotulo).toBe("Por nivel");
    expect(m.cuota.tipo).toBe("eje");
  });

  it("cuota por nivel: los de meta en orden y los fuera del diseño al final", () => {
    if (m.cuota.tipo !== "eje") throw new Error("se esperaba la tabla del eje");
    expect(m.cuota.titulo).toBe("Cuota por nivel");
    expect(m.cuota.filas.map((f) => [f.nombre, f.cuotaTexto, f.avanceTexto, f.estado.texto])).toEqual([
      ["Nivel 6", "119", "127.7 %", "Cumplida"],
      ["Nivel 9", "62", "91.9 %", "Faltan 5"],
      ["Nivel 5", "Sin meta", "—", "Fuera del diseño"],
      ["Nivel 10", "Sin meta", "—", "Fuera del diseño"],
    ]);
    expect(m.cuota.sub).toBe("1 de 2 niveles con meta ya cumplen; el nivel sale del padrón con el código del alumno");
  });

  it("a quién se está alcanzando: padrón frente a efectivas, por sexo", () => {
    if (m.lateral.tipo !== "alcance") throw new Error("se esperaba el lateral de alcance");
    expect(m.lateral.vacio).toBeNull();
    const sexo = m.lateral.dimensiones[0];
    expect(sexo.filas.map((f) => [f.etiqueta, f.padron, f.efectivas])).toEqual([
      ["Mujeres", 52.6, 54],
      ["Hombres", 47.4, 46],
    ]);
  });
});

describe("construirPorFacultad · vacíos con causa (C3, C5)", () => {
  it("sin tablero, el estado lo dice y la marca no se cuelga", () => {
    const m = construirPorFacultad(null);
    expect(m.estado).toBe("sin-tablero");
    expect(readinessDePorFacultad(m, false)).toBe("vacio:sin-tablero");
    expect(readinessDePorFacultad(m, true)).toBe("false");
  });

  it("sin bloques del motor: cada superficie declara su desconexión en vez de ceros", () => {
    const m = construirPorFacultad({ avance_cuota: { eje: EJE_FACULTAD, total: null, facultades: [] } } as unknown as MonitoreoAulasDashboard);
    if (m.lateral.tipo !== "operativo") throw new Error("se esperaba el lateral operativo");
    expect(m.cuota.tipo).toBe("vacio");
    expect(m.lateral.franja.cifras.every((c) => c.valor === "—")).toBe(true);
    expect(m.lateral.franja.vacio?.clase).toBe("desconexion");
    expect(m.lateral.rendimiento.vacio?.clase).toBe("desconexion");
    expect(m.lateral.consumo.vacio?.clase).toBe("legitimo");
  });

  it("sin avance contra la cuota la pestaña no se da por lista", () => {
    const m = construirPorFacultad({ agenda: [] } as unknown as MonitoreoAulasDashboard);
    expect(m.estado).toBe("sin-avance");
    expect(readinessDePorFacultad(m, false)).toBe("vacio:sin-avance");
  });

  it("el motor que no pudo medir el rendimiento dice su motivo", () => {
    const d = { ...hsvg(), refuerzos: { ok: false, motivo: "el estudio todavía no tiene plan de aulas." } } as unknown as MonitoreoAulasDashboard;
    const m = construirPorFacultad(d);
    if (m.lateral.tipo !== "operativo") throw new Error("se esperaba el lateral operativo");
    expect(m.lateral.rendimiento.vacio).toEqual({
      causa: "Sin rendimiento por tipo: el estudio todavía no tiene plan de aulas.",
      clase: "legitimo",
    });
  });
});

describe("construirPorFacultad · procedencia de la cuota y aviso del eje", () => {
  it("la procedencia del denominador viaja con la tabla, y el sello sin verificar se dice", () => {
    const d = hsvg();
    (d.avance_cuota as unknown as Record<string, unknown>).vigencia = "no_verificable";
    (d.avance_cuota as unknown as Record<string, unknown>).motivo = "el sello no coincide";
    const m = construirPorFacultad(d);
    expect(m.procedencia?.chip).toContain("(sello sin verificar)");
    expect(m.procedencia?.detalle).toBe("el sello no coincide");
  });

  it("F4: con la declaración del Planner la procedencia lo dice y las discrepancias se avisan", () => {
    const d = hsvg();
    (d as unknown as Record<string, unknown>).representatividad_declarada = {
      schema: "representatividad_v1", origen: "planner", origen_celdas: "traducida_v1",
      universo: { nivel: "universidad", etiqueta: "PUCP" },
      variables: [{ clave: "facultad" }, { clave: "nivel" }],
      celdas: [],
      discrepancias: [{ tipo: "variable_sin_celdas", variable: "nivel", texto: 'El Planner declara "nivel" como variable de cuota y el diseño no reparte metas por ella.' }],
    };
    const m = construirPorFacultad(d);
    expect(m.procedencia?.detalle).toContain("Universo y variables declarados en el Planner.");
    expect(m.avisoDelEje).toBe('El Planner declara "nivel" como variable de cuota y el diseño no reparte metas por ella.');
  });

  it("el aviso del eje del motor llega a la pestaña; sin aviso, nada", () => {
    expect(construirPorFacultad(hsvg()).avisoDelEje).toBeNull();
    const d = ccss();
    (d.avance_cuota as unknown as Record<string, unknown>).aviso_eje = "Falta el padrón: ninguna respuesta cae en su nivel.";
    expect(construirPorFacultad(d).avisoDelEje).toBe("Falta el padrón: ninguna respuesta cae en su nivel.");
  });

  it("sin bloque de cuota no se publica una procedencia", () => {
    expect(construirPorFacultad({ agenda: [] } as unknown as MonitoreoAulasDashboard).procedencia).toBeNull();
  });
});

describe("claveDeGrupo", () => {
  it("iguala el valor del eje sin tildes ni mayúsculas", () => {
    expect(claveDeGrupo("Educación")).toBe(claveDeGrupo("EDUCACION"));
    expect(claveDeGrupo("  Ciencias   e Ingeniería ")).toBe("CIENCIAS E INGENIERIA");
  });
});
