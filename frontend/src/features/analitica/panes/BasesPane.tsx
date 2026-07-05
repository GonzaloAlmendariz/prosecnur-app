import { useEffect, useState } from "react";
import { Database, FileCode2, FileText, FileSpreadsheet, Info, Wand2 } from "lucide-react";
import {
  apiAnaliticaBasesData,
  apiAnaliticaBasesInstrumento,
  apiAnaliticaBasesSav,
  apiAnaliticaBasesMetadata,
  apiAnaliticaBasesCsv,
  apiAnaliticaBasesXlsx,
  apiAnaliticaBasesXlsxUnificada,
  type BasesSavWriterInfo,
} from "../../../api/client";
import { Panel } from "../../../components/Panel";
import { Section, Collapsible, GenerateFooter } from "../PaneKit";
import { useReporteRun } from "../useReporteRun";
import { useAnaliticaStore } from "../store";
import { MetadatosEditor } from "../MetadatosEditor";
import { useSession } from "../../../lib/SessionContext";

// BasesPane. Descargas directas de fuente (data + XLSForm) y tres
// formatos analíticos independientes (.sav / .csv / .xlsx), cada uno con
// su propia sub-config y su propio botón "Generar".
//
// El .sav lleva measure / format.spss / display_width embebidos para
// que SPSS respete ordinal/scale/nominal al abrir. El .sps queda como
// respaldo opcional, no como ruta principal.

export function BasesPane() {
  const bases = useAnaliticaStore((s) => s.config.bases);
  const setBasesSav = useAnaliticaStore((s) => s.setBasesSav);
  const setBasesCsv = useAnaliticaStore((s) => s.setBasesCsv);
  const setBasesXlsx = useAnaliticaStore((s) => s.setBasesXlsx);
  const { state } = useSession();

  const fuenteLabel = state?.analitica_fuente === "adaptados" ? "Codificada" : "Original";
  const siblingsLabel =
    state?.estudio_processing_mode === "independent_siblings" && (state?.n_bases ?? 0) > 1
      ? `${state?.n_bases ?? 0} bases`
      : "Base activa";

  return (
    <Panel className="analitica-bases-panel">
      <div className="analitica-report-shell analitica-bases-workbench">
        <div className="analitica-bases-docbar">
          <span className="analitica-bases-docbar-icon" aria-hidden="true">
            <Database size={16} />
          </span>
          <div className="analitica-bases-docbar-copy">
            <span>Archivos del estudio</span>
            <strong>Bases e instrumentos</strong>
            <small>Descarga la base, el formulario y formatos de análisis sin modificar el proyecto.</small>
          </div>
          <div className="analitica-bases-docbar-stats" aria-label="Estado de bases e instrumento">
            <span>
              Fuente activa
              <strong>{fuenteLabel}</strong>
            </span>
            <span>
              Alcance
              <strong>{siblingsLabel}</strong>
            </span>
            <span>
              Salidas
              <strong>SAV / CSV / XLSX</strong>
            </span>
          </div>
        </div>
        <BasesUseGuide fuenteLabel={fuenteLabel} siblingsLabel={siblingsLabel} />
        <UnifiedSiblingsCard cfg={bases.xlsx} />
        <ArchivosFuenteSection />
        <MetadatosSection />
        <SavCard cfg={bases.sav} onChange={setBasesSav} />
        <CsvCard cfg={bases.csv} onChange={setBasesCsv} />
        <XlsxCard cfg={bases.xlsx} onChange={setBasesXlsx} />
      </div>
    </Panel>
  );
}

// ---- Guia rapida ----------------------------------------------------------

function BasesUseGuide({
  fuenteLabel,
  siblingsLabel,
}: {
  fuenteLabel: string;
  siblingsLabel: string;
}) {
  return (
    <div className="analitica-bases-guide" aria-label="Guía rápida para elegir archivos">
      <div className="analitica-bases-guide-context">
        <Info size={14} />
        <div>
          <strong>Fuente {fuenteLabel.toLowerCase()} · {siblingsLabel}</strong>
          <span>Elige según lo que necesitas hacer ahora; cada descarga es una copia y no cambia el proyecto.</span>
        </div>
      </div>
      <div className="analitica-bases-guide-options">
        <span>
          <FileCode2 size={14} />
          <strong>Revisar origen</strong>
          <small>Base + formulario</small>
        </span>
        <span>
          <Database size={14} />
          <strong>Comparar bases</strong>
          <small>Excel combinado</small>
        </span>
        <span>
          <FileSpreadsheet size={14} />
          <strong>Analizar fuera</strong>
          <small>SAV, CSV o Excel</small>
        </span>
      </div>
    </div>
  );
}

