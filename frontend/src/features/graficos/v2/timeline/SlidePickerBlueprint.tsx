import type { CSSProperties, ReactNode } from "react";
import type {
  GraficosSlideLayoutRegion,
  SlideBlueprintKind,
  SlideMetadata,
  SlideSlotSpec,
} from "../../../../api/client";
import {
  slideCompositionRegionSignature,
  type SlideComposition,
  type SlideCompositionDiagnostic,
} from "../../slideCompositionModel";
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

function normalizedRegionStyle(region: GraficosSlideLayoutRegion): CSSProperties {
  return {
    left: `${region.rect.x * 100}%`,
    top: `${region.rect.y * 100}%`,
    width: `${region.rect.width * 100}%`,
    height: `${region.rect.height * 100}%`,
  };
}

export function SlideCompositionRegions({
  composition,
  className = "",
  regionClassName,
  regionTitle,
  renderRegion,
}: {
  composition: SlideComposition;
  className?: string;
  regionClassName?: (region: GraficosSlideLayoutRegion) => string;
  regionTitle?: (region: GraficosSlideLayoutRegion) => string;
  renderRegion?: (region: GraficosSlideLayoutRegion) => ReactNode;
}) {
  const signature = slideCompositionRegionSignature(composition);
  return (
    <span
      className={["pulso-slide-composition-regions", className].filter(Boolean).join(" ")}
      data-composition-regions={signature}
      data-composition-contract-version={composition.contractVersion}
      data-composition-render-key={composition.renderKey}
      data-qa-geometry-group="slide-composition-regions"
      data-qa-geometry-contract="intrinsic"
    >
      {composition.regions.map((region) => (
        <span
          key={region.key}
          className={[
            "pulso-slide-composition-region",
            `is-${region.role || "shape"}`,
            regionClassName?.(region) ?? "",
          ].filter(Boolean).join(" ")}
          hidden={!region.visible}
          style={normalizedRegionStyle(region)}
          data-composition-region
          data-region-key={region.key}
          data-payload-key={region.payload_key}
          data-region-role={region.role}
          data-region-visible={String(region.visible)}
          data-region-rect={[
            region.rect.x,
            region.rect.y,
            region.rect.width,
            region.rect.height,
          ].join(",")}
          data-geometry-source={region.geometry_source}
          data-qa-geometry-member={region.visible ? true : undefined}
          data-qa-geometry-capacity={region.visible ? "owned" : undefined}
          title={regionTitle?.(region)}
        >
          {renderRegion ? renderRegion(region) : (
            <SlideCompositionRegionMarks role={region.role} />
          )}
        </span>
      ))}
    </span>
  );
}

function SlideCompositionRegionMarks({ role }: { role: string }) {
  if (role === "chart") {
    return (
      <span className="pulso-slide-composition-chart-marks">
        <i />
        <i />
        <i />
      </span>
    );
  }
  if (role === "icon") {
    return <span className="pulso-slide-composition-icon-mark" />;
  }
  return (
    <span className="pulso-slide-composition-copy-marks">
      <i />
      <i />
    </span>
  );
}

export function SlidePickerBlueprint({
  blueprint,
  composition = null,
  diagnostic = null,
  iconoUi,
  size,
}: {
  blueprint: ResolvedSlidePickerBlueprint;
  composition?: SlideComposition | null;
  diagnostic?: SlideCompositionDiagnostic | null;
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
      data-composition-status={composition ? "matrix" : "blueprint_fallback"}
      data-composition-diagnostic={diagnostic?.code}
      data-composition-fingerprint={composition?.template.fingerprint}
      data-composition-regions={composition
        ? slideCompositionRegionSignature(composition)
        : undefined}
      title={diagnostic ? `Referencia nominal: ${diagnostic.message}` : undefined}
      style={composition ? { aspectRatio: String(composition.aspectRatio) } : undefined}
      aria-hidden="true"
    >
      <span className="pulso-slide-library-blueprint-paper">
        {composition ? (
          <SlideCompositionRegions
            composition={composition}
            className="pulso-slide-library-blueprint-regions"
            renderRegion={(region) => (
              region.role === "icon" ? (
                <SlideTypeIcon
                  iconoUi={iconoUi}
                  size={18}
                  className="pulso-slide-library-blueprint-icon-svg"
                />
              ) : <SlideCompositionRegionMarks role={region.role} />
            )}
          />
        ) : (
          <>
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
          </>
        )}
      </span>
    </span>
  );
}
