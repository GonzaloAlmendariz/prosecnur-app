import { describe, expect, it } from "vitest";
import { MONITOREO_PESTANAS, MONITOREO_PESTANAS_INTERNAS_AULAS } from "../../../../../lib/navegacion/catalogos/monitoreo";
import {
  aliasDeLectura,
  ATERRIZAJE_AULAS,
  direccionDeSeccion,
  direccionDeVista,
  direccionesPublicas,
  direccionInicial,
  direccionPedida,
  FICHA_DE_AULA,
  hrefDeFichaDeAula,
  PANELES_DE_SUBVISTA_AULAS,
  pestanasDeSeccion,
  pideOtraDireccion,
  SECCIONES_AULAS,
  subvistasDePestana,
  tieneSubvistas,
  vistaDeDireccion,
  vistasMontadas,
} from "./direccionAulas";

const pedida = (seccion: string | null, pestana: string | null = null, panel: string | null = null) => ({ seccion, pestana, panel });
const d = (seccion: "insumos" | "modelo" | "control" | "avance", pestana: string, panel: string | null = null) => ({ seccion, pestana, panel });

/**
 * Revamp de Monitoreo · Cursos-horario, lote de navegación
 * (`docs/qa/revamp-monitoreo/aulas.md` §1): cinco secciones y veinte pestañas
 * pasan al esqueleto común de cuatro secciones y dieciocho pestañas.
 */
