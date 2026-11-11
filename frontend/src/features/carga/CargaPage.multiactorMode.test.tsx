import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  fileURLToPath(new URL("./CargaPage.tsx", import.meta.url)),
  "utf8",
);
const leer = (rel: string) => fs.readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const mesa = leer("./pestanas/MesaDeCarga.tsx");
const bases = leer("./pestanas/PestanaBases.tsx");
const agregarBase = leer("./pestanas/bases/AgregarBase.tsx");
const panelMonitoreo = leer("./pestanas/PanelMonitoreoCarga.tsx");
const origenes = leer("./pestanas/OrigenesDeCarga.tsx");
const styles = fs.readFileSync(
  fileURLToPath(new URL("./carga-v2.css", import.meta.url)),
  "utf8",
);

describe("origen multiactor deliberado en Carga", () => {
  it("degrada el workbench multibase a un único scroll de página en modo short", () => {
    expect(mesa).toContain("pulso-carga-workbench--multibase");
    expect(styles).toContain(':root[data-pulso-layout-mode="short"] .pulso-main--viewport .pulso-carga-frame.pulso-page-frame--scroll-panels .pulso-page-frame-body.pulso-page-frame-body--fill');
    expect(styles).toMatch(/pulso-carga-scrollarea\s*\{[\s\S]*?overflow:\s*visible;/u);
  });

  it("mantiene el aviso específico fuera del toolbar", () => {
    expect(source).not.toContain("plannedPublics");
    expect(source).not.toContain("Bases separadas por público");
    expect(source).not.toContain("públicos detectados con bases separadas planificadas");
    expect(styles).not.toContain("pulso-multibase-toggle.is-planned");
  });

  it("mantiene el batch de Monitoreo alcanzable al reabrir un estudio multibase", () => {
    // Una sola mesa para las dos organizaciones; con una base y con varias,
    // Monitoreo es un origen de "Agregar base" (Carga › Bases, R2).
    expect(source).toContain("<MesaDeCarga");
    expect(source).toContain("(isMultiBase && estudio)");
    expect(origenes).toContain('aria-label="Origen de carga"');
    expect(bases).toContain("const panelMonitoreo = <PanelMonitoreoCarga");
    expect(agregarBase).toContain('opcion.id === "monitoreo" ? (\n            panelMonitoreo');
    expect(panelMonitoreo).toContain("<ProcessingIntakePanel");
    expect(panelMonitoreo).toContain("<AcreditacionBatchPanel");
  });

  it("monta asignaciones y creación conjunta solo tras consentir la revisión", () => {
    // Un solo panel de Monitoreo, usado por las dos organizaciones de Bases.
    expect(bases.match(/<PanelMonitoreoCarga\b/g)).toHaveLength(1);
    expect(agregarBase.match(/panelMonitoreo\b/g)).toHaveLength(3);
    expect(panelMonitoreo.match(/<ProcessingIntakePanel/g)).toHaveLength(1);
    expect(panelMonitoreo.match(/<AcreditacionBatchPanel/g)).toHaveLength(1);
    expect(panelMonitoreo).toContain('revisado && perfil === "multi_actor"');
    expect(origenes).toContain("onRovingKeyChange={(key) => onModo(key as SourceMode)}");
  });
});
