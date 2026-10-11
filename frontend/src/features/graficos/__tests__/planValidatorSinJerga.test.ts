import { describe, expect, test } from "vitest";
import type { Slide, SlideMetadata } from "../../../api/graficos";
import { humanizeGraficosExportError } from "../humanizeExportError";
import { nombreTipoLamina, rotuloLamina, tituloDeLamina } from "../rotuloLamina";
import { validarPlan, type EntradaValidarPlan } from "../usePlanValidator";
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
  { name: "p1", label: "Satisfacción", tipo: "select_one", seccion: "", list_name: "acuerdo5", source: "docentes" },
  { name: "p2", label: "Edad", tipo: "select_one", seccion: "", list_name: "edad", source: "docentes" },
  { name: "p7", label: "Turno", tipo: "select_one", seccion: "", list_name: "turno", source: "docentes" },
  { name: "sexo", label: "Sexo", tipo: "select_one", seccion: "", list_name: "sexo", source: "docentes" },
  { name: "sexo", label: "Sexo", tipo: "select_one", seccion: "", list_name: "sexo", source: "estudiantes" },
];

const slides: Slide[] = [
  { id: "slide_portada_0001", tipo: "p_slide_portada", payload: { titulo: "Informe" } },
  { id: ID_LARGO, tipo: "p_slide_2_graficos", payload: { titulo: "Satisfacción con el curso", izquierda: null, derecha: { graficador: "p_barras_simples", args: { var: "p999", ancho_barra: 9 } } } },
  { id: ID_ICONO, tipo: "p_slide_objetivo_icono", payload: { titulo: "", icono: "icono_borrado_ab12" } },
  { id: ID_ESCALA, tipo: "p_slide_1_grafico", payload: { titulo: { text: "Escalas (cont.)" }, grafico: { graficador: "p_barras_multiapiladas", args: { vars: ["docentes$p1", "docentes$p2"] } } } },
  { id: "slide_sinbase_99", tipo: "p_slide_1_grafico", payload: { titulo: "Turno", grafico: { graficador: "p_barras_simples", args: { var: "p7", cruce: "sexo" } } } },
];

function entrada(parcial: Partial<EntradaValidarPlan> = {}): EntradaValidarPlan {
  return {
    slides,
    presets: { p_barras_simples: { ancho_barra: -3 } },
    wPresets: { chart_presets: { p_barras_simples: { ancho_barra: 50 } } },
    overridesReusables: [{ nombre: "Compacto", tipo_preset: "p_barras_simples", args: { ancho_barra: "x" } }],
    paletas: { acuerdo5: { a: "#1E3A8A", b: "#1D4ED8", c: "#2563EB", d: "#3B82F6" } },
    iconos: [{ id: "icono_vigente" }],
    slidesById: {
      p_slide_portada: meta("Portada", []),
      p_slide_2_graficos: meta("Dos gráficos", ["izquierda", "derecha"], [
        { name: "izquierda", role: "chart", label: "Gráfico izquierdo" } as NonNullable<SlideMetadata["slot_specs"]>[number],
        { name: "derecha", role: "chart", label: "Gráfico derecho" } as NonNullable<SlideMetadata["slot_specs"]>[number],
      ]),
      p_slide_objetivo_icono: meta("Objetivo con icono", ["icono"]),
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
    expect(porCodigo("icon-unknown")).toEqual(["Lámina 3 (Objetivo con ícono): el ícono elegido ya no está en el catálogo. Sube uno nuevo o elige otro."]);
  });

  test("variable perdida y variable sin base", () => {
    expect(porCodigo("var-unknown")).toEqual([
      "Lámina 2 · “Satisfacción con el curso” (Dos gráficos), espacio «Gráfico derecho»: la variable «p999» no está en el instrumento. ¿La renombraste o la borraste?",
    ]);
    expect(porCodigo("var-sin-base")).toEqual([
      "Lámina 5 · “Turno” (Un gráfico), espacio «Gráfico»: la variable «p7» no dice de qué base es. Está en la base «docentes»; vuelve a elegirla para dejarlo escrito.",
      "Lámina 5 · “Turno” (Un gráfico), espacio «Gráfico»: la variable «sexo» existe en las bases «docentes» y «estudiantes». Elige de cuál es: el gráfico no puede resolverla solo.",
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
      "Modo «Compacto»: el ajuste «Ancho de barra» tiene un valor inválido («x»); debe ser un número válido. Rango permitido: 0 a 1.",
      "Ajustes de Word de «Barras simples»: el ajuste «Ancho de barra» tiene un valor inválido («50»); debe ser menor o igual a 1. Rango permitido: 0 a 1.",
    ]);
  });

  test("paleta monocromática", () => {
    expect(porCodigo("paleta-monocromatica")).toEqual([
      "Paleta de «acuerdo5»: los colores son muy parecidos entre sí. En barras apiladas cuesta distinguir las categorías.",
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
