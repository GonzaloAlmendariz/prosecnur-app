import { useMemo } from "react";
import { ArgGrupo, ArgMetadata, GraficadorRef } from "../../api/client";
import { useGraficosRegistry } from "./useGraficosRegistry";
import { useVariables } from "./useVariables";
import { usePresetsMetadata } from "./usePresetsMetadata";
import { usePresetsDefaults } from "./usePresetsDefaults";
import { ArgGroup, GRUPO_META, ARG_GROUP_ORDER, normalizeArgGroup } from "./ArgGroup";
import { graficadorToPresetType } from "./graficadorPresetMap";
import { usePlanStore } from "./store";
import { LoadingBlock, ErrorBlock } from "../../components/States";
import { ArgState } from "./ArgField";
import { ChartLayoutEditor, hasChartLayoutSpec } from "./ChartLayoutPopover";
import { IconError, IconForward, IconModes, IconTemplate } from "../../lib/icons";

// Formulario dinámico de un graficador con jerarquía de fuentes:
//
//   1. Preset global (por tipo de gráfico)        — gris (heredado)
//   2. Modo aplicado (override reusable)         — morado
//   3. Edits custom del usuario sobre 1 ó 2      — azul
//
// `graf.args.overrides` es el map de keys que no provienen del preset.
// Para distinguir "viene del modo" vs "edit custom puro": si el conjunto
// `overrides` matchea EXACTAMENTE algún OverrideReusable compatible,
// entonces todos esos args son "from-mode". Si solo matchea como subset,
// los args del modo son "from-mode" y los extras son "custom". Si no
// matchea ningún modo, son todos "custom".

