// Avisos que GET /api/graficos/config entrega UNA sola vez por sesión: al abrir un plan con láminas de población antigua,
// el backend las migra al tipo vigente, lo persiste en la sesión y lo avisa en `avisos` (graficos_migrar_poblacion_sesion.R).
//
// Como el aviso no se repite, quien lea primero la config no puede tragárselo: el GET lo hacen también el calentamiento
// de arranque y los reintentos de hidratación, antes de que exista la vista que lo pinta. Por eso el cliente lo publica
// aquí: si ya hay quien escuche, se le entrega; si no, queda pendiente (de esa sesión) hasta que alguien se suscriba.

/** Lista de textos no vacíos, sin repetidos. Acepta el escalar suelto que jsonlite deja de un vector de uno. */
export function normalizarAvisosConfig(raw: unknown): string[] {
  const lista = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  const vistos = new Set<string>();
  for (const x of lista) {
    if (typeof x !== "string") continue;
    const t = x.trim();
    if (t) vistos.add(t);
  }
  return [...vistos];
}

type Sumidero = (sid: string | null, avisos: string[]) => void;

let sumidero: Sumidero | null = null;
let pendientes: { sid: string | null; avisos: string[] }[] = [];

/** Lo llama el cliente tras cada GET de la config. Sin sumidero aún (la vista no cargó), el aviso queda pendiente. */
export function publicarAvisosConfig(sid: string | null, avisos: readonly string[]): void {
  if (!avisos.length) return;
  if (sumidero) sumidero(sid, [...avisos]);
  else pendientes.push({ sid, avisos: [...avisos] });
}

/** Un único destinatario (el store de Gráficos): recibe en el acto lo pendiente y después cada aviso nuevo. */
export function fijarSumideroAvisosConfig(destino: Sumidero | null): void {
  sumidero = destino;
  if (!destino) return;
  const lote = pendientes;
  pendientes = [];
  for (const p of lote) destino(p.sid, p.avisos);
}
