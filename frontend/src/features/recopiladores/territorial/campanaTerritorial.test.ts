import { describe, expect, it } from "vitest";

import { normalizarCampana, normalizarRegistroDeCampanas, type RegistroDeCampanas } from "../../../api/materialCampanas";
import { REGISTRO_CRUDO } from "../../../api/materialCampanas.fixture";
import { accionesDeCampana } from "../campanas/accionesDeCampana";
import { hrefDeCampana } from "../campanas/direccionDeCampanas";
import { ponerEnRegistro, resumenDeTarjeta } from "../campanas/modeloRegistro";
import { resolverVistaDeCampanas, type EntradaDeCampanas } from "../campanas/redirecciones";
import { resolverSeccionTerritorial } from "./navegacionTerritorial";

const CRUDA = {
  id: "territorial.principal",
  tipo: "territorial",
  name: "UMP Lima",
  archived: false,
  persisted: true,
  ref: { store: "hojas_ruta_envio", fase: "pilot" },
  estado: { titulares: [2], reemplazos: 1, stale: false, enviado_at: "2026-10-29T14:00:00Z" },
};
const TERRITORIAL = normalizarCampana(CRUDA)!;
const BASE = normalizarRegistroDeCampanas(REGISTRO_CRUDO);
const CON_TERRITORIAL: RegistroDeCampanas = { ...BASE, campaigns: [...BASE.campaigns, TERRITORIAL] };

function ir(entrada: EntradaDeCampanas, registro: RegistroDeCampanas = CON_TERRITORIAL) {
  const r = resolverVistaDeCampanas(entrada, registro);
  return { vista: r.vista.vista, modo: r.vista.vista === "campana" ? r.vista.modo : null, reescribir: r.reescribir };
}

describe("la campaña territorial (ADR 0118)", () => {
  it("normaliza su estado con la fase del ref", () => {
    expect(TERRITORIAL.estado).toEqual({ tipo: "territorial", titulares: 2, reemplazos: 1, stale: false, enviado_at: "2026-10-29T14:00:00Z", fase: "pilot" });
  });

  it("abre en Unidades › Lista y canoniza sección y pestaña", () => {
    expect(hrefDeCampana(TERRITORIAL)).toBe("/material-campo?modo=territorial&campana=territorial.principal&seccion=unidades&pestana=lista");
    expect(ir({ modo: "territorial", campana: "territorial.principal", seccion: "unidades", pestana: "lista", foco: "150101", panel: "hoja" })).toEqual({
      vista: "campana", modo: "territorial", reescribir: null,
    });
    expect(ir({ campana: "territorial.principal", seccion: "catalogo" }).reescribir).toEqual({
      modo: "territorial", campana: "territorial.principal", seccion: "catalogo", pestana: "fichas",
    });
    expect(ir({ modo: "territorial", seccion: "accesos" }).reescribir).toEqual({
      modo: "territorial", campana: "territorial.principal", seccion: "unidades", pestana: "lista",
    });
    expect(resolverSeccionTerritorial("entrega", "traspaso")).toEqual({ seccion: "entrega", pestana: "plan" });
  });

  it("archivada no se abre", () => {
    const archivada = { ...CON_TERRITORIAL, campaigns: CON_TERRITORIAL.campaigns.map((c) => (c.tipo === "territorial" ? { ...c, archived: true } : c)) };
    expect(ir({ modo: "territorial", campana: "territorial.principal" }, archivada).vista).toBe("lista");
  });

  it("la tarjeta dice titulares, reemplazos, fecha y si está desactualizada", () => {
    const r = resumenDeTarjeta(TERRITORIAL);
    expect(r.estado).toBe("Muestra recibida");
    expect(r.cifras).toEqual([{ valor: 2, rotulo: "titulares" }, { valor: 1, rotulo: "reemplazos" }]);
    expect(r.hechos[0]).toBe("Piloto, enviada el 29/10");
    const vieja = normalizarCampana({ ...CRUDA, estado: { ...CRUDA.estado, stale: true } })!;
    expect(resumenDeTarjeta(vieja)).toMatchObject({ estado: "Desactualizada", tono: "aviso" });
    const sinFoto = normalizarCampana({ ...CRUDA, estado: { titulares: 0, reemplazos: 0, stale: true, enviado_at: null } })!;
    expect(resumenDeTarjeta(sinFoto)).toMatchObject({ estado: "Sin muestra enviada", cifras: [] });
  });

  it("se renombra y archiva como la de aulas, y crearla agota el tipo", () => {
    expect(accionesDeCampana(TERRITORIAL, { fuente: "registro", correos: 0 }).map((a) => a.id)).toEqual(["renombrar", "archivar"]);
    const conTipo: RegistroDeCampanas = { ...BASE, tipos: BASE.tipos.map((t) => (t.tipo === "territorial" ? { ...t, disponible: true, motivo: null } : t)) };
    const despues = ponerEnRegistro(conTipo, TERRITORIAL, 3);
    expect(despues.tipos.find((t) => t.tipo === "territorial")).toMatchObject({ disponible: false, motivo: "El proyecto ya tiene su campaña territorial." });
  });
});