type Props = {
  graf: GraficadorRef;
  onArgs: (patch: Record<string, unknown>) => void;
  groupFilter?: ArgGrupo[];
  flatten?: boolean;
  slotLabel?: string;
  onReplaceGraficador?: () => void;
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
}: Props) {
  const { graficadoresById, loading, error } = useGraficosRegistry();
  const { presetsByName } = usePresetsMetadata();
  const { presets: presetsDefaults } = usePresetsDefaults();
  const { variables } = useVariables();
  const userPresets = usePlanStore((s) => s.presets);
  const overridesReusables = usePlanStore((s) => s.overridesReusables);

  const meta = graficadoresById[graf.graficador];
  const presetType = graficadorToPresetType(graf.graficador);
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
  const rawOverrideArgs = useMemo<Record<string, unknown>>(() => {
    const raw: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(asRecord(slotArgs.overrides))) {
      if (!hasArgValue(value) && !(value === "" && allowsEmptyStringOverride(argsByName[name]))) continue;
      raw[name] = value;
    }
    return raw;
  }, [argsByName, slotArgs]);

  // argState por arg: para args visuales guardados como overrides,
  // calculamos según overrides y appliedMode. Para args propios del graficador,
  // marcamos custom si tienen valor (comportamiento legacy).
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

  const appliedMode = useMemo(() => {
    if (!presetType) return null;
    const aplicables = overridesReusables.filter((o) => o.tipo_preset === presetType);
    // Buscamos contra los overrides crudos del slot. `currentOverrides`
    // elimina valores iguales al preset para persistencia/manualidad, pero
    // esos valores todavía pueden venir de un modo activo y deben mostrarse
    // como "Modo" en la UI.
    for (const o of aplicables) {
      const okeys = Object.keys(o.args);
      if (okeys.length === 0) continue;
      let isSubset = true;
      for (const k of okeys) {
        if (!(k in rawOverrideArgs)) { isSubset = false; break; }
        if (!sameValue(rawOverrideArgs[k], o.args[k])) { isSubset = false; break; }
      }
      if (isSubset) return o;
    }
    return null;
  }, [presetType, overridesReusables, rawOverrideArgs]);

  const argStates = useMemo<Record<string, ArgState>>(() => {
    const map: Record<string, ArgState> = {};
    for (const a of expandedArgs) {
      const comesFromAppliedMode = Boolean(
        appliedMode &&
        Object.prototype.hasOwnProperty.call(appliedMode.args, a.name) &&
        Object.prototype.hasOwnProperty.call(rawOverrideArgs, a.name) &&
        sameValue(rawOverrideArgs[a.name], appliedMode.args[a.name])
      );
      if (overrideArgNames.has(a.name)) {
        // Arg del preset
        if (comesFromAppliedMode) {
          map[a.name] = "from-mode";
        } else if (a.name in currentOverrides) {
          map[a.name] = "custom";
        } else {
          map[a.name] = "inherited";
        }
      } else {
        // Arg propio del graficador (var, cruces, etc.) — comportamiento normal
        map[a.name] = comesFromAppliedMode
          ? "from-mode"
          : hasArgValue(slotArgs[a.name])
            ? "custom"
            : "inherited";
      }
    }
    return map;
  }, [expandedArgs, overrideArgNames, currentOverrides, appliedMode, rawOverrideArgs, slotArgs]);

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
      ...currentOverrides,
    };
  }, [slotArgs, currentOverrides]);

  // Agrupar args expandidos
  const grupos = useMemo(() => {
    if (expandedArgs.length === 0) return [];
    const byGrupo: Partial<Record<ArgGrupo, ArgMetadata[]>> = {};
    for (const a of expandedArgs) {
      const g = normalizeArgGroup(a.grupo as ArgGrupo);
      (byGrupo[g] ??= []).push(a);
    }
    const allow = groupFilter ? new Set(groupFilter.map((g) => normalizeArgGroup(g))) : null;
    return ARG_GROUP_ORDER
      .filter((g) => byGrupo[g] && byGrupo[g]!.length > 0)
      .filter((g) => !allow || allow.has(g))
      .sort((a, b) => GRUPO_META[a].order - GRUPO_META[b].order)
      .map((g) => ({ grupo: g, args: byGrupo[g]! }));
  }, [expandedArgs, groupFilter]);

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
      />
    );
  }

  if (grupos.length === 0) {
    return (
      <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic", padding: "6px 4px" }}>
        Sin opciones para configurar en este modo.
      </div>
    );
  }

  return (
    <div>
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
              values={valuesForArgs}
              inheritedValues={inheritedValues}
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
}: {
  graficador: string;
  slotLabel?: string;
  onReplaceGraficador?: () => void;
}) {
  return (
    <div className="pulso-gv2-unknown-graf" role="alert">
      <span className="pulso-gv2-unknown-graf-mark" aria-hidden="true">
        <IconError size={16} />
      </span>

      <div className="pulso-gv2-unknown-graf-copy">
        <div className="pulso-gv2-unknown-graf-kicker">
          <span>Modelo no disponible</span>
          {slotLabel && <strong>{slotLabel}</strong>}
        </div>
        <h4>Este espacio usa un graficador fuera del catálogo actual</h4>
        <p>
          Conservamos la configuración del proyecto y el resto del slide.
          Reemplázalo por un modelo vigente para recuperar preview y edición completa.
        </p>
        <div className="pulso-gv2-unknown-graf-meta" aria-label="Estado del slot">
          <span>
            <IconTemplate size={12} /> Configuración preservada
          </span>
          <span>
            <IconModes size={12} /> Requiere modelo vigente
          </span>
          <code>{graficador}</code>
        </div>
      </div>

      {onReplaceGraficador ? (
        <button
          type="button"
          className="pulso-primary pulso-gv2-pill-button pulso-gv2-unknown-graf-action"
          onClick={onReplaceGraficador}
        >
          <IconForward size={13} /> Cambiar modelo
        </button>
      ) : (
        <span className="pulso-gv2-unknown-graf-hint">Datos / Cambiar</span>
      )}
    </div>
  );
}