describe("dirección pública del modo cursos-horario", () => {
  it("cada sección pública lleva exactamente las pestañas del catálogo, en su orden", () => {
    for (const seccion of SECCIONES_AULAS) {
      expect(pestanasDeSeccion(seccion)).toEqual(MONITOREO_PESTANAS.aulas[seccion].map((tab) => tab.key));
    }
  });

  it("declara las 18 pestañas del diseño, en Insumos · Modelo · Control · Avance", () => {
    expect(Object.keys(MONITOREO_PESTANAS.aulas)).toEqual(["insumos", "modelo", "control", "avance"]);
    expect(pestanasDeSeccion("insumos")).toEqual(["fuentes", "reglas", "aplicadores"]);
    expect(pestanasDeSeccion("modelo")).toEqual(["metas", "muestra"]);
    expect(pestanasDeSeccion("control")).toEqual(["agenda", "contacto", "distribucion", "registro", "partes", "calidad", "brechas", "alumnos"]);
    expect(pestanasDeSeccion("avance")).toEqual(["resumen", "porfacultad", "cursos", "rendimiento", "salidas"]);
    const total = SECCIONES_AULAS.reduce((suma, seccion) => suma + pestanasDeSeccion(seccion).length, 0);
    expect(total).toBe(18);
  });

  it("Alumnos es la única condicional", () => {
    const condicionales = SECCIONES_AULAS.flatMap((seccion) => MONITOREO_PESTANAS.aulas[seccion]
      .filter((tab) => tab.disponibilidad === "condicional").map((tab) => `${seccion}/${tab.key}`));
    expect(condicionales).toEqual(["control/alumnos"]);
  });

  it("sin dirección aterriza en Avance › Por facultad (P1)", () => {
    expect(direccionInicial(pedida(null))).toEqual(d("avance", "porfacultad"));
    expect(direccionInicial(pedida("avance"))).toEqual(ATERRIZAJE_AULAS);
    expect(direccionDeSeccion("avance")).toEqual(ATERRIZAJE_AULAS);
  });

  it("cada sección abre por su primera pestaña", () => {
    expect(direccionDeSeccion("insumos")).toEqual(d("insumos", "fuentes"));
    expect(direccionDeSeccion("modelo")).toEqual(d("modelo", "metas"));
    expect(direccionDeSeccion("control")).toEqual(d("control", "agenda"));
  });

  it("toda vista heredada que montaba la página se monta en alguna dirección pública", () => {
    // Ninguna pestaña de hoy se pierde (§1): las 20 y la hoja Fuentes tienen
    // destino. Lo que se pinta sigue siendo la vista heredada.
    const internas = Object.entries(MONITOREO_PESTANAS_INTERNAS_AULAS)
      .flatMap(([seccion, tabs]) => (tabs.length ? tabs.map((tab) => `${seccion}/${tab.key}`) : [`${seccion}/`]));
    expect(internas).toHaveLength(21);
    const montadas = new Set(vistasMontadas().map((vista) => `${vista.seccion}/${vista.pestana}`));
    for (const clave of internas) {
      expect(montadas.has(clave), clave).toBe(true);
    }
  });

  it("monta, para cada pestaña pública, la vista que absorbe (columna «Absorbe de hoy»)", () => {
    const esperado: Record<string, string> = {
      "insumos/fuentes": "fuentes/",
      "insumos/reglas": "fuentes/",
      "insumos/aplicadores": "modelo/carga",
      "modelo/metas": "avance/cuotas",
      "modelo/muestra": "consultas/reemplazos",
      "control/agenda": "modelo/agenda",
      "control/contacto": "modelo/contacto",
      "control/distribucion": "modelo/carga",
      "control/registro": "calidad/registro",
      "control/partes": "consultas/parte",
      "control/calidad": "calidad/controles",
      "control/brechas": "consultas/brechas",
      "control/alumnos": "calidad/alumnos",
      "avance/resumen": "avance/resumen",
      "avance/porfacultad": "avance/cuotas",
      "avance/cursos": "avance/resumen",
      "avance/rendimiento": "avance/rendimiento",
      "avance/salidas": "avance/salidas",
    };
    for (const [publica, interna] of Object.entries(esperado)) {
      const [seccion, pestana] = publica.split("/") as ["insumos", string];
      const vista = vistaDeDireccion(d(seccion, pestana));
      expect(`${vista.seccion}/${vista.pestana}`, publica).toBe(interna);
    }
  });

  it("las sub-vistas montan las demás vistas que la pestaña absorbe", () => {
    expect(vistaDeDireccion(d("control", "agenda", "facultad"))).toEqual({ seccion: "modelo", pestana: "facultad" });
    expect(vistaDeDireccion(d("control", "calidad", "base"))).toEqual({ seccion: "calidad", pestana: "base" });
    expect(vistaDeDireccion(d("control", "calidad", "abiertas"))).toEqual({ seccion: "calidad", pestana: "abiertas" });
    expect(vistaDeDireccion(d("control", "brechas", "refuerzos"))).toEqual({ seccion: "consultas", pestana: "refuerzos" });
    expect(vistaDeDireccion(d("control", "partes", "codigo"))).toEqual({ seccion: "consultas", pestana: "ficha" });
    expect(vistaDeDireccion(d("modelo", "muestra", "banco"))).toEqual({ seccion: "consultas", pestana: "extras" });
    expect(vistaDeDireccion(d("modelo", "metas", "efectividad"))).toEqual({ seccion: "avance", pestana: "efectividad" });
    expect(vistaDeDireccion(d("avance", "rendimiento", "efectividad"))).toEqual({ seccion: "avance", pestana: "efectividad" });
    expect(vistaDeDireccion(d("insumos", "reglas", "criterio"))).toEqual({ seccion: "calidad", pestana: "controles" });
    expect(subvistasDePestana("control", "calidad").map((item) => item.panel)).toEqual([null, "base", "abiertas"]);
    expect(subvistasDePestana("control", "registro")).toEqual([]);
    expect(tieneSubvistas(d("control", "calidad"))).toBe(true);
    expect(tieneSubvistas(d("avance", "resumen"))).toBe(false);
  });

  it("lee los alias de la arquitectura anterior y los lleva a la dirección del diseño", () => {
    // Fuentes (hoja sin pestañas).
    expect(direccionPedida(pedida("fuentes"))).toEqual(d("insumos", "fuentes"));
    // Agenda de cursos-horario.
    expect(direccionPedida(pedida("modelo", "agenda"))).toEqual(d("control", "agenda"));
    expect(direccionPedida(pedida("modelo", "facultad"))).toEqual(d("control", "agenda", "facultad"));
    expect(direccionPedida(pedida("modelo", "contacto"))).toEqual(d("control", "contacto"));
    expect(direccionPedida(pedida("modelo", "carga"))).toEqual(d("control", "distribucion"));
    // Validación.
    expect(direccionPedida(pedida("calidad", "registro"))).toEqual(d("control", "registro"));
    expect(direccionPedida(pedida("calidad", "controles"))).toEqual(d("control", "calidad"));
    expect(direccionPedida(pedida("calidad", "base"))).toEqual(d("control", "calidad", "base"));
    expect(direccionPedida(pedida("calidad", "alumnos"))).toEqual(d("control", "alumnos"));
    expect(direccionPedida(pedida("calidad", "abiertas"))).toEqual(d("control", "calidad", "abiertas"));
    expect(direccionPedida(pedida("calidad"))).toEqual(d("control", "registro"));
    // Consultas.
    expect(direccionPedida(pedida("consultas", "ficha"))).toEqual(FICHA_DE_AULA);
    expect(direccionPedida(pedida("consultas", "reemplazos"))).toEqual(d("modelo", "muestra"));
    expect(direccionPedida(pedida("consultas", "brechas"))).toEqual(d("control", "brechas"));
    expect(direccionPedida(pedida("consultas", "parte"))).toEqual(d("control", "partes"));
    expect(direccionPedida(pedida("consultas", "extras"))).toEqual(d("modelo", "muestra", "banco"));
    expect(direccionPedida(pedida("consultas", "refuerzos"))).toEqual(d("control", "brechas", "refuerzos"));
    expect(direccionPedida(pedida("consultas"))).toEqual(FICHA_DE_AULA);
    // Avance: la clave vieja de Metas y Efectividad.
    expect(direccionPedida(pedida("avance", "cuotas"))).toEqual(d("avance", "porfacultad"));
    expect(direccionPedida(pedida("avance", "efectividad"))).toEqual(d("avance", "rendimiento", "efectividad"));
    expect(direccionPedida(pedida("avance", "resumen"))).toEqual(d("avance", "resumen"));
    expect(direccionPedida(pedida("avance", "salidas"))).toEqual(d("avance", "salidas"));
  });

  it("todo alias apunta a una dirección pública que existe", () => {
    const publicas = new Set(direccionesPublicas().map((item) => `${item.seccion}/${item.pestana}/${item.panel ?? ""}`));
    for (const [clave, destino] of Object.entries(aliasDeLectura())) {
      expect(publicas.has(`${destino.seccion}/${destino.pestana}/${destino.panel ?? ""}`), clave).toBe(true);
    }
  });

  it("ningún alias se escribe: toda dirección pública usa las secciones nuevas", () => {
    for (const item of direccionesPublicas()) {
      expect(SECCIONES_AULAS).toContain(item.seccion);
    }
  });

  it("una dirección pública con su sub-vista se respeta; un panel ajeno no la cambia", () => {
    expect(direccionPedida(pedida("control", "calidad", "base"))).toEqual(d("control", "calidad", "base"));
    expect(direccionPedida(pedida("control", "calidad", "reemplazo"))).toEqual(d("control", "calidad"));
    expect(direccionPedida(pedida("control", "no-existe"))).toEqual(d("control", "agenda"));
  });

  it("los enlaces internos que nombran la clave vieja vuelven a la pestaña que la monta", () => {
    expect(direccionDeVista({ seccion: "consultas", pestana: "reemplazos" })).toEqual(d("modelo", "muestra"));
    expect(direccionDeVista({ seccion: "fuentes", pestana: "" })).toEqual(d("insumos", "fuentes"));
    // Agenda › Carga se monta también en Insumos › Aplicadores, pero un enlace
    // a ella va a Distribución, que la opera.
    expect(direccionDeVista({ seccion: "modelo", pestana: "carga" })).toEqual(d("control", "distribucion"));
    // Avance › Metas se monta también en Modelo › Metas; su lectura es Por facultad.
    expect(direccionDeVista({ seccion: "avance", pestana: "cuotas" })).toEqual(d("avance", "porfacultad"));
    expect(direccionDeVista({ seccion: "avance", pestana: "efectividad" })).toEqual(d("avance", "rendimiento", "efectividad"));
    expect(direccionDeVista({ seccion: "avance", pestana: "resumen" })).toEqual(d("avance", "resumen"));
    expect(direccionDeVista({ seccion: "calidad", pestana: "controles" })).toEqual(d("control", "calidad"));
  });

  it("sólo pide moverse cuando la URL dice otra cosa que lo que se ve", () => {
    expect(pideOtraDireccion(pedida("control", "agenda"), d("control", "agenda"))).toBe(false);
    expect(pideOtraDireccion(pedida("modelo", "agenda"), d("control", "agenda"))).toBe(false);
    expect(pideOtraDireccion(pedida("consultas", "reemplazos"), d("control", "agenda"))).toBe(true);
    expect(pideOtraDireccion(pedida(null), d("control", "agenda"))).toBe(false);
  });

  it("los paneles de sub-vista son ASCII y no pisan el panel del reemplazo", () => {
    for (const panel of PANELES_DE_SUBVISTA_AULAS) {
      expect(panel).toMatch(/^[a-z]+$/);
    }
    // El inspector futuro (`panel=aula`) no es todavía una sub-vista.
    expect(PANELES_DE_SUBVISTA_AULAS).not.toContain("aula");
  });

  it("el enlace a la ficha de un curso-horario es la dirección pública", () => {
    const href = hrefDeFichaDeAula("CH 21");
    expect(href).toBe("/monitoreo?modo=aulas&seccion=control&pestana=partes&panel=codigo&foco=aula%3ACH%2021");
    expect(href).not.toContain("seccion=consultas");
  });
});
