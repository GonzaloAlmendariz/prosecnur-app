import { useEffect, useMemo, useState } from "react";
import * as Lucide from "lucide-react";
import { X, Save, Factory, Check, Circle, Plus, Trash2, Layers3, Loader2, AlertCircle } from "lucide-react";
import {
  ArgGrupo, ArgMetadata,
  apiGraficosPresetsDefaultsSave,
  apiGraficosPresetsDefaultsReset,
} from "../../api/client";
import { usePresetsMetadata } from "./usePresetsMetadata";
import { usePresetsDefaults, presetArgsEqual } from "./usePresetsDefaults";
import { ArgGroup, GRUPO_META } from "./ArgGroup";
import { OverrideReusable, usePlanStore } from "./store";

// Modal "Gestionar defaults". Dos modos según cómo se abrió:
//   - mode="presets": edita los defaults de presets (lo que sirve de
//     base cuando el analista hace "Restaurar default" en el editor).
//   - mode="overrides": edita los overrides reusables que arrancan
//     pre-cargados (reducido/compacto).
//
// Los cambios viven en un draft local del modal; se aplican al
// backend al hacer "Guardar" y disparan `pulso:presets-defaults-changed`
// para que los hooks con cache se refresquen.
//
// "Restaurar fábrica" borra el default del usuario en el backend (DELETE
// /presets-defaults) y cierra el modal — el próximo fetch del hook
// trae los valores factory (.PRESETS_DEFAULT_PULSO).

type LucideIcon = (props: { size?: number; color?: string }) => JSX.Element;
function resolveLucide(name: string | undefined): LucideIcon {
  const registry = Lucide as unknown as Record<string, LucideIcon>;
  return (name && registry[name]) || registry["Sliders"] || registry["Square"];
}

export function DefaultsModal({
  mode,
  onClose,
}: {
  mode: "presets" | "overrides";
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === "presets" ? "Modificar defaults de presets" : "Modificar defaults de overrides"}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(15, 23, 42, 0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(960px, 100%)", maxHeight: "88vh",
          background: "white", borderRadius: 10,
          boxShadow: "var(--pulso-shadow-high)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "12px 18px",
            borderBottom: "1px solid var(--pulso-border)",
            display: "flex", alignItems: "center", gap: 10,
          }}
        >
          <Lucide.Settings2 size={16} color="var(--pulso-primary)" />
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 14 }}>
              {mode === "presets" ? "Defaults de presets" : "Defaults de overrides"}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
              {mode === "presets"
                ? "Edita los valores base que sirven de arranque a cualquier estudio. Aplica a todas las sesiones futuras y al 'Restaurar default' por preset."
                : "Edita los overrides reusables pre-cargados (reducido, compacto…). También puedes añadir nuevos."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="pulso-icon" aria-label="Cerrar">
            <X size={14} />
          </button>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
          {mode === "presets" ? <PresetsDefaultsEditor /> : <OverridesDefaultsEditor />}
        </div>
      </div>
    </div>
  );
}

// ---- Presets defaults editor ------------------------------------------

