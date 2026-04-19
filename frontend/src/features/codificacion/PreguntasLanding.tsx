import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { AlertCircle, ArrowRight, CheckCircle2, Circle, CircleDashed, Loader2, Settings2, SlidersHorizontal } from "lucide-react";
import { apiCodifPreguntasAbiertas, PreguntaAbierta, PreguntaStatus } from "../../api/client";
import { Alert } from "../../components/Alert";

type Filter = "codificables" | "todas" | "pendientes" | "completas";

const STATUS_META: Record<PreguntaStatus, { label: string; icon: typeof Circle; color: string; bg: string }> = {
  "no-aplica": { label: "No se codifica", icon: Circle, color: "#6b7280", bg: "#f3f4f6" },
  "requiere-config": { label: "Requiere padre/hijo", icon: Settings2, color: "#a55a00", bg: "#fff7e0" },
  "sin-datos": { label: "Sin respuestas", icon: CircleDashed, color: "#6b7280", bg: "#f3f4f6" },
  "no-iniciado": { label: "Pendiente", icon: Circle, color: "#1d4ed8", bg: "#eff6ff" },
  "en-curso": { label: "En curso", icon: Loader2, color: "#0e7490", bg: "#ecfeff" },
  "completo": { label: "Completo", icon: CheckCircle2, color: "#166534", bg: "#dcfce7" },
};

const SUBTIPO_LABEL: Record<string, string> = {
  select_one_padre: "Opción única (valor)",
  select_one_hijo: "Opción única + texto abierto",
  select_one_sin_modo: "Opción única (config)",
  select_multiple: "Múltiple",
  integer: "Numérica",
  text: "Texto abierto",
};

