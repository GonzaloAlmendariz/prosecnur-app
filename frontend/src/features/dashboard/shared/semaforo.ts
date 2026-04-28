// Helper compartido para resolver colores del semáforo según la
// configuración del usuario. Garantiza que heatmap, chips de barras,
// cards FODA y cualquier otra superficie usen exactamente la misma
// paleta y modo (cortes vs gradiente).

export type SemaforoConfig = {
  modo: "cortes" | "gradiente";
  red: string;
  amber: string;
  green: string;
  redMax: number;   // 0-100, fin del rango bajo
  amberMax: number; // redMax-100, fin del rango medio
  // Cortes adicionales para fineza de color (no aparecen en la leyenda).
  stopsExtra: { value: number; color: string }[];
};

export type DashboardConfigLike = {
  semaforo_modo?: "cortes" | "gradiente";
  semaforo_red_color?: string;
  semaforo_amber_color?: string;
  semaforo_green_color?: string;
  semaforo_red_max?: number;
  semaforo_amber_max?: number;
  semaforo_stops_extra?: { value: number; color: string }[];
};

export function semaforoFromConfig(
  cfg: DashboardConfigLike,
  payloadFallback?: {
    red_color?: string;
    amber_color?: string;
    green_color?: string;
    red_max?: number;
    amber_max?: number;
  } | null,
): SemaforoConfig {
  return {
    modo: cfg.semaforo_modo === "gradiente" ? "gradiente" : "cortes",
    red: cfg.semaforo_red_color ?? payloadFallback?.red_color ?? "#D84B55",
    amber: cfg.semaforo_amber_color ?? payloadFallback?.amber_color ?? "#E0B44C",
    green: cfg.semaforo_green_color ?? payloadFallback?.green_color ?? "#3A9A5B",
    redMax: cfg.semaforo_red_max ?? payloadFallback?.red_max ?? 60,
    amberMax: cfg.semaforo_amber_max ?? payloadFallback?.amber_max ?? 80,
    stopsExtra: Array.isArray(cfg.semaforo_stops_extra) ? cfg.semaforo_stops_extra : [],
  };
}

// Construye la lista ORDENADA y EXTENDIDA de stops base + extras del usuario.
// Cada stop = { value (0-100), color }. Los extras se intercalan según value.
function allStops(sem: SemaforoConfig): { value: number; color: string }[] {
  const base: { value: number; color: string }[] = [
    { value: 0, color: sem.red },
    { value: sem.redMax, color: sem.amber },
    { value: sem.amberMax, color: sem.green },
    { value: 100, color: sem.green },
  ];
  const extras = (sem.stopsExtra ?? []).map((s) => ({
    value: Math.max(0, Math.min(100, s.value)),
    color: s.color,
  }));
  return dedupeStopsByValue([...base, ...extras].sort((a, b) => a.value - b.value));
}

function dedupeStopsByValue(stops: { value: number; color: string }[]) {
  const out: { value: number; color: string }[] = [];
  for (const stop of stops) {
    const last = out[out.length - 1];
    if (last && last.value === stop.value) {
      last.color = stop.color;
    } else {
      out.push({ ...stop });
    }
  }
  return out;
}

// Color de un score (0-100) según el modo:
//   - "cortes": devuelve el color del stop inmediatamente <= value.
//   - "gradiente": interpola linealmente entre los stops vecinos.
export function colorOfScore(value: number | null | undefined, sem: SemaforoConfig): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const stops = allStops(sem);
  const v = Math.max(0, Math.min(100, value));
  if (sem.modo === "cortes") {
    // Cortes: el último stop con value <= v gana.
    let color = stops[0].color;
    for (const s of stops) {
      if (s.value <= v) color = s.color;
      else break;
    }
    return color;
  }
  // Gradiente: localizar el segmento [a, b] que contiene v y mezclar.
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (v >= a.value && v <= b.value) {
      const span = b.value - a.value;
      const t = span > 0 ? (v - a.value) / span : 0;
      return mixHex(a.color, b.color, t);
    }
  }
  return stops[stops.length - 1].color;
}

// Construye el colorscale para Plotly heatmap. Incluye los stops extras
// (los del usuario) además de los 3 base, intercalados por valor.
export function plotlyColorscale(sem: SemaforoConfig): [number, string][] {
  const stops = allStops(sem);
  if (sem.modo === "gradiente") {
    // Stops únicos por value (Plotly requiere monotónico no decreciente).
    const out: [number, string][] = [];
    for (const s of stops) {
      const t = s.value / 100;
      out.push([t, s.color]);
    }
    return out;
  }
  // Cortes: duplicar cada stop (doble step) para que el cambio sea abrupto.
  const out: [number, string][] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    out.push([a.value / 100, a.color]);
    if (b.value > a.value) {
      out.push([Math.max(0, b.value - 0.001) / 100, a.color]);
    }
  }
  out.push([1, stops[stops.length - 1].color]);
  return out;
}

// Interpolación lineal entre dos colores hex.
function mixHex(a: string, b: string, t: number): string {
  const ar = parseHex(a);
  const br = parseHex(b);
  const tt = Math.max(0, Math.min(1, t));
  const r = Math.round(ar[0] + (br[0] - ar[0]) * tt);
  const g = Math.round(ar[1] + (br[1] - ar[1]) * tt);
  const bl = Math.round(ar[2] + (br[2] - ar[2]) * tt);
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = h.length === 3
    ? h.split("").map((c) => c + c).join("")
    : h;
  return [
    parseInt(v.slice(0, 2), 16) || 0,
    parseInt(v.slice(2, 4), 16) || 0,
    parseInt(v.slice(4, 6), 16) || 0,
  ];
}
