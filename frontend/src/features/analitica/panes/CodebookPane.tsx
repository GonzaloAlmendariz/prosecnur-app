import { BookOpen, Download, Play } from "lucide-react";
import { apiAnaliticaCodebook, downloadUrl } from "../../../api/client";
import { Alert } from "../../../components/Alert";
import { Panel } from "../../../components/Panel";
import { useAnaliticaStore } from "../store";
import { useReporteRun } from "../useReporteRun";

export function CodebookPane() {
  const codebook = useAnaliticaStore((s) => s.config.codebook);
  const setCodebook = useAnaliticaStore((s) => s.setCodebook);
  const run = useReporteRun();

  const codes = codebook.codigos_solo_si_presentes;

  function toggle(n: number) {
    setCodebook({
      codigos_solo_si_presentes: codes.includes(n)
        ? codes.filter((x) => x !== n)
        : [...codes, n].sort((a, b) => a - b),
    });
  }

  async function onGenerate() {
    await run.runSync(() => apiAnaliticaCodebook());
  }

  return (
    <Panel
      eyebrow="Reporte"
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><BookOpen size={16} /> Libro de códigos</span>}
      hint={<>Diccionario de variables con etiquetas y valores válidos. Puedes ocultar los códigos reservados (<code>NS/NR/No aplica</code>) cuando no aparecen en la data.</>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div className="pulso-section-eyebrow" style={{ marginBottom: 6 }}>Códigos solo si están presentes</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[95, 96, 97, 98, 99].map((n) => (
              <label
                key={n}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "4px 10px", borderRadius: 999,
                  border: `1px solid ${codes.includes(n) ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                  background: codes.includes(n) ? "var(--pulso-primary-soft)" : "white",
                  fontSize: 12, cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={codes.includes(n)}
                  onChange={() => toggle(n)}
                  style={{ margin: 0 }}
                />
                <code style={{ fontFamily: "monospace", fontWeight: 700 }}>{n}</code>
              </label>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 6, lineHeight: 1.4 }}>
            Convención Pulso: 95 = No contesta · 96 = No aplica · 97 = No sabe · 98 = Otro · 99 = Otros.
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--pulso-border)", paddingTop: 14 }}>
          <button
            className="pulso-primary"
            onClick={onGenerate}
            disabled={run.busy}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Play size={14} /> {run.busy ? "Generando…" : "Generar codebook"}
          </button>
          {run.fileId && (
            <a
              href={downloadUrl(run.fileId)}
              style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <Download size={13} /> codebook.xlsx
            </a>
          )}
        </div>
        {run.error && <Alert kind="error">{run.error}</Alert>}
      </div>
    </Panel>
  );
}
