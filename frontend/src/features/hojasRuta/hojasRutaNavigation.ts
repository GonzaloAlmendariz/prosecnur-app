import type {
  HojasRutaDeliveryTab,
  HojasRutaStage,
} from "./store";

export type HojasRutaNavigationRuntimeItemState = {
  done?: boolean;
  badge?: string;
  lockedReason?: string;
};

export type HojasRutaNavigationSection = {
  key: HojasRutaStage;
  n: number;
  label: string;
  hint: string;
  done: boolean;
  disabled: boolean;
  disabledReason?: string;
  badge?: string;
};

export type HojasRutaNavigationTab = {
  key: HojasRutaDeliveryTab;
  label: string;
  count: number;
  disabled: boolean;
  disabledReason?: string;
};

export type HojasRutaNavigationInput = {
  search: string;
  persistedStage: HojasRutaStage;
  persistedDeliveryTab: HojasRutaDeliveryTab;
  selectedTerritoryCount: number;
  populationOk: boolean;
  quotaExists: boolean;
  quotaOk: boolean;
  quotaRowCount: number;
  quotaTotal?: number;
  sampleExists: boolean;
  sampleOk: boolean;
  sampleBlockCount: number;
  replacementCount: number;
  resultReady: boolean;
};

export type HojasRutaNavigationModel = {
  sections: HojasRutaNavigationSection[];
  deliveryTabs: HojasRutaNavigationTab[];
  activeStage: HojasRutaStage;
  activeDeliveryTab: HojasRutaDeliveryTab;
  normalizedSearch: string;
  runtime: {
    moduleSlug: "hojas-ruta";
    activeSectionId: HojasRutaStage;
    activeTabId?: HojasRutaDeliveryTab;
    preferredRailMode: "expanded" | "collapsed";
    sectionStates: Record<string, HojasRutaNavigationRuntimeItemState>;
    tabStates: Record<string, HojasRutaNavigationRuntimeItemState>;
  };
};

export const HOJAS_RUTA_STAGE_ORDER: readonly HojasRutaStage[] = [
  "territorio",
  "poblacion",
  "muestra",
  "manzanas",
  "entrega",
];

export const HOJAS_RUTA_DELIVERY_TAB_ORDER: readonly HojasRutaDeliveryTab[] = [
  "cuotas",
  "titulares",
  "reemplazos",
];

const STAGE_PRESENTATION: Record<
  HojasRutaStage,
  Pick<HojasRutaNavigationSection, "n" | "label" | "hint">
> = {
  territorio: {
    n: 1,
    label: "Territorio",
    hint: "Distritos y manzanas",
  },
  poblacion: {
    n: 2,
    label: "Población",
    hint: "Matriz INEI 2017",
  },
  muestra: {
    n: 3,
    label: "Muestra",
    hint: "N y cuotas",
  },
  manzanas: {
    n: 4,
    label: "Manzanas",
    hint: "Selección de campo",
  },
  entrega: {
    n: 5,
    label: "Entrega",
    hint: "Revisión y ZIP",
  },
};

const DELIVERY_TAB_LABELS: Record<HojasRutaDeliveryTab, string> = {
  cuotas: "Cuotas",
  titulares: "Titulares",
  reemplazos: "Reemplazos",
};

function asStage(value: string | null): HojasRutaStage | null {
  return HOJAS_RUTA_STAGE_ORDER.includes(value as HojasRutaStage)
    ? (value as HojasRutaStage)
    : null;
}

function asDeliveryTab(value: string | null): HojasRutaDeliveryTab | null {
  return HOJAS_RUTA_DELIVERY_TAB_ORDER.includes(value as HojasRutaDeliveryTab)
    ? (value as HojasRutaDeliveryTab)
    : null;
}

// Hojas de ruta nombraba sus niveles `stage` (sección) y `tab` (pestaña). La
// gramática canónica los llama `seccion` y `pestana`; los nombres viejos se
// siguen leyendo para no romper enlaces guardados, pero nunca se escriben.
// Contrato: `lib/navegacion/direccion.ts`.
const PARAM_SECCION = "seccion";
const PARAM_PESTANA = "pestana";
const LEGACY_SECCION = "stage";
const LEGACY_PESTANA = "tab";

