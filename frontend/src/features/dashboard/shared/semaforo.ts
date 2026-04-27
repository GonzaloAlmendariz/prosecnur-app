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
};

export type DashboardConfigLike = {
  semaforo_modo?: "cortes" | "gradiente";
  semaforo_red_color?: string;
  semaforo_amber_color?: string;
  semaforo_green_color?: string;
  semaforo_red_max?: number;
  semaforo_amber_max?: number;
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
  };
}

// Color de un score (0-100) según el modo:
//   - "cortes": devuelve uno de los 3 colores según los umbrales.
//   - "gradiente": interpola linealmente entre los 3 colores.
export function colorOfScore(value: number | null | undefined, sem: SemaforoConfig): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (sem.modo === "cortes") {
    if (value < sem.redMax) return sem.red;
    if (value < sem.amberMax) return sem.amber;
    return sem.green;
  }
  // Gradiente continuo: interpolar (red→amber) en [0, redMax],
  // (amber→green) en [redMax, amberMax], y green saturado en [amberMax, 100].
  const v = Math.max(0, Math.min(100, value));
  if (v <= sem.redMax) {
    const t = sem.redMax > 0 ? v / sem.redMax : 0;
    return mixHex(sem.red, sem.amber, t);
  }
  if (v <= sem.amberMax) {
    const t = sem.amberMax > sem.redMax ? (v - sem.redMax) / (sem.amberMax - sem.redMax) : 0;
    return mixHex(sem.amber, sem.green, t);
  }
  return sem.green;
}

// Construye el colorscale para Plotly heatmap (array [t, color]).
export function plotlyColorscale(sem: SemaforoConfig): [number, string][] {
  if (sem.modo === "gradiente") {
    return [
      [0, sem.red],
      [sem.redMax / 100, sem.amber],
      [sem.amberMax / 100, sem.green],
      [1, sem.green],
    ];
  }
  return [
    [0, sem.red],
    [(sem.redMax - 0.001) / 100, sem.red],
    [sem.redMax / 100, sem.amber],
    [(sem.amberMax - 0.001) / 100, sem.amber],
    [sem.amberMax / 100, sem.green],
    [1, sem.green],
  ];
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
