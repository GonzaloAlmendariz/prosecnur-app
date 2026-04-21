import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  CircleAlert,
  GripVertical,
  Inbox,
  Link2,
  Link2Off,
  Search,
  Sparkles,
} from "lucide-react";
import {
  apiCodifColumnas,
  apiCodifDesemparejar,
  apiCodifMarcar,
  apiCodifPareja,
  apiCodifPreguntasAbiertas,
  Arquetipo,
  arquetipoOf,
  guessDummyColFromOpciones,
  OpcionSM,
  PreguntaAbierta,
} from "../../api/client";
import { LoadingBlock, ErrorBlock, EmptyState } from "../../components/States";
import { PairingDialog, PairingResult } from "./PairingDialog";

const srOnlyStyle: React.CSSProperties = {
  position: "absolute",
  width: 1, height: 1,
  padding: 0, margin: -1,
  overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap",
  border: 0,
};

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function escapeAttr(s: string): string { return s.replace(/"/g, '\\"'); }

type Filter = "todas" | "emparejadas" | "por-codificar" | "codificadas";

const TIPO_STYLE: Record<string, { bg: string; border: string; fg: string; label: string }> = {
  select_multiple: { bg: "var(--tipo-sm-bg)", border: "var(--tipo-sm-border)", fg: "var(--tipo-sm-fg)", label: "Múltiple" },
  select_one: { bg: "var(--tipo-so-bg)", border: "var(--tipo-so-border)", fg: "var(--tipo-so-fg)", label: "Opción única" },
  integer: { bg: "var(--tipo-int-bg)", border: "var(--tipo-int-border)", fg: "var(--tipo-int-fg)", label: "Numérica" },
  text: { bg: "var(--tipo-text-bg)", border: "var(--tipo-text-border)", fg: "var(--tipo-text-fg)", label: "Texto abierto" },
};

export function PreguntasLanding() {
  const [data, setData] = useState<PreguntaAbierta[] | null>(null);
  const [error, setError] = useState<string>("");
  const [filter, setFilter] = useState<Filter>("todas");
  const [query, setQuery] = useState<string>("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [pairingFor, setPairingFor] = useState<{ parent: PreguntaAbierta; preselectedChild?: string } | null>(null);
  const [busyPair, setBusyPair] = useState<string>("");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [columnas, setColumnas] = useState<string[]>([]);
  const [recentlyAdopted, setRecentlyAdopted] = useState<Set<string>>(new Set());
  const [liveMsg, setLiveMsg] = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  async function refresh() {
    try {
      const r = await apiCodifPreguntasAbiertas();
      setData(r.preguntas);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void refresh();
    (async () => {
      try { const r = await apiCodifColumnas(); setColumnas(r.columnas); } catch {}
    })();
  }, []);

  // Reverse-lookup: child_col → padre. Deriva "adoptada" para las text ya
  // emparejadas (quita ruido del listado y muestra la relación en el padre).
  const adoptedBy = useMemo(() => {
    const m = new Map<string, PreguntaAbierta>();
    if (!data) return m;
    for (const p of data) {
      const pj = p.pareja;
      if (pj && typeof pj === "object" && "child_col" in pj && pj.child_col) {
        m.set(pj.child_col, p);
      }
    }
    return m;
  }, [data]);

  function announce(msg: string) {
    setLiveMsg(msg);
    setTimeout(() => setLiveMsg(""), 800);
  }

  async function animateAdoption(srcParent: string, dstParent: string) {
    if (prefersReducedMotion()) return;
    const srcEl = document.querySelector(`[data-parent="${escapeAttr(srcParent)}"]`) as HTMLElement | null;
    const dstEl = document.querySelector(`[data-parent="${escapeAttr(dstParent)}"]`) as HTMLElement | null;
    if (!srcEl || !dstEl) return;
    const srcRect = srcEl.getBoundingClientRect();
    const dstRect = dstEl.getBoundingClientRect();
    const dx = dstRect.left + dstRect.width / 2 - (srcRect.left + srcRect.width / 2);
    const dy = dstRect.top + dstRect.height / 2 - (srcRect.top + srcRect.height / 2);

    const clone = srcEl.cloneNode(true) as HTMLElement;
    clone.style.position = "fixed";
    clone.style.left = `${srcRect.left}px`;
    clone.style.top = `${srcRect.top}px`;
    clone.style.width = `${srcRect.width}px`;
    clone.style.zIndex = "50";
    clone.style.pointerEvents = "none";
    clone.style.transition = "transform var(--anim-dur-med) var(--anim-ease-expressive), opacity var(--anim-dur-med) var(--anim-ease-smooth), filter var(--anim-dur-med) var(--anim-ease-smooth)";
    document.body.appendChild(clone);
    srcEl.style.opacity = "0";
    requestAnimationFrame(() => {
      clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.4)`;
      clone.style.opacity = "0";
      clone.style.filter = "blur(1px)";
    });
    await new Promise((r) => setTimeout(r, 320));
    clone.remove();
  }

  function glowCard(parent: string) {
    if (prefersReducedMotion()) return;
    const el = document.querySelector(`[data-parent="${escapeAttr(parent)}"]`);
    if (!el) return;
    el.classList.remove("pulso-card-glow");
    void (el as HTMLElement).offsetWidth; // restart animation
    el.classList.add("pulso-card-glow");
    setTimeout(() => el.classList.remove("pulso-card-glow"), 1200);
  }

  function scrollToPadre(parent?: string) {
    if (!parent) return;
    const el = document.querySelector(`[data-parent="${escapeAttr(parent)}"]`) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    glowCard(parent);
  }

  async function adoptDirect(padre: PreguntaAbierta, childCol: string, opcionesSm?: OpcionSM[]) {
    setBusyPair(padre.parent);
    try {
      const modo_so = padre.tipo === "select_one" ? "hijo" : undefined;
      const dummy_col = padre.tipo === "select_multiple"
        ? (padre.pareja && typeof padre.pareja === "object" && "dummy_col" in padre.pareja && padre.pareja.dummy_col
            ? padre.pareja.dummy_col
            : guessDummyColFromOpciones(opcionesSm))
        : undefined;
      await apiCodifPareja(padre.parent, childCol, modo_so, dummy_col);
      setRecentlyAdopted((s) => new Set(s).add(padre.parent));
      setTimeout(() => setRecentlyAdopted((s) => { const n = new Set(s); n.delete(padre.parent); return n; }), 1000);
      await refresh();
      glowCard(padre.parent);
      if (padre.tipo === "select_multiple" && !dummy_col) {
        announce(`${childCol} adoptada por ${padre.parent}. Falta indicar cuál opción es "Otros".`);
      } else {
        announce(`${childCol} adoptada por ${padre.parent}${modo_so ? " en modo hijo" : ""}.`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyPair("");
    }
  }

  async function setDummyForSm(padre: PreguntaAbierta, dummy_col: string) {
    setBusyPair(padre.parent);
    try {
      const pj = padre.pareja && typeof padre.pareja === "object" && "child_col" in padre.pareja ? padre.pareja : null;
      if (!pj?.child_col) return;
      // Si el usuario clickeó la opción ya seleccionada, deseleccionarla
      // (toggle). Si clickeó otra, reemplazarla.
      const alreadySelected = pj.dummy_col && pj.dummy_col === dummy_col;
      if (alreadySelected) {
        await apiCodifPareja(padre.parent, pj.child_col, undefined, "", { clear_dummy: true });
        announce(`Selección de "Otros" quitada en ${padre.parent}.`);
      } else {
        await apiCodifPareja(padre.parent, pj.child_col, undefined, dummy_col);
        announce(`Columna "Otros" configurada en ${padre.parent}.`);
      }
      await refresh();
      glowCard(padre.parent);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyPair("");
    }
  }

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
    if (!data) return { total: 0, emparejadas: 0, porCodificar: 0, codificadas: 0 };
    let emparejadas = 0, porCodificar = 0, codificadas = 0;
    for (const p of data) {
      if (isPaired(p)) emparejadas++;
      if (p.marcada && p.status !== "completo") porCodificar++;
      if (p.status === "completo") codificadas++;
    }
    return { total: data.length, emparejadas, porCodificar, codificadas };
  }, [data]);

  const visibleSections = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const wants = (p: PreguntaAbierta): boolean => {
      const arq = arquetipoOf(p, adoptedBy);
      // Ocultar adoptadas de filtros operativos (solo visibles en "todas")
      if (arq === "adoptada" && filter !== "todas") return false;
      if (filter === "emparejadas") return isPaired(p);
      if (filter === "por-codificar") return p.marcada && p.status !== "completo";
      if (filter === "codificadas") return p.status === "completo";
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
    setBusyPair(pairingFor.parent.parent);
    try {
      await apiCodifPareja(pairingFor.parent.parent, result.child_col, result.modo_so, result.dummy_col);
      setPairingFor(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyPair("");
    }
  }

  function onDragStart(e: DragStartEvent) {
    setActiveDragId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = e;
    if (!over || !data) return;
    const childParent = String(active.id);
    const parentParent = String(over.id);
    if (childParent === parentParent) return;
    const parentPregunta = data.find((p) => p.parent === parentParent);
    const childPregunta = data.find((p) => p.parent === childParent);
    if (!parentPregunta || !childPregunta) return;
    const childCol = childPregunta.col_efectiva || childPregunta.parent;
    // Fly animation + POST directo (sin modal). El user podrá ajustar modo
    // o dummy desde la card emparejada.
    await animateAdoption(childPregunta.parent, parentPregunta.parent);
    await adoptDirect(parentPregunta, childCol, parentPregunta.opciones_sm);
  }

  const activePregunta = useMemo(() => {
    if (!activeDragId || !data) return null;
    return data.find((p) => p.parent === activeDragId) ?? null;
  }, [activeDragId, data]);

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

  async function onToggleMarcada(parent: string, marcada: boolean) {
    setBusyPair(parent);
    try {
      await apiCodifMarcar(parent, marcada);
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

  if (error) return <ErrorBlock label="Error cargando preguntas" detail={error} />;
  if (!data) return <LoadingBlock label="Detectando preguntas abiertas…" />;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <FilterChip label={`Todas (${counts.total})`} active={filter === "todas"} onClick={() => setFilter("todas")} />
        <FilterChip label={`Emparejadas (${counts.emparejadas})`} active={filter === "emparejadas"} onClick={() => setFilter("emparejadas")} />
        <FilterChip label={`Por codificar (${counts.porCodificar})`} active={filter === "por-codificar"} onClick={() => setFilter("por-codificar")} />
        <FilterChip label={`Codificadas (${counts.codificadas})`} active={filter === "codificadas"} onClick={() => setFilter("codificadas")} />
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

      {visibleSections.length === 0 && (
        <EmptyState
          icon={<Inbox size={20} />}
          title="No hay preguntas en esta vista"
          hint={
            query
              ? "No hay matches para tu búsqueda. Prueba con otro nombre o limpia el filtro."
              : "Cambia el filtro de arriba para ver otras preguntas."
          }
        />
      )}

      {visibleSections.map((s) => (
        <SectionBlock
          key={s.id}
          id={s.id}
          label={s.label}
          preguntas={s.preguntas}
          collapsed={collapsed.has(s.id)}
          onToggle={() => toggleSection(s.id)}
          onPair={(p) => setPairingFor({ parent: p })}
          onUnpair={onDesemparejar}
          busyPair={busyPair}
          dragActive={!!activeDragId}
          adoptedBy={adoptedBy}
          recentlyAdopted={recentlyAdopted}
          onSetDummy={setDummyForSm}
          onScrollToPadre={scrollToPadre}
          onToggleMarcada={onToggleMarcada}
        />
      ))}

      <div aria-live="polite" aria-atomic="true" style={srOnlyStyle}>{liveMsg}</div>

      {pairingFor && (
        <PairingDialog
          pregunta={pairingFor.parent}
          preselectedChild={pairingFor.preselectedChild}
          onConfirm={onConfirmPair}
          onCancel={() => setPairingFor(null)}
        />
      )}
    </div>

    <DragOverlay dropAnimation={null}>
      {activePregunta ? <DragOverlayCard p={activePregunta} /> : null}
    </DragOverlay>
    </DndContext>
  );
}

function DragOverlayCard({ p }: { p: PreguntaAbierta }) {
  const ts = TIPO_STYLE[p.tipo] ?? TIPO_STYLE.text;
  return (
    <div
      style={{
        border: "1px solid var(--pulso-primary)",
        borderLeft: `4px solid ${ts.border}`,
        borderRadius: 8,
        padding: 10,
        background: "white",
        boxShadow: "var(--pulso-shadow-med)",
        minWidth: 220, maxWidth: 280,
        display: "flex", flexDirection: "column", gap: 4,
        transform: "rotate(-2deg)",
      }}
    >
      <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: ts.fg }}>{p.parent}</div>
      <div style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>{truncate(p.parent_label, 60)}</div>
    </div>
  );
}

function isPaired(p: PreguntaAbierta): boolean {
  return !!(p.pareja && typeof p.pareja === "object" && "child_col" in p.pareja && p.pareja.child_col);
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
        fontWeight: 500,
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
  dragActive: boolean;
  adoptedBy: Map<string, PreguntaAbierta>;
  recentlyAdopted: Set<string>;
  onSetDummy: (padre: PreguntaAbierta, dummy_col: string) => void;
  onScrollToPadre: (parent?: string) => void;
  onToggleMarcada: (parent: string, marcada: boolean) => void;
};

function SectionBlock({ id, label, preguntas, collapsed, onToggle, onPair, onUnpair, busyPair, dragActive, adoptedBy, recentlyAdopted, onSetDummy, onScrollToPadre, onToggleMarcada }: SectionProps) {
  const emparejadas = preguntas.filter((p) => isPaired(p)).length;
  const codificadas = preguntas.filter((p) => p.status === "completo").length;

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
          {emparejadas > 0 && <> · <strong style={{ color: "var(--pulso-primary)" }}>{emparejadas} {emparejadas === 1 ? "emparejada" : "emparejadas"}</strong></>}
          {codificadas > 0 && <> · <strong style={{ color: "var(--pulso-success-fg)" }}>{codificadas} {codificadas === 1 ? "codificada" : "codificadas"}</strong></>}
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
              dragActive={dragActive}
              adoptedBy={adoptedBy}
              recentlyAdopted={recentlyAdopted}
              onSetDummy={onSetDummy}
              onScrollToPadre={onScrollToPadre}
              onToggleMarcada={(m) => onToggleMarcada(p.parent, m)}
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
  dragActive: boolean;
  adoptedBy: Map<string, PreguntaAbierta>;
  recentlyAdopted: Set<string>;
  onSetDummy: (padre: PreguntaAbierta, dummy_col: string) => void;
  onScrollToPadre: (parent?: string) => void;
  onToggleMarcada: (marcada: boolean) => void;
};

function MarcarFooter({ p, arq, busy, onToggleMarcada }: { p: PreguntaAbierta; arq: Arquetipo; busy: boolean; onToggleMarcada: (m: boolean) => void }) {
  // Emparejadas: auto-marcada, inmutable mientras haya pareja.
  if (p.marcada_auto) {
    return (
      <div style={{ marginTop: 8, padding: "6px 8px", borderTop: "1px solid var(--pulso-border)", display: "flex", alignItems: "center", gap: 6 }}>
        <Check size={12} color="var(--pulso-success-fg)" />
        <span style={{ fontSize: 11, color: "var(--pulso-success-fg)", fontWeight: 600 }}>En codificación automáticamente</span>
      </div>
    );
  }
  // Adoptadas, config-so, no-aplica: no mostrar toggle.
  if (arq === "adoptada" || arq === "no-aplica" || arq === "config-so") return null;
  // Resto: toggle explícito.
  const labelOn = "✓ Incluida en codificación";
  const labelOff = "Incluir en codificación";
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        marginTop: 8, padding: "6px 8px",
        borderTop: "1px solid var(--pulso-border)",
        display: "flex", alignItems: "center", gap: 8,
      }}
    >
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: busy ? "wait" : "pointer", fontSize: 11, fontWeight: 600, color: p.marcada ? "var(--pulso-success-fg)" : "var(--pulso-text-soft)" }}>
        <input
          type="checkbox"
          checked={p.marcada}
          disabled={busy}
          onChange={(e) => onToggleMarcada(e.target.checked)}
          style={{ cursor: busy ? "wait" : "pointer" }}
          aria-label={p.marcada ? `Quitar ${p.parent} del flujo de codificación` : `Incluir ${p.parent} en el flujo de codificación`}
        />
        {p.marcada ? labelOn : labelOff}
      </label>
    </div>
  );
}

function PreguntaCard({ p, onPair, onUnpair, busy, dragActive, adoptedBy, recentlyAdopted, onSetDummy, onScrollToPadre, onToggleMarcada }: CardProps) {
  const arq = arquetipoOf(p, adoptedBy);
  const tipoStyle = TIPO_STYLE[p.tipo] ?? TIPO_STYLE.text;
  const marcarFooter = <MarcarFooter p={p} arq={arq} busy={busy} onToggleMarcada={onToggleMarcada} />;
  const paired = isPaired(p);

  // Drag (huérfanas) / Drop (parejas sin emparejar) wiring
  const isOrphan = arq === "huerfana";
  const isDropTarget = (arq === "pareja-so" || arq === "pareja-sm") && !paired;
  const draggable = useDraggable({ id: p.parent, disabled: !isOrphan });
  const droppable = useDroppable({ id: p.parent, disabled: !isDropTarget });

  const ts = tipoStyle;
  const dropHighlight = dragActive && isDropTarget;
  const dropOver = droppable.isOver && isDropTarget;
  const common: React.CSSProperties = {
    border: dropOver
      ? `2px dashed var(--drag-valid-border)`
      : dropHighlight
      ? `1px dashed var(--drag-valid-border)`
      : "1px solid var(--pulso-border)",
    borderLeft: `4px solid ${ts.border}`,
    borderRadius: 8,
    padding: 14,
    background: dropOver ? "var(--drag-valid-bg)" : "white",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    // Cards con altura uniforme: min-height generoso + stretch vertical
    // para que CSS Grid estire todas las cards de una fila al alto de la
    // más alta. Combinado con el picker SM con scroll interno a 4 opciones
    // (no 7), esto mantiene las cards con variación mínima.
    minHeight: 210,
    height: "100%",
    position: "relative",
    transition: "background 120ms, border-color 120ms",
    opacity: draggable.isDragging ? 0.4 : 1,
  };
  // Attach dnd-kit ref/listeners to the wrapping article.
  const ref = isOrphan ? draggable.setNodeRef : isDropTarget ? droppable.setNodeRef : undefined;
  const listeners = isOrphan ? draggable.listeners : undefined;
  const attributes = isOrphan ? draggable.attributes : undefined;

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

  // CASE 0: adoptada (text que ya es hija de una SO/SM)
  if (arq === "adoptada") {
    const padre = adoptedBy.get(p.col_efectiva || p.parent);
    return (
      <article
        data-parent={p.parent}
        style={{
          ...common,
          background: "var(--adoptada-bg)",
          borderLeft: `4px solid ${ts.border}`,
          border: `1px solid var(--adoptada-border)`,
          opacity: 0.92,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "var(--adoptada-fg)" }}>{p.parent}</div>
          <div style={{ flex: 1 }} />
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 6px", borderRadius: 4, background: "white", color: "var(--adoptada-fg)", fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", border: "1px solid var(--adoptada-border)" }}>
            <Check size={10} /> Adoptada por {padre?.parent ?? "padre"}
          </span>
        </div>
        {label}
        {tipoRow}
        {stats}
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => onScrollToPadre(padre?.parent)}
          style={{
            fontSize: 11, color: "var(--pulso-primary)", background: "transparent",
            border: "none", textAlign: "left", padding: 0, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600,
          }}
        >
          ↗ Gestionar desde {padre?.parent ?? "padre"}
        </button>
        {marcarFooter}
      </article>
    );
  }

  // CASE 1: auto (integer)
  if (arq === "auto") {
    return (
      <article ref={ref} {...listeners} {...attributes} data-parent={p.parent} style={common}>
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
        {marcarFooter}
      </article>
    );
  }

  // CASE 2: solitaria (text puro)
  if (arq === "solitaria") {
    return (
      <article ref={ref} {...listeners} {...attributes} data-parent={p.parent} style={common}>
        {header}
        {label}
        {tipoRow}
        {stats}
        {preview}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>{detailLink}</div>
        {marcarFooter}
      </article>
    );
  }

  // CASE 3: huerfana (text con patrón _otro) — draggable
  if (arq === "huerfana") {
    return (
      <article
        ref={ref}
        {...listeners}
        {...attributes}
        style={{
          ...common,
          borderStyle: draggable.isDragging ? "solid" : "dashed",
          borderColor: ts.border,
          background: "#fafaf7",
          cursor: draggable.isDragging ? "grabbing" : "grab",
        }}
        aria-label={`${p.parent} — arrastrable para emparejar con su pregunta padre`}
      >
        <div style={{ position: "absolute", top: 10, right: 10, color: "var(--pulso-text-soft)", opacity: 0.5 }}>
          <GripVertical size={14} />
        </div>
        {header}
        {label}
        {tipoRow}
        {stats}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <GripVertical size={11} /> Arrástrala sobre la pregunta cerrada de donde proviene este texto, o marca para codificarla sola
        </div>
        {marcarFooter}
      </article>
    );
  }

  // CASE 5: no-aplica
  if (arq === "no-aplica") {
    return (
      <article ref={ref} {...listeners} {...attributes} data-parent={p.parent} style={{ ...common, opacity: 0.55 }}>
        {header}
        {label}
        {tipoRow}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>Desactivada</span>
        {marcarFooter}
      </article>
    );
  }

  // CASE 6: pareja-so / pareja-sm
  const pareja = p.pareja && typeof p.pareja === "object" && "child_col" in p.pareja ? p.pareja : null;

  if (paired && pareja) {
    // Emparejada. SM sin dummy_col queda en estado "necesita-dummy" visible.
    const isSM = p.tipo === "select_multiple";
    const needsDummy = isSM && !pareja.dummy_col;
    const modoLabel = needsDummy
      ? "Falta opción 'Otros'"
      : p.modo_so === "padre"
      ? "Texto se integra a las opciones"
      : p.modo_so === "hijo"
      ? "Texto se codifica aparte"
      : "Emparejada";
    const fresh = recentlyAdopted.has(p.parent);

    return (
      <article ref={ref} {...listeners} {...attributes} data-parent={p.parent} style={common}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: ts.fg }}>{p.parent}</div>
          <div style={{ flex: 1 }} />
          <span
            className={fresh ? "pulso-badge-fresh" : undefined}
            style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              padding: "2px 6px", borderRadius: 4,
              background: needsDummy ? "var(--pulso-warn-bg)" : "var(--pulso-success-bg)",
              color: needsDummy ? "var(--pulso-warn-fg)" : "var(--pulso-success-fg)",
              fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
              textTransform: "uppercase", whiteSpace: "nowrap",
              border: needsDummy ? "1px solid #f0d799" : "none",
            }}
          >
            {needsDummy ? <CircleAlert size={10} /> : <Link2 size={10} />} {modoLabel}
          </span>
        </div>
        {label}
        {tipoRow}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 16px 1fr", alignItems: "center", gap: 6, marginTop: 4 }}>
          <PairedSide
            title={p.parent}
            subtitle={p.modo_so === "padre" ? "recibe nuevas opciones" : p.modo_so === "hijo" ? "queda tal cual" : "pregunta"}
            tone="primary"
          />
          <Link2 size={12} color="var(--pulso-primary)" />
          <PairedSide
            title={pareja.child_col}
            subtitle={p.modo_so === "padre" ? "texto se agrupa en opciones" : p.modo_so === "hijo" ? "se codifica en campo aparte" : "texto asociado"}
            tone="soft"
          />
        </div>

        {/* SM: picker de "Otros, especifique". Siempre visible cuando hay
            pareja y opciones disponibles. La opción actualmente marcada
            se muestra activa (borde primary + ícono ✓); al clickearla
            de nuevo se deselecciona (toggle). */}
        {p.opciones_sm && p.opciones_sm.length > 0 && (
          <SmDummyPicker
            padre={p}
            opciones={p.opciones_sm}
            busy={busy}
            selectedCol={pareja.dummy_col || ""}
            onSelect={(col) => onSetDummy(p, col)}
          />
        )}

        {/* Caso sin opciones_sm: no podemos ofrecer el picker; mostramos
            la columna de dummy en un banner informativo (fallback raro). */}
        {(!p.opciones_sm || p.opciones_sm.length === 0) && !needsDummy && pareja.dummy_col && (() => {
          return (
            <div style={{
              marginTop: 8, padding: "8px 10px",
              background: "var(--tipo-sm-bg)",
              border: "1px solid var(--tipo-sm-border)",
              borderRadius: 6,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <Check size={14} color="var(--tipo-sm-fg)" />
              <code style={{ fontFamily: "monospace", fontSize: 11 }}>{pareja.dummy_col}</code>
            </div>
          );
        })()}

        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" onClick={onPair} disabled={busy} style={{ fontSize: 11, padding: "3px 8px" }} title="Cambiar modo o cambiar hija">
            Cambiar
          </button>
          <button type="button" onClick={onUnpair} disabled={busy} style={{ fontSize: 11, padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Link2Off size={11} /> Desemparejar
          </button>
          <div style={{ flex: 1 }} />
          {!needsDummy && detailLink}
        </div>
        {marcarFooter}
      </article>
    );
  }

  // Sin emparejar. No mostramos candidatos ni mensajes de "no se detectó"
  // en la card — se ofrecen solo dentro del diálogo "Emparejar con…"
  // (si hay candidatos, aparecen preseleccionados allí; si no, el diálogo
  // permite buscar entre todas las columnas del dataset).
  const hasCands = p.candidatos_texto && p.candidatos_texto.length > 0;
  return (
    <article ref={ref} {...listeners} {...attributes} data-parent={p.parent} style={common}>
      {header}
      {label}
      {tipoRow}
      {stats}
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

function SmDummyPicker({ padre, opciones, busy, selectedCol, onSelect }: {
  padre: PreguntaAbierta;
  opciones: OpcionSM[];
  busy: boolean;
  selectedCol: string;
  onSelect: (col: string) => void;
}) {
  const hasSelection = !!selectedCol;
  const borderColor = hasSelection ? "var(--tipo-sm-border)" : "var(--pulso-warn-border)";
  const bg = hasSelection ? "var(--tipo-sm-bg)" : "var(--pulso-warn-bg)";
  const eyebrowColor = hasSelection ? "var(--tipo-sm-fg)" : "var(--pulso-warn-fg)";
  return (
    <div style={{
      marginTop: 8,
      padding: 10,
      background: bg,
      border: `1px solid ${borderColor}`,
      borderRadius: 6,
      fontSize: 12,
    }}>
      <div style={{ color: eyebrowColor, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 4, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3 }}>
        {hasSelection ? <Check size={12} /> : <CircleAlert size={12} />}
        {hasSelection ? 'Opción "Otros, especifique"' : '¿Cuál opción es "Otros, especifique"?'}
      </div>
      <div style={{ fontSize: 11, color: eyebrowColor, opacity: 0.85, marginBottom: 8, lineHeight: 1.4 }}>
        {hasSelection
          ? <>Los textos de <code style={{ fontFamily: "monospace" }}>{padre.pareja && "child_col" in padre.pareja ? padre.pareja.child_col : ""}</code> se codifican cuando esta opción fue marcada. Haz click en la opción para quitar la selección.</>
          : <>La columna que marca "Otros" es la que indica cuándo el respondente escribió texto libre en <code style={{ fontFamily: "monospace" }}>{padre.pareja && "child_col" in padre.pareja ? padre.pareja.child_col : ""}</code>. Haz click en la opción que corresponde.</>}
      </div>
      <div
        style={{
          display: "flex", flexDirection: "column", gap: 3,
          // Cap más agresivo para no dominar el alto de la card en el
          // paso 1 Organizar. ~4 items visibles (32px + 3px gap = 35px
          // cada uno → 140px de área de scroll). El resto con scroll
          // interno minimalista.
          maxHeight: opciones.length > 4 ? 144 : undefined,
          overflowY: opciones.length > 4 ? "auto" : undefined,
          scrollbarWidth: "thin",
          scrollbarColor: "var(--pulso-border) transparent",
          paddingRight: opciones.length > 4 ? 4 : 0,
        }}
      >
        {opciones.map((o) => {
          const isSelected = selectedCol === o.col_dummy && o.col_dummy !== "";
          const disabled = busy || !o.existe_en_data;
          const sugerida = o.es_otros_sugerido && !hasSelection;
          // Priorización de estilos: seleccionada > sugerida > normal.
          const borderCol = isSelected ? "var(--pulso-primary)" : sugerida ? "var(--pulso-warn-accent)" : "var(--pulso-border)";
          const bgCol = isSelected ? "var(--pulso-primary-soft)" : sugerida ? "var(--pulso-warn-bg)" : "white";
          const title = disabled && !o.existe_en_data
            ? `La columna ${o.col_dummy} no existe en tu dataset`
            : isSelected
            ? `Click para deseleccionar (actualmente marcada como "Otros")`
            : `Usar ${o.col_dummy} como columna "Otros"`;
          return (
            <button
              key={o.codigo}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(o.col_dummy)}
              aria-pressed={isSelected}
              title={title}
              style={{
                textAlign: "left",
                display: "grid",
                gridTemplateColumns: "18px 34px 1fr auto",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                background: bgCol,
                border: `1px solid ${borderCol}`,
                borderRadius: 5,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled && !o.existe_en_data ? 0.5 : 1,
                fontSize: 11,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16 }}>
                {isSelected ? <Check size={12} color="var(--pulso-primary)" /> : null}
              </span>
              <code style={{ fontFamily: "monospace", fontWeight: 700, color: isSelected ? "var(--pulso-primary)" : sugerida ? "var(--pulso-warn-fg)" : "var(--pulso-text-soft)" }}>{o.codigo}</code>
              <span style={{ color: "var(--pulso-text)", fontWeight: isSelected ? 600 : 400 }}>{truncate(o.label, 70)}</span>
              {sugerida && !isSelected && (
                <span style={{ fontSize: 9, fontWeight: 700, color: "var(--pulso-warn-fg)", textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" }}>
                  ← Probable
                </span>
              )}
              {isSelected && (
                <span style={{ fontSize: 9, fontWeight: 700, color: "var(--pulso-primary)", textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" }}>
                  Seleccionada
                </span>
              )}
            </button>
          );
        })}
      </div>
      {!hasSelection && opciones.every((o) => !o.es_otros_sugerido) && (
        <div style={{ fontSize: 10, color: "var(--pulso-warn-fg)", marginTop: 6, fontStyle: "italic" }}>
          No detecté una opción "Otros" en el instrumento. Elige la que corresponde según tu criterio.
        </div>
      )}
    </div>
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
  const cfg = badgeConfig(arq, paired, tipoStyle);
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 4, background: cfg.bg, color: cfg.fg, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

type BadgeCfg = { label: string; bg: string; fg: string; icon: typeof Check };

function badgeConfig(arq: Arquetipo, paired: boolean, _tipoStyle: { bg: string; fg: string }): BadgeCfg | null {
  // El "no-emparejamiento" NO es un status — las SO/SM pueden codificarse
  // solas. Por lo tanto una pareja sin pareja no lleva badge; el contenido
  // de la card (candidatos sugeridos, toggle "Incluir") indica la acción.
  if (arq === "auto") return { label: "Auto", bg: "#e6d9f2", fg: "#4a2d66", icon: Sparkles };
  if (arq === "solitaria") return { label: "Solitaria", bg: "#f3f4f6", fg: "#4b5563", icon: Check };
  if (arq === "huerfana") return { label: "Texto libre", bg: "#fef3c7", fg: "#78350f", icon: CircleAlert };
  if (arq === "adoptada") return { label: "Adoptada", bg: "#f0f4fa", fg: "#5f6b7a", icon: Link2 };
  if (arq === "no-aplica") return { label: "Inactiva", bg: "#f3f4f6", fg: "#9ca3af", icon: Check };
  if ((arq === "pareja-so" || arq === "pareja-sm") && paired) {
    return { label: "Emparejada", bg: "var(--pulso-success-bg)", fg: "var(--pulso-success-fg)", icon: Link2 };
  }
  // pareja-so/sm sin emparejar, o config-so: sin badge de error.
  return null;
}

function truncate(s: string, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
