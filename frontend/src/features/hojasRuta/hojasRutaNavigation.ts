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
  "seleccion",
];

/**
 * Etapas que cambiaron de nombre. «Entrega» pasó a «Selección» con el ADR 0108
 * §5: Cuotas, Titulares y Reemplazos son la selección de campo, y los impresos
 * pasan a Material de campo. Se LEE en la URL y en el estado guardado; nunca se
 * escribe.
 */
const ALIAS_ETAPA: Readonly<Record<string, HojasRutaStage>> = {
  entrega: "seleccion",
};

/**
 * La etapa vigente que nombra un valor de URL o de estado persistido, o `null`
 * si no nombra ninguna. Un proyecto guardado con `active_stage = "entrega"`
 * vuelve a Selección y no cae en Territorio.
 */
export function resolverEtapaHojasRuta(value: unknown): HojasRutaStage | null {
  if (typeof value !== "string") return null;
  const limpio = value.trim().toLowerCase();
  if (HOJAS_RUTA_STAGE_ORDER.includes(limpio as HojasRutaStage)) return limpio as HojasRutaStage;
  return ALIAS_ETAPA[limpio] ?? null;
}

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
  seleccion: {
    n: 5,
    label: "Selección",
    hint: "Cuotas, titulares y reemplazos",
  },
};

const DELIVERY_TAB_LABELS: Record<HojasRutaDeliveryTab, string> = {
  cuotas: "Cuotas",
  titulares: "Titulares",
  reemplazos: "Reemplazos",
};

function asStage(value: string | null): HojasRutaStage | null {
  return resolverEtapaHojasRuta(value);
}

function asDeliveryTab(value: string | null): HojasRutaDeliveryTab | null {
  return HOJAS_RUTA_DELIVERY_TAB_ORDER.includes(value as HojasRutaDeliveryTab)
    ? (value as HojasRutaDeliveryTab)
    : null;
}

// Hojas de ruta nombraba sus niveles `stage`/`etapa` (sección) y `tab`
// (pestaña). La gramática canónica los llama `seccion` y `pestana`; los nombres
// viejos se siguen leyendo para no romper enlaces guardados, pero nunca se
// escriben. Contrato: `lib/navegacion/direccion.ts`.
const PARAM_SECCION = "seccion";
const PARAM_PESTANA = "pestana";
const LEGACY_SECCION: readonly string[] = ["stage", "etapa"];
const LEGACY_PESTANA: readonly string[] = ["tab"];

function leerNivel(
  params: URLSearchParams,
  canonico: string,
  legacy: readonly string[],
): string | null {
  for (const clave of [canonico, ...legacy]) {
    const valor = params.get(clave);
    if (valor !== null) return valor;
  }
  return null;
}

function tieneLegacy(params: URLSearchParams, legacy: readonly string[]): boolean {
  return legacy.some((clave) => params.has(clave));
}

function fijarNivel(
  params: URLSearchParams,
  canonico: string,
  legacy: readonly string[],
  valor: string,
): void {
  params.set(canonico, valor);
  for (const clave of legacy) params.delete(clave);
}

function borrarNivel(
  params: URLSearchParams,
  canonico: string,
  legacy: readonly string[],
): void {
  params.delete(canonico);
  for (const clave of legacy) params.delete(clave);
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
  if (stage === "seleccion" && deliveryTab) {
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
      key: "seleccion",
      ...STAGE_PRESENTATION.seleccion,
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
  const persistedStage = resolverEtapaHojasRuta(input.persistedStage) ?? fallbackStage;
  const persistedStageEnabled = !sections.find(
    (section) => section.key === persistedStage,
  )?.disabled;
  let activeStage = persistedStageEnabled
    ? persistedStage
    : fallbackStage;
  let searchChanged = false;

  if (requestedStageRaw !== null) {
    const requestedSection = sections.find(
      (section) => section.key === requestedStage,
    );
    if (requestedSection && !requestedSection.disabled) {
      activeStage = requestedSection.key;
      // Un nombre viejo de parámetro (`stage=`) o de valor (`entrega`) se
      // reescribe a la forma canónica aunque la etapa pedida sea válida.
      if (tieneLegacy(params, LEGACY_SECCION) || requestedStageRaw !== activeStage) {
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

  if (activeStage !== "seleccion") {
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
      if (tieneLegacy(params, LEGACY_PESTANA)) {
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
      activeTabId: activeStage === "seleccion"
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