function PresetsDefaultsEditor() {
  const { presets: catalog, loading: loadingCatalog } = usePresetsMetadata();
  const { presets: backendDefaults, esCustom, loading: loadingDefaults, refresh } = usePresetsDefaults();

  const [draft, setDraft] = useState<Record<string, Record<string, unknown>>>({});
  const [selected, setSelected] = useState<string>("base");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<"saved" | "reset" | null>(null);
  const [error, setError] = useState("");

  // Sincronizar draft con los defaults del backend cuando llegan.
  useEffect(() => {
    setDraft(backendDefaults);
  }, [backendDefaults]);

  if (loadingCatalog || loadingDefaults) {
    return <LoadingBlock label="Cargando defaults de presets…" />;
  }

  const meta = catalog.find((p) => p.name === selected) ?? catalog[0];
  if (!meta) return null;

  const currentDraft = draft[meta.name] ?? {};
  const dirty = !presetArgsEqual(draft, backendDefaults);

  function setArg(tipo: string, arg: string, value: unknown) {
    setDraft((prev) => {
      const next = { ...prev };
      const forType = { ...(next[tipo] ?? {}) };
      if (value === null || value === undefined || value === "") delete forType[arg];
      else forType[arg] = value;
      if (Object.keys(forType).length === 0) delete next[tipo];
      else next[tipo] = forType;
      return next;
    });
  }

  async function onSave() {
    setError(""); setSaving(true);
    try {
      await apiGraficosPresetsDefaultsSave(draft);
      setFeedback("saved");
      window.dispatchEvent(new CustomEvent("pulso:presets-defaults-changed"));
      await refresh();
      setTimeout(() => setFeedback(null), 1500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onResetFactory() {
    if (!window.confirm(
      "¿Volver a los defaults de fábrica?\n\nTu personalización de defaults se descartará. Los presets del plan actual no se tocan — solo cambia a qué valores apunta 'Restaurar default' por preset."
    )) return;
    setError(""); setSaving(true);
    try {
      await apiGraficosPresetsDefaultsReset();
      setFeedback("reset");
      window.dispatchEvent(new CustomEvent("pulso:presets-defaults-changed"));
      await refresh();
      setTimeout(() => setFeedback(null), 1500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
          padding: "8px 10px", borderRadius: 6,
          background: esCustom ? "var(--pulso-primary-soft)" : "var(--pulso-surface)",
          border: `1px solid ${esCustom ? "var(--pulso-primary-border)" : "var(--pulso-border)"}`,
          fontSize: 11,
        }}
      >
        <span style={{ color: "var(--pulso-text-soft)", flex: 1, minWidth: 180 }}>
          {esCustom
            ? "Estás editando tu set personalizado de defaults."
            : "Estás editando los defaults de fábrica. Al guardar se convierten en tu set personalizado."}
        </span>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !dirty}
          className="pulso-primary"
          style={{
            fontSize: 11, padding: "5px 12px",
            display: "inline-flex", alignItems: "center", gap: 5,
            opacity: (saving || !dirty) ? 0.55 : 1,
          }}
        >
          {feedback === "saved" ? <Check size={11} /> : <Save size={11} />}
          {feedback === "saved" ? "Guardado" : "Guardar defaults"}
        </button>
        {esCustom && (
          <button
            type="button"
            onClick={onResetFactory}
            disabled={saving}
            style={{
              fontSize: 11, padding: "5px 12px",
              display: "inline-flex", alignItems: "center", gap: 5,
            }}
          >
            {feedback === "reset" ? <Check size={11} /> : <Factory size={11} />}
            {feedback === "reset" ? "Restaurado" : "Volver a fábrica"}
          </button>
        )}
        {error && (
          <span
            role="alert"
            style={{
              fontSize: 11, fontWeight: 500,
              padding: "3px 8px", borderRadius: 999,
              background: "#fef2f2", color: "#991b1b",
              border: "1px solid #fecaca",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            <AlertCircle size={11} /> {error}
          </span>
        )}
      </div>

      {/* Sidebar + editor */}
      <div style={{ display: "flex", gap: 14, minHeight: 360 }}>
        <aside
          style={{
            width: 200, flexShrink: 0,
            borderRight: "1px solid var(--pulso-border)",
            paddingRight: 10,
            display: "flex", flexDirection: "column", gap: 2,
          }}
        >
          {catalog.map((p) => {
            const isActive = p.name === selected;
            // Señal "hay cambios sin guardar en este preset" — sirve para
            // que el usuario sepa qué presets tocó en la sesión actual
            // del modal antes de pulsar Guardar.
            const dirty = !presetArgsEqual(
              draft[p.name] ?? {},
              backendDefaults[p.name] ?? {},
            );
            const Icon = resolveLucide(p.icono_ui);
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => setSelected(p.name)}
                title={dirty ? "Tiene cambios sin guardar" : undefined}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 9px", borderRadius: 6,
                  border: "1px solid transparent",
                  background: isActive ? "var(--pulso-primary-soft)" : "transparent",
                  color: isActive ? "var(--pulso-primary)" : "var(--pulso-text)",
                  fontSize: 12, fontWeight: isActive ? 600 : 500,
                  textAlign: "left", cursor: "pointer",
                }}
              >
                <Icon size={13} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.titulo_humano}
                </span>
                {dirty && (
                  <Circle
                    size={7}
                    fill="var(--pulso-primary)"
                    color="transparent"
                    aria-label="Sin guardar"
                  />
                )}
              </button>
            );
          })}
        </aside>

        <section style={{ flex: 1, minWidth: 0 }}>
          <PresetArgsEditor meta={meta} values={currentDraft} onChangeArg={(name, val) => setArg(meta.name, name, val)} />
        </section>
      </div>
    </div>
  );
}

