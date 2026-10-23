import { describe, expect, it } from "vitest";
import { MONITOREO_PESTANAS } from "../../../../../lib/navegacion/catalogos/monitoreo";
import {
  ATERRIZAJE_TELEFONICO,
  PANELES_DE_SUBVISTA,
  SECCIONES_TELEFONICAS,
  direccionDeVista,
  pestanasDeSeccion,
  pideOtraVista,
  subvistasDePestana,
  vistaInicial,
  vistaPedida,
} from "./direccionTelefonica";
import { pestanasDelRail } from "./modeloDelRail";

const pedida = (seccion: string | null, pestana: string | null = null, panel: string | null = null) => ({ seccion, pestana, panel });

describe("dirección pública del telefónico", () => {
  it("aterriza en Avance › Cuotas cuando la URL no pide nada", () => {
    expect(vistaInicial(pedida(null))).toEqual(ATERRIZAJE_TELEFONICO);
    expect(direccionDeVista(ATERRIZAJE_TELEFONICO)).toEqual({ seccion: "avance", pestana: "cuotas", panel: null });
  });

  it("la tabla cubre exactamente el catálogo público, en su orden", () => {
    for (const seccion of SECCIONES_TELEFONICAS) {
      expect(pestanasDeSeccion(seccion)).toEqual(MONITOREO_PESTANAS.telefonico[seccion].map((tab) => tab.key));
    }
  });

  it("ida y vuelta: cada dirección pública monta una vista y vuelve a la misma dirección", () => {
    for (const seccion of SECCIONES_TELEFONICAS) {
      for (const pestana of pestanasDeSeccion(seccion)) {
        const paneles = [null, ...subvistasDePestana(seccion, pestana).map((item) => item.panel).filter(Boolean)];
        for (const panel of paneles) {
          const vista = vistaPedida(pedida(seccion, pestana, panel));
          expect(vista, `${seccion}/${pestana}/${panel}`).not.toBeNull();
          expect(direccionDeVista(vista!)).toEqual({ seccion, pestana, panel });
        }
      }
    }
  });

  it("lee las direcciones viejas como alias y devuelve la forma pública", () => {
    const casos: Array<[ReturnType<typeof pedida>, string]> = [
      [pedida("telefonico", "incidencia"), "control/insistencia"],
      [pedida("telefonico", "tiempos"), "control/respuestas/tiempos"],
      [pedida("consultas", "cruces"), "control/discrepancias"],
      [pedida("consultas", "subsanacion"), "control/respuestas/salvedades"],
      [pedida("fuentes", "sheets"), "insumos/estados"],
      [pedida("fuentes", "collectors"), "insumos/llave"],
      [pedida("modelo", "estrategias"), "modelo/cuotas/calendario"],
      [pedida("avance", "actores"), "avance/cuotas"],
      [pedida("avance", "resumen"), "avance/ritmo"],
      [pedida("avance", "salidas"), "avance/entregas"],
      [pedida("telefonico"), "control/barrido"],
      [pedida("consultas"), "control/respuestas"],
      [pedida("control", "incidencia"), "control/insistencia"],
    ];
    for (const [entrada, esperada] of casos) {
      const vista = vistaPedida(entrada);
      const direccion = direccionDeVista(vista!);
      expect([direccion.seccion, direccion.pestana, direccion.panel].filter(Boolean).join("/"), JSON.stringify(entrada)).toBe(esperada);
    }
  });

  it("una sección pública sin pestaña abre su primera pestaña", () => {
    expect(direccionDeVista(vistaPedida(pedida("control"))!).pestana).toBe("barrido");
    expect(direccionDeVista(vistaPedida(pedida("insumos"))!).pestana).toBe("fuentes");
  });

  it("un panel desconocido no cambia de vista", () => {
    expect(direccionDeVista(vistaPedida(pedida("control", "respuestas", "filtros"))!).panel).toBeNull();
  });

  it("sólo pide otra vista cuando la dirección pide algo distinto de lo que se ve", () => {
    expect(pideOtraVista(pedida(null), ATERRIZAJE_TELEFONICO)).toBe(false);
    expect(pideOtraVista(pedida("avance", "cuotas"), ATERRIZAJE_TELEFONICO)).toBe(false);
    expect(pideOtraVista(pedida("avance", "actores"), ATERRIZAJE_TELEFONICO)).toBe(false);
    expect(pideOtraVista(pedida("control", "barrido"), ATERRIZAJE_TELEFONICO)).toBe(true);
  });

  it("los paneles de sub-vista son ids estables", () => {
    expect(PANELES_DE_SUBVISTA).toEqual(["calendario", "tiempos", "salvedades"]);
  });

  it("el rail toma nombre del catálogo público y la insignia de la vista que monta", () => {
    const rail = pestanasDelRail("control", (seccion) => (seccion === "telefonico"
      ? [{ key: "incidencia", label: "Sin efectiva", detail: "x", icon: MONITOREO_PESTANAS.telefonico.control[0].icon, badge: "324", estado: "parcial" }]
      : []));
    expect(rail.map((tab) => tab.key)).toEqual(["barrido", "insistencia", "equipo", "discrepancias", "respuestas", "avisos"]);
    const insistencia = rail.find((tab) => tab.key === "insistencia");
    expect(insistencia?.label).toBe("Insistencia");
    expect(insistencia?.badge).toBe("324");
  });
});