// ---- Archivos fuente ------------------------------------------------------

function ArchivosFuenteSection() {
  return (
    <Section
      title={
        <span className="analitica-inline-title">
          <FileCode2 size={14} /> Revisar origen
        </span>
      }
      subtitle="Base y formulario de la fuente activa, listos para auditoría o trazabilidad."
    >
      <div className="analitica-bases-source-grid">
        <SourceDataCard />
        <SourceInstrumentCard />
      </div>
    </Section>
  );
}

function SourceDataCard() {
  const run = useReporteRun();

  async function onGenerate() {
    await run.runSync(apiAnaliticaBasesData);
  }

  return (
    <div className="analitica-bases-source-card">
      <div className="analitica-bases-source-head">
        <span className="analitica-bases-source-icon" aria-hidden="true">
          <FileSpreadsheet size={15} />
        </span>
        <div className="analitica-bases-source-copy">
          <strong>Base de datos</strong>
          <span>
            Respuestas de la fuente activa. Si usas la fuente codificada, incluye las variables recodificadas junto a sus originales.
          </span>
        </div>
      </div>
      <GenerateFooter
        label="Descargar base"
        busy={run.busy}
        fileId={run.fileId}
        downloadName={run.filename ?? "data_codificada.xlsx"}
        error={run.error}
        onGenerate={onGenerate}
        perBase={run.perBase}
      />
    </div>
  );
}

function SourceInstrumentCard() {
  const run = useReporteRun();

  async function onGenerate() {
    await run.runSync(apiAnaliticaBasesInstrumento);
  }

  return (
    <div className="analitica-bases-source-card">
      <div className="analitica-bases-source-head">
        <span className="analitica-bases-source-icon" aria-hidden="true">
          <FileCode2 size={15} />
        </span>
        <div className="analitica-bases-source-copy">
          <strong>Formulario XLSForm</strong>
          <span>
            Instrumento que explica preguntas, opciones y estructura de la base descargada.
          </span>
        </div>
      </div>
      <GenerateFooter
        label="Descargar XLSForm"
        busy={run.busy}
        fileId={run.fileId}
        downloadName={run.filename ?? "instrumento_codificado.xlsx"}
        error={run.error}
        onGenerate={onGenerate}
        perBase={run.perBase}
      />
    </div>
  );
}

// ---- Metadatos SPSS (inferencia editable) ---------------------------------

function MetadatosSection() {
  const overridesCount = useAnaliticaStore(
    (s) => Object.keys(s.config.bases.overrides ?? {}).length,
  );
  const summary =
    overridesCount === 0
      ? "inferencia automática"
      : `${overridesCount} ${overridesCount === 1 ? "variable editada" : "variables editadas"}`;

  return (
    <Section
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Wand2 size={14} /> Lectura para SPSS
        </span>
      }
      subtitle={
        <>
          Ajusta solo si una variable necesita leerse como categoría, orden o escala numérica antes de crear el archivo.
        </>
      }
    >
      <Collapsible
        title="Ajustar lectura"
        summary={summary}
        defaultOpen={overridesCount > 0}
      >
        <MetadatosEditor />
      </Collapsible>
    </Section>
  );
}

// ---- SAV card -------------------------------------------------------------

