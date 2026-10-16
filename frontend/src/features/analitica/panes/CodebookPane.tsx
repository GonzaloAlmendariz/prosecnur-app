import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, Download, FileSpreadsheet, FileText, Info } from "lucide-react";
import { apiAnaliticaCodebook, apiAnaliticaConfigPut, downloadUrl, type MultiBaseResult } from "../../../api/client";
import { apiAnaliticaCodigosEspeciales, type CodigoEspecialSugerido } from "../../../api/analitica";
import { codigoEscrito, opcionesCodigosEspeciales } from "./codigosEspecialesModel";
import { Panel } from "../../../components/Panel";
import { formatoConteo } from "../../../lib/formatoNumero";
import { CifrasPestana } from "../CifrasPestana";
import { InterruptorOpcion } from "../InterruptorOpcion";
import { useAnaliticaStore } from "../store";
import { Section, GenerateFooter, PaneGroup } from "../PaneKit";
import { useReporteRun } from "../useReporteRun";
import { useSession } from "../../../lib/SessionContext";
import { Link, useLocation } from "react-router-dom";
import { searchConPanel } from "../../../lib/navegacion/paneles";
import { PANEL_VARIABLES_EXCLUIDAS } from "../panelesAnalitica";
import "../variablesExcluidas.css";
import "./CodebookPane.css";

// CodebookPane. La inclusión/exclusión y los labels confirmados viven en
// Datos / Revisión de data. Este panel genera el diccionario y el XLSForm
// final de la misma corrida para que ambos queden sincronizados.