function leerNivel(
  params: URLSearchParams,
  canonico: string,
  legacy: string,
): string | null {
  return params.get(canonico) ?? params.get(legacy);
}

function fijarNivel(
  params: URLSearchParams,
  canonico: string,
  legacy: string,
  valor: string,
): void {
  params.set(canonico, valor);
  params.delete(legacy);
}

function borrarNivel(
  params: URLSearchParams,
  canonico: string,
  legacy: string,
): void {
  params.delete(canonico);
  params.delete(legacy);
}

function lastEnabled<T extends { key: string; disabled: boolean }>(
  items: readonly T[],
  fallback: T["key"],
): T["key"] {
  return [...items].reverse().find((item) => !item.disabled)?.key ?? fallback;
}

function serializeSearch(
  originalSearch: string,
  params: URLSearchParams,
  changed: boolean,
): string {
  if (!changed) return originalSearch;
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function buildHojasRutaNavigationSearch(
  currentSearch: string,
  stage: HojasRutaStage,
  deliveryTab?: HojasRutaDeliveryTab,
): string {
  const params = new URLSearchParams(
    currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch,
  );
  fijarNivel(params, PARAM_SECCION, LEGACY_SECCION, stage);
  if (stage === "entrega" && deliveryTab) {
    fijarNivel(params, PARAM_PESTANA, LEGACY_PESTANA, deliveryTab);
  } else {
    borrarNivel(params, PARAM_PESTANA, LEGACY_PESTANA);
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function buildHojasRutaNavigation(
  input: HojasRutaNavigationInput,
): HojasRutaNavigationModel {
  const sections: HojasRutaNavigationSection[] = [
    {
      key: "territorio",
      ...STAGE_PRESENTATION.territorio,
      done: input.selectedTerritoryCount > 0,
      disabled: false,
      badge: input.selectedTerritoryCount > 0
        ? String(input.selectedTerritoryCount)
        : undefined,
    },
    {
      key: "poblacion",
      ...STAGE_PRESENTATION.poblacion,
      done: input.populationOk,
      disabled: input.selectedTerritoryCount === 0,
      disabledReason: input.selectedTerritoryCount === 0
        ? "Confirma al menos un distrito."
        : undefined,
      badge: input.populationOk ? "Lista" : undefined,
    },
    {
      key: "muestra",
      ...STAGE_PRESENTATION.muestra,
      done: input.quotaOk,
      disabled: !input.populationOk,
      disabledReason: !input.populationOk
        ? "Calcula primero la matriz poblacional."
        : undefined,
      badge: input.quotaOk
        ? input.quotaTotal != null
          ? String(input.quotaTotal)
          : "Lista"
        : undefined,
    },
    {
      key: "manzanas",
      ...STAGE_PRESENTATION.manzanas,
      done: input.sampleOk,
      disabled: !input.quotaOk,
      disabledReason: !input.quotaOk
        ? "Calcula primero las cuotas."
        : undefined,
      badge: input.sampleOk ? String(input.sampleBlockCount) : undefined,
    },
    {
      key: "entrega",
      ...STAGE_PRESENTATION.entrega,
      done: input.resultReady,
      disabled: !input.sampleOk,
      disabledReason: !input.sampleOk
        ? "Selecciona primero las manzanas."
        : undefined,
      badge: input.resultReady ? "Lista" : undefined,
    },
  ];

  const deliveryTabs: HojasRutaNavigationTab[] = [
    {
      key: "cuotas",
      label: DELIVERY_TAB_LABELS.cuotas,
      count: input.quotaRowCount,
      disabled: !input.quotaExists,
      disabledReason: !input.quotaExists
        ? "Calcula primero las cuotas."
        : undefined,
    },
    {
      key: "titulares",
      label: DELIVERY_TAB_LABELS.titulares,
      count: input.sampleBlockCount,
      disabled: !input.sampleExists,
      disabledReason: !input.sampleExists
        ? "Selecciona primero las manzanas."
        : undefined,
    },
    {
      key: "reemplazos",
      label: DELIVERY_TAB_LABELS.reemplazos,
      count: input.replacementCount,
      disabled: !input.sampleExists || input.replacementCount === 0,
      disabledReason: !input.sampleExists
        ? "Selecciona primero las manzanas."
        : input.replacementCount === 0
          ? "La muestra no tiene reemplazos."
          : undefined,
    },
  ];

  const params = new URLSearchParams(
    input.search.startsWith("?") ? input.search.slice(1) : input.search,
  );
  const requestedStageRaw = leerNivel(params, PARAM_SECCION, LEGACY_SECCION);
  const requestedStage = asStage(requestedStageRaw);
  const fallbackStage = lastEnabled(sections, "territorio") as HojasRutaStage;
  const persistedStageEnabled = !sections.find(
    (section) => section.key === input.persistedStage,
  )?.disabled;
  let activeStage = persistedStageEnabled
    ? input.persistedStage
    : fallbackStage;
  let searchChanged = false;

  if (requestedStageRaw !== null) {
    const requestedSection = sections.find(
      (section) => section.key === requestedStage,
    );
    if (requestedSection && !requestedSection.disabled) {
      activeStage = requestedSection.key;
      if (params.has(LEGACY_SECCION)) {
        fijarNivel(params, PARAM_SECCION, LEGACY_SECCION, activeStage);
        searchChanged = true;
      }
    } else {
      activeStage = fallbackStage;
      fijarNivel(params, PARAM_SECCION, LEGACY_SECCION, activeStage);
      searchChanged = true;
    }
  }

  const fallbackDeliveryTab = lastEnabled(
    deliveryTabs,
    "cuotas",
  ) as HojasRutaDeliveryTab;
  const persistedTabEnabled = !deliveryTabs.find(
    (tab) => tab.key === input.persistedDeliveryTab,
  )?.disabled;
  let activeDeliveryTab = persistedTabEnabled
    ? input.persistedDeliveryTab
    : fallbackDeliveryTab;
  const requestedTabRaw = leerNivel(params, PARAM_PESTANA, LEGACY_PESTANA);

  if (activeStage !== "entrega") {
    if (requestedTabRaw !== null) {
      borrarNivel(params, PARAM_PESTANA, LEGACY_PESTANA);
      searchChanged = true;
    }
  } else if (requestedTabRaw !== null) {
    const requestedTab = asDeliveryTab(requestedTabRaw);
    const requestedTabItem = deliveryTabs.find(
      (tab) => tab.key === requestedTab,
    );
    if (requestedTabItem && !requestedTabItem.disabled) {
      activeDeliveryTab = requestedTabItem.key;
      // La pestaña pedida es válida y no hay nada que corregir, pero si llegó
      // por el alias legacy hay que migrarla igual: normalizar y dejar la URL
      // mitad `tab=` mitad `seccion=` es peor que no haberla tocado.
      if (params.has(LEGACY_PESTANA)) {
        fijarNivel(params, PARAM_PESTANA, LEGACY_PESTANA, activeDeliveryTab);
        searchChanged = true;
      }
    } else {
      activeDeliveryTab = fallbackDeliveryTab;
      fijarNivel(params, PARAM_PESTANA, LEGACY_PESTANA, activeDeliveryTab);
      searchChanged = true;
    }
  }

  const sectionStates = Object.fromEntries(
    sections.map((section) => [
      section.key,
      {
        done: section.done,
        badge: section.badge,
        lockedReason: section.disabled
          ? section.disabledReason
          : undefined,
      },
    ]),
  );
  const tabStates = Object.fromEntries(
    deliveryTabs.map((tab) => [
      tab.key,
      {
        badge: String(tab.count),
        lockedReason: tab.disabled ? tab.disabledReason : undefined,
      },
    ]),
  );

  return {
    sections,
    deliveryTabs,
    activeStage,
    activeDeliveryTab,
    normalizedSearch: serializeSearch(input.search, params, searchChanged),
    runtime: {
      moduleSlug: "hojas-ruta",
      activeSectionId: activeStage,
      activeTabId: activeStage === "entrega"
        ? activeDeliveryTab
        : undefined,
      preferredRailMode: activeStage === "territorio" || activeStage === "manzanas"
        ? "collapsed"
        : "expanded",
      sectionStates,
      tabStates,
    },
  };
}
