import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { ArgGrupo, ArgMetadata, GraficadorRef } from "../../api/client";
import { useGraficosRegistry } from "./useGraficosRegistry";
import { useVariables } from "./useVariables";
import { usePresetsMetadata } from "./usePresetsMetadata";
import { usePresetsDefaults } from "./usePresetsDefaults";
import { filtrarAjustes } from "./buscarAjustes";
import "./v2/styles/paletas-suite.css";
import { ArgGroup, GRUPO_META, ARG_GROUP_ORDER, normalizeArgGroup } from "./ArgGroup";
import { graficadorToPresetType } from "./graficadorPresetMap";
import { usePlanStore } from "./store";
import { LoadingBlock, ErrorBlock } from "../../components/States";
import { ArgState } from "./ArgField";
import { ChartLayoutEditor, hasChartLayoutSpec } from "./ChartLayoutPopover";
import { collectActiveChartStyleValues, resolveActiveChartLayoutOrigin } from "./chartLayoutOrigin";
import { IconChecklist, IconError, IconForward, IconModes, IconSuccess, IconTemplate } from "../../lib/icons";

// Formulario dinámico de un graficador con dos ámbitos observables:
//
//   1. Preset global (por tipo de gráfico)        — gris (heredado)
//   2. Ajustes propios del gráfico                 — azul
//
// `graf.args.overrides` guarda copias, no identidad de biblioteca. Aunque
// sus valores coincidan con un estilo guardado, siguen siendo ajustes propios.