export function CodebookPane() {
  const codebook = useAnaliticaStore((s) => s.config.codebook);
  const config = useAnaliticaStore((s) => s.config);
  const setCodebook = useAnaliticaStore((s) => s.setCodebook);
  const colorRecods = useAnaliticaStore((s) => s.config.color_recodificaciones);
  const setColorRecodificaciones = useAnaliticaStore((s) => s.setColorRecodificaciones);
  // AnaliticaPage no monta las pestañas hasta hidratar la config, así que este
  // conteo ya es el de la base activa y no el default vacío (U6).
  const excluidasCount = useAnaliticaStore((s) => new Set(s.config.variables_excluidas).size);
  const location = useLocation();
  const hrefExcluidas = { pathname: location.pathname, search: searchConPanel(location.search, PANEL_VARIABLES_EXCLUIDAS) };
  const run = useReporteRun();
  const runPdf = useReporteRun();
  const { state } = useSession();

  const codes = codebook.codigos_solo_si_presentes;
  const fuenteLabel = state?.analitica_fuente?.startsWith("adaptados") ? "Codificada" : "Original";

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

  async function onGeneratePdf() {
    await runPdf.runSync(async () => {
      await apiAnaliticaConfigPut(config);
      return apiAnaliticaCodebook({ formato: "pdf" });
    });
  }

  // Sugerencias del estudio, no una lista fija: los códigos especiales que traen
  // los instrumentos, con su etiqueta, más los ya marcados.
  const [sugeridos, setSugeridos] = useState<CodigoEspecialSugerido[] | null>(null);
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  useEffect(() => {
    let vivo = true;
    apiAnaliticaCodigosEspeciales()
      .then((c) => { if (vivo) setSugeridos(c); })
      .catch(() => { if (vivo) setSugeridos([]); });
    return () => { vivo = false; };
  }, []);
  const codigosMeta = opcionesCodigosEspeciales(sugeridos ?? [], codes);
  const agregarCodigo = () => {
    const n = codigoEscrito(nuevoCodigo);
    if (n === null) return;
    if (!codes.includes(n)) toggle(n);
    setNuevoCodigo("");
  };

  return (
    <Panel className="analitica-codebook-panel">
      {/* C1: barra, avisos y secciones del libro son bloques independientes. */}
      <div
        className="analitica-report-shell analitica-codebook-workbench"
        data-qa-geometry-group="analitica/codebook-workbench"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="analitica-codebook-docbar">
          <span className="analitica-codebook-docbar-icon" aria-hidden="true">
            <BookOpen size={16} />
          </span>
          <div className="analitica-codebook-docbar-copy">
            <span>Producto documental</span>
            <strong>Libro de códigos</strong>
            <small>Diccionario sincronizado con etiquetas confirmadas y XLSForm final.</small>
          </div>
          <CifrasPestana
            ariaLabel="Estado del libro de códigos"
            cifras={[
              { etiqueta: "Fuente", valor: fuenteLabel },
              { etiqueta: "Códigos especiales", valor: formatoConteo(codes.length) },
              {
                etiqueta: "Excluidas",
                valor: (
                  <Link
                    to={hrefExcluidas}
                    replace
                    className="pulso-excluidas-enlace"
                    aria-haspopup="dialog"
                    aria-label={`${formatoConteo(excluidasCount)} ${excluidasCount === 1 ? "variable excluida" : "variables excluidas"}: ver y editar`}
                  >
                    {formatoConteo(excluidasCount)}
                  </Link>
                ),
              },
            ]}
          />
        </div>

        <div className="analitica-codebook-info">
          <Info size={14} />
          <div>
            Usa la fuente <strong>{fuenteLabel}</strong> con las exclusiones y etiquetas confirmadas en <strong>Datos</strong>; el <strong>XLSForm final</strong> se genera en la misma corrida.
          </div>
        </div>

        <Section
          title="Códigos especiales"
          subtitle={<>
            Sugeridos a partir de las listas de respuestas del estudio. Un código marcado va al bloque de valores especiales y solo aparece si alguien lo respondió. Aplica a todos los formatos.
          </>}
        >
          <div className="analitica-codebook-code-grid">
            {sugeridos === null && <span className="analitica-codebook-code-nota">Leyendo los instrumentos…</span>}
            {sugeridos !== null && codigosMeta.length === 0 && (
              <span className="analitica-codebook-code-nota">Los instrumentos no traen códigos que parezcan especiales.</span>
            )}
            {codigosMeta.map((c) => (
              <label
                key={c.code}
                title={c.label}
                className={`analitica-codebook-code ${c.marcado ? "is-active" : ""} ${c.origen === "configurado" ? "is-ajeno" : ""}`}
              >
                <input type="checkbox" checked={c.marcado} onChange={() => toggle(c.code)} />
                <code>{c.code}</code>
                <span>{c.label}</span>
              </label>
            ))}
          </div>
          <div className="analitica-codebook-code-agregar">
            <input
              value={nuevoCodigo}
              inputMode="numeric"
              placeholder="Otro código"
              aria-label="Agregar un código especial"
              onChange={(e) => setNuevoCodigo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") agregarCodigo(); }}
            />
            <button type="button" className="analitica-codebook-code-agregar-btn" disabled={codigoEscrito(nuevoCodigo) === null} onClick={agregarCodigo}>
              Agregar
            </button>
          </div>
        </Section>

        <Section
          title="Presentación de recodificaciones"
          subtitle={<>
            Marca visualmente las variables recodificadas en los entregables para ubicarlas de un vistazo. Afecta el instrumento, la base de datos y el libro de códigos.
          </>}
        >
          <div className="analitica-control-grid">
            <InterruptorOpcion
              checked={colorRecods}
              onToggle={() => setColorRecodificaciones(!colorRecods)}
              titulo="Resaltar recodificaciones con color"
              descripcion="Pinta las variables recodificadas con un color de fondo en el instrumento, la base de datos y el libro de códigos."
            />
          </div>
        </Section>

        {excluidasCount > 0 && (
          <div className="analitica-codebook-note">
            {/* Un bloque y no texto suelto: así la línea entera es el contenido
                medido y la nota no declara capacidad que no tiene (C3). */}
            <div>
              Este reporte omite <strong>{excluidasCount}</strong> {excluidasCount === 1 ? "variable excluida" : "variables excluidas"}.{" "}
              <Link to={hrefExcluidas} replace className="pulso-excluidas-enlace" aria-haspopup="dialog">
                Ver y editar las excluidas
              </Link>
            </div>
          </div>
        )}

        <PaneGroup
          label="Libro de códigos"
          hint="El diccionario del estudio, en Excel para análisis o en PDF para leer e imprimir."
        >
          <Section
            title={
              <span className="analitica-inline-title">
                <FileSpreadsheet size={14} /> Excel (.xlsx)
              </span>
            }
            subtitle="Editable, para análisis. Genera además el XLSForm final sincronizado en la misma corrida."
          >
            <GenerateFooter
              label="Generar Excel"
              busy={run.busy}
              fileId={run.fileId}
              downloadName={run.filename ?? "libro_de_codigos.xlsx"}
              error={run.error}
              onGenerate={onGenerate}
              perBase={run.perBase}
            />

            <FinalXlsformDownload result={run.lastResult?.xlsform} />
          </Section>

          <Section
            title={
              <span className="analitica-inline-title">
                <FileText size={14} /> PDF
              </span>
            }
            subtitle="Para leer, imprimir y compartir. Usa la misma fuente y exclusiones que el Excel."
          >
            <GenerateFooter
              label="Generar PDF"
              busy={runPdf.busy}
              fileId={runPdf.fileId}
              downloadName={runPdf.filename ?? "libro_de_codigos.pdf"}
              error={runPdf.error}
              onGenerate={onGeneratePdf}
              perBase={runPdf.perBase}
            />
          </Section>
        </PaneGroup>
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
