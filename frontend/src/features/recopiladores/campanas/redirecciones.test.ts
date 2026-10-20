import { describe, expect, it } from "vitest";

import { normalizarRegistroDeCampanas, type RegistroDeCampanas } from "../../../api/materialCampanas";
import { REGISTRO_CRUDO, REGISTRO_VACIO_CRUDO } from "../../../api/materialCampanas.fixture";
import { resolverVistaDeCampanas, type EntradaDeCampanas } from "./redirecciones";

const CON_LAS_DOS = normalizarRegistroDeCampanas(REGISTRO_CRUDO);
const VACIO = normalizarRegistroDeCampanas(REGISTRO_VACIO_CRUDO);

function conCorreos(...ids: string[]): RegistroDeCampanas {
  return {
    ...CON_LAS_DOS,
    campaigns: [
      CON_LAS_DOS.campaigns[0],
      ...ids.map((id) => ({ ...CON_LAS_DOS.campaigns[1], id: `correo.${id}`, ref: id, name: id })),
    ],
  };
}

function ir(entrada: EntradaDeCampanas, registro: RegistroDeCampanas = CON_LAS_DOS) {
  const r = resolverVistaDeCampanas(entrada, registro);
  return { vista: r.vista.vista, campana: r.vista.vista === "campana" ? r.vista.campana.id : null, reescribir: r.reescribir };
}

describe("la dirección de Material de campo (ADR 0111 §Redirecciones)", () => {
  it("`/material-campo` es la lista de campañas", () => {
    expect(ir({})).toEqual({ vista: "lista", campana: null, reescribir: null });
    expect(ir({}, VACIO)).toEqual({ vista: "lista", campana: null, reescribir: null });
  });

  it("una campaña canónica abre sin reescribir nada", () => {
    expect(ir({ modo: "aulas", campana: "aulas.principal", seccion: "unidades", pestana: "lista" }).reescribir).toBeNull();
    expect(ir({ modo: "correo", campana: "correo.egresados", seccion: "correo", pestana: "editor", foco: "saludo" })).toEqual({
      vista: "campana", campana: "correo.egresados", reescribir: null,
    });
  });

  it("si `campana` y `modo` discrepan, manda la campaña", () => {
    expect(ir({ modo: "correo", campana: "aulas.principal", seccion: "accesos" })).toEqual({
      vista: "campana",
      campana: "aulas.principal",
      reescribir: { modo: "aulas", campana: "aulas.principal", seccion: "accesos" },
    });
    expect(ir({ modo: "aulas", campana: "correo.egresados", seccion: "unidades" }).reescribir).toEqual({
      modo: "correo", campana: "correo.egresados", seccion: "correo", pestana: "editor",
    });
  });

  it("una sección de aulas sin campaña abre la campaña de aulas; sin ella, la lista", () => {
    expect(ir({ seccion: "accesos", pestana: "vinculacion" })).toEqual({
      vista: "campana",
      campana: "aulas.principal",
      reescribir: { modo: "aulas", campana: "aulas.principal", seccion: "accesos", pestana: "vinculacion" },
    });
    // Un alias viejo también: la sección la canoniza el shell de aulas.
    expect(ir({ seccion: "materiales", pestana: "vista" }).campana).toBe("aulas.principal");
    expect(ir({ seccion: "unidades", panel: "rehacer-plan" }).reescribir).toEqual({
      modo: "aulas", campana: "aulas.principal", seccion: "unidades", panel: "rehacer-plan",
    });
    expect(ir({ seccion: "unidades" }, VACIO)).toEqual({ vista: "lista", campana: null, reescribir: {} });
  });

  it("`?modo=aulas` sin campaña: la única de ese tipo; si no hay, la lista", () => {
    expect(ir({ modo: "aulas", seccion: "catalogo", pestana: "editor" }).reescribir).toEqual({
      modo: "aulas", campana: "aulas.principal", seccion: "catalogo", pestana: "editor",
    });
    expect(ir({ modo: "aulas" }, VACIO).vista).toBe("lista");
  });

  it("Catálogo › Correos con foco va a la campaña de correo y el bloque queda como foco", () => {
    expect(ir({ seccion: "catalogo", pestana: "correos", foco: "egresados~saludo" })).toEqual({
      vista: "campana",
      campana: "correo.egresados",
      reescribir: { modo: "correo", campana: "correo.egresados", seccion: "correo", pestana: "editor", foco: "saludo" },
    });
    expect(ir({ seccion: "catalogo", pestana: "correos", foco: "egresados", panel: "correo-envios" }).reescribir).toEqual({
      modo: "correo", campana: "correo.egresados", seccion: "correo", pestana: "editor", panel: "correo-envios",
    });
    // Si la campaña del foco no existe, la lista.
    expect(ir({ seccion: "catalogo", pestana: "correos", foco: "borrada~saludo" })).toEqual({ vista: "lista", campana: null, reescribir: {} });
  });

  it("Catálogo › Correos sin foco: la única campaña de correo; con cero o varias, la lista", () => {
    expect(ir({ seccion: "catalogo", pestana: "correos" }).campana).toBe("correo.egresados");
    expect(ir({ seccion: "catalogo", pestana: "correos" }, conCorreos("a", "b")).vista).toBe("lista");
    expect(ir({ seccion: "catalogo", pestana: "correos" }, VACIO).vista).toBe("lista");
    // Los alias a mano siguen llegando: `?pestana=mailchimp`.
    expect(ir({ pestana: "mailchimp" }).campana).toBe("correo.egresados");
  });

  it("`?modo=correo` sin campaña: la única; con varias, la lista", () => {
    expect(ir({ modo: "correo" }).campana).toBe("correo.egresados");
    expect(ir({ modo: "correo" }, conCorreos("a", "b")).vista).toBe("lista");
  });

  it("`?panel=correo-campanas` es la lista con «Nueva campaña» abierto", () => {
    expect(ir({ seccion: "catalogo", pestana: "correos", panel: "correo-campanas" })).toEqual({
      vista: "lista", campana: null, reescribir: { panel: "nueva-campana" },
    });
  });

  it("una campaña inexistente o archivada vuelve a la lista sin rastro", () => {
    expect(ir({ modo: "correo", campana: "correo.borrada", seccion: "correo" })).toEqual({ vista: "lista", campana: null, reescribir: {} });
    const archivada: RegistroDeCampanas = {
      ...CON_LAS_DOS,
      campaigns: CON_LAS_DOS.campaigns.map((c) => (c.tipo === "aulas" ? { ...c, archived: true } : c)),
    };
    expect(ir({ modo: "aulas", campana: "aulas.principal" }, archivada).vista).toBe("lista");
    // Y la sección de aulas sin campaña tampoco la reabre: está archivada.
    expect(ir({ seccion: "unidades" }, archivada).vista).toBe("lista");
  });

  it("la campaña de aulas que aún no existe se abre si el tipo está disponible", () => {
    expect(ir({ modo: "aulas", campana: "aulas.principal", seccion: "unidades" }, VACIO)).toEqual({
      vista: "campana", campana: "aulas.principal", reescribir: null,
    });
  });

  it("la lista conserva sólo sus paneles", () => {
    expect(ir({ panel: "nueva-campana" }).reescribir).toBeNull();
    expect(ir({ panel: "campana-renombrar", foco: "correo.egresados" }).reescribir).toBeNull();
    expect(ir({ panel: "correo-identidad" }).reescribir).toEqual({});
    expect(ir({ seccion: "campanas" }).reescribir).toEqual({});
    expect(ir({ modo: "territorial" }).vista).toBe("lista");
  });
});
