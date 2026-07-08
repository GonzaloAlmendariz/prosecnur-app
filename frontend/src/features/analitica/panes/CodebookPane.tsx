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
    <Panel className="analitica-codebook-panel">
      <div className="analitica-report-shell analitica-codebook-workbench">
        <div className="analitica-codebook-docbar">
          <span className="analitica-codebook-docbar-icon" aria-hidden="true">
            <BookOpen size={16} />
          </span>
          <div className="analitica-codebook-docbar-copy">
            <span>Producto documental</span>
            <strong>Libro de códigos</strong>
            <small>Diccionario sincronizado con etiquetas confirmadas y XLSForm final.</small>
          </div>
          <div className="analitica-codebook-docbar-stats" aria-label="Estado del libro de códigos">
            <span>
              Fuente
              <strong>{fuenteLabel}</strong>
            </span>
            <span>
              Códigos
              <strong>{codes.length}/5 activos</strong>
            </span>
            <span>
              Excluidas
              <strong>{excluidasCount}</strong>
            </span>
          </div>
        </div>

        <div className="analitica-codebook-info">
          <Info size={14} />
          <div>
            Usa la fuente <strong>{fuenteLabel}</strong> con las exclusiones y etiquetas confirmadas en <strong>Datos</strong>; el <strong>XLSForm final</strong> se genera en la misma corrida.
          </div>
        </div>

        <Section
          title="1. Códigos especiales"
          subtitle={<>
            Convenciones Pulso para NS/NR/NA: los códigos marcados solo aparecen si alguien los respondió, sin filas vacías en la tabla final.
          </>}
        >
          <div className="analitica-codebook-code-grid">
            {codigosMeta.map((c) => {
              const active = codes.includes(c.code);
              return (
                <label
                  key={c.code}
                  title={c.label}
                  className={`analitica-codebook-code ${active ? "is-active" : ""}`}
                >
                  <input type="checkbox" checked={active} onChange={() => toggle(c.code)} />
                  <code>{c.code}</code>
                  <span>{c.label}</span>
                </label>
              );
            })}
          </div>
        </Section>

        {excluidasCount > 0 && (
          <div className="analitica-codebook-note">
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
    <div className="analitica-codebook-xlsform">
      <div className="analitica-codebook-xlsform-head">
        <div>
          <FileSpreadsheet size={14} />
          XLSForm final descargable
        </div>
        {fileId ? (
          <a
            href={downloadUrl(fileId)}
            download={filename}
            className="analitica-codebook-download"
          >
            <Download size={12} />
            {multi ? `${filename} (zip)` : filename}
          </a>
        ) : (
          <span className="analitica-codebook-pending">
            Pendiente de generar
          </span>
        )}
      </div>

      <div className="analitica-codebook-xlsform-copy">
        Sale de la misma corrida: mismas etiquetas y exclusiones que Frecuencias, Bases y Cruces.
      </div>
      {fileId ? (
        <div className="analitica-codebook-sync">
          <CheckCircle2 size={12} />
          Sincronizado con la última generación del libro de códigos
        </div>
      ) : null}

      {multi && result?.bases?.length ? (
        <div className="analitica-codebook-base-links">
          {result.bases.map((base) => (
            base.file_id ? (
              <a
                key={base.nombre}
                href={downloadUrl(base.file_id)}
                className="analitica-codebook-base-link"
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