export function PreguntasLanding() {
  const [data, setData] = useState<PreguntaAbierta[] | null>(null);
  const [error, setError] = useState<string>("");
  const [filter, setFilter] = useState<Filter>("codificables");
  const [query, setQuery] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const r = await apiCodifPreguntasAbiertas();
        setData(r.preguntas);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  const counts = useMemo(() => {
    if (!data) return null;
    const c: Record<string, number> = { total: data.length, codificables: 0, pendientes: 0, completas: 0, "no-aplica": 0, "requiere-config": 0 };
    for (const p of data) {
      if (p.status === "no-aplica") c["no-aplica"] += 1;
      else if (p.status === "requiere-config") c["requiere-config"] += 1;
      else if (p.status === "completo") c.completas += 1;
      else if (p.status === "no-iniciado" || p.status === "en-curso") c.pendientes += 1;
      if (["no-iniciado", "en-curso", "completo"].includes(p.status)) c.codificables += 1;
    }
    return c;
  }, [data]);

  const visible = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.filter((p) => {
      if (filter === "codificables" && !["no-iniciado", "en-curso", "completo"].includes(p.status)) return false;
      if (filter === "pendientes" && !["no-iniciado", "en-curso"].includes(p.status)) return false;
      if (filter === "completas" && p.status !== "completo") return false;
      if (!q) return true;
      return p.parent.toLowerCase().includes(q) || p.parent_label.toLowerCase().includes(q);
    });
  }, [data, filter, query]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <Alert kind="info">Detectando preguntas abiertas…</Alert>;

  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <FilterChip label={`Codificables (${counts?.codificables ?? 0})`} active={filter === "codificables"} onClick={() => setFilter("codificables")} />
        <FilterChip label={`Pendientes (${counts?.pendientes ?? 0})`} active={filter === "pendientes"} onClick={() => setFilter("pendientes")} />
        <FilterChip label={`Completas (${counts?.completas ?? 0})`} active={filter === "completas"} onClick={() => setFilter("completas")} />
        <FilterChip label={`Todas (${counts?.total ?? 0})`} active={filter === "todas"} onClick={() => setFilter("todas")} />
        <div style={{ flex: 1 }} />
        <input
          placeholder="Buscar por nombre o etiqueta"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ fontSize: 13, width: 280 }}
        />
      </div>

      {visible.length === 0 && (
        <Alert kind="info">No hay preguntas en esta vista.</Alert>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
        {visible.map((p) => <PreguntaCard key={p.parent} p={p} />)}
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "5px 12px",
        borderRadius: 999,
        fontSize: 13,
        border: active ? "1px solid var(--pulso-primary)" : "1px solid var(--pulso-border)",
        background: active ? "var(--pulso-primary)" : "white",
        color: active ? "white" : "var(--pulso-text)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function PreguntaCard({ p }: { p: PreguntaAbierta }) {
  const meta = STATUS_META[p.status];
  const Icon = meta.icon;
  const codificable = ["no-iniciado", "en-curso", "completo"].includes(p.status);
  const pct = p.n_unicas > 0 ? Math.round((p.n_codificadas / p.n_unicas) * 100) : 0;

  const card = (
    <article
      style={{
        border: "1px solid var(--pulso-border)",
        borderRadius: 8,
        padding: 14,
        background: "white",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 180,
        position: "relative",
        cursor: codificable ? "pointer" : "default",
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600, color: "var(--pulso-primary)" }}>{p.parent}</div>
        <div style={{ flex: 1 }} />
        <StatusBadge meta={meta} Icon={Icon} label={meta.label} />
      </div>
      <div style={{ fontSize: 13, color: "var(--pulso-text)", lineHeight: 1.35 }} title={p.parent_label}>
        {truncate(p.parent_label, 120)}
      </div>
      <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", display: "flex", gap: 10, flexWrap: "wrap" }}>
        <span><span style={{ fontWeight: 600 }}>{SUBTIPO_LABEL[p.subtipo] ?? p.subtipo}</span></span>
        {p.col_efectiva && (
          <span>col: <code style={{ fontFamily: "monospace" }}>{p.col_efectiva}</code></span>
        )}
      </div>
      {p.n_respuestas > 0 && (
        <div style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>
          <strong style={{ color: "var(--pulso-text)" }}>{p.n_respuestas}</strong> respuestas · <strong style={{ color: "var(--pulso-text)" }}>{p.n_unicas}</strong> únicas
          {pct > 0 && <> · <strong style={{ color: meta.color }}>{pct}%</strong> codificado</>}
        </div>
      )}
      {p.preview && p.preview.length > 0 && (
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic", borderLeft: "2px solid var(--pulso-border)", paddingLeft: 8 }}>
          {p.preview.slice(0, 2).map((pv, i) => <div key={i}>“{truncate(pv, 60)}”</div>)}
        </div>
      )}
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {codificable ? (
          <span style={{ fontSize: 12, color: "var(--pulso-primary)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            Codificar <ArrowRight size={12} />
          </span>
        ) : (
          <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
            {p.status === "requiere-config" && "Configura padre/hijo en modo avanzado"}
            {p.status === "sin-datos" && "No hay respuestas en el dataset"}
            {p.status === "no-aplica" && "Desactivada"}
          </span>
        )}
      </div>
    </article>
  );

  if (codificable) {
    return (
      <NavLink
        to={`/codificacion/preguntas/${encodeURIComponent(p.parent)}`}
        style={{ textDecoration: "none", color: "inherit" }}
      >
        {card}
      </NavLink>
    );
  }
  return card;
}

function StatusBadge({ meta, Icon, label }: { meta: { color: string; bg: string }; Icon: typeof Circle; label: string }) {
  const isSpinning = label === "En curso";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        color: meta.color,
        background: meta.bg,
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      <Icon size={11} className={isSpinning ? "pulso-spin" : undefined} />
      {label}
    </span>
  );
}

function truncate(s: string, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// re-export to avoid unused import warning while we iterate
export const _k = SlidersHorizontal;
export const _a = AlertCircle;
