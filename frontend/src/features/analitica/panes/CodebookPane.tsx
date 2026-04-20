import { BookOpen } from "lucide-react";
import { apiAnaliticaCodebook } from "../../../api/client";
import { Panel } from "../../../components/Panel";
import { useAnaliticaStore } from "../store";
import { Section, GenerateFooter } from "../PaneKit";
import { useReporteRun } from "../useReporteRun";

// CodebookPane — simple: qué códigos especiales ocultar si no aparecen.

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

  const codigosMeta: Array<{ code: number; label: string }> = [
    { code: 95, label: "No contesta" },
    { code: 96, label: "No aplica" },
    { code: 97, label: "No sabe" },
    { code: 98, label: "Otro" },
    { code: 99, label: "Otros" },
  ];

  return (
    <Panel
      eyebrow="Reporte"
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><BookOpen size={16} /> Libro de códigos</span>}
      hint="Excel con el diccionario completo del instrumento: nombre técnico, etiqueta, tipo, valores válidos y labels por cada variable."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <Section
          title="1. Códigos especiales"
          subtitle={<>
            Los códigos <code>95</code>–<code>99</code> son convenciones Pulso para respuestas especiales (NS/NR/NA). Las variables marcadas aquí <strong>solo los muestran si al menos un respondiente los marcó</strong>. Así evitas que la tabla final traiga filas vacías.
          </>}
        >
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {codigosMeta.map((c) => {
              const active = codes.includes(c.code);
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => toggle(c.code)}
                  title={c.label}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 8,
                    border: `1px solid ${active ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                    background: active ? "var(--pulso-primary-soft)" : "white",
                    cursor: "pointer", fontSize: 12,
                  }}
                >
                  <input type="checkbox" checked={active} onChange={() => toggle(c.code)} style={{ margin: 0 }} />
                  <code style={{ fontFamily: "monospace", fontWeight: 700, color: active ? "var(--pulso-primary)" : "var(--pulso-text)" }}>{c.code}</code>
                  <span style={{ color: "var(--pulso-text-soft)" }}>{c.label}</span>
                </button>
              );
            })}
          </div>
        </Section>

        <GenerateFooter
          label="Generar libro de códigos"
          busy={run.busy}
          fileId={run.fileId}
          downloadName="libro_de_codigos.xlsx"
          error={run.error}
          onGenerate={onGenerate}
        />
      </div>
    </Panel>
  );
}