function SavCard({
  cfg,
  onChange,
}: {
  cfg: { incluir_sps: boolean };
  onChange: (patch: Partial<{ incluir_sps: boolean }>) => void;
}) {
  const run = useReporteRun();
  const [writer, setWriter] = useState<BasesSavWriterInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await apiAnaliticaBasesMetadata();
        if (!cancelled) setWriter(r.sav_writer ?? null);
      } catch {
        if (!cancelled) setWriter(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function onGenerate() {
    await run.runSync(() => apiAnaliticaBasesSav({ incluir_sps: cfg.incluir_sps }));
  }

  const downloadName = cfg.incluir_sps ? "bases_sav.zip" : "datos.sav";

  return (
    <Section
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Database size={14} /> Analizar en SPSS
        </span>
      }
      subtitle={
        <>
          Archivo SAV con etiquetas de variables, respuestas y tipo de medida.
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
            datos.sav
          </code>
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
            La lectura de cada columna se guarda dentro del archivo. Si necesitas corregir una variable, usa “Cómo leer variables en SPSS”.
          </div>
        </div>
        <SavWriterStatus writer={writer} />

        <Collapsible title="Avanzado" summary={cfg.incluir_sps ? "respaldo incluido" : "sin respaldo"} defaultOpen={false}>
          <label
            style={{
              display: "inline-flex", alignItems: "flex-start", gap: 8,
              fontSize: 12, cursor: "pointer", padding: "4px 0",
            }}
          >
            <input
              type="checkbox"
              checked={cfg.incluir_sps}
              onChange={(e) => onChange({ incluir_sps: e.target.checked })}
              style={{ marginTop: 2 }}
            />
            <span>
              <strong>Incluir respaldo técnico para SPSS</strong>
              <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 2, lineHeight: 1.5 }}>
                Agrega un archivo con instrucciones de lectura. Normalmente no hace falta; actívalo solo si alguien necesita auditar la importación.
              </div>
            </span>
          </label>
        </Collapsible>

        <GenerateFooter
          label="Descargar archivo SAV"
          busy={run.busy}
          fileId={run.fileId}
          downloadName={run.filename ?? downloadName}
          error={run.error}
          onGenerate={onGenerate}
          perBase={run.perBase}
        />
      </div>
    </Section>
  );
}

function SavWriterStatus({ writer }: { writer: BasesSavWriterInfo | null }) {
  const ok = writer?.engine === "pyreadstat" && writer.ok !== false;
  const fallbackMessage =
    writer?.message && !/fallback|\.sps/i.test(writer.message)
      ? writer.message
      : "Si el motor principal no está disponible, conserva el respaldo para SPSS.";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        fontSize: 11,
        color: ok ? "var(--tipo-int-fg)" : "var(--pulso-text-soft)",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          borderRadius: 999,
          border: `1px solid ${ok ? "var(--tipo-int-border)" : "var(--pulso-border)"}`,
          background: ok ? "var(--tipo-int-bg)" : "var(--pulso-surface)",
          fontWeight: 700,
        }}
      >
        {ok ? "Metadatos embebidos" : "Respaldo disponible"}
      </span>
      <span>
        {ok
          ? "El archivo guarda etiquetas y tipos de medida dentro del SAV."
          : fallbackMessage}
      </span>
    </div>
  );
}

// ---- CSV card -------------------------------------------------------------

function CsvCard({
  cfg,
  onChange,
}: {
  cfg: {
    valores: "codigos" | "etiquetas";
    separador: "," | ";";
    multi_select: "codigos_crudos" | "etiquetas_unidas" | "dummy_01";
  };
  onChange: (patch: Partial<typeof cfg>) => void;
}) {
  const run = useReporteRun();

  async function onGenerate() {
    await run.runSync(() =>
      apiAnaliticaBasesCsv({
        valores: cfg.valores,
        separador: cfg.separador,
        multi_select: cfg.multi_select,
      }),
    );
  }

  return (
    <Section
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <FileText size={14} /> Compartir CSV
        </span>
      }
      subtitle="Archivo plano para equipos que trabajan en R, Python, Stata o Excel."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <RadioRow
          label="Contenido"
          value={cfg.valores}
          onChange={(v) => onChange({ valores: v as "codigos" | "etiquetas" })}
          options={[
            { value: "codigos", label: "Códigos", hint: "Valores como 1, 2, 3 para análisis." },
            { value: "etiquetas", label: "Etiquetas", hint: "Textos legibles para revisar o compartir." },
          ]}
        />

        <RadioRow
          label="Preguntas multi-respuesta"
          value={cfg.multi_select}
          onChange={(v) => onChange({ multi_select: v as "codigos_crudos" | "etiquetas_unidas" | "dummy_01" })}
          options={[
            { value: "dummy_01", label: "Expandir a columnas 0/1", hint: "Una columna por opción (estándar en análisis estadístico)." },
            {
              value: "etiquetas_unidas",
              label: "Etiquetas unidas con '|'",
              hint: "Solo aplica si el contenido es 'Etiquetas'.",
              disabled: cfg.valores !== "etiquetas",
            },
            { value: "codigos_crudos", label: "Mantener códigos originales", hint: "Conserva respuestas como '1 3 5'." },
          ]}
        />

        <RadioRow
          label="Separador"
          value={cfg.separador}
          onChange={(v) => onChange({ separador: v as "," | ";" })}
          options={[
            { value: ",", label: "Coma (,)", hint: "Estándar internacional." },
            { value: ";", label: "Punto y coma (;)", hint: "Para Excel en locales donde la coma es decimal (ES, FR, DE…)." },
          ]}
        />

        <GenerateFooter
          label="Exportar CSV"
          busy={run.busy}
          fileId={run.fileId}
          downloadName={run.filename ?? "datos.csv"}
          error={run.error}
          onGenerate={onGenerate}
          perBase={run.perBase}
        />
      </div>
    </Section>
  );
}

