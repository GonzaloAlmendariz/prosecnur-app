import type {
  ArgChoice,
  ArgGrupo,
  ArgMetadata,
  ArgTipoInput,
  GraficadorMetadata,
  PresetsRegistry,
  Registry,
  SlideCategoria,
  SlideMetadata,
  SlideType,
} from "../../api/client";
import { safeText } from "./safeText";

function normalizeChoice(choice: ArgChoice): ArgChoice {
  const value = safeText(choice.value);
  return {
    ...choice,
    value,
    label: safeText(choice.label, value),
    hint: safeText(choice.hint),
  };
}

export function normalizeArgMetadata(arg: ArgMetadata): ArgMetadata {
  const name = safeText(arg.name);
  return {
    ...arg,
    name,
    label: safeText(arg.label, name || "Campo"),
    tipo_input: safeText(arg.tipo_input, "string") as ArgTipoInput,
    grupo: safeText(arg.grupo, "diagnostico") as ArgGrupo,
    descripcion: safeText(arg.descripcion),
    unidad: safeText(arg.unidad),
    efecto: safeText(arg.efecto),
    relacionados: Array.isArray(arg.relacionados)
      ? arg.relacionados.map((item) => safeText(item)).filter(Boolean)
      : [],
    choices: Array.isArray(arg.choices) ? arg.choices.map(normalizeChoice) : undefined,
    opciones: Array.isArray(arg.opciones) ? arg.opciones.map(normalizeChoice) : undefined,
  };
}

function normalizeSlideMetadata(slide: SlideMetadata): SlideMetadata {
  const name = safeText(slide.name) as SlideType;
  return {
    ...slide,
    name,
    titulo_humano: safeText(slide.titulo_humano, name),
    descripcion: safeText(slide.descripcion),
    icono_ui: safeText(slide.icono_ui, "FileText"),
    categoria: safeText(slide.categoria, "otro") as SlideCategoria,
    slots: Array.isArray(slide.slots) ? slide.slots.map((slot) => safeText(slot)).filter(Boolean) : [],
    args: Array.isArray(slide.args) ? slide.args.map(normalizeArgMetadata) : [],
    args_extra: Array.isArray(slide.args_extra) ? slide.args_extra.map((arg) => safeText(arg)).filter(Boolean) : [],
  };
}

function normalizeGraficadorMetadata(graf: GraficadorMetadata): GraficadorMetadata {
  const name = safeText(graf.name);
  return {
    ...graf,
    name,
    titulo_humano: safeText(graf.titulo_humano, name),
    descripcion: safeText(graf.descripcion),
    icono_ui: safeText(graf.icono_ui, "BarChart"),
    requisito: safeText(graf.requisito),
    feature_kind: safeText(graf.feature_kind),
    available: graf.available !== false,
    disabled_reason: safeText(graf.disabled_reason),
    args: Array.isArray(graf.args) ? graf.args.map(normalizeArgMetadata) : [],
    args_extra: Array.isArray(graf.args_extra) ? graf.args_extra.map((arg) => safeText(arg)).filter(Boolean) : [],
  };
}

export function normalizeGraficosRegistry(registry: Registry): Registry {
  return {
    slides: Array.isArray(registry.slides) ? registry.slides.map(normalizeSlideMetadata) : [],
    graficadores: Array.isArray(registry.graficadores)
      ? registry.graficadores.map(normalizeGraficadorMetadata)
      : [],
  };
}

export function normalizePresetsRegistry(registry: PresetsRegistry): PresetsRegistry {
  return {
    presets: Array.isArray(registry.presets)
      ? registry.presets.map((preset) => {
          const name = safeText(preset.name);
          return {
            ...preset,
            name,
            titulo_humano: safeText(preset.titulo_humano, name),
            descripcion: safeText(preset.descripcion),
            icono_ui: safeText(preset.icono_ui, "Sliders"),
            args: Array.isArray(preset.args) ? preset.args.map(normalizeArgMetadata) : [],
          };
        })
      : [],
  };
}
