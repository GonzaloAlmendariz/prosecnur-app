import { Database } from "lucide-react";
import { apiAnaliticaSpss } from "../../../api/client";
import { Panel } from "../../../components/Panel";
import { Section, GenerateFooter } from "../PaneKit";
import { useReporteRun } from "../useReporteRun";

// BasesPane — exporta el dataset etiquetado como .sav + sintaxis .sps.
// Sin args configurables: el output siempre es la base preparada en el
// header (según el toggle Auto/Codificada/Original).

export function BasesPane() {
  const run = useReporteRun();

  async function onGenerate() {
    await run.runAsync(() => apiAnaliticaSpss());
  }

  return (
    <Panel
      eyebrow="Reporte"
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Database size={16} /> Bases</span>}
      hint="Base de datos etiquetada lista para SPSS. Incluye todas las variables con sus value-labels y measures ya aplicados."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <Section
          title="Qué incluye el export"
          subtitle="Un zip con dos archivos, listos para abrir en SPSS sin configuración adicional."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <FileBadge
              name="datos.sav"
              desc="Dataset con etiquetas de variable, value-labels y nivel de medida (nominal / ordinal / escala)."
            />
            <FileBadge
              name="niveles_medida.sps"
              desc="Sintaxis de respaldo con las declaraciones de measure / label por variable. Sirve si tu versión de SPSS pierde los atributos al abrir el .sav."
            />
          </div>
        </Section>

        <Section
          title="Qué fuente se exporta"
          subtitle={<>
            La base exportada depende del toggle de fuente del encabezado superior. Si está en <strong>Auto</strong> y ya aplicaste codificación en Fase 3, se exporta la versión con las variables <code>*_recod</code>.
          </>}
        >
          <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", padding: "10px 12px", background: "var(--pulso-surface)", borderRadius: 6, lineHeight: 1.5 }}>
            Este reporte no tiene más opciones. Si necesitas filtrar variables o casos, hazlo desde SPSS una vez descargado.
          </div>
        </Section>

        <GenerateFooter
          label="Exportar bases"
          busy={run.busy}
          jobId={run.jobId}
          fileId={run.fileId}
          downloadName="bases.zip"
          error={run.error}
          onGenerate={onGenerate}
          onJobDone={run.onJobDone}
          onJobError={run.onJobError}
          onJobCancelled={run.onJobCancelled}
        />
      </div>
    </Panel>
  );
}

function FileBadge({ name, desc }: { name: string; desc: string }) {
  return (
    <div
      style={{
        display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, alignItems: "start",
        padding: "10px 12px",
        background: "var(--pulso-surface)",
        border: "1px solid var(--pulso-border)",
        borderRadius: 6,
      }}
    >
      <code style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 12, color: "var(--pulso-primary)", background: "var(--pulso-primary-soft)", padding: "3px 8px", borderRadius: 4 }}>
        {name}
      </code>
      <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}