// ---- XLSX card ------------------------------------------------------------

function XlsxCard({
  cfg,
  onChange,
}: {
  cfg: {
    valores: "codigos" | "etiquetas" | "ambos";
    multi_select: "codigos_crudos" | "etiquetas_unidas" | "dummy_01";
  };
  onChange: (patch: Partial<typeof cfg>) => void;
}) {
  const run = useReporteRun();

  async function onGenerate() {
    await run.runSync(() =>
      apiAnaliticaBasesXlsx({ valores: cfg.valores, multi_select: cfg.multi_select }),
    );
  }

  const etiquetasDisabled = cfg.valores === "codigos";

  return (
    <Section
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <FileSpreadsheet size={14} /> Revisar en Excel
        </span>
      }
      subtitle="Libro de trabajo para lectura rápida de códigos, etiquetas y preguntas multi-respuesta."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <RadioRow
          label="Contenido"
          value={cfg.valores}
          onChange={(v) => onChange({ valores: v as "codigos" | "etiquetas" | "ambos" })}
          options={[
            { value: "ambos", label: "Códigos y etiquetas", hint: "Dos hojas: una para análisis y otra para lectura." },
            { value: "codigos", label: "Solo códigos", hint: "Una sola hoja con valores numéricos." },
            { value: "etiquetas", label: "Solo etiquetas", hint: "Una sola hoja con texto legible." },
          ]}
        />

        <RadioRow
          label="Preguntas multi-respuesta"
          value={cfg.multi_select}
          onChange={(v) => onChange({ multi_select: v as "codigos_crudos" | "etiquetas_unidas" | "dummy_01" })}
          options={[
            { value: "dummy_01", label: "Expandir a columnas 0/1", hint: "Una columna por opción (estándar en análisis estadístico)." },
            {
              value: "etiquetas_unidas",
              label: "Etiquetas unidas con '|'",
              hint: "Solo afecta la hoja de etiquetas.",
              disabled: etiquetasDisabled,
            },
            { value: "codigos_crudos", label: "Mantener códigos originales", hint: "Conserva respuestas como '1 3 5'." },
          ]}
        />

        <GenerateFooter
          label="Exportar Excel"
          busy={run.busy}
          fileId={run.fileId}
          downloadName={run.filename ?? "datos.xlsx"}
          error={run.error}
          onGenerate={onGenerate}
          perBase={run.perBase}
        />
      </div>
    </Section>
  );
}

