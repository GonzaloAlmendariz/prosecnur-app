import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CargaTopologyDecision } from "./CargaTopologyDecision";
import {
  resolveCargaTopology,
  type CargaTopologyInput,
  type CargaTopologyIntent,
} from "./CargaTopologyModel";

function topologyInput(
  overrides: Partial<CargaTopologyInput> = {},
): CargaTopologyInput {
  return {
    intent: null,
    hasStudy: false,
    baseCount: 0,
    hasInstrument: false,
    hasData: false,
    processingMode: null,
    integratedBaseCount: 0,
    ...overrides,
  };
}

function renderDecision({
  input = topologyInput(),
  intent = input.intent,
  disabled = false,
}: {
  input?: CargaTopologyInput;
  intent?: CargaTopologyIntent;
  disabled?: boolean;
} = {}) {
  return renderToStaticMarkup(
    <CargaTopologyDecision
      resolution={resolveCargaTopology(input)}
      intent={intent}
      disabled={disabled}
      onIntentChange={vi.fn()}
    />,
  );
}

function radioTags(html: string) {
  return html.match(/<input\b[^>]*type="radio"[^>]*>/gu) ?? [];
}

function radioByValue(html: string, value: string) {
  return radioTags(html).find((tag) => tag.includes(`value="${value}"`)) ?? "";
}

function optionMarkup(html: string, value: string) {
  const marker = `value="${value}"`;
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return "";
  const start = html.lastIndexOf("<label", markerIndex);
  const end = html.indexOf("</label>", markerIndex);
  return start >= 0 && end >= 0 ? html.slice(start, end + "</label>".length) : "";
}

function accessibleGroupCount(html: string) {
  return Math.max(
    html.match(/<fieldset\b/gu)?.length ?? 0,
    html.match(/role="radiogroup"/gu)?.length ?? 0,
  );
}

describe("CargaTopologyDecision", () => {
  it("mantiene siempre visibles y agrupadas las decisiones de una o varias bases", () => {
    const html = renderDecision();

    expect(accessibleGroupCount(html)).toBeGreaterThanOrEqual(1);
    expect(radioTags(html)).toHaveLength(2);
    expect(html).toContain("Una base");
    expect(html).toContain("Varias bases");
    expect(radioByValue(html, "single")).toBeTruthy();
    expect(radioByValue(html, "multi")).toBeTruthy();
  });

  it("muestra las tres estrategias profesionales solo al elegir varias bases", () => {
    const singleHtml = renderDecision({
      input: topologyInput({ intent: "single" }),
      intent: "single",
    });
    const multiHtml = renderDecision({
      input: topologyInput({ intent: "separate" }),
      intent: "separate",
    });

    expect(singleHtml).not.toContain("Bases separadas");
    expect(accessibleGroupCount(multiHtml)).toBeGreaterThanOrEqual(2);
    expect(radioTags(multiHtml)).toHaveLength(5);
    expect(multiHtml).toContain("Bases separadas");
    expect(multiHtml).toMatch(/conserva su propio formulario y sus respuestas/iu);
    expect(multiHtml).toContain("Base integrada");
    expect(multiHtml).toMatch(/formulario guía común/iu);
    expect(multiHtml).toContain("Hermanas independientes");
    expect(multiHtml).toMatch(/datos no se mezclan/iu);
  });

  it("explica las salidas por base y conjuntas de Bases separadas en Gráficos", () => {
    const html = renderDecision({
      input: topologyInput({ intent: "separate" }),
      intent: "separate",
    });
    const separateOption = optionMarkup(html, "separate");

    expect(separateOption).toMatch(/Gráficos/u);
    expect(separateOption).toMatch(/report/iu);
    expect(separateOption).toMatch(/independient|por (?:cada )?base/iu);
    expect(separateOption).toMatch(/informe[^<]*conjunt|combin[^<]*resultad/iu);
  });

  it("expone la selección en el radio nativo y no solamente mediante color", () => {
    const html = renderDecision({
      input: topologyInput({ intent: "integrated" }),
      intent: "integrated",
    });

    expect(radioByValue(html, "integrated")).toContain("checked");
    expect(radioByValue(html, "single")).not.toContain("checked");
    expect(radioByValue(html, "multi")).toContain("checked");
  });

  it("deshabilita todas las decisiones cuando el estado duro está bloqueado", () => {
    const hardInput = topologyInput({
      intent: "single",
      hasStudy: true,
      baseCount: 2,
      processingMode: "multibase",
    });
    const html = renderDecision({ input: hardInput, intent: "single", disabled: true });

    const fieldsets = html.match(/<fieldset\b[^>]*>/gu) ?? [];
    expect(fieldsets).toHaveLength(2);
    expect(fieldsets.every((fieldset) => fieldset.includes("disabled"))).toBe(true);
    expect(html).toMatch(/bloque|base|definid/iu);
  });

  it("aclara Acreditación y Repeats sin convertirlos en una cuarta opción", () => {
    const html = renderDecision({
      input: topologyInput({ intent: "multi" }),
      intent: "multi",
    });

    expect(html).toMatch(/acreditación/iu);
    expect(html).toMatch(/repeat|grupos repetidos/iu);
    expect(radioByValue(html, "repeat")).toBe("");
    expect(radioByValue(html, "accreditation")).toBe("");
    expect(radioTags(html)).toHaveLength(5);
  });
});