type Props = {
  graf: GraficadorRef;
  onArgs: (patch: Record<string, unknown>) => void;
  groupFilter?: ArgGrupo[];
  flatten?: boolean;
  slotLabel?: string;
  onReplaceGraficador?: () => void;
  replaceGraficadorLabel?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function hasArgValue(value: unknown): boolean {
  return value !== undefined &&
    value !== null &&
    value !== "" &&
    !(Array.isArray(value) && value.length === 0);
}

function allowsEmptyStringOverride(meta: ArgMetadata | undefined): boolean {
  return meta?.tipo_input === "string" || meta?.tipo_input === "textarea";
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function clarifyGraphTitleArg(arg: ArgMetadata): ArgMetadata {
  if (arg.name !== "titulo") return arg;
  return {
    ...arg,
    label: "Título del gráfico",
    descripcion: "Texto que se muestra como título propio del gráfico.",
  };
}

export default function GraficadorForm({
  graf,
  onArgs,
  groupFilter,
  flatten = false,
  slotLabel,
  onReplaceGraficador,
  replaceGraficadorLabel,
}: Props) {
  const { graficadoresById, loading, error } = useGraficosRegistry();
  const { presetsByName } = usePresetsMetadata();
  const { presets: presetsDefaults } = usePresetsDefaults();
  const { variables } = useVariables();
  const userPresets = usePlanStore((s) => s.presets);

  const meta = graficadoresById[graf.graficador];
  const presetType = graficadorToPresetType(graf.graficador, meta?.preset_key);
  const presetMeta = presetType ? presetsByName[presetType] : undefined;
  const isStyleContext = useMemo(() => {
    if (!groupFilter?.length) return false;
    const groups = new Set(groupFilter.map((g) => normalizeArgGroup(g)));
    return groups.has("lectura") && !groups.has("datos");
  }, [groupFilter]);

  // Valor "preset" efectivo para cada arg del preset:
  //   userPresets[presetType] ?? presetsDefaults[presetType] ?? presetMeta.args[].default
  const presetValues = useMemo<Record<string, unknown>>(() => {
    if (!presetMeta || !presetType) return {};
    const def: Record<string, unknown> = {};
    for (const a of presetMeta.args) {
      if (a.default !== undefined && a.default !== null) def[a.name] = a.default;
    }
    return {
      ...def,
      ...(presetsDefaults[presetType] ?? {}),
      ...(userPresets[presetType] ?? {}),
    };
  }, [presetMeta, presetType, presetsDefaults, userPresets]);

  // Expansión: los args propios del graficador se combinan con los args
  // del preset compatible. Antes esto dependía de un placeholder técnico
  // `overrides`; ahora el backend ya no lo expone a la UI, así que el
  // merge debe ocurrir explícitamente aquí.
  const expandedArgs: ArgMetadata[] = useMemo(() => {
    if (!meta) return [];
    const result: ArgMetadata[] = [];
    const seen = new Set<string>();
    const hideLegacyWrapY =
      graf.graficador === "p_barras_multiapiladas" &&
      !!presetMeta?.args.some((a) => a.name === "ancho_max_eje_y");
    for (const a of meta.args) {
      if (a.tipo_input === "overrides") continue;
      if (hideLegacyWrapY && a.name === "wrap_y") continue;
      result.push(isStyleContext ? clarifyGraphTitleArg(a) : a);
      seen.add(a.name);
    }
    if (presetMeta) {
      for (const presetArg of presetMeta.args) {
        if (seen.has(presetArg.name)) continue;
        result.push({ ...presetArg, grupo: presetArg.grupo ?? "estilo" } as ArgMetadata);
        seen.add(presetArg.name);
      }
    }
    return result;
  }, [graf.graficador, isStyleContext, meta, presetMeta]);

  const presetArgNames = useMemo(() => {
    return new Set(presetMeta?.args.map((a) => a.name) ?? []);
  }, [presetMeta]);
  const overrideArgNames = useMemo(() => {
    const names = new Set(presetArgNames);
    if (isStyleContext) names.add("titulo");
    return names;
  }, [isStyleContext, presetArgNames]);

  const argsByName = useMemo(() => {
    const map: Record<string, ArgMetadata> = {};
    for (const arg of expandedArgs) map[arg.name] = arg;
    return map;
  }, [expandedArgs]);

  const slotArgs = useMemo<Record<string, unknown>>(() => asRecord(graf.args), [graf.args]);
  const ownedStyleValues = useMemo(
    () => collectActiveChartStyleValues(slotArgs, overrideArgNames),
    [overrideArgNames, slotArgs],
  );

  // Los overrides anidados y las copias legacy propias se normalizan contra
  // la Base PPT. Esta comparación reduce persistencia; nunca atribuye estilo.
  const currentOverrides = useMemo<Record<string, unknown>>(() => {
    const merged: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(asRecord(slotArgs.overrides))) {
      if (!hasArgValue(value) && !(value === "" && allowsEmptyStringOverride(argsByName[name]))) continue;
      if (presetArgNames.has(name) && sameValue(value, presetValues[name])) continue;
      merged[name] = value;
    }

    // Compatibilidad: algunos proyectos o UIs antiguas pudieron guardar
    // args de preset directamente en el slot. Los tratamos como overrides
    // efectivos para no perderlos al reabrir, y el siguiente cambio los
    // vuelve a escribir en `args.overrides` (forma canónica del motor).
    for (const name of overrideArgNames) {
      if (name in merged) continue;
      const topLevelValue = slotArgs[name];
      if (!hasArgValue(topLevelValue) && !(topLevelValue === "" && allowsEmptyStringOverride(argsByName[name]))) continue;
      if (presetArgNames.has(name) && sameValue(topLevelValue, presetValues[name])) continue;
      merged[name] = topLevelValue;
    }

    return merged;
  }, [argsByName, overrideArgNames, presetArgNames, presetValues, slotArgs]);

  const layoutOrigin = useMemo(
    () => resolveActiveChartLayoutOrigin(ownedStyleValues),
    [ownedStyleValues],
  );

  const argStates = useMemo<Record<string, ArgState>>(() => {
    const map: Record<string, ArgState> = {};
    for (const a of expandedArgs) {
      if (overrideArgNames.has(a.name)) {
        map[a.name] = a.name in ownedStyleValues ? "custom" : "inherited";
      } else {
        map[a.name] = hasArgValue(slotArgs[a.name]) ? "custom" : "inherited";
      }
    }
    return map;
  }, [expandedArgs, overrideArgNames, ownedStyleValues, slotArgs]);

  // inheritedValues: para args del preset, el valor del preset (gris).
  // Para args propios del graficador, undefined (no hay heredado).
  const inheritedValues = useMemo<Record<string, unknown>>(() => {
    const map: Record<string, unknown> = {};
    for (const a of expandedArgs) {
      if (presetArgNames.has(a.name)) {
        map[a.name] = presetValues[a.name];
      }
    }
    return map;
  }, [expandedArgs, presetArgNames, presetValues]);

  // values combinados: para args del preset usamos el override si existe,
  // si no el preset; el ArgField pinta el "inheritedValue" cuando estado
  // es "inherited" sin valor propio (ya manejado en ArgField).
  const valuesForArgs = useMemo<Record<string, unknown>>(() => {
    return {
      ...slotArgs,
      // Cada arg del preset que tenga override aparece en top-level
      ...ownedStyleValues,
    };
  }, [slotArgs, ownedStyleValues]);

  // Agrupar args expandidos
  // Buscador de ajustes del gráfico.
  //
  // El panel de Estilo global ya tenía uno; esta superficie —donde el analista
  // pasa la mayor parte del tiempo— no, y expone hasta 27 ajustes por gráfico.
  // Misma regla, importada del mismo módulo: dos copias se separarían y el
  // analista vería resultados distintos según por qué panel entró.
  const [busqueda, setBusqueda] = useState("");
  const argsBuscados = useMemo(
    () => filtrarAjustes(expandedArgs, busqueda),
    [expandedArgs, busqueda],
  );

  const grupos = useMemo(() => {
    if (argsBuscados.length === 0) return [];
    const byGrupo: Partial<Record<ArgGrupo, ArgMetadata[]>> = {};
    for (const a of argsBuscados) {
      const g = normalizeArgGroup(a.grupo as ArgGrupo);
      (byGrupo[g] ??= []).push(a);
    }
    const allow = groupFilter ? new Set(groupFilter.map((g) => normalizeArgGroup(g))) : null;
    return ARG_GROUP_ORDER
      .filter((g) => byGrupo[g] && byGrupo[g]!.length > 0)
      .filter((g) => !allow || allow.has(g))
      .sort((a, b) => GRUPO_META[a].order - GRUPO_META[b].order)
      .map((g) => ({ grupo: g, args: byGrupo[g]! }));
  }, [argsBuscados, groupFilter]);

  function handleChange(name: string, value: unknown) {
    if (overrideArgNames.has(name)) {
      const prev = currentOverrides;
      const next = { ...prev };
      // Si el valor coincide con el del preset, lo borramos (vuelve a heredado)
      const presetVal = presetValues[name];
      const isSameAsPreset = presetArgNames.has(name) && sameValue(value, presetVal);
      const isEmptyStringOverride = value === "" && allowsEmptyStringOverride(argsByName[name]);
      if (value === null || value === undefined || (!isEmptyStringOverride && value === "") || isSameAsPreset) {
        delete next[name];
      } else {
        next[name] = value;
      }
      const patch: Record<string, unknown> = { overrides: next };
      // Si existía una copia legacy en top-level, limpiarla evita que
      // vuelva a pisar el preset al rehidratar el proyecto.
      if (Object.prototype.hasOwnProperty.call(slotArgs, name)) {
        patch[name] = null;
      }
      onArgs(patch);
    } else {
      onArgs({ [name]: value });
    }
  }

  function handleLayoutPatch(patchIn: Record<string, unknown>) {
    const nextOverrides = { ...currentOverrides };
    const patch: Record<string, unknown> = {};

    for (const [name, value] of Object.entries(patchIn)) {
      if (overrideArgNames.has(name)) {
        const presetVal = presetValues[name];
        const isSameAsPreset = presetArgNames.has(name) && sameValue(value, presetVal);
        const isEmptyStringOverride = value === "" && allowsEmptyStringOverride(argsByName[name]);
        if (value === null || value === undefined || (!isEmptyStringOverride && value === "") || isSameAsPreset) {
          delete nextOverrides[name];
        } else {
          nextOverrides[name] = value;
        }
        if (Object.prototype.hasOwnProperty.call(slotArgs, name)) {
          patch[name] = null;
        }
      } else {
        patch[name] = value;
      }
    }

    patch.overrides = nextOverrides;
    onArgs(patch);
  }

  if (loading) {
    return <LoadingBlock variant="inline" label="Cargando opciones…" />;
  }
  if (error) {
    return <ErrorBlock label="Error cargando catálogo" detail={error} />;
  }
  if (!meta) {
    return (
      <UnknownGraficadorState
        graficador={graf.graficador}
        slotLabel={slotLabel}
        onReplaceGraficador={onReplaceGraficador}
        replaceGraficadorLabel={replaceGraficadorLabel}
      />
    );
  }

  // El vacío por BÚSQUEDA no puede usar el mismo camino que el vacío por falta
  // de opciones: ese early return se lleva por delante el propio buscador y
  // deja al analista sin forma de limpiar lo que escribió.
  if (expandedArgs.length === 0) {
    return (
      <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic", padding: "6px 4px" }}>
        Sin opciones para configurar en este modo.
      </div>
    );
  }

  return (
    <div>
      {expandedArgs.length > 6 && (
        <div className="pulso-gv2-presets-buscador">
          <Search size={13} aria-hidden="true" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={`Buscar entre ${expandedArgs.length} ajustes…`}
            aria-label="Buscar un ajuste por nombre o por lo que hace"
          />
          {busqueda.trim() && (
            <span className="pulso-gv2-presets-buscador-conteo">
              {argsBuscados.length === 0
                ? "sin resultados"
                : `${argsBuscados.length} de ${expandedArgs.length}`}
            </span>
          )}
          {busqueda && (
            <button type="button" className="pulso-icon" onClick={() => setBusqueda("")}
                    aria-label="Limpiar la búsqueda">
              <X size={11} />
            </button>
          )}
        </div>
      )}
      {grupos.length === 0 && (
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic", padding: "6px 4px" }}>
          Ningún ajuste coincide con «{busqueda.trim()}».
        </div>
      )}
      {grupos.map(({ grupo, args }) => (
        <ArgGroup
          key={grupo}
          grupo={grupo}
          args={args}
          values={valuesForArgs}
          onChangeArg={handleChange}
          variables={variables}
          flatten={flatten}
          argStates={argStates}
          inheritedValues={inheritedValues}
          onResetArg={(name) => handleChange(name, null)}
          bodyIntro={normalizeArgGroup(grupo) === "espacio" && hasChartLayoutSpec(presetType, args) ? (
            <ChartLayoutEditor
              presetType={presetType}
              args={args}
              values={ownedStyleValues}
              inheritedValues={inheritedValues}
              origin={layoutOrigin}
              onChangeArg={handleChange}
              onChangeArgs={handleLayoutPatch}
              onResetArg={(name) => handleChange(name, null)}
            />
          ) : undefined}
        />
      ))}
    </div>
  );
}

function UnknownGraficadorState({
  graficador,
  slotLabel,
  onReplaceGraficador,
  replaceGraficadorLabel,
}: {
  graficador: string;
  slotLabel?: string;
  onReplaceGraficador?: () => void;
  replaceGraficadorLabel?: string;
}) {
  const actionLabel = replaceGraficadorLabel ?? "Reemplazar modelo";

  return (
    <div className="pulso-gv2-unknown-graf" role="alert">
      <span className="pulso-gv2-unknown-graf-mark" aria-hidden="true">
        <IconError size={16} />
      </span>

      <div className="pulso-gv2-unknown-graf-copy">
        <div className="pulso-gv2-unknown-graf-kicker">
          <span>Modelo pendiente de actualizar</span>
          {slotLabel && <strong>{slotLabel}</strong>}
        </div>
        <h4>Tu configuración está protegida</h4>
        <p>
          Este slot usa un identificador de modelo que ya no aparece en el catálogo actual.
          Conservamos sus argumentos para que puedas elegir un modelo vigente sin perder ajustes.
        </p>
        <div className="pulso-gv2-unknown-graf-flow" aria-label="Ruta de recuperación">
          <span>
            <IconChecklist size={12} /> Ajustes guardados
          </span>
          <IconForward className="pulso-gv2-unknown-graf-flow-arrow" size={11} aria-hidden="true" />
          <span>
            <IconTemplate size={12} /> Elegir modelo vigente
          </span>
          <IconForward className="pulso-gv2-unknown-graf-flow-arrow" size={11} aria-hidden="true" />
          <span>
            <IconModes size={12} /> Preview exacta
          </span>
        </div>
        <div className="pulso-gv2-unknown-graf-meta" aria-label="Estado del slot">
          <span data-tone="safe">
            <IconSuccess size={12} /> Plan intacto
          </span>
          <span data-tone="limited">
            <IconModes size={12} /> Preview limitado
          </span>
          <code title={`Identificador pendiente: ${graficador}`}>{graficador}</code>
        </div>
      </div>

      {onReplaceGraficador ? (
        <button
          type="button"
          className="pulso-primary pulso-gv2-pill-button pulso-gv2-unknown-graf-action"
          onClick={onReplaceGraficador}
          title={actionLabel}
          aria-label={`${actionLabel}: ${slotLabel ?? graficador}`}
        >
          <IconForward size={13} /> {actionLabel}
        </button>
      ) : (
        <span className="pulso-gv2-unknown-graf-hint">Abre Datos para elegir modelo</span>
      )}
    </div>
  );
}
