import { useMemo, useState } from "react";
import { Plus, Copy, Trash2, CheckCircle2, Layers3, SlidersHorizontal } from "lucide-react";
import { ArgGrupo, ArgMetadata } from "../../api/client";
import { usePlanStore, OverrideReusable } from "./store";
import { usePresetsMetadata } from "./usePresetsMetadata";
import { ArgGroup, GRUPO_META, ARG_GROUP_ORDER, normalizeArgGroup } from "./ArgGroup";
import { LoadingBlock, ErrorBlock, EmptyState } from "../../components/States";
import { ChartLayoutEditor, hasChartLayoutSpec } from "./ChartLayoutPopover";
import { humanizeIdentifier } from "./graficadorDisplay";
import { resolveGraphLucideIcon } from "./lucideRegistry";
// Los overrides reutilizables usan solo controles catalogados.

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

  if (loading) return <LoadingBlock label="Cargando catálogo…" />;
  if (error) return <ErrorBlock label="Error cargando catálogo" detail={error} />;

  const selected = overrides.find((o) => o.id === selectedId);
  const modesWithArgs = overrides.filter((o) => Object.keys(o.args).length > 0).length;
  const coveredTypes = new Set(overrides.map((o) => o.tipo_preset)).size;
  const totalArgs = overrides.reduce((sum, o) => sum + Object.keys(o.args).length, 0);

  function handleCreate() {
    const tipoDefault = tipoOptions[0]?.name ?? "barras_apiladas";
    const nuevoNombre = `Estilo ${overrides.length + 1}`;
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
    const confirm = window.confirm("¿Eliminar este estilo guardado? Los gráficos que lo estén usando volverán a la base predeterminada.");
    if (!confirm) return;
    removeOverride(id);
    if (selectedId === id) {
      const rest = overrides.filter((o) => o.id !== id);
      setSelectedId(rest[0]?.id ?? null);
    }
  }

  return (
    <div className="pulso-gv2-overrides-editor">
      <div className="pulso-gv2-overrides-overview" aria-label="Resumen de estilos guardados">
        <span className="pulso-gv2-overrides-overview-icon" aria-hidden="true">
          <Layers3 size={15} />
        </span>
        <span className="pulso-gv2-overrides-overview-copy">
          <strong>Estilos guardados</strong>
          <span>
            {overrides.length === 0
              ? "Crea apariencias como compacto, narrativo o alta densidad"
              : `${overrides.length} estilo${overrides.length === 1 ? "" : "s"} · ${modesWithArgs} con ajustes · ${coveredTypes} tipo${coveredTypes === 1 ? "" : "s"} de gráfico`}
          </span>
        </span>
        <span className="pulso-gv2-overrides-overview-pill">
          {totalArgs} ajuste{totalArgs === 1 ? "" : "s"}
        </span>
      </div>
      <div className="pulso-gv2-overrides-map" aria-label="Estructura de estilos guardados">
        <span className="is-base"><CheckCircle2 size={12} /> Base predeterminada</span>
        <span className="is-connector" aria-hidden="true">/</span>
        <span className={overrides.length > 0 ? "is-mode" : "is-muted"}>{overrides.length || 0} estilo{overrides.length === 1 ? "" : "s"} guardado{overrides.length === 1 ? "" : "s"}</span>
        <span className="is-connector" aria-hidden="true">/</span>
        <span className={modesWithArgs > 0 ? "is-custom" : "is-muted"}>{modesWithArgs} con ajustes adicionales</span>
      </div>
      <div className="pulso-gv2-overrides-workbench">
      {/* Sidebar */}
      <aside className="pulso-gv2-overrides-sidebar">
        <button
          type="button"
          className="pulso-primary pulso-gv2-overrides-new"
          onClick={handleCreate}
        >
          <Plus size={13} /> Nuevo estilo
        </button>

        {overrides.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={<Layers3 size={16} />}
            title="Sin estilos guardados"
            hint="Crea uno y aplícalo desde cualquier gráfico."
          />
        ) : (
          <div className="pulso-gv2-overrides-list">
            {overrides.map((o) => {
              const tipoMeta = presetsByName[o.tipo_preset];
              const Icon = resolveGraphLucideIcon(tipoMeta?.icono_ui, "Sliders");
              const isActive = o.id === selectedId;
              const argCount = Object.keys(o.args).length;
              const hasArgs = argCount > 0;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelectedId(o.id)}
                  className={`pulso-gv2-mode-list-item ${isActive ? "is-active" : ""}`}
                  data-empty={hasArgs ? "false" : "true"}
                >
                  <Icon size={13} />
                  <span className="pulso-gv2-mode-list-copy">
                    <span className="pulso-gv2-mode-list-label">{o.nombre}</span>
                    <span className="pulso-gv2-mode-list-meta">
                      {tipoMeta?.titulo_humano ?? humanizeIdentifier(o.tipo_preset, "Tipo de gráfico")} · {hasArgs ? `${argCount} ajuste${argCount === 1 ? "" : "s"}` : "hereda base"}
                    </span>
                  </span>
                  <span className={`pulso-gv2-mode-list-state ${hasArgs ? "is-custom" : "is-base"}`}>
                    {hasArgs ? argCount : "Base"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </aside>

      {/* Editor */}
      <section className="pulso-gv2-overrides-detail">
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
          <EmptyState
            icon={<Layers3 size={22} />}
            title={overrides.length === 0 ? "Aún no hay estilos guardados" : "Selecciona un estilo guardado"}
            hint={
              overrides.length === 0
                ? "Un estilo guardado conserva una apariencia reusable para aplicarla a gráficos específicos cuando la base predeterminada no alcanza."
                : "Elige uno del panel izquierdo para editar sus ajustes."
            }
            cta={
              overrides.length === 0 ? (
                <button
                  type="button"
                  className="pulso-primary"
                  onClick={handleCreate}
                  style={{
                    fontSize: 12, padding: "7px 14px",
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  <Plus size={13} /> Crear primer estilo
                </button>
              ) : undefined
            }
          />
        )}
      </section>
      </div>
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
  const Icon = resolveGraphLucideIcon(tipoMeta?.icono_ui, "Sliders");
  const argCount = Object.keys(override.args).length;
  const stateLabel = argCount > 0
    ? `${argCount} ajuste${argCount === 1 ? "" : "s"}`
    : "Sin ajustes propios";
  const modelLabel = tipoMeta?.titulo_humano ?? humanizeIdentifier(override.tipo_preset, "Tipo de gráfico");

  const gruposDeArgs = useMemo(() => {
    if (!tipoMeta) return [];
    const byGrupo: Partial<Record<ArgGrupo, ArgMetadata[]>> = {};
    for (const a of tipoMeta.args) {
      const g = normalizeArgGroup(a.grupo as ArgGrupo);
      (byGrupo[g] ??= []).push(a);
    }
    return ARG_GROUP_ORDER
      .filter((g) => byGrupo[g] && byGrupo[g]!.length > 0)
      .sort((a, b) => GRUPO_META[a].order - GRUPO_META[b].order)
      .map((g) => ({ grupo: g, args: byGrupo[g]! }));
  }, [tipoMeta]);
  const layoutArgs = tipoMeta?.args ?? [];

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
      <header className="pulso-gv2-override-detail-head">
        <span className="pulso-gv2-override-detail-icon" aria-hidden="true">
          <Icon size={15} />
        </span>
        <div className="pulso-gv2-override-detail-copy">
          <span className="pulso-gv2-override-eyebrow">Estilo guardado</span>
          <input
            type="text"
            value={override.nombre}
            onChange={(e) => onUpdate({ nombre: e.target.value })}
            placeholder="Ej. Compacto para grid 4"
            className="pulso-inline-edit pulso-gv2-override-name"
          />
          <div className="pulso-gv2-override-model-row">
            <label>Tipo de gráfico</label>
            <select
              value={override.tipo_preset}
              onChange={(e) => handleTipoChange(e.target.value)}
              className="pulso-gv2-override-model-select"
            >
              {tipoOptions.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.titulo_humano}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="pulso-gv2-override-actions">
          <span className={`pulso-gv2-override-state ${argCount > 0 ? "is-custom" : "is-base"}`}>
            <SlidersHorizontal size={11} />
            {stateLabel}
          </span>
        <button
          type="button"
          onClick={onDuplicate}
          title="Duplicar esta variante"
          className="pulso-gv2-override-action-button"
        >
          <Copy size={11} /> Duplicar
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Eliminar esta variante"
          className="pulso-icon pulso-icon-danger"
          style={{ minWidth: 28, minHeight: 28 }}
        >
          <Trash2 size={12} />
        </button>
        </div>
      </header>

      <div className="pulso-gv2-override-lineage" aria-label="Estructura del estilo seleccionado">
        <span className="is-base"><CheckCircle2 size={12} /> Base predeterminada</span>
        <span className="is-connector" aria-hidden="true">/</span>
        <span className="is-mode">{modelLabel}</span>
        <span className="is-connector" aria-hidden="true">/</span>
        <span className={argCount > 0 ? "is-custom" : "is-muted"}>{stateLabel}</span>
      </div>

      <OverrideFocusGrid
        modelLabel={modelLabel}
        modeName={override.nombre}
        argCount={argCount}
      />

      {tipoMeta?.descripcion && (
        <p className="pulso-gv2-override-description">
          {tipoMeta.descripcion} Los ajustes que definas acá se aplican sobre la base predeterminada cuando uses este estilo.
        </p>
      )}

      <div className="pulso-gv2-presets-body">
        {gruposDeArgs.length === 0 ? (
          <div className="pulso-gv2-override-empty">
            Este tipo de gráfico no tiene ajustes visuales catalogados todavía.
            No se puede editar desde esta pantalla.
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
              bodyIntro={normalizeArgGroup(grupo) === "espacio" && hasChartLayoutSpec(override.tipo_preset, layoutArgs) ? (
                <ChartLayoutEditor
                  presetType={override.tipo_preset}
                  args={layoutArgs}
                  values={override.args}
                  onChangeArg={handleChangeArg}
                  onChangeArgs={(patchIn) => {
                    const next = { ...override.args };
                    for (const [name, value] of Object.entries(patchIn)) {
                      if (value === null || value === undefined || value === "") {
                        delete next[name];
                      } else {
                        next[name] = value;
                      }
                    }
                    onUpdate({ args: next });
                  }}
                />
              ) : undefined}
            />
          ))
        )}

      </div>
    </>
  );
}

function OverrideFocusGrid({
  modelLabel,
  modeName,
  argCount,
}: {
  modelLabel: string;
  modeName: string;
  argCount: number;
}) {
  return (
    <div className="pulso-gv2-override-focus-grid" aria-label="Resumen del estilo guardado seleccionado">
      <span className="is-model">
        <strong>Tipo compatible</strong>
        <b>{modelLabel}</b>
      </span>
      <span className={argCount > 0 ? "is-custom" : "is-base"}>
        <strong>Herencia</strong>
        <b>{argCount > 0 ? `${argCount} sobre base` : "Usa base predeterminada"}</b>
      </span>
      <span className="is-mode">
        <strong>Estilo guardado</strong>
        <b>{modeName.trim() || "Sin nombre"}</b>
      </span>
    </div>
  );
}
