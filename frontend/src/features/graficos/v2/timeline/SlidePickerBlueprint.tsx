import type { SlideType } from "../../../../api/client";
import { SlideTypeIcon } from "../../SlideTypeIcon";

export type SlidePickerBlueprintSize = "card" | "hero";

export type SlidePickerBlueprintLayout =
  | "cover"
  | "index"
  | "section"
  | "objective"
  | "text"
  | "technical"
  | "topTwo"
  | "single"
  | "singleNarrative"
  | "splitRight"
  | "splitLeft"
  | "two"
  | "twoNarrative"
  | "twoTextLeft"
  | "twoTextRight"
  | "grid4"
  | "population2"
  | "population4"
  | "population5"
  | "population6";

type SlidePickerBlueprintSpec = {
  layout: SlidePickerBlueprintLayout;
  pptLayout: string;
  structureLabel: string;
  fallbackSlots: readonly string[];
};

const BLUEPRINTS = {
  p_slide_portada: {
    layout: "cover",
    pptLayout: "Title Slide",
    structureLabel: "Portada editorial",
    fallbackSlots: [],
  },
  p_slide_indice: {
    layout: "index",
    pptLayout: "Indice",
    structureLabel: "Índice editorial",
    fallbackSlots: [],
  },
  p_slide_seccion: {
    layout: "section",
    pptLayout: "Section Header",
    structureLabel: "Separador editorial",
    fallbackSlots: [],
  },
  p_slide_objetivo_icono: {
    layout: "objective",
    pptLayout: "Objetivos_Secciones",
    structureLabel: "Texto con ícono",
    fallbackSlots: ["icono"],
  },
  p_slide_texto: {
    layout: "text",
    pptLayout: "Title and Content",
    structureLabel: "Texto editorial",
    fallbackSlots: [],
  },
  p_slide_tabla_tecnica: {
    layout: "technical",
    pptLayout: "Title and Content",
    structureLabel: "Tabla editorial",
    fallbackSlots: [],
  },
  p_slide_top_two_box: {
    layout: "topTwo",
    pptLayout: "Title and Content",
    structureLabel: "Explicación visual",
    fallbackSlots: [],
  },
  p_slide_1_grafico: {
    layout: "single",
    pptLayout: "Graficos",
    structureLabel: "Gráfico principal",
    fallbackSlots: ["grafico"],
  },
  p_slide_1_grafico_narrativo: {
    layout: "singleNarrative",
    pptLayout: "1_Grafico_narrativo",
    structureLabel: "Narrativa + gráfico",
    fallbackSlots: ["grafico"],
  },
  p_slide_grafico_texto_derecha: {
    layout: "splitRight",
    pptLayout: "right_grafico_texto",
    structureLabel: "Gráfico + texto",
    fallbackSlots: ["grafico"],
  },
  p_slide_grafico_texto_izquierda: {
    layout: "splitLeft",
    pptLayout: "left_grafico_texto",
    structureLabel: "Texto + gráfico",
    fallbackSlots: ["grafico"],
  },
  p_slide_2_graficos: {
    layout: "two",
    pptLayout: "Graficos_2columnas",
    structureLabel: "Dos columnas",
    fallbackSlots: ["izquierda", "derecha"],
  },
  p_slide_2_graficos_narrativo: {
    layout: "twoNarrative",
    pptLayout: "1_Graficos_2columnas_narrativo",
    structureLabel: "Narrativa + comparación",
    fallbackSlots: ["izquierda", "derecha"],
  },
  p_slide_2_graficos_texto_izquierda: {
    layout: "twoTextLeft",
    pptLayout: "left_2graficos_texto",
    structureLabel: "Texto + dos gráficos",
    fallbackSlots: ["grafico_1", "grafico_2"],
  },
  p_slide_2_graficos_texto_derecha: {
    layout: "twoTextRight",
    pptLayout: "right_2graficos_texto",
    structureLabel: "Dos gráficos + texto",
    fallbackSlots: ["grafico_1", "grafico_2"],
  },
  p_slide_4_graficos: {
    layout: "grid4",
    pptLayout: "4_paneles",
    structureLabel: "Matriz 2 × 2",
    fallbackSlots: [
      "superior_izquierda",
      "superior_derecha",
      "inferior_izquierda",
      "inferior_derecha",
    ],
  },
  p_slide_2_graficos_poblacion: {
    layout: "population2",
    pptLayout: "poblacion_2",
    structureLabel: "Dos gráficos + ícono",
    fallbackSlots: ["izquierda", "derecha", "icono"],
  },
  p_slide_4_graficos_poblacion: {
    layout: "population4",
    pptLayout: "poblacion_4",
    structureLabel: "Matriz 2 × 2 + ícono",
    fallbackSlots: [
      "superior_izquierda",
      "superior_derecha",
      "inferior_izquierda",
      "inferior_derecha",
      "icono",
    ],
  },
  p_slide_5_graficos_poblacion: {
    layout: "population5",
    pptLayout: "poblacion_5",
    structureLabel: "Matriz 3 + 2 + ícono",
    fallbackSlots: [
      "grafico_superior_1",
      "grafico_superior_2",
      "grafico_superior_3",
      "grafico_inferior_1",
      "grafico_inferior_2",
      "icono",
    ],
  },
  p_slide_6_graficos_poblacion: {
    layout: "population6",
    pptLayout: "poblacion_6",
    structureLabel: "Matriz 3 × 2 + ícono",
    fallbackSlots: [
      "grafico_superior_1",
      "grafico_superior_2",
      "grafico_superior_3",
      "grafico_inferior_1",
      "grafico_inferior_2",
      "grafico_inferior_3",
      "icono",
    ],
  },
} satisfies Record<SlideType, SlidePickerBlueprintSpec>;

