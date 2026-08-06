import {
  PROCESAMIENTO_PESTANAS,
  type CargaWorkspaceTab,
} from "../../lib/navegacion/catalogos/procesamiento";

export type { CargaWorkspaceTab };

export type CargaWorkspaceState =
  | "neutral"
  | "pending"
  | "attention"
  | "ready";

export type CargaWorkspaceContext = {
  hasInstrument: boolean;
  hasData: boolean;
  hasBase: boolean;
  hasReviewIssues: boolean;
  isMultiBase: boolean;
  baseCount: number;
  instrumentBaseCount?: number;
  dataBaseCount?: number;
  /** ADR 0062: sólo con bases que no comparten instrumento existe la pestaña. */
  basesSeparadas?: boolean;
  /** Filas de la equivalencia ya declarada, si el estudio la tiene. */
  equivalenciasDeclaradas?: number;
};

export type CargaWorkspaceMetadata = {
  key: CargaWorkspaceTab;
  label: string;
  summary: string;
};

export type CargaWorkspaceItem = CargaWorkspaceMetadata & {
  state: CargaWorkspaceState;
  statusLabel: string;
  description: string;
};

export const CARGA_WORKSPACE_TABS = PROCESAMIENTO_PESTANAS.carga;

export const CARGA_WORKSPACE_TAB_KEYS: readonly CargaWorkspaceTab[] =
  CARGA_WORKSPACE_TABS.map((tab) => tab.key);

export const CARGA_WORKSPACE_STATE_LABELS: Readonly<
  Record<CargaWorkspaceState, string>
> = {
  neutral: "Por definir",
  pending: "Pendiente",
  attention: "Requiere atención",
  ready: "Listo",
};

function item(
  key: CargaWorkspaceTab,
  state: CargaWorkspaceState,
  description: string,
): CargaWorkspaceItem {
  const metadata = CARGA_WORKSPACE_TABS.find((candidate) => candidate.key === key);
  if (!metadata) {
    throw new Error(`Pestaña de carga no registrada: ${key}`);
  }

  return {
    ...metadata,
    state,
    statusLabel: CARGA_WORKSPACE_STATE_LABELS[state],
    description,
  };
}

function normalizedBaseCount(context: CargaWorkspaceContext): number {
  if (!Number.isFinite(context.baseCount)) return 0;
  return Math.max(0, Math.trunc(context.baseCount));
}

function normalizedCoverageCount(
  value: number | undefined,
  fallback: boolean,
  baseCount: number,
): number {
  if (Number.isFinite(value)) {
    return Math.min(baseCount, Math.max(0, Math.trunc(value ?? 0)));
  }
  return fallback ? baseCount : 0;
}

function multibaseCoverage(context: CargaWorkspaceContext) {
  const baseCount = normalizedBaseCount(context);
  return {
    baseCount,
    instrumentBaseCount: normalizedCoverageCount(
      context.instrumentBaseCount,
      context.hasInstrument,
      baseCount,
    ),
    dataBaseCount: normalizedCoverageCount(
      context.dataBaseCount,
      context.hasData,
      baseCount,
    ),
  };
}

function planItem(context: CargaWorkspaceContext): CargaWorkspaceItem {
  const baseCount = normalizedBaseCount(context);
  const hasBase = context.hasBase || baseCount > 0;

  if (hasBase) {
    if (context.isMultiBase) {
      if (baseCount > 0) {
        return item(
          "plan",
          "ready",
          `${baseCount} base${baseCount === 1 ? " organizada" : "s organizadas"} para el estudio.`,
        );
      }
      return item("plan", "ready", "El espacio multibase está organizado para el estudio.");
    }
    return item("plan", "ready", "La base de trabajo ya está definida.");
  }

  if (context.hasInstrument || context.hasData) {
    return item(
      "plan",
      "attention",
      "Hay insumos disponibles, pero todavía falta definir la base de trabajo.",
    );
  }

  if (context.isMultiBase) {
    return item(
      "plan",
      "pending",
      "El modo multibase está definido; falta crear la primera base.",
    );
  }

  return item(
    "plan",
    "neutral",
    "Define si el procesamiento usará una base o varias bases.",
  );
}

function sourcesItem(context: CargaWorkspaceContext): CargaWorkspaceItem {
  if (context.isMultiBase) {
    const { baseCount, instrumentBaseCount, dataBaseCount } = multibaseCoverage(context);
    if (baseCount > 0 && instrumentBaseCount === baseCount && dataBaseCount === baseCount) {
      return item(
        "fuentes",
        "ready",
        baseCount === 1
          ? "La base tiene formulario y respuestas."
          : `Las ${baseCount} bases tienen formulario y respuestas.`,
      );
    }
    if (baseCount > 0 && (instrumentBaseCount > 0 || dataBaseCount > 0)) {
      return item(
        "fuentes",
        "attention",
        `Formularios en ${instrumentBaseCount} de ${baseCount}; respuestas en ${dataBaseCount} de ${baseCount} bases.`,
      );
    }
  }

  if (context.hasInstrument && context.hasData) {
    return item("fuentes", "ready", "El formulario y las respuestas están disponibles.");
  }

  if (context.hasData) {
    return item(
      "fuentes",
      "attention",
      "Hay respuestas disponibles, pero falta asociar el formulario.",
    );
  }

  if (context.hasInstrument) {
    return item(
      "fuentes",
      "pending",
      "El formulario está disponible; falta cargar o conectar las respuestas.",
    );
  }

  return item(
    "fuentes",
    "pending",
    "Añade el formulario y carga o conecta las respuestas.",
  );
}

