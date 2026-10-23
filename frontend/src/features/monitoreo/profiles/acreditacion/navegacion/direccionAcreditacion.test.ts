import { describe, expect, it } from "vitest";
import { MONITOREO_PESTANAS } from "../../../../../lib/navegacion/catalogos/monitoreo";
import {
  direccionDeVista,
  pestanasDeSeccion,
  SECCIONES_ACREDITACION,
  vistaDeSeccion,
  vistaInicial,
  vistaPedida,
} from "./direccionAcreditacion";
import { antetituloDePestana, disponibilidad, pestanasDelRail } from "./modeloDelRail";
import { readinessDeAcreditacion } from "./useNavegacionAcreditacion";

const pedida = (seccion: string | null, pestana: string | null = null, panel: string | null = null) => ({ seccion, pestana, panel });

describe("dirección pública de Acreditación", () => {
  it("la tabla cubre exactamente las 20 pestañas del catálogo, en su orden", () => {
    for (const seccion of SECCIONES_ACREDITACION) {
      expect(pestanasDeSeccion(seccion)).toEqual(MONITOREO_PESTANAS.acreditacion[seccion].map((tab) => tab.key));
    }
    const total = SECCIONES_ACREDITACION.reduce((suma, seccion) => suma + pestanasDeSeccion(seccion).length, 0);
    expect(total).toBe(20);
  });

  it("sin dirección aterriza en Avance › Por público (D2)", () => {
    const vista = vistaInicial(pedida(null));
    expect(direccionDeVista(vista)).toEqual({ seccion: "avance", pestana: "publicos", panel: null });
  });

  it("lee las direcciones viejas como alias y las publica con la forma nueva", () => {
    const casos: Array<[ReturnType<typeof pedida>, string]> = [
      [pedida("consultas", "subsanacion"), "control/resolver"],
      [pedida("consultas", "plataforma"), "control/respuestas"],
      [pedida("consultas", "base"), "control/personas"],
      [pedida("telefonico", "incidencia"), "control/reintentos"],
      [pedida("telefonico", "estados"), "insumos/reglas"],
      [pedida("fuentes", "collectors"), "insumos/fuentes"],
      [pedida("fuentes", "survey"), "insumos/fuentes"],
      [pedida("fuentes", "actores"), "insumos/publicos"],
      [pedida("modelo", "estructura"), "modelo/metas"],
      [pedida("modelo", "distribucion"), "modelo/cuotas"],
      [pedida("avance", "actores"), "avance/publicos"],
      [pedida("avance", "encuestas"), "avance/ritmo"],
      [pedida("avance", "correo"), "control/correo"],
      [pedida("consultas"), "control/resolver"],
    ];
    for (const [entrada, esperada] of casos) {
      const vista = vistaPedida(entrada);
      expect(vista, JSON.stringify(entrada)).not.toBeNull();
      const publica = direccionDeVista(vista!);
      expect(`${publica.seccion}/${publica.pestana}`, JSON.stringify(entrada)).toBe(esperada);
    }
  });

  it("las sub-vistas se piden con `panel`", () => {
    expect(vistaPedida(pedida("control", "barrido", "ritmo"))).toEqual({ seccion: "telefonico", pestana: "dia" });
    expect(vistaPedida(pedida("insumos", "fuentes", "recopiladores"))).toEqual({ seccion: "fuentes", pestana: "recopiladores" });
    expect(direccionDeVista({ seccion: "avance", pestana: "detalle" })).toEqual({ seccion: "avance", pestana: "cuotas", panel: "detalle" });
  });

  it("una pestaña condicional que el estudio no tiene cede a la primera de Casos", () => {
    const sinContacto = disponibilidad({ correo: false, barrido: false });
    expect(direccionDeVista(vistaPedida(pedida("control", "correo"), sinContacto)!).pestana).toBe("resolver");
    expect(direccionDeVista(vistaDeSeccion("control", sinContacto)).pestana).toBe("resolver");
    const conBarrido = disponibilidad({ correo: false, barrido: true });
    expect(direccionDeVista(vistaDeSeccion("control", conBarrido)).pestana).toBe("barrido");
    // Mientras no se sabe, la pestaña se ofrece.
    const sinSaber = disponibilidad({ correo: null, barrido: null });
    expect(direccionDeVista(vistaDeSeccion("control", sinSaber)).pestana).toBe("correo");
  });

  it("el rail de Control dice el grupo y deja fuera lo que el estudio no declara", () => {
    const rail = pestanasDelRail("control", () => [], disponibilidad({ correo: true, barrido: false }));
    expect(rail.map((tab) => tab.key)).toEqual(["correo", "resolver", "cruce", "calidad", "personas", "respuestas"]);
    expect(rail[0].label).toBe("Contacto · Correo");
    expect(rail[1].label).toBe("Casos · Por resolver");
    expect(antetituloDePestana("control", "resolver")).toBe("Control · Casos");
    expect(antetituloDePestana("avance", "publicos")).toBe("Avance");
  });

  it("la readiness nombra la pestaña pública (G5)", () => {
    expect(readinessDeAcreditacion("consultas", "subsanacion")).toBe("monitoreo-acreditacion-control-resolver");
    expect(readinessDeAcreditacion("avance", "actores")).toBe("monitoreo-acreditacion-avance-publicos");
  });
});
