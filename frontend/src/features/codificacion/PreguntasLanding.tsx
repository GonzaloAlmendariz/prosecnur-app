import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  CircleAlert,
  Link2,
  Link2Off,
  Search,
  Settings2,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  apiCodifDesemparejar,
  apiCodifPareja,
  apiCodifPreguntasAbiertas,
  Arquetipo,
  arquetipoOf,
  PreguntaAbierta,
} from "../../api/client";
import { Alert } from "../../components/Alert";
import { PairingDialog, PairingResult } from "./PairingDialog";

type Filter = "codificables" | "todas" | "por-emparejar" | "completas";

const TIPO_STYLE: Record<string, { bg: string; border: string; fg: string; label: string }> = {
  select_multiple: { bg: "var(--tipo-sm-bg)", border: "var(--tipo-sm-border)", fg: "var(--tipo-sm-fg)", label: "Múltiple" },
  select_one: { bg: "var(--tipo-so-bg)", border: "var(--tipo-so-border)", fg: "var(--tipo-so-fg)", label: "Opción única" },
  integer: { bg: "var(--tipo-int-bg)", border: "var(--tipo-int-border)", fg: "var(--tipo-int-fg)", label: "Numérica" },
  text: { bg: "var(--tipo-text-bg)", border: "var(--tipo-text-border)", fg: "var(--tipo-text-fg)", label: "Texto abierto" },
};

export function PreguntasLanding() {
  const [data, setData] = useState<PreguntaAbierta[] | null>(null);
  const [error, setError] = useState<string>("");
  const [filter, setFilter] = useState<Filter>("codificables");
  const [query, setQuery] = useState<string>("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [pairingFor, setPairingFor] = useState<PreguntaAbierta | null>(null);
  const [busyPair, setBusyPair] = useState<string>("");

  async function refresh() {
    try {
      const r = await apiCodifPreguntasAbiertas();
      setData(r.preguntas);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const bySection = useMemo(() => {
    if (!data) return [];
    // Order preguntas by q_order ASC, then group by section preserving
    // first-seen order (which is section-of-lowest-q).
    const sorted = [...data].sort((a, b) => {
      const qa = a.q_order ?? 999999;
      const qb = b.q_order ?? 999999;
      return qa - qb;
    });
    const map = new Map<string, { id: string; label: string; preguntas: PreguntaAbierta[] }>();
    for (const p of sorted) {
      const key = p.section || "(sin sección)";
      const label = p.section_label || p.section || "Sin sección";
      if (!map.has(key)) map.set(key, { id: key, label, preguntas: [] });
      map.get(key)!.preguntas.push(p);
    }
    return Array.from(map.values());
  }, [data]);

  const counts = useMemo(() => {
    if (!data) return { total: 0, codificables: 0, porEmparejar: 0, completas: 0, noAplica: 0 };
    let codificables = 0, porEmparejar = 0, completas = 0, noAplica = 0;
    for (const p of data) {
      const arq = arquetipoOf(p);
      if (p.status === "no-aplica") noAplica++;
      else if (p.status === "completo") completas++;
      if (["no-iniciado", "en-curso", "completo"].includes(p.status)) codificables++;
      if ((arq === "pareja-so" || arq === "pareja-sm") && !isPaired(p)) porEmparejar++;
    }
    return { total: data.length, codificables, porEmparejar, completas, noAplica };
  }, [data]);

  const visibleSections = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const wants = (p: PreguntaAbierta): boolean => {
      const arq = arquetipoOf(p);
      if (filter === "por-emparejar") {
        return (arq === "pareja-so" || arq === "pareja-sm") && !isPaired(p);
      }
      if (filter === "completas") return p.status === "completo";
      if (filter === "codificables") return ["no-iniciado", "en-curso", "completo"].includes(p.status);
      return true; // todas
    };
    const matchesQ = (p: PreguntaAbierta): boolean => {
      if (!q) return true;
      return p.parent.toLowerCase().includes(q) || p.parent_label.toLowerCase().includes(q) || (p.section_label || "").toLowerCase().includes(q);
    };
    return bySection
      .map((s) => ({ ...s, preguntas: s.preguntas.filter((p) => wants(p) && matchesQ(p)) }))
      .filter((s) => s.preguntas.length > 0);
  }, [bySection, data, filter, query]);

  async function onConfirmPair(result: PairingResult) {
    if (!pairingFor) return;
    setBusyPair(pairingFor.parent);
    try {
      await apiCodifPareja(pairingFor.parent, result.child_col, result.modo_so, result.dummy_col);
      setPairingFor(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyPair("");
    }
  }

  async function onDesemparejar(parent: string) {
    setBusyPair(parent);
    try {
      await apiCodifDesemparejar(parent);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyPair("");
    }
  }

  function toggleSection(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <Alert kind="info">Detectando preguntas abiertas…</Alert>;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <FilterChip label={`Codificables (${counts.codificables})`} active={filter === "codificables"} onClick={() => setFilter("codificables")} />
        <FilterChip label={`Por emparejar (${counts.porEmparejar})`} active={filter === "por-emparejar"} onClick={() => setFilter("por-emparejar")} accent={counts.porEmparejar > 0} />
        <FilterChip label={`Completas (${counts.completas})`} active={filter === "completas"} onClick={() => setFilter("completas")} />
        <FilterChip label={`Todas (${counts.total})`} active={filter === "todas"} onClick={() => setFilter("todas")} />
        <div style={{ flex: 1 }} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Search size={14} color="var(--pulso-text-soft)" />
          <input
            placeholder="Buscar por nombre, etiqueta o sección"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ fontSize: 13, width: 280 }}
          />
        </span>
      </div>

      {visibleSections.length === 0 && <Alert kind="info">No hay preguntas en esta vista.</Alert>}

      {visibleSections.map((s) => (
        <SectionBlock
          key={s.id}
          id={s.id}
          label={s.label}
          preguntas={s.preguntas}
          collapsed={collapsed.has(s.id)}
          onToggle={() => toggleSection(s.id)}
          onPair={(p) => setPairingFor(p)}
          onUnpair={onDesemparejar}
          busyPair={busyPair}
        />
      ))}

      {pairingFor && (
        <PairingDialog
          pregunta={pairingFor}
          onConfirm={onConfirmPair}
          onCancel={() => setPairingFor(null)}
        />
      )}
    </div>
  );
}

