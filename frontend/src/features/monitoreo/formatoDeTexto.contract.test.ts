import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **P3, P4 y P8 de la pasada de formato de Monitoreo: frases, cifras y metadatos.**
 *
 * - P3: Monitoreo cosía datos con « · » en ~963 líneas de código (sin contar
 *   comentarios): «P884 · Norma Flores Bustamante», «En la fase · 4 antes»,
 *   `join(" · ")`. Una lista se une con coma o con «y» (`lib/enumerar`); la
 *   jerarquía de una dirección, con « › ». Quedan los que LEEN el punto medio de
 *   un dato del backend o del Sheets (un `split`, una regex, el nombre de
 *   responsable que llega partido) y el que marca una celda vacía.
 * - P4: una cifra visible pasa por `lib/formatoNumero` (`formatoConteo`,
 *   `formatoDecimal`, `formatoConteoDe`). Quedan las fechas (`dateStyle`), los
 *   formateadores base de cada perfil, los decimales fijos que el formateador
 *   compartido no ofrece y los `.length` que cuentan cosas que no pasan de 999.
 * - P8: la meta no va en monoespaciada; un `<code>` vuelve sólo si muestra código.
 *
 * Ratchet por archivo al 3 nov 2026: sólo baja. `<code>` con meta 0.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" || e.name === "fixtures" ? [] : archivos(completo);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

const rel = (f: string) => path.relative(aqui, f).split(path.sep).join("/");

/** Líneas de código, sin comentarios de bloque ni de línea. */
function lineas(fuente: string): string[] {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .split("\n")
    .map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/ .*$/, ""));
}