function PresetArgsEditor({
  meta, values, onChangeArg,
}: {
  meta: { name: string; args: ArgMetadata[] };
  values: Record<string, unknown>;
  onChangeArg: (name: string, value: unknown) => void;
}) {
  const grupos = useMemo(() => {
    const byGrupo: Record<ArgGrupo, ArgMetadata[]> = {
      datos: [], textos: [], estilo: [], filtro: [], semaforo: [], canvas: [], tabla: [], avanzado: [],
    };
    for (const a of meta.args) {
      const g: ArgGrupo = (a.grupo as ArgGrupo) ?? "avanzado";
      (byGrupo[g] ?? byGrupo.avanzado).push(a);
    }
    return (Object.keys(byGrupo) as ArgGrupo[])
      .filter((g) => byGrupo[g].length > 0)
      .sort((a, b) => GRUPO_META[a].order - GRUPO_META[b].order)
      .map((g) => ({ grupo: g, args: byGrupo[g] }));
  }, [meta]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
      {grupos.map(({ grupo, args }) => (
        <ArgGroup
          key={grupo}
          grupo={grupo}
          args={args}
          values={values}
          onChangeArg={onChangeArg}
          variables={[]}
        />
      ))}
    </div>
  );
}

// ---- Overrides defaults editor ---------------------------------------

function OverridesDefaultsEditor() {
  // Los overrides defaults viven en el store de Zustand como
  // `overridesReusables` — la idea es que el usuario edita los que
  // están pre-cargados + puede añadir nuevos. Al guardar, se persisten
  // via autosave (igual que cualquier otro cambio del store).
  //
  // Nota: esto edita el estado del estudio ACTUAL. Para que los
  // overrides persistan entre estudios/sesiones habría que añadir un
  // endpoint separado /overrides-defaults — lo dejamos para iteración
  // siguiente si el usuario lo pide.
  const overrides = usePlanStore((s) => s.overridesReusables);
  const addOverride = usePlanStore((s) => s.addOverrideReusable);
  const updateOverride = usePlanStore((s) => s.updateOverrideReusable);
  const removeOverride = usePlanStore((s) => s.removeOverrideReusable);

  const { presets: catalog, presetsByName, loading: loadingCatalog } = usePresetsMetadata();
  const tipoOptions = useMemo(() => catalog.filter((p) => p.name !== "base"), [catalog]);

  const [selectedId, setSelectedId] = useState<string | null>(overrides[0]?.id ?? null);
  const selected = overrides.find((o) => o.id === selectedId);

  if (loadingCatalog) {
    return <LoadingBlock label="Cargando catálogo…" />;
  }

  function newOverride() {
    const ov: OverrideReusable = {
      id: `ov-${Math.random().toString(36).slice(2, 10)}`,
      nombre: `Override ${overrides.length + 1}`,
      tipo_preset: tipoOptions[0]?.name ?? "barras_apiladas",
      args: {},
    };
    addOverride(ov);
    setSelectedId(ov.id);
  }

  function handleDelete(id: string) {
    if (!window.confirm("¿Eliminar este override?")) return;
    removeOverride(id);
    if (selectedId === id) {
      const rest = overrides.filter((o) => o.id !== id);
      setSelectedId(rest[0]?.id ?? null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 14, minHeight: 360 }}>
      <aside
        style={{
          width: 240, flexShrink: 0,
          borderRight: "1px solid var(--pulso-border)",
          paddingRight: 12,
          display: "flex", flexDirection: "column", gap: 6,
        }}
      >
        <button
          type="button"
          className="pulso-primary"
          onClick={newOverride}
          style={{ fontSize: 12, padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 5, justifyContent: "center" }}
        >
          <Plus size={12} /> Añadir override
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
          {overrides.map((o) => {
            const tipoMeta = presetsByName[o.tipo_preset];
            const Icon = resolveLucide(tipoMeta?.icono_ui);
            const isActive = o.id === selectedId;
            const hasArgs = Object.keys(o.args).length > 0;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setSelectedId(o.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 9px", borderRadius: 6,
                  border: "1px solid transparent",
                  background: isActive ? "var(--pulso-primary-soft)" : "transparent",
                  color: isActive ? "var(--pulso-primary)" : "var(--pulso-text)",
                  fontSize: 11, fontWeight: isActive ? 600 : 500,
                  textAlign: "left", cursor: "pointer",
                }}
              >
                <Icon size={12} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {o.nombre}
                </span>
                {hasArgs && <Circle size={6} fill="var(--pulso-primary)" color="transparent" />}
              </button>
            );
          })}
        </div>
      </aside>
      <section style={{ flex: 1, minWidth: 0 }}>
        {selected ? (
          <OverrideEditForm
            override={selected}
            tipoOptions={tipoOptions}
            presetsByName={presetsByName}
            onUpdate={(patch) => updateOverride(selected.id, patch)}
            onDelete={() => handleDelete(selected.id)}
          />
        ) : (
          <EmptyState
            icon={<Layers3 size={22} />}
            title={overrides.length === 0 ? "Aún no hay overrides" : "Selecciona un override"}
            hint={
              overrides.length === 0
                ? "Crea mini-presets reusables (reducido, compacto…) que cualquier slide del plan puede invocar."
                : "Elige un override de la izquierda para editar sus args, o crea uno nuevo."
            }
            cta={
              overrides.length === 0 ? (
                <button
                  type="button"
                  className="pulso-primary"
                  onClick={newOverride}
                  style={{
                    fontSize: 12, padding: "7px 14px",
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  <Plus size={13} /> Crear primer override
                </button>
              ) : undefined
            }
          />
        )}
      </section>
    </div>
  );
}