const UNKNOWN_BLUEPRINT: SlidePickerBlueprintSpec = {
  layout: "text",
  pptLayout: "Title and Content",
  structureLabel: "Composición editorial",
  fallbackSlots: [],
};

export type ResolvedSlidePickerBlueprint = Omit<SlidePickerBlueprintSpec, "fallbackSlots"> & {
  graphSlots: string[];
};

export function resolveSlidePickerBlueprint(
  type: SlideType,
  registrySlots: readonly string[] = [],
): ResolvedSlidePickerBlueprint {
  const spec: SlidePickerBlueprintSpec = BLUEPRINTS[type] ?? UNKNOWN_BLUEPRINT;
  const sourceSlots = registrySlots.length > 0 ? registrySlots : spec.fallbackSlots;
  const graphSlots = Array.from(new Set(
    sourceSlots
      .map((slot) => slot.trim())
      .filter((slot) => slot.length > 0 && slot !== "icono"),
  ));

  return {
    layout: spec.layout,
    pptLayout: spec.pptLayout,
    structureLabel: spec.structureLabel,
    graphSlots,
  };
}

export function SlidePickerBlueprint({
  type,
  slots,
  iconoUi,
  size,
}: {
  type: SlideType;
  slots: readonly string[];
  iconoUi?: string;
  size: SlidePickerBlueprintSize;
}) {
  const blueprint = resolveSlidePickerBlueprint(type, slots);

  return (
    <span
      className={`pulso-slide-library-blueprint pulso-slide-library-blueprint--${size}`}
      data-layout={blueprint.layout}
      data-ppt-layout={blueprint.pptLayout}
      data-slots={blueprint.graphSlots.length}
      data-slot-names={blueprint.graphSlots.join(",")}
      aria-hidden="true"
    >
      <span className="pulso-slide-library-blueprint-paper">
        <span className="pulso-slide-library-blueprint-brand">
          <i />
          <i />
        </span>
        <span className="pulso-slide-library-blueprint-kicker" />
        <span className="pulso-slide-library-blueprint-title">
          <i />
          <i />
        </span>
        <span className="pulso-slide-library-blueprint-section-band" />
        <span className="pulso-slide-library-blueprint-copy">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="pulso-slide-library-blueprint-index">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="pulso-slide-library-blueprint-table">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="pulso-slide-library-blueprint-top-two">
          <i />
          <i />
          <i />
          <i />
          <b />
        </span>
        <span className="pulso-slide-library-blueprint-narrative">
          <i />
          <i />
          <i />
        </span>
        <span className="pulso-slide-library-blueprint-text-panel">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span
          className="pulso-slide-library-blueprint-charts"
          data-qa-geometry-group="slide-library-blueprint-zones"
          data-qa-geometry-contract="equal"
        >
          {blueprint.graphSlots.map((slot) => (
            <span
              key={slot}
              className="pulso-slide-library-blueprint-chart"
              data-slot={slot}
              data-qa-geometry-member
              data-qa-geometry-capacity="owned"
            >
              <i />
              <i />
              <i />
            </span>
          ))}
        </span>
        <span className="pulso-slide-library-blueprint-icon">
          <SlideTypeIcon
            tipo={type}
            iconoUi={iconoUi}
            size={18}
            className="pulso-slide-library-blueprint-icon-svg"
          />
        </span>
        <span className="pulso-slide-library-blueprint-footer" />
      </span>
    </span>
  );
}