const PUNTO = (l: string) => (l.includes("·") ? 1 : 0);
const TO_LOCALE = (l: string) => l.match(/toLocaleString\(/g)?.length ?? 0;
const LENGTH_CRUDO = (l: string) => l.match(/[{$]\{?[\w.?![\]]+\.length\}/g)?.length ?? 0;
const CODE = (l: string) => l.match(/<code\b/g)?.length ?? 0;

const SNAPSHOT_PUNTO: Record<string, number> = {
  "core/acreditacionSources.ts": 2,
  "fieldOccurrences.ts": 1,
  "profiles/acreditacion/AcreditacionMonitoreoPage.tsx": 2,
  "profiles/acreditacion/avance/Ritmo.tsx": 1,
  "profiles/acreditacion/insumos/publicosModelo.ts": 1,
  "profiles/aulas/AulasAgendadasDeLaFila.tsx": 1,
  "profiles/aulas/AulasMetasBarras.tsx": 1,
  "profiles/aulas/AulasSexoPorFacultadChart.tsx": 1,
  "profiles/aulas/cargaDeCampo.ts": 2,
  "profiles/aulas/croquisDeCampus.ts": 1,
  "profiles/aulas/estados/AvisoDeLecturaFallida.tsx": 2,
  "profiles/aulas/registroPorFacultad.ts": 1,
  "profiles/aulas/sistemaPabellon.ts": 1,
  "profiles/telefonico/TelefonicoMonitoreoPage.tsx": 2,
  "profiles/telefonico/control/rondasModel.ts": 1,
  "profiles/territorial/TerritorialProductionAnnulmentWorkspace.tsx": 1,
  "profiles/territorial/TerritorialQuotaConsistencyPanel.tsx": 3,
  "profiles/territorial/TerritorialSourceConsole.tsx": 1,
  "profiles/territorial/avance/faltanteModel.ts": 1,
  "profiles/territorial/control/equipoModel.ts": 2,
  "profiles/territorial/rotulos.ts": 1,
  "public/MonitoreoPublicReportPage.tsx": 2,
};

const SNAPSHOT_TO_LOCALE: Record<string, number> = {
  "core/colaDeInsistencia/ResponsablesDeCola.tsx": 1,
  "core/formatoComun.ts": 1,
  "core/rotulosComunes.ts": 1,
  "fuentes/vocabulario.ts": 1,
  "profiles/acreditacion/avance/PesasDeComposicion.tsx": 1,
  "profiles/acreditacion/avance/PorCuota.tsx": 1,
  "profiles/acreditacion/avance/variablesDeControlModelo.ts": 1,
  "profiles/acreditacion/avanceCorreoMatriz.ts": 1,
  "profiles/acreditacion/formato.ts": 1,
  "profiles/aulas/AulasDosSheets.tsx": 1,
  "profiles/aulas/AulasEfectividadSeguimiento.tsx": 1,
  "profiles/aulas/destinoDelLibro.ts": 1,
  "profiles/aulas/kpisDeAulas.ts": 2,
  "profiles/telefonico/avance/Ritmo.tsx": 1,
  "profiles/telefonico/control/Discrepancias.tsx": 1,
  "profiles/telefonico/control/Equipo.tsx": 2,
  "profiles/telefonico/formato.ts": 1,
  "profiles/territorial/TerritorialAdvanceWorkbench.tsx": 1,
  "profiles/territorial/TerritorialFieldOccurrencesWorkbench.tsx": 1,
  "profiles/territorial/TerritorialProductionAnnulmentWorkspace.tsx": 1,
  "profiles/territorial/TerritorialSourceConsole.tsx": 1,
  "public/MonitoreoPublicReportPage.tsx": 14,
  "salidas/MonitoreoOutputsWorkbench.tsx": 1,
  "shell/MonitoreoModuleChrome.tsx": 1,
};

const SNAPSHOT_LENGTH_CRUDO: Record<string, number> = {
  "estados/DefinidorDeEstados.tsx": 2,
  "fieldOccurrences.ts": 1,
  "filtroEfectiva/criterios.ts": 1,
  "profiles/acreditacion/AcreditacionMonitoreoPage.tsx": 5,
  "profiles/acreditacion/AcreditacionPhoneAlerts.ts": 1,
  "profiles/acreditacion/control/casos/Personas.tsx": 1,
  "profiles/acreditacion/control/casos/Respuestas.tsx": 1,
  "profiles/acreditacion/control/contacto/Correo.tsx": 1,
  "profiles/acreditacion/fuentes/ActoresDelEstudio.tsx": 1,
  "profiles/acreditacion/fuentes/FuentesUniverso.tsx": 1,
  "profiles/acreditacion/fuentes/useElencoDeActores.ts": 1,
  "profiles/acreditacion/modelo/DistribucionPorActor.tsx": 1,
  "profiles/aulas/AulasAvancePorCurso.tsx": 1,
  "profiles/aulas/AulasBrechaEstratoChart.tsx": 1,
  "profiles/aulas/AulasControlDelLibro.tsx": 2,
  "profiles/aulas/AulasFiltrosDeEfectiva.tsx": 1,
  "profiles/aulas/AulasFuentesDelEstudio.tsx": 1,
  "profiles/aulas/AulasPopoverReemplazo.tsx": 1,
  "profiles/aulas/AulasRefuerzosPedidos.tsx": 1,
  "profiles/aulas/RegistroDeCampo.tsx": 1,
  "profiles/aulas/avance/PorFacultadAulas.tsx": 1,
  "profiles/aulas/avisoLibroPublicado.ts": 1,
  "profiles/aulas/control/AgendaAulas.tsx": 1,
  "profiles/aulas/insumos/TablasDeMaterial.tsx": 1,
  "profiles/telefonico/TelefonicoMonitoreoPage.tsx": 10,
  "profiles/telefonico/TelefonicoPhoneAlerts.ts": 1,
  "profiles/telefonico/control/Discrepancias.tsx": 2,
  "profiles/telefonico/fuentes/modeloDeCadena.ts": 1,
  "profiles/territorial/TerritorialAdvanceWorkbench.tsx": 2,
  "profiles/territorial/TerritorialMonitoreoPage.tsx": 4,
  "profiles/territorial/avance/AvancePorZona.tsx": 1,
  "profiles/territorial/avance/MapaDeCasos.tsx": 1,
  "profiles/territorial/control/ocurrenciasModel.ts": 1,
  "profiles/territorial/insumos/ConexionesTab.tsx": 2,
  "salidas/MonitoreoOutputsWorkbench.tsx": 3,
  "shell/MonitoreoModuleChrome.tsx": 1,
  "shell/MonitoreoPathContext.tsx": 1,
  "sync/menuDeActualizar.ts": 3,
};

function conteo(contar: (l: string) => number): Record<string, number> {
  const salida: Record<string, number> = {};
  for (const f of archivos(aqui)) {
    const n = lineas(readFileSync(f, "utf8")).reduce((total, l) => total + contar(l), 0);
    if (n > 0) salida[rel(f)] = n;
  }
  return salida;
}

function ratchet(actual: Record<string, number>, foto: Record<string, number>) {
  const suben = Object.entries(actual)
    .filter(([f, n]) => n > (foto[f] ?? 0))
    .map(([f, n]) => `${f}: ${foto[f] ?? 0} → ${n}`);
  const bajaron = Object.entries(foto)
    .filter(([f, n]) => (actual[f] ?? 0) < n)
    .map(([f, n]) => `${f}: ${n} → ${actual[f] ?? 0}`);
  return { suben, bajaron };
}

describe("frases, cifras y metadatos de Monitoreo (P3, P4 y P8)", () => {
  it("el barrido ve el feature (centinela)", () => {
    expect(archivos(aqui).length).toBeGreaterThan(600);
  });

  it.each([
    ["« · » como separador (P3)", PUNTO, SNAPSHOT_PUNTO],
    ["toLocaleString fuera del formateador (P4)", TO_LOCALE, SNAPSHOT_TO_LOCALE],
    ["{x.length} sin formatear (P4)", LENGTH_CRUDO, SNAPSHOT_LENGTH_CRUDO],
  ] as const)("%s: ningún archivo sube y la foto no guarda conteos viejos", (_nombre, contar, foto) => {
    const { suben, bajaron } = ratchet(conteo(contar), foto);
    expect(suben, "Une con coma o enumerar(); las cifras van por lib/formatoNumero.").toEqual([]);
    expect(bajaron, "Bájalo también en la foto.").toEqual([]);
  });

  it("ningún metadato va en <code> (P8, meta 0)", () => {
    expect(conteo(CODE)).toEqual({});
  });

  it("los detectores reconocen lo que prohíben (no son guards que no guardan)", () => {
    expect(PUNTO('{"P884 · Norma"}')).toBe(1);
    expect(TO_LOCALE('n.toLocaleString("es-PE")')).toBe(1);
    expect(LENGTH_CRUDO("<b>{filas.length}</b>")).toBe(1);
    expect(LENGTH_CRUDO("`${casos.length} casos`")).toBe(1);
    expect(CODE("<code>CodPulso</code>")).toBe(1);
    expect(lineas("// a · b\nx").filter((l) => PUNTO(l))).toEqual([]);
  });
});
