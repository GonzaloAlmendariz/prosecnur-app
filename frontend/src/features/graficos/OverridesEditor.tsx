import { useMemo, useState } from "react";
import * as Lucide from "lucide-react";
import { Plus, Copy, Trash2, Circle } from "lucide-react";
import { ArgGrupo, ArgMetadata } from "../../api/client";
import { usePlanStore, OverrideReusable } from "./store";
import { usePresetsMetadata } from "./usePresetsMetadata";
import { ArgGroup, GRUPO_META } from "./ArgGroup";
import { AdvancedJsonEditor } from "./AdvancedJsonEditor";

// Overrides reutilizables = mini-presets nombrados (ej. "compacto", "grande")
// que se aplican a slots específicos dentro de un slide.
//
// Mirror del patrón `ovr_apiladas_compactas` / `ovr_pie_compacto` de los
// QMDs de GIZ: útil cuando un grid 4×/5×/6× necesita tamaños distintos
// a los slides de 1-2 gráficos.
//
// Layout:
//   [ sidebar: lista de overrides + botón "Nuevo" ]  |  [ editor ]
//
// Cada override guarda:
//   - id (estable, uuid)
//   - nombre ("compacto")
//   - tipo_preset ("barras_apiladas", "pie", …)
//   - args (Record<string, unknown>)
//
// Los args editables son los del tipo de preset correspondiente — reusamos
// el catálogo de presets-metadata (los mismos args que edita PresetsEditor).
//
// Aplicación: GraficadorSlot muestra un dropdown "Aplicar override" con
// los overrides compatibles con el tipo del graficador actual (via
// graficadorToPresetType). Al aplicar, copia los args al campo
// `overrides` del GraficadorRef.

type LucideIcon = (props: { size?: number; color?: string }) => JSX.Element;

function resolveLucide(name: string | undefined): LucideIcon {
  const registry = Lucide as unknown as Record<string, LucideIcon>;
  return (name && registry[name]) || registry["Sliders"] || registry["Square"];
}

function newId() {
  return `ov-${Math.random().toString(36).slice(2, 10)}`;
}