function isPaired(p: PreguntaAbierta): boolean {
  return !!(p.pareja && typeof p.pareja === "object" && "child_col" in p.pareja && p.pareja.child_col);
}

function FilterChip({ label, active, onClick, accent }: { label: string; active: boolean; onClick: () => void; accent?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "5px 12px",
        borderRadius: 999,
        fontSize: 13,
        border: active ? "1px solid var(--pulso-primary)" : `1px solid ${accent ? "#d68a00" : "var(--pulso-border)"}`,
        background: active ? "var(--pulso-primary)" : accent ? "#fff4e0" : "white",
        color: active ? "white" : accent ? "#8a5000" : "var(--pulso-text)",
        cursor: "pointer",
        fontWeight: accent ? 600 : 500,
      }}
    >
      {label}
    </button>
  );
}

type SectionProps = {
  id: string;
  label: string;
  preguntas: PreguntaAbierta[];
  collapsed: boolean;
  onToggle: () => void;
  onPair: (p: PreguntaAbierta) => void;
  onUnpair: (parent: string) => void;
  busyPair: string;
};

function SectionBlock({ id, label, preguntas, collapsed, onToggle, onPair, onUnpair, busyPair }: SectionProps) {
  const porEmparejar = preguntas.filter((p) => {
    const arq = arquetipoOf(p);
    return (arq === "pareja-so" || arq === "pareja-sm") && !isPaired(p);
  }).length;
  const completas = preguntas.filter((p) => p.status === "completo").length;

  return (
    <section aria-labelledby={`sec-${id}`} style={{ marginBottom: 22 }}>
      <header
        style={{
          position: "sticky",
          top: 56,
          zIndex: 2,
          background: "var(--pulso-bg)",
          padding: "10px 4px",
          borderBottom: "1px solid var(--pulso-border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
          cursor: "pointer",
        }}
        onClick={onToggle}
      >
        {collapsed ? <ChevronRightIcon size={14} /> : <ChevronDown size={14} />}
        <h2 id={`sec-${id}`} style={{ margin: 0, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--pulso-text)" }}>
          {label}
        </h2>
        <span style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>
          {preguntas.length} {preguntas.length === 1 ? "pregunta" : "preguntas"}
          {porEmparejar > 0 && <> · <strong style={{ color: "#8a5000" }}>{porEmparejar} por emparejar</strong></>}
          {completas > 0 && <> · <strong style={{ color: "#166534" }}>{completas} {completas === 1 ? "completa" : "completas"}</strong></>}
        </span>
      </header>
      {!collapsed && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {preguntas.map((p) => (
            <PreguntaCard
              key={p.parent}
              p={p}
              onPair={() => onPair(p)}
              onUnpair={() => onUnpair(p.parent)}
              busy={busyPair === p.parent}
            />
          ))}
        </div>
      )}
    </section>
  );
}

type CardProps = {
  p: PreguntaAbierta;
  onPair: () => void;
  onUnpair: () => void;
  busy: boolean;
};

