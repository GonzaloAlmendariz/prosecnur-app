import { describe, expect, it } from "vitest";
import {
  buildHojasRutaNavigation,
  buildHojasRutaNavigationSearch,
  resolverEtapaHojasRuta,
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
      "seleccion",
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
      { key: "seleccion", done: true, disabled: true },
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
      search: "?shell=v3&stage=seleccion&tab=reemplazos",
      persistedStage: "poblacion",
      persistedDeliveryTab: "cuotas",
    });

    expect(model.activeStage).toBe("seleccion");
    expect(model.activeDeliveryTab).toBe("reemplazos");
    expect(model.runtime.activeSectionId).toBe("seleccion");
    expect(model.runtime.activeTabId).toBe("reemplazos");
    // Un enlace guardado con los nombres viejos sigue resolviendo, y de paso
    // sale migrado a la forma canónica.
    expect(model.normalizedSearch).toBe(
      "?shell=v3&seccion=seleccion&pestana=reemplazos",
    );
  });

  it.each([
    ["territorio", "collapsed"],
    ["poblacion", "expanded"],
    ["muestra", "expanded"],
    ["manzanas", "collapsed"],
    ["seleccion", "expanded"],
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
      persistedStage: "seleccion",
      persistedDeliveryTab: "titulares",
    });

    expect(model.activeStage).toBe("seleccion");
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
      search: "?shell=v3&stage=seleccion&tab=reemplazos",
      sampleExists: false,
      sampleOk: false,
      sampleBlockCount: 0,
      replacementCount: 0,
    });
    const lockedTab = buildHojasRutaNavigation({
      ...READY_INPUT,
      search: "?shell=v3&stage=seleccion&tab=reemplazos",
      replacementCount: 0,
    });

    // Entra por el alias legacy y sale en forma canónica: normalizar una URL
    // vieja es exactamente el momento de migrarla.
    expect(invalidStage.activeStage).toBe("seleccion");
    expect(invalidStage.normalizedSearch).toBe(
      "?shell=v3&seccion=seleccion&pestana=reemplazos",
    );
    expect(lockedStage.activeStage).toBe("manzanas");
    expect(lockedStage.normalizedSearch).toBe(
      "?shell=v3&seccion=manzanas",
    );
    expect(lockedTab.activeDeliveryTab).toBe("titulares");
    expect(lockedTab.normalizedSearch).toBe(
      "?shell=v3&seccion=seleccion&pestana=titulares",
    );
  });

  it("sigue entendiendo los enlaces guardados con stage/tab", () => {
    const legacy = buildHojasRutaNavigation({
      ...READY_INPUT,
      search: "?stage=seleccion&tab=reemplazos",
    });
    const canonico = buildHojasRutaNavigation({
      ...READY_INPUT,
      search: "?seccion=seleccion&pestana=reemplazos",
    });

    expect(legacy.activeStage).toBe(canonico.activeStage);
    expect(legacy.activeDeliveryTab).toBe(canonico.activeDeliveryTab);
  });

  it("el param canónico gana sobre su alias legacy", () => {
    const model = buildHojasRutaNavigation({
      ...READY_INPUT,
      search: "?stage=poblacion&seccion=seleccion",
    });

    expect(model.activeStage).toBe("seleccion");
  });

  it("escribe seccion/pestana canónicos sin perder shell v3", () => {
    expect(
      buildHojasRutaNavigationSearch(
        "?shell=v3&stage=seleccion&tab=cuotas",
        "poblacion",
      ),
    ).toBe("?shell=v3&seccion=poblacion");
    expect(
      buildHojasRutaNavigationSearch(
        "?shell=v3&seccion=poblacion",
        "seleccion",
        "titulares",
      ),
    ).toBe("?shell=v3&seccion=seleccion&pestana=titulares");
  });

  // ADR 0108 §5: «Entrega» se renombró «Selección». La forma vieja se lee en la
  // URL y en el estado guardado, y nunca se escribe.
  describe("Entrega → Selección", () => {
    it("lee ?seccion=entrega y la reescribe a seleccion conservando la pestaña", () => {
      const model = buildHojasRutaNavigation({
        ...READY_INPUT,
        search: "?seccion=entrega&pestana=titulares",
      });
      expect(model.activeStage).toBe("seleccion");
      expect(model.activeDeliveryTab).toBe("titulares");
      expect(model.normalizedSearch).toBe("?seccion=seleccion&pestana=titulares");
    });

    it("lee stage=entrega y etapa=entrega como alias", () => {
      for (const search of ["?stage=entrega&tab=cuotas", "?etapa=entrega&tab=cuotas"]) {
        const model = buildHojasRutaNavigation({ ...READY_INPUT, search });
        expect(model.activeStage, search).toBe("seleccion");
        expect(model.normalizedSearch, search).toBe("?seccion=seleccion&pestana=cuotas");
      }
    });

    it("resuelve un estado persistido «entrega» a Selección", () => {
      const model = buildHojasRutaNavigation({
        ...READY_INPUT,
        search: "",
        // Lo que llega de un `.pulso` guardado antes del renombre.
        persistedStage: "entrega" as unknown as HojasRutaNavigationInput["persistedStage"],
      });
      expect(model.activeStage).toBe("seleccion");
      expect(resolverEtapaHojasRuta("entrega")).toBe("seleccion");
      expect(resolverEtapaHojasRuta("seleccion")).toBe("seleccion");
      expect(resolverEtapaHojasRuta("otra")).toBeNull();
      expect(resolverEtapaHojasRuta(undefined)).toBeNull();
    });

    it("nunca escribe la forma vieja", () => {
      expect(buildHojasRutaNavigationSearch("?stage=entrega", "seleccion", "cuotas")).toBe(
        "?seccion=seleccion&pestana=cuotas",
      );
      expect(buildHojasRutaNavigationSearch("?etapa=entrega", "muestra")).toBe("?seccion=muestra");
    });
  });
});