function reviewItem(context: CargaWorkspaceContext): CargaWorkspaceItem {
  if (context.hasReviewIssues) {
    return item(
      "revision",
      "attention",
      "Hay incidencias de carga que requieren una decisión.",
    );
  }

  if (context.hasInstrument && context.hasData) {
    if (context.isMultiBase) {
      const { baseCount, instrumentBaseCount, dataBaseCount } = multibaseCoverage(context);
      if (instrumentBaseCount < baseCount || dataBaseCount < baseCount) {
        return item(
          "revision",
          "attention",
          "Hay bases incompletas que deben resolverse antes de continuar.",
        );
      }
    }
    return item("revision", "ready", "No hay incidencias de carga pendientes.");
  }

  return item(
    "revision",
    "pending",
    "La revisión se completará cuando estén disponibles el formulario y las respuestas.",
  );
}

function structureItem(context: CargaWorkspaceContext): CargaWorkspaceItem {
  if (context.isMultiBase) {
    const { baseCount, instrumentBaseCount } = multibaseCoverage(context);
    if (instrumentBaseCount > 0) {
      return item(
        "estructura",
        instrumentBaseCount === baseCount ? "ready" : "attention",
        baseCount === 1
          ? "La base tiene estructura disponible."
          : `${instrumentBaseCount} de ${baseCount} bases tienen estructura disponible.`,
      );
    }
  }

  if (context.hasInstrument) {
    return item("estructura", "ready", "Las variables y sus códigos están disponibles.");
  }

  if (context.hasData) {
    return item(
      "estructura",
      "attention",
      "Hay respuestas, pero falta un formulario para reconstruir la estructura.",
    );
  }

  return item(
    "estructura",
    "pending",
    "Carga o conecta un formulario para revisar variables y códigos.",
  );
}

function dataItem(context: CargaWorkspaceContext): CargaWorkspaceItem {
  if (context.isMultiBase) {
    const { baseCount, dataBaseCount } = multibaseCoverage(context);
    if (dataBaseCount > 0) {
      return item(
        "datos",
        dataBaseCount === baseCount ? "ready" : "attention",
        baseCount === 1
          ? "La base tiene respuestas listas para explorar."
          : `${dataBaseCount} de ${baseCount} bases tienen respuestas listas para explorar.`,
      );
    }
  }

  if (context.hasData) {
    return item("datos", "ready", "Las respuestas están listas para explorar.");
  }

  if (context.hasBase || normalizedBaseCount(context) > 0) {
    return item("datos", "pending", "La base está creada, pero todavía no contiene respuestas.");
  }

  return item("datos", "pending", "Carga o conecta respuestas para abrir la vista tabular.");
}

/**
 * ADR 0062. La pestaña sólo entra cuando las bases no comparten instrumento; el
 * filtro vive en `cargaWorkspaceItems`, no aquí, para que este builder describa
 * un solo estado y no dos cosas a la vez.
 */
function equivalencesItem(context: CargaWorkspaceContext): CargaWorkspaceItem {
  const declaradas = context.equivalenciasDeclaradas ?? 0;
  if (declaradas > 0) {
    return item(
      "equivalencias",
      "ready",
      `${declaradas} ${declaradas === 1 ? "pregunta emparejada" : "preguntas emparejadas"} entre los públicos.`,
    );
  }
  return item(
    "equivalencias",
    "pending",
    "Declara qué pregunta de un público equivale a cuál de otro para poder compararlos.",
  );
}

export function cargaWorkspaceItems(
  context: CargaWorkspaceContext,
): readonly CargaWorkspaceItem[] {
  const items = [
    planItem(context),
    sourcesItem(context),
    reviewItem(context),
    structureItem(context),
    dataItem(context),
  ];
  // Espejo en el cliente del predicado del backend (ADR 0061/0062): sin bases
  // separadas la equivalencia no significa nada y la pestaña no se ofrece.
  if (context.basesSeparadas) items.push(equivalencesItem(context));
  return items;
}

export function isCargaWorkspaceTab(value: unknown): value is CargaWorkspaceTab {
  return typeof value === "string"
    && (CARGA_WORKSPACE_TAB_KEYS as readonly string[]).includes(value);
}

/**
 * Conserva todos los destinos canónicos, aunque su contenido esté pendiente.
 * Una solicitud ausente o inválida vuelve siempre a Plan: el estado del
 * proyecto informa las pestañas, pero nunca provoca navegación implícita.
 */
export function resolveCargaWorkspaceTab(
  requested: unknown,
  _context: CargaWorkspaceContext,
): CargaWorkspaceTab {
  if (isCargaWorkspaceTab(requested)) return requested;
  return "plan";
}