export function OverridesEditor() {
  const overrides = usePlanStore((s) => s.overridesReusables);
  const addOverride = usePlanStore((s) => s.addOverrideReusable);
  const updateOverride = usePlanStore((s) => s.updateOverrideReusable);
  const removeOverride = usePlanStore((s) => s.removeOverrideReusable);

  const { presets, presetsByName, loading, error } = usePresetsMetadata();

  // Tipos elegibles para overrides: todos los presets excepto `base`
  // (base aplica por herencia a todos los presets; no tiene sentido como
  // override de un gráfico individual).
  const tipoOptions = useMemo(
    () => presets.filter((p) => p.name !== "base"),
    [presets]
  );

  const [selectedId, setSelectedId] = useState<string | null>(
    overrides[0]?.id ?? null
  );

  if (loading) {
    return (
      <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", padding: 10 }}>
        Cargando catálogo…
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ fontSize: 12, color: "#991b1b", padding: 10 }}>
        Error cargando catálogo: {error}
      </div>
    );
  }

  const selected = overrides.find((o) => o.id === selectedId);

  function handleCreate() {
    const tipoDefault = tipoOptions[0]?.name ?? "barras_apiladas";
    const nuevoNombre = `Override ${overrides.length + 1}`;
    const nuevo: OverrideReusable = {
      id: newId(),
      nombre: nuevoNombre,
      tipo_preset: tipoDefault,
      args: {},
    };
    addOverride(nuevo);
    setSelectedId(nuevo.id);
  }

  function handleDuplicate(ov: OverrideReusable) {
    const copia: OverrideReusable = {
      id: newId(),
      nombre: `${ov.nombre} (copia)`,
      tipo_preset: ov.tipo_preset,
      args: { ...ov.args },
    };
    addOverride(copia);
    setSelectedId(copia.id);
  }

  function handleDelete(id: string) {
    const confirm = window.confirm("¿Eliminar este override? Los gráficos que lo estén usando volverán a los defaults del preset.");
    if (!confirm) return;
    removeOverride(id);
    if (selectedId === id) {
      const rest = overrides.filter((o) => o.id !== id);
      setSelectedId(rest[0]?.id ?? null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 16, minHeight: 420 }}>
      {/* Sidebar */}
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
          onClick={handleCreate}
          style={{
            fontSize: 12, padding: "7px 10px",
            display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center",
          }}
        >
          <Plus size={13} /> Nuevo override
        </button>

        {overrides.length === 0 ? (
          <div
            style={{
              fontSize: 11, color: "var(--pulso-text-soft)",
              padding: "14px 10px",
              background: "var(--pulso-surface)",
              borderRadius: 6,
              border: "1px dashed var(--pulso-border)",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            No tienes overrides.
            <br />
            Crea uno y aplícalo desde cualquier slot de gráfico.
          </div>
        ) : (
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
                    padding: "7px 9px", borderRadius: 6,
                    border: "1px solid transparent",
                    background: isActive ? "var(--pulso-primary-soft)" : "transparent",
                    color: isActive ? "var(--pulso-primary)" : "var(--pulso-text)",
                    fontSize: 12, fontWeight: isActive ? 600 : 500,
                    textAlign: "left", cursor: "pointer",
                    minWidth: 0,
                  }}
                >
                  <Icon size={13} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {o.nombre}
                  </span>
                  {hasArgs && (
                    <Circle size={6} fill="var(--pulso-primary)" color="transparent" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </aside>

      {/* Editor */}
      <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        {selected ? (
          <OverrideEditPanel
            override={selected}
            tipoOptions={tipoOptions}
            presetsByName={presetsByName}
            onUpdate={(patch) => updateOverride(selected.id, patch)}
            onDuplicate={() => handleDuplicate(selected)}
            onDelete={() => handleDelete(selected.id)}
          />
        ) : (
          <div
            style={{
              fontSize: 12, color: "var(--pulso-text-soft)",
              padding: "18px 14px",
              border: "1px dashed var(--pulso-border)",
              borderRadius: 8,
              background: "var(--pulso-surface)",
              textAlign: "center", lineHeight: 1.5,
            }}
          >
            Selecciona un override en el panel izquierdo o crea uno nuevo.
          </div>
        )}
      </section>
    </div>
  );
}

function OverrideEditPanel({
  override,
  tipoOptions,
  presetsByName,
  onUpdate,
  onDuplicate,
  onDelete,
}: {
  override: OverrideReusable;
  tipoOptions: { name: string; titulo_humano: string; icono_ui: string }[];
  presetsByName: Record<string, { name: string; titulo_humano: string; args: ArgMetadata[]; descripcion: string; icono_ui: string }>;
  onUpdate: (patch: Partial<OverrideReusable>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const tipoMeta = presetsByName[override.tipo_preset];
  const Icon = resolveLucide(tipoMeta?.icono_ui);

  const gruposDeArgs = useMemo(() => {
    if (!tipoMeta) return [];
    const byGrupo: Record<ArgGrupo, ArgMetadata[]> = {
      datos: [], textos: [], estilo: [], calculo: [], semaforo: [], avanzado: [],
    };
    for (const a of tipoMeta.args) {
      const g: ArgGrupo = (a.grupo as ArgGrupo) ?? "avanzado";
      (byGrupo[g] ?? byGrupo.avanzado).push(a);
    }
    return (Object.keys(byGrupo) as ArgGrupo[])
      .filter((g) => byGrupo[g].length > 0)
      .sort((a, b) => GRUPO_META[a].order - GRUPO_META[b].order)
      .map((g) => ({ grupo: g, args: byGrupo[g] }));
  }, [tipoMeta]);

  function handleChangeArg(arg: string, value: unknown) {
    const next = { ...override.args };
    if (value === null || value === undefined || value === "") {
      delete next[arg];
    } else {
      next[arg] = value;
    }
    onUpdate({ args: next });
  }

  function handleTipoChange(newTipo: string) {
    // Al cambiar el tipo, vaciamos args (los del tipo anterior ya no aplican).
    onUpdate({ tipo_preset: newTipo, args: {} });
  }

  return (
    <>
      {/* Header con nombre editable + tipo + acciones */}
      <header
        style={{
          display: "flex", alignItems: "center", gap: 10,
          paddingBottom: 10,
          borderBottom: "1px solid var(--pulso-border)",
        }}
      >
        <span
          style={{
            width: 30, height: 30, borderRadius: 7,
            background: "var(--pulso-primary-soft)",
            color: "var(--pulso-primary)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={15} />
        </span>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <input
            type="text"
            value={override.nombre}
            onChange={(e) => onUpdate({ nombre: e.target.value })}
            placeholder="Nombre del override"
            style={{
              fontSize: 14, fontWeight: 700,
              padding: "3px 6px", border: "1px solid transparent",
              borderRadius: 4, background: "transparent",
              color: "var(--pulso-text)", outline: "none",
            }}
            onFocus={(e) => { e.currentTarget.style.border = "1px solid var(--pulso-border)"; e.currentTarget.style.background = "white"; }}
            onBlur={(e) => { e.currentTarget.style.border = "1px solid transparent"; e.currentTarget.style.background = "transparent"; }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
              Aplica a:
            </label>
            <select
              value={override.tipo_preset}
              onChange={(e) => handleTipoChange(e.target.value)}
              style={{
                fontSize: 11, padding: "3px 6px",
                border: "1px solid var(--pulso-border)",
                borderRadius: 5, background: "white",
                color: "var(--pulso-text)",
              }}
            >
              {tipoOptions.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.titulo_humano}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={onDuplicate}
          title="Duplicar este override"
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 11, padding: "5px 10px",
            border: "1px solid var(--pulso-border)", borderRadius: 6,
            background: "white", color: "var(--pulso-text)",
            cursor: "pointer",
          }}
        >
          <Copy size={11} /> Duplicar
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Eliminar este override"
          className="pulso-icon pulso-icon-danger"
          style={{ minWidth: 28, minHeight: 28 }}
        >
          <Trash2 size={12} />
        </button>
      </header>

      {tipoMeta?.descripcion && (
        <p
          style={{
            margin: 0, fontSize: 11,
            color: "var(--pulso-text-soft)", lineHeight: 1.5,
          }}
        >
          {tipoMeta.descripcion} Los args que definas acá <strong>pisan</strong> al preset global cuando se aplique este override.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
        {gruposDeArgs.length === 0 ? (
          <div
            style={{
              fontSize: 12, color: "var(--pulso-text-soft)",
              padding: "14px 16px", borderRadius: 6,
              background: "var(--pulso-surface)",
              border: "1px solid var(--pulso-border)",
            }}
          >
            Este tipo de preset no tiene args catalogados. Usa la edición JSON avanzada
            abajo para setear args específicos.
          </div>
        ) : (
          gruposDeArgs.map(({ grupo, args }) => (
            <ArgGroup
              key={grupo}
              grupo={grupo}
              args={args}
              values={override.args}
              onChangeArg={handleChangeArg}
              variables={[]}
            />
          ))
        )}

        <AdvancedJsonEditor
          value={override.args}
          onChange={(next) => onUpdate({ args: next })}
          curatedArgNames={tipoMeta?.args.map((a) => a.name) ?? []}
          label="Edición JSON avanzada"
          hint="Args raw del override. Ideal para los args canvas/compactos de los QMDs (ej. canvas_w_etiquetas, alto_por_categoria) que aún no están en el catálogo."
        />
      </div>
    </>
  );
}