function PreguntaCard({ p, onPair, onUnpair, busy }: CardProps) {
  const arq = arquetipoOf(p);
  const tipoStyle = TIPO_STYLE[p.tipo] ?? TIPO_STYLE.text;
  const paired = isPaired(p);

  const ts = tipoStyle;
  const common: React.CSSProperties = {
    border: "1px solid var(--pulso-border)",
    borderLeft: `4px solid ${ts.border}`,
    borderRadius: 8,
    padding: 14,
    background: "white",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minHeight: 170,
    position: "relative",
  };

  // --- HEADER común ---
  const header = (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: ts.fg }}>{p.parent}</div>
      <div style={{ flex: 1 }} />
      <ArquetipoBadge arq={arq} paired={paired} tipoStyle={ts} />
    </div>
  );

  const label = (
    <div style={{ fontSize: 13, color: "var(--pulso-text)", lineHeight: 1.35 }} title={p.parent_label}>
      {truncate(p.parent_label, 110)}
    </div>
  );

  const tipoRow = (
    <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ padding: "2px 6px", borderRadius: 4, background: ts.bg, color: ts.fg, fontWeight: 600 }}>{ts.label}</span>
      {p.col_efectiva && <span>col: <code style={{ fontFamily: "monospace" }}>{p.col_efectiva}</code></span>}
    </div>
  );

  const stats = p.n_respuestas > 0 ? (
    <div style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>
      <strong style={{ color: "var(--pulso-text)" }}>{p.n_respuestas}</strong> respuestas · <strong style={{ color: "var(--pulso-text)" }}>{p.n_unicas}</strong> únicas
    </div>
  ) : null;

  const preview = p.preview && p.preview.length > 0 ? (
    <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic", borderLeft: "2px solid var(--pulso-border)", paddingLeft: 8 }}>
      {p.preview.slice(0, 2).map((pv, i) => <div key={i}>“{truncate(pv, 50)}”</div>)}
    </div>
  ) : null;

  // --- Acción principal: según arquetipo ---
  const detailLink = (
    <NavLink
      to={`/codificacion/preguntas/${encodeURIComponent(p.parent)}`}
      style={{ fontSize: 12, color: "var(--pulso-primary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}
    >
      {p.status === "completo" ? "Revisar" : p.status === "en-curso" ? "Continuar" : "Codificar"} <ArrowRight size={12} />
    </NavLink>
  );

  // CASE 1: auto (integer)
  if (arq === "auto") {
    return (
      <article style={common}>
        {header}
        {label}
        {tipoRow}
        {stats}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Sparkles size={12} color="var(--tipo-int-fg)" />
          <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
            Autocodifica con su diccionario
          </span>
          <div style={{ flex: 1 }} />
          {detailLink}
        </div>
      </article>
    );
  }

  // CASE 2: solitaria (text puro)
  if (arq === "solitaria") {
    return (
      <article style={common}>
        {header}
        {label}
        {tipoRow}
        {stats}
        {preview}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>{detailLink}</div>
      </article>
    );
  }

  // CASE 3: huerfana (text con patrón _otro)
  if (arq === "huerfana") {
    return (
      <article style={{ ...common, borderStyle: "dashed", borderColor: ts.border, background: "#fafaf7" }}>
        {header}
        {label}
        {tipoRow}
        {stats}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
          Probablemente es el "Otros, especifique" de una pregunta cerrada. Emparejala desde la card padre.
        </div>
      </article>
    );
  }

  // CASE 4: config-so (SO sin modo y sin candidatos)
  if (arq === "config-so") {
    return (
      <article style={common}>
        {header}
        {label}
        {tipoRow}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--pulso-text-soft)" }}>
          <Settings2 size={12} />
          <span>Sin candidatos de "Otros" automáticos. Configurá en modo avanzado.</span>
        </div>
      </article>
    );
  }

  // CASE 5: no-aplica
  if (arq === "no-aplica") {
    return (
      <article style={{ ...common, opacity: 0.55 }}>
        {header}
        {label}
        {tipoRow}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>Desactivada</span>
      </article>
    );
  }

  // CASE 6: pareja-so / pareja-sm
  const pareja = p.pareja && typeof p.pareja === "object" && "child_col" in p.pareja ? p.pareja : null;

  if (paired && pareja) {
    // Emparejada
    const modoLabel = p.modo_so === "padre" ? "MODO PADRE" : p.modo_so === "hijo" ? "MODO HIJO" : "EMPAREJADA";
    return (
      <article style={common}>
        {header}
        {label}
        {tipoRow}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 16px 1fr", alignItems: "center", gap: 6, marginTop: 4 }}>
          <PairedSide title={p.parent} subtitle={p.modo_so === "padre" ? "(recodifica valores)" : "(referencia)"} tone="primary" />
          <Link2 size={12} color="var(--pulso-primary)" />
          <PairedSide title={pareja.child_col} subtitle={p.modo_so === "hijo" ? "(texto recodificado)" : "(auxiliar)"} tone="soft" />
        </div>
        {pareja.dummy_col && (
          <div style={{ fontSize: 10, color: "var(--pulso-text-soft)", marginTop: 2 }}>
            col "Otros": <code style={{ fontFamily: "monospace" }}>{pareja.dummy_col}</code>
          </div>
        )}
        <div style={{ fontSize: 10, color: "var(--pulso-primary)", fontWeight: 700, letterSpacing: 0.5 }}>{modoLabel}</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={onPair}
            disabled={busy}
            style={{ fontSize: 11, padding: "3px 8px" }}
            title="Cambiar modo o cambiar hija"
          >
            Cambiar
          </button>
          <button
            type="button"
            onClick={onUnpair}
            disabled={busy}
            style={{ fontSize: 11, padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <Link2Off size={11} /> Desemparejar
          </button>
          <div style={{ flex: 1 }} />
          {detailLink}
        </div>
      </article>
    );
  }

  // Sin emparejar, con candidatos
  const hasCands = p.candidatos_texto && p.candidatos_texto.length > 0;

  return (
    <article style={common}>
      {header}
      {label}
      {tipoRow}
      {stats}
      {hasCands ? (
        <div style={{ background: "#fff7e8", border: "1px solid #f0d799", borderRadius: 6, padding: 8, fontSize: 11 }}>
          <div style={{ color: "#8a5000", fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
            <Wand2 size={11} /> Candidatos para "Otros, especifique"
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {p.candidatos_texto.slice(0, 3).map((c) => (
              <div key={c.col} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <code style={{ fontFamily: "monospace", fontSize: 11 }}>{c.col}</code>
                <ConfBadge conf={c.confianza} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
          Sin candidatos automáticos. Podés emparejar manualmente o marcarla como "sin Otros".
        </div>
      )}
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button
          type="button"
          onClick={onPair}
          disabled={busy}
          className={hasCands ? "pulso-primary" : undefined}
          style={{ fontSize: 12, padding: "5px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          <Link2 size={12} /> Emparejar con…
        </button>
        <div style={{ flex: 1 }} />
      </div>
    </article>
  );
}

function PairedSide({ title, subtitle, tone }: { title: string; subtitle: string; tone: "primary" | "soft" }) {
  return (
    <div
      style={{
        border: `1px solid ${tone === "primary" ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
        borderRadius: 6,
        padding: "6px 8px",
        background: tone === "primary" ? "var(--pulso-primary-soft)" : "var(--pulso-surface-2)",
        overflow: "hidden",
      }}
    >
      <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: tone === "primary" ? "var(--pulso-primary)" : "var(--pulso-text)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{title}</div>
      <div style={{ fontSize: 9, color: "var(--pulso-text-soft)" }}>{subtitle}</div>
    </div>
  );
}

function ArquetipoBadge({ arq, paired, tipoStyle }: { arq: Arquetipo; paired: boolean; tipoStyle: { bg: string; fg: string } }) {
  const { label, bg, fg, icon: Icon } = badgeConfig(arq, paired, tipoStyle);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 4, background: bg, color: fg, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>
      <Icon size={10} />
      {label}
    </span>
  );
}

function badgeConfig(arq: Arquetipo, paired: boolean, _tipoStyle: { bg: string; fg: string }): { label: string; bg: string; fg: string; icon: typeof Check } {
  if (arq === "auto") return { label: "Auto", bg: "#e6d9f2", fg: "#4a2d66", icon: Sparkles };
  if (arq === "solitaria") return { label: "Solitaria", bg: "#f3f4f6", fg: "#4b5563", icon: Check };
  if (arq === "huerfana") return { label: "Huérfana", bg: "#fef3c7", fg: "#78350f", icon: CircleAlert };
  if (arq === "config-so") return { label: "Configurar", bg: "#fef3c7", fg: "#78350f", icon: Settings2 };
  if (arq === "no-aplica") return { label: "Inactiva", bg: "#f3f4f6", fg: "#9ca3af", icon: Check };
  if (arq === "pareja-so" || arq === "pareja-sm") {
    return paired
      ? { label: "Emparejada", bg: "#dcfce7", fg: "#166534", icon: Link2 }
      : { label: "Por emparejar", bg: "#fff4e0", fg: "#8a5000", icon: Link2Off };
  }
  return { label: "Pendiente", bg: "#eff6ff", fg: "#1d4ed8", icon: Check };
}

function ConfBadge({ conf }: { conf: number }) {
  const label = conf >= 1.0 ? "match fuerte" : conf >= 0.6 ? "prefijo" : "misma sección";
  const color = conf >= 1.0 ? "#166534" : conf >= 0.6 ? "#8a5000" : "#6b7280";
  return <span style={{ fontSize: 9, color, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>· {label}</span>;
}

function truncate(s: string, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
