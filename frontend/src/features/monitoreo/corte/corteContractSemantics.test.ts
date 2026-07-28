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

  it("los tres perfiles construyen el corte en vez de pasar n_rows a las salidas", () => {
    // Solo se inspecciona el bloque JSX del panel de salidas: la banda superior
    // del módulo sí muestra el conteo del snapshot, y con ese rótulo es correcto.
    const bloqueSalidas = (fuente: string) => {
      const inicio = fuente.search(/<(MonitoreoOutputsWorkbench|TerritorialOutputsPanel)\b/);
      return inicio === -1 ? "" : fuente.slice(inicio, fuente.indexOf("/>", inicio) + 2);
    };

    for (const [nombre, fuente] of [
      ["territorial", TERRITORIAL],
      ["acreditación", ACREDITACION],
      ["telefónico", TELEFONICO],
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
    expect(TERRITORIAL).toContain("estadoPestanaAvanceTerritorial");
  });
});

describe("honestidad de los conteos", () => {
  it("la banda territorial no llama 'registros' al conteo crudo", () => {
    expect(TERRITORIAL).toContain("en el snapshot");
    expect(TERRITORIAL).not.toContain("`${fmt(nRows)} registros`");
  });

  it("el panel de salidas nombra los tres granos en su encabezado", () => {
    expect(OUTPUTS).toContain("en el snapshot");
    expect(OUTPUTS).toContain("procesables");
    expect(OUTPUTS).toContain("efectivas sin determinar");
  });
});
