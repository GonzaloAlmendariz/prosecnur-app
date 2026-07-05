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
            <span>Producto de base</span>
            <strong>Bases e instrumento</strong>
            <small>Descarga la base lista para trabajar y el formulario que la explica.</small>
          </div>
          <div className="analitica-bases-docbar-stats" aria-label="Estado de bases e instrumento">
            <span>
              Fuente
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
        <FuenteInfo />
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

// ---- Fuente info ----------------------------------------------------------

function FuenteInfo() {
  const { state } = useSession();
  const fuenteLabel = state?.analitica_fuente === "adaptados" ? "Codificada" : "Original";

  return (
    <div className="analitica-bases-info">
      <Info size={14} />
      <div>
        Todas las descargas salen desde la <strong>fuente activa</strong>: <strong>{fuenteLabel}</strong>.
        Usa los archivos fuente para auditar el origen y los formatos analíticos para compartir o analizar la base.
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
          <FileCode2 size={14} /> Archivos fuente
        </span>
      }
      subtitle="Los archivos tal como quedan en la fuente activa. Úsalos para respaldar, revisar o entregar el paquete base."
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
            Archivo de datos de la fuente activa. Si trabajas con la versión codificada, incluye las variables recodificadas y su formato.
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
          <strong>XLSForm</strong>
          <span>
            Formulario que documenta preguntas, opciones y estructura. La versión codificada conserva las marcas de recodificación.
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
          Revisa cómo SPSS leerá cada variable: categoría, orden o escala numérica. Si una escala
          quedó mal interpretada, corrígela aquí antes de exportar el <code>.sav</code>.
        </>
      }
    >
      <Collapsible
        title="Revisar lectura de variables"
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
          <Database size={14} /> SPSS (.sav)
        </span>
      }
      subtitle={
        <>
          Archivo listo para abrir en SPSS con etiquetas de variable, etiquetas de respuesta y tipo de medida incluidos.
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
            El sistema prepara la lectura de cada columna para SPSS. Si necesitas auditar el detalle técnico, revísalo en “Lectura para SPSS”.
          </div>
        </div>
        <SavWriterStatus writer={writer} />

        <Collapsible title="Avanzado" summary={cfg.incluir_sps ? ".sps incluido" : "Sin .sps"} defaultOpen={false}>
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
              <strong>Incluir archivo de respaldo para SPSS</strong>
              <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 2, lineHeight: 1.5 }}>
                Agrega un archivo técnico con las instrucciones de lectura. Normalmente no hace falta; actívalo solo si alguien necesita revisar el detalle en SPSS.
              </div>
            </span>
          </label>
        </Collapsible>

        <GenerateFooter
          label="Exportar .sav"
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
        {ok ? "pyreadstat activo" : "fallback SAV"}
      </span>
      <span>
        {ok
          ? "Metadatos SPSS embebidos en el .sav."
          : writer?.message ?? "Si el motor cae a fallback, conserva el .sps como respaldo."}
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
          <FileText size={14} /> CSV
        </span>
      }
      subtitle="Archivo plano para equipos que trabajan en Excel, R, Python o Stata."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <RadioRow
          label="Contenido"
          value={cfg.valores}
          onChange={(v) => onChange({ valores: v as "codigos" | "etiquetas" })}
          options={[
            { value: "codigos", label: "Códigos", hint: "Valores como 1, 2, 3 para análisis estadístico." },
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
            { value: "codigos_crudos", label: "Códigos crudos ('1 3 5')", hint: "Preserva el formato original del dataset." },
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
          <FileSpreadsheet size={14} /> Excel (.xlsx)
        </span>
      }
      subtitle="Libro para revisar la base sin software especializado. Incluye nombres técnicos y etiquetas de variable."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <RadioRow
          label="Contenido"
          value={cfg.valores}
          onChange={(v) => onChange({ valores: v as "codigos" | "etiquetas" | "ambos" })}
          options={[
            { value: "ambos", label: "Ambos (2 hojas)", hint: "Hoja 'codigos' + hoja 'etiquetas' en el mismo archivo." },
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
            { value: "codigos_crudos", label: "Códigos crudos ('1 3 5')", hint: "Preserva el formato original." },
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
          <FileSpreadsheet size={14} /> Base unificada entre bases
        </span>
      }
      subtitle={
        <>
          Descarga una sola base con todas las bases hermanas. La salida estándar omite datos personales no necesarios;
          usa <strong>Con metadatos</strong> cuando necesites reenviar o revisar la base completa. El libro separa variables
          comunes y no comunes para que las comparaciones se lean con claridad.
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
          Mantiene cada base independiente dentro del proyecto. Esta descarga solo arma una tabla combinada para exploración en Excel.
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
              label="Exportar base unificada"
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
              label="Con metadatos"
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
