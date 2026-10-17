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
  veredicto: "huella",
  resumen: {
    altas: 2, bajas: 0, campos: 1, roles: 0, unidades_con_cambios: 1, sin_cambio: 2466, claves_repetidas: 0,
    // Las AFECTADAS con ficha (3) no son las fichas listas del plan (12).
    afectadas: { unidades: 3, fichas: 1, unidades_con_ficha: 3, accesos: 3 },
    fichas_cobertura: { juegos: 1, unidades_cubiertas: 12 },
    fichas_total: 1,
    entregado: false,
  },
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

  const alDia = {
    stale: false,
    estado: "al_dia",
    sorteo_vigente: { run_id: "sel_aulas_20260801211224_e3", desfasado: false },
    resumen: { ...RESUMEN.resumen, altas: 0, campos: 0, unidades_con_cambios: 0, afectadas: { unidades: 0, fichas: 0, unidades_con_ficha: 0, accesos: 0 } },
  };

  it("al día: cuántas fichas hay listas, contadas por cobertura y no por afectadas", () => {
    const aviso = avisoMaterialCampo(leer(alDia));
    expect(aviso?.tono).toBe("info");
    expect(aviso?.texto).toBe("Material de campo: 12 fichas listas de este sorteo.");
  });

  it("mismo sorteo con datos distintos: avisa por huella, no calla por sorteo", () => {
    const aviso = avisoMaterialCampo(leer({ sorteo_vigente: { run_id: "sel_aulas_20260801211224_e3", desfasado: false } }));
    expect(aviso?.tono).toBe("warn");
    expect(aviso?.texto).toBe("Material de campo tiene datos distintos de esta selección.");
    expect(aviso?.enlace.label).toBe("Revisar diferencias");
    expect(aviso?.texto).not.toMatch(/fichas listas/);
  });

  it("otro sorteo con la misma huella: al día, y dice que el sorteo es otro", () => {
    const aviso = avisoMaterialCampo(leer({ ...alDia, solo_corrida: true, sorteo_vigente: { run_id: "sel_aulas_20260821160928_bf", desfasado: true } }));
    expect(aviso?.tono).toBe("info");
    expect(aviso?.texto).toBe("Material de campo: 12 fichas listas; su plan es de otro sorteo con las mismas unidades.");
  });

  it("selección sin terminar: un plan desfasado se avisa igual; lo al día no se celebra", () => {
    expect(avisoMaterialCampo(leer(), false)?.tono).toBe("warn");
    const sinFuente = leer({ estado: "sin_fuente", stale: false, veredicto: null, fingerprint_actual: null, fuente: { ...RESUMEN.fuente, disponible: false, unidades: 0 } });
    expect(avisoMaterialCampo(sinFuente, false)?.texto).toBe(
      `Material de campo tiene un plan del sorteo del 1/8 (${(2468).toLocaleString("es-PE")} unidades); esta selección es del 21/8.`,
    );
    expect(avisoMaterialCampo(leer(alDia), false)).toBeNull();
  });

  it("sin fuente por error: lo dice con su causa; sin fuente sin más, calla", () => {
    const base = { estado: "sin_fuente", stale: false, sorteo_vigente: { run_id: "", desfasado: false } };
    const conError = leer({ ...base, fuente: { ...RESUMEN.fuente, disponible: false, error_id: "err_9f3a" } });
    expect(conError.fuente.error_id).toBe("err_9f3a");
    expect(avisoMaterialCampo(conError)?.texto).toMatch(/^No se pudo comparar el plan de Material de campo/);
    expect(avisoMaterialCampo(leer({ ...base, fuente: { ...RESUMEN.fuente, disponible: false } }))).toBeNull();
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
