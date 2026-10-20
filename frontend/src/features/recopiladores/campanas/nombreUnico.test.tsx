import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { motivoSinCodigo } from "../../../api/materialCampanas";
import { AvisoDeNombreRepetido } from "./AvisoDeNombreRepetido";
import { destinoDeRetorno, selectorDeRetorno } from "./focoDeRetorno";
import { avisoDeHomonima, campanaHomonima, claveDeNombre, rotuloDelMenu, subtituloDeCampana } from "./nombreUnico";

const CAMPANAS = [
  { id: "aulas.principal", name: "Campo en aulas" },
  { id: "correo.encuesta-de-reacreditacion", name: "Encuesta de Reacreditación" },
  { id: "correo.vieja", name: "Invitación 2025", archived: true },
];

describe("el nombre de una campaña no se repite (F1)", () => {
  it("mayúsculas, tildes y espacios no distinguen dos nombres", () => {
    expect(claveDeNombre("  Encuesta  de Reacreditación ")).toBe("encuesta de reacreditacion");
    expect(campanaHomonima("encuesta de reacreditacion", CAMPANAS)?.id).toBe("correo.encuesta-de-reacreditacion");
    expect(campanaHomonima("ENCUESTA DE REACREDITACIÓN", CAMPANAS)?.id).toBe("correo.encuesta-de-reacreditacion");
    expect(campanaHomonima("Encuesta de Reacreditación Contabilidad", CAMPANAS)).toBeNull();
    expect(campanaHomonima("   ", CAMPANAS)).toBeNull();
  });

  it("al renombrar, el nombre propio no choca consigo mismo", () => {
    expect(campanaHomonima("Encuesta de Reacreditación", CAMPANAS, "correo.encuesta-de-reacreditacion")).toBeNull();
    expect(campanaHomonima("Campo en aulas", CAMPANAS, "correo.encuesta-de-reacreditacion")?.id).toBe("aulas.principal");
  });

  it("el aviso ofrece abrirla; una archivada sólo pide otro nombre", () => {
    expect(avisoDeHomonima(CAMPANAS[1])).toEqual({ texto: "Ya existe una campaña con este nombre", accion: "Ábrela o usa otro nombre" });
    expect(avisoDeHomonima(CAMPANAS[2]).accion).toBeNull();
    const html = renderToStaticMarkup(
      <MemoryRouter><AvisoDeNombreRepetido id="x" campana={CAMPANAS[1]} href="/material-campo?modo=correo" /></MemoryRouter>,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Ya existe una campaña con este nombre");
    expect(html).toMatch(/<a [^>]*href="\/material-campo\?modo=correo"[^>]*>Ábrela<\/a> o usa otro nombre/);
  });

  it("el subtítulo distingue: el actor, o si no el asunto; nunca repite el nombre", () => {
    expect(subtituloDeCampana({ name: "Encuesta", actor: "Docentes" }, "Asunto")).toBe("Docentes");
    expect(subtituloDeCampana({ name: "Encuesta de Reacreditación", actor: "" }, "Encuesta de reacreditación de Contabilidad"))
      .toBe("Encuesta de reacreditación de Contabilidad");
    expect(subtituloDeCampana({ name: "Encuesta", actor: "" }, " encuesta ")).toBe("");
    expect(subtituloDeCampana({ name: "Encuesta", actor: "" })).toBe("");
    expect(rotuloDelMenu({ name: "Encuesta" }, "Docentes")).toBe("Acciones de Encuesta · Docentes");
    expect(rotuloDelMenu({ name: "Encuesta" }, "")).toBe("Acciones de Encuesta");
  });

  it("el motivo de un tipo no disponible sale sin la referencia interna (F16)", () => {
    expect(motivoSinCodigo("Requiere leer las UMP de Hojas de ruta (E2)")).toBe("Requiere leer las UMP de Hojas de ruta");
    expect(motivoSinCodigo("Ya existe (C1, E2)")).toBe("Ya existe");
    expect(motivoSinCodigo("Sin código (todavía)")).toBe("Sin código (todavía)");
    expect(motivoSinCodigo(null)).toBeNull();
  });
});

describe("al cerrar un diálogo el foco vuelve a quien lo abrió (F10)", () => {
  type Falso = { isConnected: boolean; disabled?: boolean; focus: () => void; nombre: string };
  const el = (nombre: string, isConnected = true): Falso => ({ nombre, isConnected, focus: () => undefined });
  const doc = (mapa: Record<string, Falso>) => ({
    body: el("body") as unknown as HTMLElement,
    querySelector: (sel: string) => (mapa[sel] ?? null) as unknown as Element | null,
  });

  it("el disparador recordado, si sigue montado", () => {
    const boton = el("Nueva campaña");
    const out = destinoDeRetorno(doc({}), { el: boton as unknown as Element, clave: null }, []);
    expect((out as unknown as Falso).nombre).toBe("Nueva campaña");
  });

  it("si se volvió a montar, el que lleva su misma marca; si no, el primer respaldo que exista", () => {
    const nuevo = el("Nueva campaña (otra vez)");
    const viejo = el("viejo", false) as unknown as Element;
    const conMarca = destinoDeRetorno(doc({ [selectorDeRetorno("nueva-campana")]: nuevo }), { el: viejo, clave: "nueva-campana" }, []);
    expect((conMarca as unknown as Falso).nombre).toBe("Nueva campaña (otra vez)");
    const menu = el("⋯ de la campaña");
    const respaldo = destinoDeRetorno(doc({ '[data-retorno="menu-correo.x"]': menu }), { el: viejo, clave: null }, ['[data-retorno="nada"]', '[data-retorno="menu-correo.x"]']);
    expect((respaldo as unknown as Falso).nombre).toBe("⋯ de la campaña");
    expect(destinoDeRetorno(doc({}), { el: viejo, clave: null }, ['[data-retorno="nada"]'])).toBeNull();
  });
});
