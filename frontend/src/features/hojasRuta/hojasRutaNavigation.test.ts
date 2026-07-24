import { describe, expect, it } from "vitest";
import {
  buildHojasRutaNavigation,
  buildHojasRutaNavigationSearch,
} from "./hojasRutaNavigation";
import type { HojasRutaNavigationInput } from "./hojasRutaNavigation";

const READY_INPUT: HojasRutaNavigationInput = {
  search: "?shell=v3",
  persistedStage: "territorio",
  persistedDeliveryTab: "cuotas",
  selectedTerritoryCount: 2,
  populationOk: true,
  quotaExists: true,
  quotaOk: true,
  quotaRowCount: 12,
  quotaTotal: 240,
  sampleExists: true,
  sampleOk: true,
  sampleBlockCount: 20,
  replacementCount: 4,
  resultReady: false,
};

describe("HojasRuta navigation model", () => {
  it("keeps the canonical stage and delivery-tab order", () => {
    const model = buildHojasRutaNavigation(READY_INPUT);

    expect(model.sections.map((section) => section.key)).toEqual([
      "territorio",
      "poblacion",
      "muestra",
      "manzanas",
      "entrega",
    ]);
    expect(model.deliveryTabs.map((tab) => tab.key)).toEqual([
      "cuotas",
      "titulares",
      "reemplazos",
    ]);
  });

  it("projects exact output gating and completion into runtime state", () => {
    const model = buildHojasRutaNavigation({
      ...READY_INPUT,
      selectedTerritoryCount: 0,
      populationOk: false,
      quotaExists: false,
      quotaOk: false,
      sampleExists: false,
      sampleOk: false,
      sampleBlockCount: 0,
      replacementCount: 0,
      resultReady: true,
    });

    expect(model.sections.map(({ key, done, disabled }) => ({
      key,
      done,
      disabled,
    }))).toEqual([
      { key: "territorio", done: false, disabled: false },
      { key: "poblacion", done: false, disabled: true },
      { key: "muestra", done: false, disabled: true },
      { key: "manzanas", done: false, disabled: true },
      { key: "entrega", done: true, disabled: true },
    ]);
    expect(model.deliveryTabs.map(({ key, disabled }) => ({
      key,
      disabled,
    }))).toEqual([
      { key: "cuotas", disabled: true },
      { key: "titulares", disabled: true },
      { key: "reemplazos", disabled: true },
    ]);
    expect(model.runtime.sectionStates.poblacion.lockedReason).toBe(
      "Confirma al menos un distrito.",
    );
  });

  it("uses the valid URL over persisted Zustand state", () => {
    const model = buildHojasRutaNavigation({
      ...READY_INPUT,
      search: "?shell=v3&stage=entrega&tab=reemplazos",
      persistedStage: "poblacion",
      persistedDeliveryTab: "cuotas",
    });

    expect(model.activeStage).toBe("entrega");
    expect(model.activeDeliveryTab).toBe("reemplazos");
    expect(model.runtime.activeSectionId).toBe("entrega");
    expect(model.runtime.activeTabId).toBe("reemplazos");
    expect(model.normalizedSearch).toBe(
      "?shell=v3&stage=entrega&tab=reemplazos",
    );
  });

  it.each([
    ["territorio", "collapsed"],
    ["poblacion", "expanded"],
    ["muestra", "expanded"],
    ["manzanas", "collapsed"],
    ["entrega", "expanded"],
  ] as const)("recommends the %s rail mode as %s", (stage, railMode) => {
    const model = buildHojasRutaNavigation({
      ...READY_INPUT,
      search: `?shell=v3&stage=${stage}`,
    });

    expect(model.runtime.preferredRailMode).toBe(railMode);
  });

  it("respects persisted state when the URL omits stage and tab", () => {
    const model = buildHojasRutaNavigation({
      ...READY_INPUT,
      persistedStage: "entrega",
      persistedDeliveryTab: "titulares",
    });

    expect(model.activeStage).toBe("entrega");
    expect(model.activeDeliveryTab).toBe("titulares");
    expect(model.normalizedSearch).toBe("?shell=v3");
  });

  it("normalizes an invalid or locked URL to the last enabled item", () => {
    const invalidStage = buildHojasRutaNavigation({
      ...READY_INPUT,
      search: "?shell=v3&stage=desconocida&tab=reemplazos",
    });
    const lockedStage = buildHojasRutaNavigation({
      ...READY_INPUT,
      search: "?shell=v3&stage=entrega&tab=reemplazos",
      sampleExists: false,
      sampleOk: false,
      sampleBlockCount: 0,
      replacementCount: 0,
    });
    const lockedTab = buildHojasRutaNavigation({
      ...READY_INPUT,
      search: "?shell=v3&stage=entrega&tab=reemplazos",
      replacementCount: 0,
    });

    expect(invalidStage.activeStage).toBe("entrega");
    expect(invalidStage.normalizedSearch).toBe(
      "?shell=v3&stage=entrega&tab=reemplazos",
    );
    expect(lockedStage.activeStage).toBe("manzanas");
    expect(lockedStage.normalizedSearch).toBe(
      "?shell=v3&stage=manzanas",
    );
    expect(lockedTab.activeDeliveryTab).toBe("titulares");
    expect(lockedTab.normalizedSearch).toBe(
      "?shell=v3&stage=entrega&tab=titulares",
    );
  });

  it("builds canonical stage/tab searches without losing shell v3", () => {
    expect(
      buildHojasRutaNavigationSearch(
        "?shell=v3&stage=entrega&tab=cuotas",
        "poblacion",
      ),
    ).toBe("?shell=v3&stage=poblacion");
    expect(
      buildHojasRutaNavigationSearch(
        "?shell=v3&stage=poblacion",
        "entrega",
        "titulares",
      ),
    ).toBe("?shell=v3&stage=entrega&tab=titulares");
  });
});
