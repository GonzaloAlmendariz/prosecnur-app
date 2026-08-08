import type {
  SlideBlueprintKind,
  SlideMetadata,
  SlideSlotSpec,
} from "../../../../api/client";
import { SlideTypeIcon } from "../../SlideTypeIcon";

export type SlidePickerBlueprintSize = "card" | "hero";

export type ResolvedSlidePickerBlueprint = {
  kind: SlideBlueprintKind;
  pptLayout: string;
  structureLabel: string;
  graphSlots: SlideSlotSpec[];
};

export function resolveSlidePickerBlueprint(
  metadata: Pick<SlideMetadata, "blueprint" | "slot_specs" | "slots">,
): ResolvedSlidePickerBlueprint {
  const legacySpecs = metadata.slots.map<SlideSlotSpec>((name) => ({
    name,
    role: name === "icono" ? "icon" : "chart",
    label: humanizeSlotName(name),
  }));
  const sourceSpecs = metadata.slot_specs !== undefined
    ? metadata.slot_specs
    : legacySpecs;
  const names = new Set<string>();
  const graphSlots = sourceSpecs.filter((spec) => {
    if (spec.role !== "chart" || names.has(spec.name)) return false;
    names.add(spec.name);
    return true;
  });

  return {
    kind: metadata.blueprint?.kind ?? "neutral",
    pptLayout: metadata.blueprint?.ppt_layout ?? "",
    structureLabel: metadata.blueprint?.structure_label.trim()
      || "Composición compatible",
    graphSlots,
  };
}

function humanizeSlotName(value: string): string {
  const words = value.split("_").filter(Boolean).join(" ");
  return words ? `${words.charAt(0).toLocaleUpperCase("es")}${words.slice(1)}` : "Zona";
}

export function SlidePickerBlueprint({
  blueprint,
  iconoUi,
  size,
}: {
  blueprint: ResolvedSlidePickerBlueprint;
  iconoUi?: string;
  size: SlidePickerBlueprintSize;
}) {
  return (
    <span
      className={`pulso-slide-library-blueprint pulso-slide-library-blueprint--${size}`}
      data-layout={blueprint.kind}
      data-ppt-layout={blueprint.pptLayout}
      data-slots={blueprint.graphSlots.length}
      data-slot-names={blueprint.graphSlots.map((slot) => slot.name).join(",")}
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
              key={slot.name}
              className="pulso-slide-library-blueprint-chart"
              data-slot={slot.name}
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
