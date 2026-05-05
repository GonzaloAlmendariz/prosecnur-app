import { useState } from "react";
import { Database, FileText, FileSpreadsheet, Info, Wand2 } from "lucide-react";
import {
  apiAnaliticaBasesSav,
  apiAnaliticaBasesCsv,
  apiAnaliticaBasesXlsx,
} from "../../../api/client";
import { Panel } from "../../../components/Panel";
import { Section, Collapsible, GenerateFooter } from "../PaneKit";
import { useReporteRun } from "../useReporteRun";
import { useAnaliticaStore } from "../store";
import { MetadatosEditor } from "../MetadatosEditor";

// BasesPane. Tres formatos independientes (.sav / .csv / .xlsx), cada
// uno con su propia sub-config y su propio botón "Generar". El usuario
// puede re-ejecutar solo lo que cambió sin tocar el resto.
//
// El .sav lleva measure / format.spss / display_width embebidos para
// que SPSS respete ordinal/scale/nominal al abrir. Por eso el toggle
// "Incluir .sps de respaldo" está OFF por defecto — solo se activa
// como red de seguridad para versiones de SPSS que pierdan atributos.

export function BasesPane() {
  const bases = useAnaliticaStore((s) => s.config.bases);
  const setBasesSav = useAnaliticaStore((s) => s.setBasesSav);
  const setBasesCsv = useAnaliticaStore((s) => s.setBasesCsv);
  const setBasesXlsx = useAnaliticaStore((s) => s.setBasesXlsx);

  return (
    <Panel
      eyebrow="Reporte"
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Database size={16} /> Bases</span>}
      hint="Exporta la base de datos preparada en tres formatos: SPSS (.sav) con todos los atributos de medida embebidos, CSV con opciones de codificación, o Excel con hojas paralelas para códigos y etiquetas."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <FuenteInfo />
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
  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", gap: 8,
        padding: "10px 12px", borderRadius: 6,
        background: "var(--pulso-surface)",
        border: "1px solid var(--pulso-border)",
        fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5,
      }}
    >
      <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        Los tres formatos exportan la <strong>misma base</strong> (la que está activa según el toggle de fuente del encabezado).
        Cada formato tiene su propia configuración y su botón "Generar" independiente, así puedes re-ejecutar solo lo que cambió.
      </div>
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
          <Wand2 size={14} /> Metadatos SPSS inferidos
        </span>
      }
      subtitle={
        <>
          Cada variable recibe un <strong>nivel de medida</strong> (nominal/ordinal/escala) inferido
          desde el tipo XLSForm y las value-labels. Si la inferencia no acertó — por ejemplo una
          Likert que quedó como nominal — puedes corregirla aquí. El formato SPSS (<code>F8.0</code>,
          <code>A40</code>, <code>DATE10</code>…) lo elige el sistema automáticamente. Solo afecta
          al export <code>.sav</code>; CSV y XLSX lo ignoran.
        </>
      }
    >
      <Collapsible
        title="Revisar / editar inferencia"
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
          Binario nativo de SPSS con etiquetas de variable, value-labels y <strong>nivel de medida</strong> (nominal/ordinal/escala) embebidos. Listo para abrir sin pasos extra.
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
            Se infiere automáticamente <code>measure</code> (editable arriba), <code>format.spss</code> y <code>display_width</code> por columna a partir del tipo XLSForm (<code>select_one</code> likert → ordinal; <code>integer/decimal</code> → scale; texto → nominal).
          </div>
        </div>

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
              <strong>Incluir <code>niveles_medida.sps</code> de respaldo</strong>
              <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 2, lineHeight: 1.5 }}>
                Syntax con <code>VARIABLE LEVEL</code> + <code>FORMATS</code> por si tu versión de SPSS pierde los measures al abrir el .sav. Si el .sav te abre bien, no lo necesitas. Al activarlo, el output pasa a ser un <code>.zip</code> con ambos archivos.
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
      subtitle="Archivo plano universal. Se abre en cualquier software (Excel, R, Python, Stata). UTF-8 con BOM para compatibilidad con Excel en Windows."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <RadioRow
          label="Contenido"
          value={cfg.valores}
          onChange={(v) => onChange({ valores: v as "codigos" | "etiquetas" })}
          options={[
            { value: "codigos", label: "Códigos numéricos", hint: "Respuestas como 1, 2, 3 — ideal para stats (R, SPSS, Stata)." },
            { value: "etiquetas", label: "Etiquetas de texto", hint: "Respuestas como 'Hombre', 'Mujer' — más legible para humanos." },
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
      subtitle="Libro con los nombres técnicos en la fila 1 y las etiquetas de variable en la fila 2. Ideal para compartir con stakeholders que quieren explorar la base sin software especializado."
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
