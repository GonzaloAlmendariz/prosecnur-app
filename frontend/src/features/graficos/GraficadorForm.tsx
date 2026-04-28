import { useMemo } from "react";
import { ArgGrupo, ArgMetadata, GraficadorRef } from "../../api/client";
import { useGraficosRegistry } from "./useGraficosRegistry";
import { useVariables } from "./useVariables";
import { usePresetsMetadata } from "./usePresetsMetadata";
import { usePresetsDefaults } from "./usePresetsDefaults";
import { ArgGroup, GRUPO_META } from "./ArgGroup";
import { graficadorToPresetType } from "./graficadorPresetMap";
import { usePlanStore } from "./store";
import { LoadingBlock, ErrorBlock } from "../../components/States";
import { ArgState } from "./ArgField";

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
};

export default function GraficadorForm({ graf, onArgs, groupFilter, flatten = false }: Props) {
  const { graficadoresById, loading, error } = useGraficosRegistry();
  const { presetsByName } = usePresetsMetadata();
  const { presets: presetsDefaults } = usePresetsDefaults();
  const { variables } = useVariables();
  const userPresets = usePlanStore((s) => s.presets);
  const overridesReusables = usePlanStore((s) => s.overridesReusables);

  const meta = graficadoresById[graf.graficador];
  const presetType = graficadorToPresetType(graf.graficador);
  const presetMeta = presetType ? presetsByName[presetType] : undefined;

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

  // Detectar el modo aplicado actualmente (subset match)
  const currentOverrides = useMemo<Record<string, unknown>>(() => {
    return ((graf.args?.overrides as Record<string, unknown>) ?? {});
  }, [graf.args]);

  const appliedMode = useMemo(() => {
    if (!presetType) return null;
    const aplicables = overridesReusables.filter((o) => o.tipo_preset === presetType);
    // Buscamos un modo cuyas keys/values sean subset del overrides actual
    for (const o of aplicables) {
      const okeys = Object.keys(o.args);
      if (okeys.length === 0) continue;
      let isSubset = true;
      for (const k of okeys) {
        if (!(k in currentOverrides)) { isSubset = false; break; }
        if (JSON.stringify(currentOverrides[k]) !== JSON.stringify(o.args[k])) { isSubset = false; break; }
      }
      if (isSubset) return o;
    }
    return null;
  }, [presetType, overridesReusables, currentOverrides]);

  // Expansión: el arg `overrides` del graficador se reemplaza por todos
  // los args del preset compatible.
  const expandedArgs: ArgMetadata[] = useMemo(() => {
    if (!meta) return [];
    const result: ArgMetadata[] = [];
    for (const a of meta.args) {
      if (a.tipo_input === "overrides" && presetMeta) {
        for (const presetArg of presetMeta.args) {
          result.push({ ...presetArg, grupo: presetArg.grupo ?? "estilo" } as ArgMetadata);
        }
      } else {
        result.push(a);
      }
    }
    return result;
  }, [meta, presetMeta]);

  const presetArgNames = useMemo(() => {
    return new Set(presetMeta?.args.map((a) => a.name) ?? []);
  }, [presetMeta]);

  // argState por arg: para args del preset, calculamos según overrides
  // y appliedMode. Para args propios del graficador (no overrides), los
  // marcamos custom si tienen valor (comportamiento legacy).
  const argStates = useMemo<Record<string, ArgState>>(() => {
    const map: Record<string, ArgState> = {};
    const modeKeys = appliedMode ? new Set(Object.keys(appliedMode.args)) : new Set<string>();
    for (const a of expandedArgs) {
      if (presetArgNames.has(a.name)) {
        // Arg del preset
        if (a.name in currentOverrides) {
          if (modeKeys.has(a.name)) {
            map[a.name] = "from-mode";
          } else {
            map[a.name] = "custom";
          }
        } else {
          map[a.name] = "inherited";
        }
      } else {
        // Arg propio del graficador (var, cruces, etc.) — comportamiento normal
        const v = (graf.args as Record<string, unknown>)?.[a.name];
        const has = v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
        map[a.name] = has ? "custom" : "inherited";
      }
    }
    return map;
  }, [expandedArgs, presetArgNames, currentOverrides, appliedMode, graf.args]);

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
      ...graf.args,
      // Cada arg del preset que tenga override aparece en top-level
      ...currentOverrides,
    };
  }, [graf.args, currentOverrides]);

  // Agrupar args expandidos
  const grupos = useMemo(() => {
    if (expandedArgs.length === 0) return [];
    const byGrupo: Record<ArgGrupo, ArgMetadata[]> = {
      datos: [], textos: [], estilo: [], filtro: [], semaforo: [], canvas: [], tabla: [], avanzado: [],
    };
    for (const a of expandedArgs) {
      const g: ArgGrupo = (a.grupo as ArgGrupo) ?? "avanzado";
      (byGrupo[g] ?? byGrupo.avanzado).push(a);
    }
    const allow = groupFilter ? new Set(groupFilter) : null;
    return (Object.keys(byGrupo) as ArgGrupo[])
      .filter((g) => byGrupo[g].length > 0)
      .filter((g) => !allow || allow.has(g))
      .sort((a, b) => GRUPO_META[a].order - GRUPO_META[b].order)
      .map((g) => ({ grupo: g, args: byGrupo[g] }));
  }, [expandedArgs, groupFilter]);

  function handleChange(name: string, value: unknown) {
    if (presetArgNames.has(name)) {
      const prev = currentOverrides;
      const next = { ...prev };
      // Si el valor coincide con el del preset, lo borramos (vuelve a heredado)
      const presetVal = presetValues[name];
      const isSameAsPreset = JSON.stringify(value) === JSON.stringify(presetVal);
      if (value === null || value === undefined || value === "" || isSameAsPreset) {
        delete next[name];
      } else {
        next[name] = value;
      }
      onArgs({ overrides: next });
    } else {
      onArgs({ [name]: value });
    }
  }

  if (loading) {
    return <LoadingBlock variant="inline" label="Cargando opciones…" />;
  }
  if (error) {
    return <ErrorBlock label="Error cargando catálogo" detail={error} />;
  }
  if (!meta) {
    return (
      <ErrorBlock
        label="Graficador desconocido"
        detail={`El graficador "${graf.graficador}" no existe en el registry actual.`}
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
        />
      ))}
    </div>
  );
}
