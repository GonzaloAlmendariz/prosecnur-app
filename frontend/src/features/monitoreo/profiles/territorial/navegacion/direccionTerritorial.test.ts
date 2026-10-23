import { describe, expect, it } from "vitest";
import { MONITOREO_PESTANAS, MONITOREO_PESTANAS_INTERNAS_TERRITORIAL } from "../../../../../lib/navegacion/catalogos/monitoreo";
import {
  ATERRIZAJE_TERRITORIAL,
  aliasDeLectura,
  direccionDeVista,
  direccionInicial,
  direccionPedida,
  direccionesPublicas,
  esPestanaPropia,
  pestanasDeSeccion,
  pideOtraDireccion,
  SECCIONES_TERRITORIALES,
  subvistasDePestana,
  panelesSuperpuestos,
  vistaDeDireccion,
  vistaQueAbsorbe,
} from "./direccionTerritorial";

const pedida = (seccion: string | null, pestana: string | null = null, panel: string | null = null) => ({ seccion, pestana, panel });

describe("dirección pública del modo territorial", () => {
  it("cada sección pública lleva exactamente las pestañas del catálogo, en su orden", () => {
    for (const seccion of SECCIONES_TERRITORIALES) {
      expect(pestanasDeSeccion(seccion)).toEqual(MONITOREO_PESTANAS.territorial[seccion].map((tab) => tab.key));
    }
  });

  it("declara las 19 pestañas del diseño", () => {
    const total = SECCIONES_TERRITORIALES.reduce((suma, seccion) => suma + pestanasDeSeccion(seccion).length, 0);
    expect(total).toBe(19);
  });

  it("sin dirección aterriza en Avance › Faltante por UMP", () => {
    expect(direccionInicial(pedida(null))).toEqual({ seccion: "avance", pestana: "faltante", panel: null });
    expect(direccionInicial(pedida("avance"))).toEqual(ATERRIZAJE_TERRITORIAL);
  });

  it("toda vista heredada que montaba la página se monta en alguna dirección pública o se lee como alias", () => {
    const internas = Object.entries(MONITOREO_PESTANAS_INTERNAS_TERRITORIAL)
      .flatMap(([seccion, tabs]) => tabs.map((tab) => `${seccion}/${tab.key}`));
    const montadas = new Set(direccionesPublicas().map((item) => {
      const vista = vistaQueAbsorbe(item);
      return `${vista.seccion}/${vista.pestana}`;
    }));
    const alias = aliasDeLectura();
    for (const clave of internas) {
      expect(montadas.has(clave) || clave in alias, clave).toBe(true);
    }
  });

  it("lee los alias de la arquitectura anterior y los lleva a la dirección del diseño", () => {
    expect(direccionPedida(pedida("fuentes", "form"))).toEqual({ seccion: "insumos", pestana: "conexiones", panel: null });
    expect(direccionPedida(pedida("fuentes", "reconciliation"))).toEqual({ seccion: "control", pestana: "conciliacion", panel: null });
    expect(direccionPedida(pedida("modelo", "variables"))).toEqual({ seccion: "insumos", pestana: "mapeo", panel: null });
    expect(direccionPedida(pedida("modelo", "resumen"))).toEqual({ seccion: "avance", pestana: "mapa", panel: null });
    expect(direccionPedida(pedida("modelo", "tabla"))).toEqual({ seccion: "avance", pestana: "umps", panel: null });
    expect(direccionPedida(pedida("calidad", "cuotas"))).toEqual(ATERRIZAJE_TERRITORIAL);
    expect(direccionPedida(pedida("avance", "cuotas"))).toEqual(ATERRIZAJE_TERRITORIAL);
    expect(direccionPedida(pedida("avance", "ump"))).toEqual({ seccion: "avance", pestana: "mapa", panel: null });
    expect(direccionPedida(pedida("avance", "ritmo"))).toEqual({ seccion: "avance", pestana: "resumen", panel: null });
    expect(direccionPedida(pedida("consultas", "gps"))).toEqual({ seccion: "control", pestana: "bandeja", panel: "gps" });
    expect(direccionPedida(pedida("ocurrencias", "alerts"))).toEqual({ seccion: "control", pestana: "reportes", panel: null });
    expect(direccionPedida(pedida("calidad"))).toEqual({ seccion: "control", pestana: "senales", panel: null });
  });

  it("una dirección pública con su sub-vista se respeta", () => {
    expect(direccionPedida(pedida("control", "senales", "duracion"))).toEqual({ seccion: "control", pestana: "senales", panel: "duracion" });
    // Un panel que no es sub-vista de esa pestaña no la cambia.
    expect(direccionPedida(pedida("control", "senales", "ficha"))).toEqual({ seccion: "control", pestana: "senales", panel: null });
  });

  it("los enlaces internos que nombran la clave vieja vuelven a la pestaña que la monta", () => {
    expect(direccionDeVista({ seccion: "calidad", pestana: "duracion" })).toEqual({ seccion: "control", pestana: "senales", panel: "duracion" });
    expect(direccionDeVista({ seccion: "calidad", pestana: "geolocalizacion" })).toEqual({ seccion: "control", pestana: "senales", panel: null });
    // Validación › Cuotas se monta en Modelo › Cuotas, pero un enlace a ella
    // va al faltante, que es lo que la reemplaza.
    expect(direccionDeVista({ seccion: "calidad", pestana: "cuotas" })).toEqual(ATERRIZAJE_TERRITORIAL);
    expect(direccionDeVista({ seccion: "modelo", pestana: "tabla" })).toEqual({ seccion: "modelo", pestana: "metas", panel: "manzanas" });
  });

  it("Faltante por UMP es propia y pide el corte de avance", () => {
    expect(esPestanaPropia(ATERRIZAJE_TERRITORIAL)).toBe(true);
    // `validation_summary` (el corte de Validación) no trae las subsanaciones.
    expect(vistaDeDireccion(ATERRIZAJE_TERRITORIAL).seccion).toBe("avance");
    // Resumen necesita `response_audit` para los motivos de observación.
    expect(vistaDeDireccion({ seccion: "avance", pestana: "resumen", panel: null }).seccion).toBe("calidad");
    expect(esPestanaPropia({ seccion: "avance", pestana: "resumen", panel: "ritmo" })).toBe(false);
    // Avance › UMP es propia, pide el corte de Avance y abre la ficha con `panel=ump`.
    expect(esPestanaPropia({ seccion: "avance", pestana: "umps", panel: null })).toBe(true);
    expect(vistaDeDireccion({ seccion: "avance", pestana: "umps", panel: null }).seccion).toBe("avance");
    expect(panelesSuperpuestos("avance", "umps")).toEqual(["ump"]);
    expect(esPestanaPropia({ seccion: "avance", pestana: "mapa", panel: null })).toBe(true);
    expect(panelesSuperpuestos("avance", "mapa")).toEqual(["ump"]);
    // Control › Calidad: Bandeja, Señales y Equipo propias; sus sub-vistas
    // heredadas (GPS, Duración) siguen montando la vista vieja.
    for (const pestana of ["bandeja", "senales", "equipo"]) {
      expect(esPestanaPropia({ seccion: "control", pestana, panel: null })).toBe(true);
    }
    expect(esPestanaPropia({ seccion: "control", pestana: "senales", panel: "duracion" })).toBe(false);
    expect(panelesSuperpuestos("control", "equipo")).toEqual(["codigo", "anular"]);
    // Control › Correcciones: las tres propias; Conciliación pide el corte de
    // Validación y su sub-vista espacial sigue heredada.
    for (const pestana of ["subsanaciones", "anulaciones", "conciliacion"]) {
      expect(esPestanaPropia({ seccion: "control", pestana, panel: null })).toBe(true);
    }
    expect(vistaDeDireccion({ seccion: "control", pestana: "conciliacion", panel: null }).seccion).toBe("calidad");
    expect(esPestanaPropia({ seccion: "control", pestana: "conciliacion", panel: "espacial" })).toBe(false);
    // Control › Ocurrencias y Reportes UMP propias; sus sub-vistas siguen heredadas.
    expect(esPestanaPropia({ seccion: "control", pestana: "ocurrencias", panel: null })).toBe(true);
    expect(esPestanaPropia({ seccion: "control", pestana: "reportes", panel: null })).toBe(true);
    expect(esPestanaPropia({ seccion: "control", pestana: "reportes", panel: "alertas" })).toBe(false);
  });

  it("lista las sub-vistas sólo cuando hay más de una", () => {
    expect(subvistasDePestana("control", "senales").map((item) => item.panel)).toEqual([null, "duracion"]);
    expect(subvistasDePestana("control", "equipo")).toEqual([]);
  });

  it("no confunde la dirección escrita con una petición nueva", () => {
    const activa = { seccion: "control" as const, pestana: "bandeja", panel: null };
    expect(pideOtraDireccion(pedida("control", "bandeja"), activa)).toBe(false);
    expect(pideOtraDireccion(pedida("consultas", "registro"), activa)).toBe(false);
    expect(pideOtraDireccion(pedida("control", "equipo"), activa)).toBe(true);
    expect(pideOtraDireccion(pedida(null), activa)).toBe(false);
  });
});
