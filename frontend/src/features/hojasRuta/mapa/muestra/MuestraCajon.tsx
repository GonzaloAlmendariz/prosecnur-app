import { Panel } from "../../../../components/Panel";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoTable } from "../../../../components/PulsoTable";
import { X } from "../../../../vendor/lucide-react";
import type { QuotaPlan } from "../../../../api/hojasRuta";
import { nombreDistrito } from "../nombres";
import { useLienzoHojasRuta } from "../store";

/**
 * Cajón inferior de Muestra (brecha B17): las cuotas del motor por distrito,
 * con su reparto por rango de edad y por sexo. Son totales marginales: la ficha
 * pide llegar al total de cada sexo y de cada rango, no a sus cruces.
 */

type Fila = { territorio: string; porRango: Record<string, number>; porSexo: Record<string, number>; total: number };
const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(n));

export function pivotarCuotas(cuotas: QuotaPlan | null): { rangos: string[]; sexos: string[]; filas: Fila[] } {
  const rangos: string[] = [];
  const sexos: string[] = [];
  const porDistrito = new Map<string, Fila>();
  for (const c of cuotas?.cells ?? []) {
    const territorio = String(c.territorio ?? "");
    const rango = String(c.rango_edad ?? "");
    const sexo = c.sexo == null || c.sexo === "" ? null : String(c.sexo);
    const n = Number(c.cuota ?? 0) || 0;
    if (rango && !rangos.includes(rango)) rangos.push(rango);
    if (sexo && !sexos.includes(sexo)) sexos.push(sexo);
    const f = porDistrito.get(territorio) ?? { territorio, porRango: {}, porSexo: {}, total: 0 };
    if (rango) f.porRango[rango] = (f.porRango[rango] ?? 0) + n;
    if (sexo) f.porSexo[sexo] = (f.porSexo[sexo] ?? 0) + n;
    f.total += n;
    porDistrito.set(territorio, f);
  }
  return { rangos, sexos, filas: [...porDistrito.values()] };
}

/** P4: el botón «Calcular cuotas» sale sólo sin cuotas y con quien las calcule. */
export const ofreceCalcularCuotas = (cuotas: QuotaPlan | null, onCalcular?: () => void) => !cuotas && Boolean(onCalcular);

/**
 * P4 de la paridad con la página clásica: sin cuotas todavía (la muestra no se sorteó), el cajón
 * las calcula con el tamaño guardado (`/api/hojas-ruta/quota-preview`, que las guarda en las salidas)
 * en vez de esperar al sorteo.
 */
export function MuestraCajon({ cuotas, onCalcular, calculando = false }: { cuotas: QuotaPlan | null; onCalcular?: () => void; calculando?: boolean }) {
  const { cajonMuestra, setCajonMuestra } = useLienzoHojasRuta();
  if (!cajonMuestra) return null;
  const { rangos, sexos, filas } = pivotarCuotas(cuotas);
  return (
    <Panel
      className="hr-sel-cajon"
      aria-label="Cuotas de la muestra"
      title="Cuotas por distrito, totales por edad y por sexo"
      actions={
        <PulsoButton variant="icon" size="sm" aria-label="Cerrar las cuotas" onClick={() => setCajonMuestra(false)}>
          <X size={14} aria-hidden />
        </PulsoButton>
      }
    >
      {ofreceCalcularCuotas(cuotas, onCalcular) ? (
        <div className="hr-mapa-acciones">
          <PulsoButton variant="primary" size="sm" disabled={calculando} onClick={onCalcular}>
            {calculando ? "Calculando…" : "Calcular cuotas"}
          </PulsoButton>
          <span className="hr-mapa-nota">Con el tamaño guardado, antes de sortear.</span>
        </div>
      ) : null}
      <PulsoTable
        ariaLabel="Cuotas por distrito"
        densidad="compacta"
        altoMaximo={280}
        columnas={[
          { id: "distrito", encabezado: "Distrito", ancho: 160, celda: (f: Fila) => nombreDistrito(f.territorio), valor: (f: Fila) => f.territorio },
          ...rangos.map((r) => ({ id: `r-${r}`, encabezado: r, ancho: 78, tipo: "cifra" as const, celda: (f: Fila) => fmt(f.porRango[r] ?? 0), valor: (f: Fila) => f.porRango[r] ?? 0 })),
          ...sexos.map((x) => ({ id: `s-${x}`, encabezado: x, ancho: 84, tipo: "cifra" as const, celda: (f: Fila) => fmt(f.porSexo[x] ?? 0), valor: (f: Fila) => f.porSexo[x] ?? 0 })),
          { id: "total", encabezado: "Total", ancho: 84, tipo: "cifra" as const, celda: (f: Fila) => <b>{fmt(f.total)}</b>, valor: (f: Fila) => f.total },
        ]}
        filas={filas}
        idDeFila={(f) => f.territorio}
        vacio="Sin cuotas calculadas: guarda y calcula el tamaño."
      />
    </Panel>
  );
}
