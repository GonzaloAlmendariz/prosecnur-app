import type { ViewDescriptor, ViewMeta } from "../types";

type MetaChip = {
  label: string;
  tone?: "neutral" | "info";
  mono?: boolean;
};

const PLOTLY_FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

const PLOTLY_THEME = {
  surface: "#ffffff",
  surfaceAlt: "#f8faff",
  border: "#d8e0ef",
  grid: "#dbe3f1",
  text: "#1f2933",
  textSoft: "#5f6b7a",
  inkStrong: "#0f172a",
  hoverBg: "#0f172a",
  hoverFg: "#f8fafc",
  accent: {
    neutral: "#002457",
    neutralSoft: "rgba(0, 36, 87, 0.08)",
    explore: "#2457d6",
    exploreSoft: "rgba(36, 87, 214, 0.10)",
    instrument: "#0f766e",
    instrumentSoft: "rgba(15, 118, 110, 0.10)",
    custom: "#9a3412",
    customSoft: "rgba(154, 52, 18, 0.10)",
    summary: "#7c3aed",
    summarySoft: "rgba(124, 58, 237, 0.10)",
    success: "#166534",
    successSoft: "rgba(22, 101, 52, 0.10)",
    warn: "#b45309",
    warnSoft: "rgba(180, 83, 9, 0.10)",
    danger: "#b91c1c",
    dangerSoft: "rgba(185, 28, 28, 0.10)",
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function mergeObjects<T extends Record<string, unknown>>(
  base: T,
  extra?: Record<string, unknown>,
): T {
  if (!extra) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const current = out[key];
    if (isRecord(current) && isRecord(value)) {
      out[key] = mergeObjects(current, value);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

function normalizeTypeLabel(tipo?: string) {
  const map: Record<string, string> = {
    so: "Selección única",
    sm: "Selección múltiple",
    num: "Numérica",
    fecha: "Fecha",
    texto: "Texto",
    mixto: "Mixta",
  };
  return tipo ? (map[tipo] ?? tipo) : null;
}

function inferToneFromMeta(meta?: ViewMeta): "neutral" | "success" | "warn" | "danger" {
  const sev = String(meta?.severidad ?? "neutral");
  if (sev === "success" || sev === "warn" || sev === "danger") return sev;
  return "neutral";
}

export function getChartTone(view: ViewDescriptor): {
  accent: string;
  soft: string;
  badge: string;
} {
  const tipo = typeof view.meta?.tipo === "string" ? view.meta.tipo : undefined;

  if (view.kind === "kpi_card") {
    const sev = inferToneFromMeta(view.meta);
    if (sev === "success") {
      return {
        accent: PLOTLY_THEME.accent.success,
        soft: PLOTLY_THEME.accent.successSoft,
        badge: "Indicador",
      };
    }
    if (sev === "warn") {
      return {
        accent: PLOTLY_THEME.accent.warn,
        soft: PLOTLY_THEME.accent.warnSoft,
        badge: "Indicador",
      };
    }
    if (sev === "danger") {
      return {
        accent: PLOTLY_THEME.accent.danger,
        soft: PLOTLY_THEME.accent.dangerSoft,
        badge: "Indicador",
      };
    }
  }

  if (tipo === "so") {
    return {
      accent: "#2457d6",
      soft: "rgba(36, 87, 214, 0.10)",
      badge: "Selección única",
    };
  }
  if (tipo === "sm") {
    return {
      accent: "#16a34a",
      soft: "rgba(22, 163, 74, 0.10)",
      badge: "Selección múltiple",
    };
  }
  if (tipo === "num") {
    return {
      accent: "#7c3aed",
      soft: "rgba(124, 58, 237, 0.10)",
      badge: "Numérica",
    };
  }

  if (view.kind === "heatmap_semaforo") {
    return {
      accent: PLOTLY_THEME.accent.instrument,
      soft: PLOTLY_THEME.accent.instrumentSoft,
      badge: "Mapa de calor",
    };
  }
  if (view.kind === "scatterpolar" || view.kind === "radar") {
    return {
      accent: PLOTLY_THEME.accent.summary,
      soft: PLOTLY_THEME.accent.summarySoft,
      badge: "Perfil comparado",
    };
  }
  if (view.kind === "table") {
    return {
      accent: PLOTLY_THEME.accent.custom,
      soft: PLOTLY_THEME.accent.customSoft,
      badge: "Detalle",
    };
  }
  if (view.actions?.length) {
    return {
      accent: PLOTLY_THEME.accent.instrument,
      soft: PLOTLY_THEME.accent.instrumentSoft,
      badge: "Vista accionable",
    };
  }
  return {
    accent: PLOTLY_THEME.accent.explore,
    soft: PLOTLY_THEME.accent.exploreSoft,
    badge: "Distribución",
  };
}

export function deriveChartEyebrow(view: ViewDescriptor) {
  const custom = typeof view.meta?.eyebrow === "string" ? view.meta.eyebrow : null;
  if (custom && custom.trim()) return custom;

  const meta = view.meta ?? {};
  if (meta.var_x && meta.var_y) return "Cruce";
  if (meta.var) return "Distribución";

  return getChartTone(view).badge;
}

export function deriveChartFooter(view: ViewDescriptor) {
  const explicit = typeof view.meta?.note === "string" ? view.meta.note : null;
  if (explicit && explicit.trim()) return explicit;
  if (view.actions?.length) return view.actions[0].label;
  return null;
}

export function buildMetaChips(meta?: ViewMeta): MetaChip[] {
  if (!meta) return [];

  const chips: MetaChip[] = [];
  const tipoLabel = normalizeTypeLabel(typeof meta.tipo === "string" ? meta.tipo : undefined);
  if (tipoLabel) chips.push({ label: tipoLabel, tone: "info" });

  if (typeof meta.var === "string" && meta.var.trim()) {
    chips.push({ label: meta.var, mono: true });
  }
  if (typeof meta.var_x === "string" && meta.var_x.trim()) {
    chips.push({ label: `X: ${meta.var_x}`, mono: true });
  }
  if (typeof meta.var_y === "string" && meta.var_y.trim()) {
    chips.push({ label: `Y: ${meta.var_y}`, mono: true });
  }

  const nValidos = typeof meta.n_validos === "number" ? meta.n_validos : null;
  const nTotal = typeof meta.n_total === "number" ? meta.n_total : null;
  if (nValidos != null && nTotal != null) {
    chips.push({ label: `${nValidos}/${nTotal} válidos` });
  } else if (nValidos != null) {
    chips.push({ label: `${nValidos} válidos` });
  }

  if (typeof meta.n_secciones === "number") {
    chips.push({ label: `${meta.n_secciones} secciones` });
  }
  if (typeof meta.n_tipos === "number") {
    chips.push({ label: `${meta.n_tipos} tipos` });
  }
  if (typeof meta.total_con_casos === "number") {
    chips.push({ label: `${meta.total_con_casos} reglas con casos` });
  }

  return chips.slice(0, 4);
}

export function hasPlotlyData(view: ViewDescriptor) {
  const data = view.plotly.data;
  if (!data || data.length === 0) return false;

  return data.some((trace) => {
    if (!isRecord(trace)) return false;
    const cells = isRecord(trace.cells) ? trace.cells : null;
    if (cells && Array.isArray(cells.values)) {
      return cells.values.some((entry: unknown) => Array.isArray(entry) ? entry.length > 0 : entry != null);
    }
    if (Array.isArray(trace.z)) {
      return trace.z.length > 0 && trace.z.some((row) => Array.isArray(row) ? row.length > 0 : row != null);
    }
    if (Array.isArray(trace.values)) return trace.values.length > 0;
    if (Array.isArray(trace.x)) return trace.x.length > 0;
    if (Array.isArray(trace.y)) return trace.y.length > 0;
    if (Array.isArray(trace.r)) return trace.r.length > 0;
    return true;
  });
}

function styleAxis(axis: Record<string, unknown> | undefined, orientation: "x" | "y") {
  return mergeObjects(
    {
      automargin: true,
      fixedrange: true,
      gridcolor: PLOTLY_THEME.grid,
      zeroline: false,
      tickfont: {
        family: PLOTLY_FONT_STACK,
        size: 11,
        color: PLOTLY_THEME.textSoft,
      },
      title: {
        font: {
          family: PLOTLY_FONT_STACK,
          size: 11,
          color: PLOTLY_THEME.textSoft,
        },
        standoff: orientation === "x" ? 12 : 10,
      },
    },
    axis,
  );
}

function styleTrace(trace: unknown, accent: string, soft: string) {
  if (!isRecord(trace)) return trace;

  const next = { ...trace };
  const type = typeof next.type === "string" ? next.type : "";

  if (type === "bar") {
    next.marker = mergeObjects(
      {
        color: next.marker && isRecord(next.marker) && next.marker.color ? next.marker.color : accent,
        line: {
          color: PLOTLY_THEME.surface,
          width: 1.2,
        },
      },
      isRecord(next.marker) ? next.marker : undefined,
    );
  }

  if (type === "heatmap") {
    next.colorbar = mergeObjects(
      {
        thickness: 14,
        lenmode: "fraction",
        len: 1.04,
        y: 0.5,
        yanchor: "middle",
        tickfont: {
          family: PLOTLY_FONT_STACK,
          size: 10,
          color: PLOTLY_THEME.textSoft,
        },
      },
      isRecord(next.colorbar) ? next.colorbar : undefined,
    );
  }

  if (type === "scatterpolar") {
    next.line = mergeObjects(
      {
        color: accent,
        width: 2.4,
      },
      isRecord(next.line) ? next.line : undefined,
    );
    if (typeof next.fillcolor !== "string") next.fillcolor = soft;
  }

  if (type === "table") {
    next.header = mergeObjects(
      {
        fill: { color: "#eef3ff" },
        line: { color: PLOTLY_THEME.border, width: 1 },
        font: {
          family: PLOTLY_FONT_STACK,
          size: 11,
          color: PLOTLY_THEME.inkStrong,
        },
        align: "left",
        height: 30,
      },
      isRecord(next.header) ? next.header : undefined,
    );
    next.cells = mergeObjects(
      {
        fill: { color: PLOTLY_THEME.surface },
        line: { color: PLOTLY_THEME.border, width: 1 },
        font: {
          family: PLOTLY_FONT_STACK,
          size: 11,
          color: PLOTLY_THEME.text,
        },
        align: "left",
        height: 28,
      },
      isRecord(next.cells) ? next.cells : undefined,
    );
  }

  return next;
}

export function buildPlotlyData(view: ViewDescriptor) {
  const tone = getChartTone(view);
  return view.plotly.data.map((trace) => styleTrace(trace, tone.accent, tone.soft));
}

export function buildPlotlyLayout(view: ViewDescriptor, height?: number) {
  const tone = getChartTone(view);
  const baseLayout: Record<string, unknown> = {
    autosize: true,
    paper_bgcolor: "rgba(255,255,255,0)",
    plot_bgcolor: "rgba(255,255,255,0)",
    font: {
      family: PLOTLY_FONT_STACK,
      size: 12,
      color: PLOTLY_THEME.text,
    },
    margin: { l: 72, r: 24, t: 12, b: 52 },
    dragmode: false,
    hovermode: "closest",
    hoverlabel: {
      bgcolor: PLOTLY_THEME.hoverBg,
      bordercolor: PLOTLY_THEME.hoverBg,
      font: {
        family: PLOTLY_FONT_STACK,
        size: 11,
        color: PLOTLY_THEME.hoverFg,
      },
    },
    legend: {
      orientation: "h",
      y: -0.18,
      x: 0.5,
      xanchor: "center",
      font: {
        family: PLOTLY_FONT_STACK,
        size: 11,
        color: PLOTLY_THEME.textSoft,
      },
    },
    separators: ",.",
  };

  const layout = mergeObjects(baseLayout, view.plotly.layout);
  const next: Record<string, unknown> = {
    ...layout,
    xaxis: styleAxis(isRecord(layout.xaxis) ? layout.xaxis : undefined, "x"),
    yaxis: styleAxis(isRecord(layout.yaxis) ? layout.yaxis : undefined, "y"),
  };

  if (!next.colorway) {
    next.colorway = [
      tone.accent,
      "#2563eb",
      "#0f766e",
      "#d97706",
      "#7c3aed",
    ];
  }
  if (height) next.height = height;

  return next;
}

export function buildPlotlyConfig(view: ViewDescriptor) {
  return mergeObjects(
    {
      displayModeBar: false,
      scrollZoom: false,
      responsive: true,
      displaylogo: false,
      doubleClick: false,
      editable: false,
      showAxisDragHandles: false,
      showAxisRangeEntryBoxes: false,
    },
    view.plotly.config,
  );
}
