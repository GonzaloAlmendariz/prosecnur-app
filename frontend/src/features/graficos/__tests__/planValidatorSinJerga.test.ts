import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import type { Slide, SlideMetadata } from "../../../api/graficos";
import { humanizeGraficosExportError } from "../humanizeExportError";
import { nombreTipoLamina, rotuloLamina, tituloDeLamina } from "../rotuloLamina";
import { nombrePaleta, validarPlan, type EntradaValidarPlan } from "../usePlanValidator";
import type { VarWithSource } from "../useVariables";

// Contrato de los avisos del validador del plan (B-g, parte frontend): hablan de la lámina por su número y su título,
// como el backend (`.aviso_lamina`), y nunca del id interno, el tipo `p_slide_*`, «slide»/«slot» ni en voseo. Antes
// decían «"Objetivo con icono" (slide 3f9a1c): … Subí uno nuevo o elige otro.».

const ID_LARGO = "slide_8c1d2e3f-4a5b-4c6d-8e7f-90a1b2c3d4e5";
const ID_ICONO = "slide_1f2e3d4c-5b6a-4978-8a9b-0c1d2e3f4a5b";
const ID_ESCALA = "slide_ab12cd34ef56";

function meta(titulo_humano: string, slots: string[], slot_specs?: SlideMetadata["slot_specs"]) {
  return { titulo_humano, slots, slot_specs };
}

const variables: VarWithSource[] = [
  { name: "p1", label: "Satisfacción", tipo: "select_one", seccion: "", list_name: "lst_p31", source: "docentes" },
  { name: "p2", label: "Edad", tipo: "select_one", seccion: "", list_name: "edad", source: "docentes" },
  { name: "p7", label: "Turno", tipo: "select_one", seccion: "", list_name: "turno", source: "docentes" },
  { name: "sexo", label: "Sexo", tipo: "select_one", seccion: "", list_name: "sexo", source: "docentes" },
  { name: "sexo", label: "Sexo", tipo: "select_one", seccion: "", list_name: "sexo", source: "estudiantes" },
];

const slides: Slide[] = [
  { id: "slide_portada_0001", tipo: "p_slide_portada", payload: { titulo: "Informe" } },
  { id: ID_LARGO, tipo: "p_slide_2_graficos", payload: { titulo: "Satisfacción con el curso", izquierda: null, derecha: { graficador: "p_barras_simples", args: { var: "p999", ancho_barra: 9 } } } },
  { id: ID_ICONO, tipo: "p_slide_3_graficos_poblacion_corona", payload: { titulo: "", icono: "icono_borrado_ab12" } },
  { id: ID_ESCALA, tipo: "p_slide_1_grafico", payload: { titulo: { text: "Escalas (cont.)" }, grafico: { graficador: "p_barras_multiapiladas", args: { vars: ["docentes$p1", "docentes$p2"] } } } },
  { id: "slide_sinbase_99", tipo: "p_slide_1_grafico", payload: { titulo: "Turno", grafico: { graficador: "p_barras_simples", args: { var: "p7", cruce: "sexo" } } } },
];

function entrada(parcial: Partial<EntradaValidarPlan> = {}): EntradaValidarPlan {
  return {
    slides,
    presets: { p_barras_simples: { ancho_barra: -3 } },
    wPresets: { chart_presets: { p_barras_simples: { ancho_barra: 50 } } },
    overridesReusables: [{ nombre: "Compacto", tipo_preset: "p_barras_simples", args: { ancho_barra: "x" } }],
    paletas: { lst_p31: { a: "#1E3A8A", b: "#1D4ED8", c: "#2563EB", d: "#3B82F6" } },
    iconos: [{ id: "icono_vigente" }],
    slidesById: {
      p_slide_portada: meta("Portada", []),
      p_slide_2_graficos: meta("Dos gráficos", ["izquierda", "derecha"], [
        { name: "izquierda", role: "chart", label: "Gráfico izquierdo" } as NonNullable<SlideMetadata["slot_specs"]>[number],
        { name: "derecha", role: "chart", label: "Gráfico derecho" } as NonNullable<SlideMetadata["slot_specs"]>[number],
      ]),
      // El objetivo ya no elige ícono (G5, siempre la diana): el ícono perdido se prueba en una lámina de población.
      p_slide_3_graficos_poblacion_corona: meta("Tres gráficos alrededor del ícono", ["icono"]),
      p_slide_1_grafico: meta("Un gráfico", ["grafico"]),
    },
    graficadoresById: {
      p_barras_simples: { args: [{ name: "ancho_barra", label: "Ancho de barra", tipo_input: "number", grupo: "valores", min: 0, max: 1 }] },
    },
    presetsByName: {
      p_barras_simples: { titulo_humano: "Barras simples", args: [{ name: "ancho_barra", label: "Ancho de barra", tipo_input: "number", grupo: "valores", min: 0, max: 1 }] },
    },
    variables,
    multi: true,
    ...parcial,
  };
}

