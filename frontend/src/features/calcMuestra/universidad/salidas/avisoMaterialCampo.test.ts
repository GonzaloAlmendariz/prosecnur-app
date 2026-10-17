/**
 * Entrega › Pase a Monitoreo dice qué tiene Material de campo (E1e).
 *
 * Lee sólo `GET /origen?nivel=resumen`; sin plan no dice nada.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { normalizeCollectionOrigen } from "../../../../api/recopiladores";
import { avisoMaterialCampo } from "./avisoMaterialCampo";

const RESUMEN = {
  ok: true,
  schema: "collection_origen/v1",
  nivel: "resumen",
  state_revision: 7,
  adapter: "aulas_v1",
  fuente: { modulo: "calc-muestra", origen: "calc_muestra_aulas_selection", disponible: true, run_id: "sel_aulas_20260821160928_bf", unidades: 2616 },
  plan: { existe: true, run_id: "sel_aulas_20260801211224_e3", unidades: 2468, huella_registrada: "sha256:x" },
  fingerprint_actual: null,
  fingerprint_plan: "sha256:x",
  sorteo_vigente: { run_id: "sel_aulas_20260821160928_bf", desfasado: true },
  fuente_intermedia_desfasada: false,
  estado: "cambio",
  stale: true,
  solo_corrida: false,
  resumen: { afectadas: { unidades: null, fichas: 1, unidades_con_ficha: 12, accesos: 12 }, entregado: false },
  cambios: null,
  truncado: {},
  limite: 200,
};

const leer = (cambios: Record<string, unknown> = {}) => normalizeCollectionOrigen({ ...RESUMEN, ...cambios });

describe("aviso de Material de campo en Cálculo de muestra", () => {
  it("desfasado: las dos fechas, las unidades del plan y el enlace a Origen", () => {
    const aviso = avisoMaterialCampo(leer());
    expect(aviso?.tono).toBe("warn");
    expect(aviso?.texto).toBe(
      `Material de campo tiene un plan del sorteo del 1/8 (${(2468).toLocaleString("es-PE")} unidades); esta selección es del 21/8.`,
    );
    expect(aviso?.enlace).toEqual({ label: "Revisar diferencias", to: "/material-campo?seccion=unidades&pestana=origen" });
  });

  it("al día: cuántas fichas hay listas", () => {
    const aviso = avisoMaterialCampo(leer({ stale: false, estado: "al_dia", sorteo_vigente: { run_id: "sel_aulas_20260801211224_e3", desfasado: false } }));
    expect(aviso?.tono).toBe("info");
    expect(aviso?.texto).toBe("Material de campo: 12 fichas listas de este sorteo.");
  });

  it("sin plan no dice nada", () => {
    expect(avisoMaterialCampo(leer({ estado: "sin_plan", plan: { existe: false } }))).toBeNull();
    expect(avisoMaterialCampo(null)).toBeNull();
  });

  it("lee sólo el resumen del origen, nunca el estado del otro módulo", () => {
    const aqui = path.dirname(fileURLToPath(import.meta.url));
    const fuente = fs.readFileSync(path.join(aqui, "avisoMaterialCampo.ts"), "utf8");
    expect(fuente).toContain('apiRecopiladoresOrigen("resumen")');
    expect(fuente).not.toMatch(/apiRecopiladoresState|\/api\/recopiladores\/state/);
  });
});
