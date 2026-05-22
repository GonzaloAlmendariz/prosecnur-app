import { BookOpen, CheckCircle2, Download, FileSpreadsheet, Info } from "lucide-react";
import { apiAnaliticaCodebook, apiAnaliticaConfigPut, downloadUrl, type MultiBaseResult } from "../../../api/client";
import { Panel } from "../../../components/Panel";
import { useAnaliticaStore } from "../store";
import { Section, GenerateFooter } from "../PaneKit";
import { useReporteRun } from "../useReporteRun";
import { useSession } from "../../../lib/SessionContext";

// CodebookPane. La inclusión/exclusión y los labels confirmados viven en
// Datos / Revisión de data. Este panel genera el diccionario y el XLSForm
// final de la misma corrida para que ambos queden sincronizados.

export function CodebookPane() {
  const codebook = useAnaliticaStore((s) => s.config.codebook);
  const config = useAnaliticaStore((s) => s.config);
  const setCodebook = useAnaliticaStore((s) => s.setCodebook);
  const excluidasCount = useAnaliticaStore((s) => s.config.variables_excluidas.length);
  const run = useReporteRun();
  const { state } = useSession();

  const codes = codebook.codigos_solo_si_presentes;
  const fuenteLabel = state?.analitica_fuente === "adaptados" ? "Codificada" : "Original";

  function toggle(n: number) {
    setCodebook({
      codigos_solo_si_presentes: codes.includes(n)
        ? codes.filter((x) => x !== n)
        : [...codes, n].sort((a, b) => a - b),
    });
  }

  async function onGenerate() {
    await run.runSync(async () => {
      await apiAnaliticaConfigPut(config);
      return apiAnaliticaCodebook();
    });
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
      hint="Genera el diccionario de variables y, en la misma corrida, el XLSForm final que queda sincronizado con las etiquetas confirmadas en Datos / Revisión."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--pulso-surface)",
            border: "1px solid var(--pulso-border)",
            fontSize: 11,
            color: "var(--pulso-text-soft)",
            lineHeight: 1.5,
          }}
        >
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            Esta corrida usa la fuente analítica <strong>{fuenteLabel}</strong> y aplica los cambios confirmados en <strong>Datos / Revisión de data</strong>: variables excluidas, etiquetas de preguntas y etiquetas de opciones. El resultado principal es el libro de códigos; el <strong>XLSForm final</strong> queda disponible aquí mismo al terminar.
          </div>
        </div>

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

        {excluidasCount > 0 && (
          <div
            style={{
              fontSize: 11, color: "var(--pulso-text-soft)",
              padding: "8px 12px", borderRadius: 6,
              background: "var(--pulso-surface)",
              border: "1px solid var(--pulso-border)",
              lineHeight: 1.5,
            }}
          >
            Este reporte omite <strong>{excluidasCount}</strong> {excluidasCount === 1 ? "variable excluida" : "variables excluidas"} globalmente. Edita esa selección en <strong>Datos / Revisión de data</strong>.
          </div>
        )}

        <GenerateFooter
          label="Generar libro de códigos + XLSForm final"
          busy={run.busy}
          fileId={run.fileId}
          downloadName={run.filename ?? "libro_de_codigos.xlsx"}
          error={run.error}
          onGenerate={onGenerate}
          perBase={run.perBase}
        />

        <FinalXlsformDownload result={run.lastResult?.xlsform} />
      </div>
    </Panel>
  );
}

function FinalXlsformDownload({ result }: { result?: MultiBaseResult }) {
  const fileId = result?.zip?.file_id ?? result?.file_id;
  const filename = result?.zip?.filename ?? result?.filename ?? "xlsform_final.xlsx";
  const multi = (result?.bases?.length ?? 0) > 1;

  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid var(--pulso-border)",
        background: "var(--pulso-surface)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 800, color: "var(--pulso-text)" }}>
          <FileSpreadsheet size={14} />
          XLSForm final descargable
        </div>
        {fileId ? (
          <a
            href={downloadUrl(fileId)}
            download={filename}
            style={{
              fontSize: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 10px",
              borderRadius: 999,
              color: "var(--pulso-primary)",
              background: "var(--pulso-primary-soft)",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            <Download size={12} />
            {multi ? `${filename} (zip)` : filename}
          </a>
        ) : (
          <span
            style={{
              fontSize: 11,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 10px",
              borderRadius: 999,
              border: "1px dashed var(--pulso-border)",
              color: "var(--pulso-text-soft)",
              fontWeight: 700,
            }}
          >
            Pendiente de generar
          </span>
        )}
      </div>

      <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
        Este archivo se genera junto con el libro de códigos y usa las mismas etiquetas de variables y opciones que Frecuencias, Bases y Cruces. También omite las variables excluidas en Datos / Revisión.
      </div>
      {fileId ? (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--pulso-success-fg)", fontWeight: 700 }}>
          <CheckCircle2 size={12} />
          Sincronizado con la última generación del libro de códigos
        </div>
      ) : null}

      {multi && result?.bases?.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {result.bases.map((base) => (
            base.file_id ? (
              <a
                key={base.nombre}
                href={downloadUrl(base.file_id)}
                style={{
                  fontSize: 11,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 9px",
                  borderRadius: 999,
                  background: "white",
                  border: "1px solid var(--pulso-border)",
                  color: "var(--pulso-text)",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                <Download size={10} />
                {base.nombre}
              </a>
            ) : null
          ))}
        </div>
      ) : null}
    </div>
  );
}