// Lo que no puede aparecer en un aviso: ids (uuid, el sufijo que mostraba `shortId`, el id entero), tipos internos,
// jerga y voseo.
const JERGA: [string, RegExp][] = [
  ["uuid", /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i],
  ["tipo interno", /\bp_(slide|barras|radar|tabla|plan)/],
  ["«slide»", /\bslides?\b/i],
  ["«slot»", /\bslots?\b/i],
  ["«(slide …)»", /\(slide /i],
  ["voseo", /\b(Subí|Elegí|Revisá|Cargá|Probá|Volvé|Hacé|Usá|Tocá|Agregá|Seleccioná|Cambiá|Poné|Dejá|Mirá|Guardá|Configurá|Activá|Escribí|Abrí|Fijate|tenés|podés|querés)(?![\p{L}])/iu],
  ["«icono» sin tilde", /\bicono\b/i],
  ["«export» en inglés", /\bexport\b/i],
  ["envoltura de callr", /! in callr|Caused by error|callr/i],
  ["list_name interno", /\blst_\w+/],
];

function jergaEn(texto: string, ids: readonly string[]): string[] {
  const hallazgos = JERGA.filter(([, re]) => re.test(texto)).map(([nombre]) => nombre);
  for (const id of ids) {
    if (texto.includes(id) || texto.includes(id.slice(-6))) hallazgos.push(`id ${id}`);
  }
  return hallazgos;
}

describe("validador del plan: avisos sin jerga", () => {
  const resumen = validarPlan(entrada());
  const ids = slides.map((s) => s.id);

  test("el plan de ejemplo produce cada familia de aviso", () => {
    const codigos = new Set(resumen.issues.map((i) => i.code));
    for (const c of ["slot-empty", "var-unknown", "var-sin-base", "icon-unknown", "numeric-invalid", "scale-mismatch", "paleta-monocromatica"]) {
      expect(codigos, c).toContain(c);
    }
  });

  test("ningún mensaje trae ids, tipos internos, «slide»/«slot» ni voseo", () => {
    const vacio = validarPlan(entrada({ slides: [] }));
    for (const issue of [...resumen.issues, ...vacio.issues]) {
      expect(jergaEn(issue.message, ids), issue.message).toEqual([]);
    }
  });

  test("el id viaja aparte, para «Ir a la lámina»", () => {
    const icono = resumen.issues.find((i) => i.code === "icon-unknown");
    expect(icono?.slideId).toBe(ID_ICONO);
    const vacio = resumen.issues.find((i) => i.code === "slot-empty");
    expect(vacio?.slideId).toBe(ID_LARGO);
    expect(vacio?.slotName).toBe("izquierda");
  });
});

describe("textos reescritos del validador", () => {
  const porCodigo = (code: string) => validarPlan(entrada()).issues.filter((i) => i.code === code).map((i) => i.message);

  test("plan vacío", () => {
    expect(validarPlan(entrada({ slides: [] })).issues[0].message).toBe("El informe no tiene láminas. Agrega al menos una para poder exportar.");
  });

  test("espacio sin gráfico: número, título, tipo visible y nombre del espacio", () => {
    expect(porCodigo("slot-empty")).toEqual(["Lámina 2 · “Satisfacción con el curso” (Dos gráficos): el espacio «Gráfico izquierdo» no tiene gráfico."]);
  });

  test("ícono que ya no está: lámina sin título, tipo con tilde y tuteo", () => {
    expect(porCodigo("icon-unknown")).toEqual(["Lámina 3 (Tres gráficos: dos arriba y uno ancho): el ícono elegido ya no está en el catálogo. Sube uno nuevo o elige otro."]);
  });

  test("variable perdida y variable sin base", () => {
    expect(porCodigo("var-unknown")).toEqual([
      "Lámina 2 · “Satisfacción con el curso” (Dos gráficos), espacio «Gráfico derecho»: la pregunta «p999» no está en el instrumento. ¿La renombraste o la borraste?",
    ]);
    expect(porCodigo("var-sin-base")).toEqual([
      "Lámina 5 · “Turno” (Un gráfico), espacio «Gráfico»: la pregunta «p7» no dice de qué base es. Está en la base «docentes»; vuelve a elegirla para dejarlo escrito.",
      "Lámina 5 · “Turno” (Un gráfico), espacio «Gráfico»: la pregunta «sexo» existe en las bases «docentes» y «estudiantes». Elige de cuál es: el gráfico no puede resolverla solo.",
    ]);
  });

  test("escalas incompatibles: el título pierde el «(cont.)» y el veredicto sigue en minúscula", () => {
    const [msg] = porCodigo("scale-mismatch");
    expect(msg.startsWith("Lámina 4 · “Escalas” (Un gráfico), espacio «Gráfico»: estas preguntas no comparten una escala compatible")).toBe(true);
  });

  test("valores numéricos: lámina, ajustes por defecto, Word y modos", () => {
    expect(porCodigo("numeric-invalid")).toEqual([
      "Lámina 2 · “Satisfacción con el curso” (Dos gráficos), espacio «Gráfico derecho»: el ajuste «Ancho de barra» tiene un valor inválido («9»); debe ser menor o igual a 1. Rango permitido: 0 a 1.",
      "Ajustes por defecto de «Barras simples»: el ajuste «Ancho de barra» tiene un valor inválido («-3»); debe ser mayor o igual a 0. Rango permitido: 0 a 1.",
      "Estilo guardado «Compacto»: el ajuste «Ancho de barra» tiene un valor inválido («x»); debe ser un número válido. Rango permitido: 0 a 1.",
      "Ajustes de Word de «Barras simples»: el ajuste «Ancho de barra» tiene un valor inválido («50»); debe ser menor o igual a 1. Rango permitido: 0 a 1.",
    ]);
  });

  test("paleta monocromática", () => {
    expect(porCodigo("paleta-monocromatica")).toEqual([
      "La paleta de «Satisfacción»: los colores son muy parecidos entre sí. En barras apiladas cuesta distinguir las categorías.",
    ]);
  });
});

describe("rótulo de la lámina", () => {
  test("con y sin título, igual que `.aviso_lamina` del backend", () => {
    expect(rotuloLamina({ payload: { titulo: "Perfil" } }, 0)).toBe("Lámina 1 · “Perfil”");
    expect(rotuloLamina({ payload: { titulo: "  " } }, 6)).toBe("Lámina 7");
    expect(rotuloLamina({ payload: {} }, 2)).toBe("Lámina 3");
    expect(tituloDeLamina({ titulo: "Edad (cont.)" })).toBe("Edad");
    expect(tituloDeLamina({ titulo: { text: "Rico" } })).toBe("Rico");
  });

  test("el tipo se nombra como el selector, nunca `p_slide_*`", () => {
    expect(nombreTipoLamina("p_slide_objetivo_icono", "Objetivo con icono")).toBe("Objetivo con ícono");
    expect(nombreTipoLamina("p_slide_inventado", "")).toBe("un tipo de lámina que esta versión no reconoce");
  });
});

describe("errores de exportación humanizados: sin jerga", () => {
  const plan = { slides, version: 1 } as unknown as Parameters<typeof humanizeGraficosExportError>[1];
  const crudos = [
    'argument "var" is missing, with no default',
    'object \'p999\' not found',
    "non-numeric argument to binary operator",
    "Graficador no registrado: p_barras_raras",
    "zero-length vector",
    "Icono no encontrado: 'abc'",
    "La slide 'p_slide_objetivo_icono' requiere un icono",
    "'icono' debe ser un ppt_element",
    "cannot open file 'x.png'",
    "La lámina «Objetivo con ícono» requiere un ícono. Elige un PNG en Configuración global > Íconos.",
    "! in callr subprocess. Caused by error: ! Base 'estudiantes': modo='var_cruce': cuando `vars` es lista, debe ser una lista nombrada.",
    "! in callr subprocess. Caused by error: ! objeto `foo_bar` inesperado en p_slide_x(slide_ab12cd34ef56)",
  ];

  test.each(crudos)("%s", (crudo) => {
    const h = humanizeGraficosExportError(crudo, plan);
    for (const texto of [h.message, h.hint ?? "", h.slideRef?.label ?? ""]) {
      expect(jergaEn(texto, slides.map((s) => s.id)), texto).toEqual([]);
    }
  });

  test("la lámina culpable se nombra por su número y el id viaja aparte", () => {
    const h = humanizeGraficosExportError("object 'p999' not found", plan);
    expect(h.message).toBe("La variable «p999» no existe en los datos cargados (usada en Lámina 2 · “Satisfacción con el curso”).");
    expect(h.slideRef).toEqual({ id: ID_LARGO, label: "Lámina 2 · “Satisfacción con el curso”" });
  });
});

describe("errores de exportación: casos reescritos", () => {
  const conGrupos = {
    slides: [
      ...slides,
      { id: "slide_grupos_7777", tipo: "p_slide_1_grafico", payload: { titulo: "Comparación por tema", grafico: { graficador: "p_barras_multiapiladas", args: { modo: "var_cruce", vars: ["p1", "p2"], cruces: "sexo" } } } },
    ],
  } as unknown as Parameters<typeof humanizeGraficosExportError>[1];
  const CALLR_EN_VIVO = "! in callr subprocess. Caused by error: ! Base 'estudiantes': modo='var_cruce': cuando `vars` es lista, debe ser una lista nombrada.";

  test("grupos de preguntas sin tema (visto en vivo): lenguaje llano, lámina culpable y crudo aparte", () => {
    const h = humanizeGraficosExportError(CALLR_EN_VIVO, conGrupos);
    expect(h.message).toBe("Lámina 6 · “Comparación por tema”: un gráfico de la base «estudiantes» compara grupos de preguntas, pero los grupos quedaron sin el nombre de su tema.");
    expect(h.slideRef?.id).toBe("slide_grupos_7777");
    expect(h.detalle).toBe(CALLR_EN_VIVO);
  });

  test("lo que no se reconoce no se muestra crudo: va en `detalle`", () => {
    const crudo = "! in callr subprocess. Caused by error: ! algo raro en `p_dim_x()`";
    const h = humanizeGraficosExportError(`[E_INTERNAL] ${crudo}`, conGrupos);
    expect(h.message).toBe("No se pudo generar el informe. Revisa la lámina indicada o vuelve a intentarlo; el detalle quedó en el registro.");
    expect(h.message).not.toContain("callr");
    expect(h.detalle).toBe(crudo);
  });

  test("ícono requerido: reconoce el texto actual del backend y el viejo", () => {
    const nuevo = humanizeGraficosExportError("La lámina «Objetivo con ícono» requiere un ícono. Elige un PNG en Configuración global > Íconos.", conGrupos);
    expect(nuevo.message).toBe("Una lámina «Objetivo con ícono» necesita un ícono.");
    const viejo = humanizeGraficosExportError("La slide 'p_slide_objetivo_icono' requiere un icono", conGrupos);
    expect(viejo.message).toBe("Una lámina «Objetivo con ícono» necesita un ícono.");
  });
});

describe("paleta: se nombra por la pregunta, no por la lista interna", () => {
  test("una, varias o ninguna pregunta", () => {
    const vars = [
      { name: "p31", label: "<b>Confianza</b> en la institución", list_name: "lst_p31" },
      { name: "p32", label: "Confianza en el gobierno", list_name: "lst_p31" },
      { name: "p33", label: "Confianza en la prensa", list_name: "lst_p31" },
    ];
    expect(nombrePaleta("lst_p31", vars.slice(0, 1))).toBe("La paleta de «Confianza en la institución»");
    expect(nombrePaleta("lst_p31", vars)).toBe("La paleta de «Confianza en la institución» (y 2 preguntas más)");
    expect(nombrePaleta("lst_p31", [])).toBe("Una paleta de colores que ya no usa ninguna pregunta");
  });

  test("pregunta sin etiqueta: nunca el nombre interno de la variable ni de la lista", () => {
    const sinTitulo = [
      { name: "conf_inst_p31", label: "", list_name: "lst_p31" },
      { name: "conf_gob_p32", label: "  <br/> ", list_name: "lst_p31" },
    ];
    expect(nombrePaleta("lst_p31", sinTitulo.slice(0, 1))).toBe("La paleta de una pregunta sin título");
    expect(nombrePaleta("lst_p31", sinTitulo)).toBe("La paleta de 2 preguntas sin título");
    // Con una pregunta con título, las sin título cuentan entre «las demás».
    const mezcla = [...sinTitulo, { name: "p33", label: "Confianza en la prensa", list_name: "lst_p31" }];
    expect(nombrePaleta("lst_p31", mezcla)).toBe("La paleta de «Confianza en la prensa» (y 2 preguntas más)");
    for (const vars of [sinTitulo.slice(0, 1), sinTitulo, mezcla]) {
      const texto = nombrePaleta("lst_p31", vars);
      expect(texto).not.toMatch(/conf_inst_p31|conf_gob_p32|lst_p31/);
      expect(texto).not.toMatch(/\w_\w/);
    }
    // Y en el aviso que arma el validador.
    const r = validarPlan(entrada({ variables: [{ name: "p31_conf", label: "", tipo: "select_one", seccion: "", list_name: "lst_p31", source: "docentes" }] }));
    const aviso = r.warnings.find((w) => w.code === "paleta-monocromatica");
    expect(aviso?.message).toBe("La paleta de una pregunta sin título: los colores son muy parecidos entre sí. En barras apiladas cuesta distinguir las categorías.");
  });
});

describe("salud del plan: sin «export» en inglés", () => {
  test("ningún texto visible de PlanHealthBadge dice «export»", () => {
    const fuente = readFileSync(new URL("../PlanHealthBadge.tsx", import.meta.url), "utf8")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/^import .*$/gm, "");
    const literales = [...fuente.matchAll(/"([^"\n]*)"|`([^`]*)`/g)].map((m) => m[1] ?? m[2] ?? "");
    const conExport = literales.filter((t) => /\bexport\b/i.test(t) || /\bslides?\b/i.test(t));
    expect(conExport).toEqual([]);
  });
});
