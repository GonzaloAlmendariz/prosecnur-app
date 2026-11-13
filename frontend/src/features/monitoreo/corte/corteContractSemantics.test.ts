import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Tests de contrato del corte: vigilan que las reparaciones de la auditoría
// visual del 25-07-2026 no se deshagan por deriva. Leen el fuente porque lo que
// se protege es una regla de arquitectura, no un cálculo.

const monitoreoDir = path.join(__dirname, "..");

function leer(relativo: string) {
  return fs.readFileSync(path.join(monitoreoDir, relativo), "utf8");
}

const OUTPUTS = leer("salidas/MonitoreoOutputsWorkbench.tsx");
const RAIL = leer("components/MonitoreoWorkbenchRail.tsx");
const TERRITORIAL = leer("profiles/territorial/TerritorialMonitoreoPage.tsx");
const ACREDITACION = leer("profiles/acreditacion/AcreditacionMonitoreoPage.tsx");
const TELEFONICO = leer("profiles/telefonico/TelefonicoMonitoreoPage.tsx");
const AULAS = leer("profiles/aulas/AulasMonitoreoPage.tsx");

describe("gate de salidas", () => {
  it("el workbench de salidas recibe el corte, no el conteo crudo de filas", () => {
    // `nRows` habilitaba PDFs de cliente con cero válidas: 36 filas en el
    // snapshot bastaban para emitir un entregable no defendible.
    expect(OUTPUTS).toContain("corte: MonitoreoCorte");
    expect(OUTPUTS).not.toMatch(/^\s*nRows: number;$/m);
  });

  it("la salida de cliente se gatea por readiness y no por filas", () => {
    expect(OUTPUTS).toContain("readinessDeSalidas");
    expect(OUTPUTS).toContain("const canGeneratePdf = salidaClienteHabilitada");
    expect(OUTPUTS).not.toContain("hasSnapshot && nRows > 0 && !pdfJobId");
  });

  it("los cuatro perfiles construyen el corte en vez de pasar n_rows a las salidas", () => {
    // Solo se inspecciona el bloque JSX del panel de salidas: la banda superior
    // del módulo sí muestra el conteo del snapshot, y con ese rótulo es correcto.
    // Con el estándar de Salidas (4 nov 2026) las props del motor viajan en un objeto `motor` que se esparce
    // (`{...motor}`): en ese caso lo que se inspecciona es ese objeto.
    const bloqueSalidas = (fuente: string) => {
      const inicio = fuente.search(/<(MonitoreoOutputsWorkbench|TerritorialOutputsPanel)\b/);
      if (inicio === -1) return "";
      const jsx = fuente.slice(inicio, fuente.indexOf("/>", inicio) + 2);
      if (!/\{\.\.\.motor\}/.test(jsx)) return jsx;
      const objeto = fuente.lastIndexOf("const motor = {", inicio);
      return objeto === -1 ? jsx : fuente.slice(objeto, fuente.indexOf("};", objeto) + 2).replace(/\bcorte: /, "corte={");
    };

    for (const [nombre, fuente] of [
      ["territorial", TERRITORIAL],
      ["acreditación", ACREDITACION],
      ["telefónico", TELEFONICO],
      ["cursos-horario", AULAS],
    ] as const) {
      const bloque = bloqueSalidas(fuente);
      expect(bloque, `${nombre} debe montar un panel de salidas`).toBeTruthy();
      expect(bloque, `${nombre} debe pasar corte al panel de salidas`).toMatch(/corte=\{corte/);
      expect(bloque, `${nombre} no debe pasar n_rows al panel de salidas`).not.toMatch(/nRows=/);
      expect(bloque, `${nombre} no debe pasar hasSnapshot al panel de salidas`).not.toMatch(/hasSnapshot=/);
    }
  });
});

describe("máquina de estados visual", () => {
  it("el rail propaga badge y estado en vez de descartarlos", () => {
    // El adaptador construía ContextTabRailItem sin badge ni status, así que
    // los perfiles los calculaban para nada.
    expect(RAIL).toContain("badge: tab.badge");
    expect(RAIL).toContain("estado: tab.estado");
  });

  it("readyStatus habla el vocabulario canónico, no ready/warning", () => {
    for (const [nombre, fuente] of [
      ["acreditación", ACREDITACION],
      ["telefónico", TELEFONICO],
    ] as const) {
      expect(fuente, `${nombre} mantiene el mapeo canónico`).toContain('if (risk) return "bloqueado";');
      expect(fuente, `${nombre} no vuelve al binario ready/warning`).not.toContain('return ready ? "ready" : "warning";');
    }
  });

  it("las pestañas de Avance derivan su estado de evidencia, no de tener filas", () => {
    expect(ACREDITACION).toContain("estadoVisual({");
    expect(ACREDITACION).not.toContain("estado: readyStatus(advanceStats.actors > 0)");
    expect(ACREDITACION).not.toContain("estado: readyStatus(advanceStats.sources > 0)");
    expect(ACREDITACION).not.toContain("estado: readyStatus(advanceStats.controls > 0)");
  });

  it("territorial da readiness a sus pestañas de Avance", () => {
    // Con el esqueleto común el rail territorial se arma en su modelo propio.
    const RAIL_TERRITORIAL = leer("profiles/territorial/navegacion/modeloDelRail.ts");
    expect(TERRITORIAL).toContain("pestanasDelRail(");
    expect(RAIL_TERRITORIAL).toContain("estadoDeAvance(");
    expect(RAIL_TERRITORIAL).toContain("estadoVisual({");
    expect(RAIL_TERRITORIAL).toContain("readinessDeSalidas(corte)");
  });
});

describe("honestidad de los conteos", () => {
  it("la banda territorial no llama 'registros' al conteo crudo", () => {
    // Lo verificado es que la página no vuelva a rotular el conteo crudo como
    // «registros». La palabra «recibidas» salió de esta página con la pantalla
    // de carga propia (2026-11-12): la banda del módulo rotula su cifra aparte.
    expect(TERRITORIAL).not.toContain("`${fmt(nRows)} registros`");
  });

  it("el panel de salidas nombra los tres granos en su encabezado", () => {
    // Lo que este contrato defiende es que el conteo crudo NO se confunda con
    // las válidas, no la palabra con que se diga. Pasó de «en el snapshot» a
    // «recibidas» —«snapshot» describe cómo guarda la app, no lo que el estudio
    // tiene delante— y la distinción se mantiene intacta.
    expect(OUTPUTS).toContain("recibidas");
    expect(OUTPUTS).not.toMatch(/`\$\{fmt\(corte\.ingesta\)\} registros`/);
    expect(OUTPUTS).toContain("procesables");
    expect(OUTPUTS).toContain("efectivas sin determinar");
  });
});