function OverrideEditForm({
  override, tipoOptions, presetsByName, onUpdate, onDelete,
}: {
  override: OverrideReusable;
  tipoOptions: { name: string; titulo_humano: string }[];
  presetsByName: Record<string, { name: string; args: ArgMetadata[] }>;
  onUpdate: (patch: Partial<OverrideReusable>) => void;
  onDelete: () => void;
}) {
  const tipoMeta = presetsByName[override.tipo_preset];

  function setArg(name: string, value: unknown) {
    const next = { ...override.args };
    if (value === null || value === undefined || value === "") delete next[name];
    else next[name] = value;
    onUpdate({ args: next });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text"
          value={override.nombre}
          onChange={(e) => onUpdate({ nombre: e.target.value })}
          placeholder="Nombre del override"
          style={{
            flex: 1, minWidth: 180,
            fontSize: 13, fontWeight: 700,
            padding: "5px 8px", border: "1px solid var(--pulso-border)",
            borderRadius: 5, background: "white", outline: "none",
          }}
        />
        <select
          value={override.tipo_preset}
          onChange={(e) => onUpdate({ tipo_preset: e.target.value, args: {} })}
          style={{
            fontSize: 11, padding: "5px 8px",
            border: "1px solid var(--pulso-border)",
            borderRadius: 5, background: "white",
          }}
        >
          {tipoOptions.map((t) => (
            <option key={t.name} value={t.name}>{t.titulo_humano}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={onDelete}
          className="pulso-icon pulso-icon-danger"
          aria-label="Eliminar"
          title="Eliminar override"
        >
          <Trash2 size={12} />
        </button>
      </div>
      {tipoMeta && (
        <PresetArgsEditor
          meta={tipoMeta}
          values={override.args}
          onChangeArg={setArg}
        />
      )}
    </div>
  );
}

// ---- Shared UI helpers ------------------------------------------------

function LoadingBlock({ label }: { label: string }) {
  return (
    <div
      role="status"
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 10, minHeight: 320,
        fontSize: 12, color: "var(--pulso-text-soft)",
      }}
    >
      <Loader2
        size={16}
        color="var(--pulso-primary)"
        style={{ animation: "pulso-spin 900ms linear infinite" }}
      />
      {label}
      <style>{`@keyframes pulso-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function EmptyState({
  icon, title, hint, cta,
}: {
  icon: JSX.Element;
  title: string;
  hint?: string;
  cta?: JSX.Element;
}) {
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", textAlign: "center",
        gap: 8, padding: "40px 20px", minHeight: 260,
        color: "var(--pulso-text-soft)",
      }}
    >
      <span
        style={{
          width: 42, height: 42, borderRadius: 10,
          background: "var(--pulso-surface)",
          color: "var(--pulso-text-soft)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          border: "1px solid var(--pulso-border)",
        }}
      >
        {icon}
      </span>
      <h4 style={{ margin: 0, fontSize: 13, color: "var(--pulso-text)" }}>{title}</h4>
      {hint && (
        <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, maxWidth: 320 }}>
          {hint}
        </p>
      )}
      {cta && <div style={{ marginTop: 6 }}>{cta}</div>}
    </div>
  );
}