function UnifiedSiblingsCard({
  cfg,
}: {
  cfg: {
    valores: "codigos" | "etiquetas" | "ambos";
    multi_select: "codigos_crudos" | "etiquetas_unidas" | "dummy_01";
  };
}) {
  const cleanRun = useReporteRun();
  const metadataRun = useReporteRun();
  const { state } = useSession();
  const enabled = state?.estudio_processing_mode === "independent_siblings" && (state?.n_bases ?? 0) > 1;

  async function onGenerateClean() {
    await cleanRun.runSync(() =>
      apiAnaliticaBasesXlsxUnificada({
        valores: cfg.valores,
        multi_select: cfg.multi_select,
        omitir_identificadores_directos: true,
        omitir_metadatos_operativos: true,
      }),
    );
  }

  async function onGenerateWithMetadata() {
    await metadataRun.runSync(() =>
      apiAnaliticaBasesXlsxUnificada({
        valores: cfg.valores,
        multi_select: cfg.multi_select,
        omitir_identificadores_directos: false,
        omitir_metadatos_operativos: false,
      }),
    );
  }

  if (!enabled) return null;

  const summary = metadataRun.lastResult?.unified ?? cleanRun.lastResult?.unified;

  return (
    <Section
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <FileSpreadsheet size={14} /> Comparar todas las bases en Excel
        </span>
      }
      subtitle={
        <>
          Descarga una tabla temporal con todas las bases hermanas para comparar variables comunes.
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 6,
            border: "1px solid var(--pulso-border)",
            background: "var(--pulso-surface)",
            fontSize: 11,
            color: "var(--pulso-text-soft)",
            lineHeight: 1.5,
          }}
        >
          No cambia tus bases dentro del proyecto. Solo descarga una tabla combinada para exploración en Excel.
          {summary && (
            <div style={{ marginTop: 6, color: "var(--pulso-text)" }}>
              {summary.n_filas} filas · {summary.n_columnas} columnas · {summary.n_variables_comunes} comunes · {summary.n_variables_no_comunes} no comunes
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div>
            <GenerateFooter
              label="Descargar base limpia"
              busy={cleanRun.busy}
              fileId={cleanRun.fileId}
              downloadName={cleanRun.filename ?? "bases_unificadas.xlsx"}
              error={cleanRun.error}
              onGenerate={onGenerateClean}
              perBase={cleanRun.perBase}
            />
          </div>
          <div
            title="Incluye variables identificadoras y metadatos operativos como survey_id, response_id, collector_id, estado y fechas."
          >
            <GenerateFooter
              label="Descargar con metadatos"
              busy={metadataRun.busy}
              fileId={metadataRun.fileId}
              downloadName={metadataRun.filename ?? "bases_unificadas_con_metadata.xlsx"}
              error={metadataRun.error}
              onGenerate={onGenerateWithMetadata}
              disabled={cleanRun.busy}
              disabledHint={cleanRun.busy ? "Espera a que termine la exportación limpia." : undefined}
              perBase={metadataRun.perBase}
              variant="secondary"
            />
          </div>
        </div>
      </div>
    </Section>
  );
}

// ---- Sub-components -------------------------------------------------------

type RadioOption = {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
};

function RadioRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: RadioOption[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {options.map((opt) => (
          <RadioOption
            key={opt.value}
            opt={opt}
            active={value === opt.value}
            onSelect={() => onChange(opt.value)}
          />
        ))}
      </div>
    </div>
  );
}

function RadioOption({
  opt,
  active,
  onSelect,
}: {
  opt: RadioOption;
  active: boolean;
  onSelect: () => void;
}) {
  const [hover, setHover] = useState(false);
  const isDisabled = !!opt.disabled;
  const borderColor = active
    ? "var(--pulso-primary)"
    : hover && !isDisabled
    ? "var(--pulso-text-soft)"
    : "var(--pulso-border)";
  const bg = active
    ? "var(--pulso-primary-soft)"
    : hover && !isDisabled
    ? "var(--pulso-surface)"
    : "white";

  return (
    <label
      title={isDisabled ? "No disponible con esta configuración" : opt.hint}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 9,
        padding: "9px 12px", borderRadius: 6,
        border: `1px solid ${borderColor}`,
        background: bg,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.5 : 1,
        transition: "background 120ms ease, border-color 120ms ease",
      }}
    >
      <input
        type="radio"
        checked={active}
        disabled={isDisabled}
        onChange={() => !isDisabled && onSelect()}
        style={{
          marginTop: 2,
          accentColor: "var(--pulso-primary)",
          cursor: isDisabled ? "not-allowed" : "pointer",
        }}
      />
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pulso-text)", lineHeight: 1.35 }}>
          {opt.label}
        </span>
        {opt.hint && (
          <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.45 }}>
            {opt.hint}
          </span>
        )}
      </span>
    </label>
  );
}
