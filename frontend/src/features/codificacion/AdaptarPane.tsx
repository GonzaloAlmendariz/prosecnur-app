import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Play, RefreshCw } from "lucide-react";
import {
  apiCodifAplicar,
  apiCodifPlanAdaptacion,
  AplicarResult,
  downloadUrl,
  PlanAdaptacion,
  PlanPregunta,
} from "../../api/client";
import { Alert } from "../../components/Alert";
import { JobProgress } from "../../components/JobProgress";
import { Panel } from "../../components/Panel";
import { LoadingBlock, ErrorBlock } from "../../components/States";

type Props = {
  onBackToCodificar: () => void;
};

export function AdaptarPane({ onBackToCodificar }: Props) {
  const [plan, setPlan] = useState<PlanAdaptacion | null>(null);
  const [loadErr, setLoadErr] = useState<string>("");
  const [busyLoad, setBusyLoad] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [runErr, setRunErr] = useState<string>("");
  const [output, setOutput] = useState<{ data: string; inst: string } | null>(null);

  async function load() {
    setBusyLoad(true);
    setLoadErr("");
    try {
      const p = await apiCodifPlanAdaptacion();
      setPlan(p);
    } catch (e) {
      setLoadErr((e as Error).message);
    } finally {
      setBusyLoad(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function onAdaptar() {
    setRunErr("");
    setOutput(null);
    try {
      const r = await apiCodifAplicar();
      setJobId(r.job_id);
    } catch (e) {
      setRunErr((e as Error).message);
    }
  }

  function onJobDone(d: AplicarResult) {
    setOutput({ data: d.data_adaptada.file_id, inst: d.instrumento_adaptado.file_id });
    setJobId(null);
  }
  function onJobError(msg: string) { setRunErr(msg); setJobId(null); }
  function onJobCancelled() { setJobId(null); }

  if (loadErr) return <ErrorBlock label="Error cargando plan" detail={loadErr} />;
  if (!plan) return <LoadingBlock label="Cargando resumen…" />;

  const noHayNada = plan.preguntas.length === 0;
  const preguntasSoportadas = plan.preguntas.filter((p) => p.bridge_soportado);
  const preguntasNoSoportadas = plan.preguntas.filter((p) => !p.bridge_soportado);
  // Los totales mostrados en el header reflejan solo lo que realmente se
  // va a adaptar (preguntas soportadas). El backend devuelve totales que
  // incluyen las no-soportadas; las reclacula aquí para evitar el gap
  // visual "2 preguntas pero veo 1 card".
  const t = {
    n_preguntas: preguntasSoportadas.length,
    n_variables_nuevas: preguntasSoportadas.length,
    n_codigos_nuevos: preguntasSoportadas.reduce((s, p) => s + p.n_codigos_nuevos, 0),
    n_codigos_reutilizados: preguntasSoportadas.reduce((s, p) => s + p.n_codigos_reutilizados, 0),
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header con totales */}
      <div
        style={{
          background: "white",
          border: "1px solid var(--pulso-border)",
          borderRadius: 8,
          padding: 16,
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <Stat label="Preguntas" value={t.n_preguntas} />
        <Divider />
        <Stat label="Variables nuevas" value={t.n_variables_nuevas} hint="Se agregan como *_recod al dataset" />
        <Divider />
        <Stat label="Códigos nuevos" value={t.n_codigos_nuevos} />
        <Divider />
        <Stat label="Códigos reutilizados" value={t.n_codigos_reutilizados} hint="Opciones existentes que reciben más respuestas" />
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={load}
          disabled={busyLoad}
          style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
          title="Recargar el resumen (útil si volviste a codificar)"
        >
          <RefreshCw size={12} /> Actualizar
        </button>
      </div>

      {noHayNada && (
        <Alert kind="warn">
          No hay preguntas con grupos codificados. Vuelve al paso <strong>2 · Codificar</strong> y agrupa respuestas antes de adaptar.
        </Alert>
      )}

      {/* Tabla de preguntas soportadas */}
      {preguntasSoportadas.length > 0 && (
        <Panel eyebrow="Qué se va a adaptar" title="Variables que se crearán en el dataset">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {preguntasSoportadas.map((p) => (
              <PreguntaPlanCard key={p.parent} p={p} />
            ))}
          </div>
        </Panel>
      )}

      {/* No soportadas (text sin pareja, SM sin dummy, etc) */}
      {preguntasNoSoportadas.length > 0 && (
        <Alert kind="warn">
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {preguntasNoSoportadas.length} {preguntasNoSoportadas.length === 1 ? "pregunta quedará" : "preguntas quedarán"} fuera de la adaptación
          </div>
          <div style={{ fontSize: 12 }}>
            Estas preguntas tienen grupos codificados pero su configuración no permite adaptarlas automáticamente todavía:
          </div>
          <ul style={{ marginTop: 6, marginBottom: 0, fontSize: 12, paddingLeft: 20 }}>
            {preguntasNoSoportadas.map((p) => (
              <li key={p.parent}>
                <code style={{ fontFamily: "monospace" }}>{p.parent}</code> — {p.parent_label} ({motivoNoSoportado(p)})
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Acciones */}
      {!output && (
        <div
          style={{
            background: "var(--pulso-surface)",
            borderRadius: 6,
            padding: 14,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <button type="button" onClick={onBackToCodificar} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={13} /> Volver a codificar
          </button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="pulso-primary"
            onClick={onAdaptar}
            disabled={!!jobId || t.n_preguntas === 0}
            style={{ fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Play size={14} /> Adaptar dataset
          </button>
        </div>
      )}

      {jobId && (
        <JobProgress<AplicarResult>
          label="Adaptando dataset e instrumento"
          jobId={jobId}
          onDone={onJobDone}
          onError={onJobError}
          onCancelled={onJobCancelled}
        />
      )}

      {runErr && <Alert kind="error">{runErr}</Alert>}

      {output && (
        <Panel eyebrow="Resultado" title="Archivos adaptados listos para descargar">
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--pulso-success-fg)", marginBottom: 10 }}>
            <CheckCircle2 size={16} /> La adaptación terminó correctamente.
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a
              href={downloadUrl(output.data)}
              download="data_adaptada.xlsx"
              className="pulso-primary"
              style={{ fontSize: 13, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
            >
              <Download size={14} /> data_adaptada.xlsx
            </a>
            <a
              href={downloadUrl(output.inst)}
              download="instrumento_adaptado.xlsx"
              style={{ fontSize: 13, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Download size={14} /> instrumento_adaptado.xlsx
            </a>
          </div>
        </Panel>
      )}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 22, fontWeight: 700, color: "var(--pulso-primary)" }}>{value}</span>
      <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--pulso-text-soft)" }}>
        {label}
      </span>
      {hint && <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>{hint}</span>}
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, alignSelf: "stretch", background: "var(--pulso-border)" }} />;
}

function PreguntaPlanCard({ p }: { p: PlanPregunta }) {
  const arqLabel =
    p.tipo === "select_one" && p.modo_so === "hijo" ? "SO · texto codificado aparte" :
    p.tipo === "select_one" && p.modo_so === "padre" ? "SO · texto integrado a opciones originales" :
    p.tipo === "integer" ? "Numérica · rangos" :
    p.tipo === "text" ? "Texto abierto" :
    p.tipo === "select_multiple" ? "Opción múltiple" : p.tipo;

  return (
    <article
      style={{
        border: "1px solid var(--pulso-border)",
        borderRadius: 6,
        padding: 12,
        background: "white",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <code style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: "var(--pulso-primary)" }}>
          {p.parent}
        </code>
        <span style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>{p.parent_label}</span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            color: "var(--pulso-text-soft)",
          }}
        >
          {arqLabel}
        </span>
      </div>

      <div
        style={{
          marginTop: 10,
          padding: "8px 10px",
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 4,
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: "var(--pulso-success-fg)", fontWeight: 700 }}>Nueva variable:</span>
        <code style={{ fontFamily: "monospace", fontWeight: 700 }}>{p.nueva_variable}</code>
        <span style={{ color: "var(--pulso-success-fg)" }}>·</span>
        <span>{p.n_respuestas_afectadas} {p.n_respuestas_afectadas === 1 ? "respuesta afectada" : "respuestas afectadas"}</span>
      </div>

      {/* Códigos nuevos */}
      {p.codigos_nuevos.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
            {p.codigos_nuevos.length} código{p.codigos_nuevos.length === 1 ? "" : "s"} nuevo{p.codigos_nuevos.length === 1 ? "" : "s"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {p.codigos_nuevos.map((c) => (
              <CodigoRow key={`n-${c.codigo}`} c={c} kind="nuevo" />
            ))}
          </div>
        </div>
      )}

      {/* Códigos reutilizados */}
      {p.codigos_reutilizados.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
            {p.codigos_reutilizados.length} opción{p.codigos_reutilizados.length === 1 ? "" : "es"} existente{p.codigos_reutilizados.length === 1 ? "" : "s"} reutilizada{p.codigos_reutilizados.length === 1 ? "" : "s"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {p.codigos_reutilizados.map((c) => (
              <CodigoRow key={`r-${c.codigo}`} c={c} kind="reuso" />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function CodigoRow({ c, kind }: { c: { codigo: string; etiqueta: string; n_respuestas: number }; kind: "nuevo" | "reuso" }) {
  const bg = kind === "nuevo" ? "var(--pulso-success-bg)" : "#eef2ff";
  const fg = kind === "nuevo" ? "var(--pulso-success-fg)" : "#4338ca";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "50px 1fr auto",
        gap: 10,
        alignItems: "center",
        fontSize: 12,
        padding: "3px 8px",
      }}
    >
      <code
        style={{
          fontFamily: "monospace",
          fontWeight: 700,
          padding: "2px 8px",
          background: bg,
          color: fg,
          borderRadius: 4,
          fontSize: 11,
          textAlign: "center",
        }}
      >
        {c.codigo}
      </code>
      <span>{c.etiqueta || <em style={{ color: "var(--pulso-text-soft)" }}>sin etiqueta</em>}</span>
      <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
        {c.n_respuestas} {c.n_respuestas === 1 ? "respuesta" : "respuestas"}
      </span>
    </div>
  );
}

function motivoNoSoportado(p: PlanPregunta): string {
  if (p.tipo === "text" && !p.text_col) return "texto sin pareja SO/SM";
  if (p.tipo === "select_multiple" && !p.text_col) return "SM sin 'Otros, especifique' emparejado";
  return "configuración no reconocida";
}
