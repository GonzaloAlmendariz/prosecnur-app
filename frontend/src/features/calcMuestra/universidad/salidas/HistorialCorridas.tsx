/**
 * Mini-historial de corridas (pestaña Cierre, debajo de la ficha ejecutiva):
 * lista compacta y plegable de las últimas corridas de cálculo y de selección
 * de aulas registradas en workspace.run_history, con comparación de dos
 * corridas lado a lado (parámetros y resultados con deltas). Sirve para
 * justificar un ajuste ("qué cambió entre el diseño A y el B") sin salir de
 * la ficha. Solo lectura: el registro ocurre en la página al terminar cada
 * corrida y se persiste con el autosave normal.
 */
import { useMemo, useState } from "react";
import { GitCompareArrows } from "lucide-react";
import type { CalcMuestraCorrida, CalcMuestraWorkspace } from "../../../../api/client";
import { historialCorridas } from "../../corridas";
import { fmtDec, fmtInt, fmtPct } from "../../sharedCore";
import { classroomMethodLabel } from "../aulas/aulasParts";
import { PanelAvanzado } from "../ui";
import "./salidas.css";

const TECNICA_LABEL: Record<string, string> = {
  prob_aleatorio_simple: "Probabilístico clásico",
  prob_estratificado: "Estratificado proporcional",
  prob_estratificado_independiente: "Dominios independientes",
  prob_conglomerado_multietapico: "Por conglomerados",
  sistematico: "Sistemático",
  intencion_censal: "Cobertura censal",
  barrido: "Barrido operativo",
  no_prob_cuotas: "Cuotas controladas",
  no_prob_conveniencia: "Conveniencia con pisos",
};

function metodoCorrida(corrida: CalcMuestraCorrida): string {
  if (!corrida.metodo) return "—";
  if (corrida.tipo === "seleccion") return classroomMethodLabel(corrida.metodo) || corrida.metodo;
  return TECNICA_LABEL[corrida.metodo] ?? corrida.metodo;
}

const FECHA_CORRIDA = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function fechaCorrida(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : FECHA_CORRIDA.format(date);
}

function cifraCorrida(corrida: CalcMuestraCorrida): string {
  if (corrida.tipo === "seleccion") {
    const titulares = corrida.resumen?.titulares;
    return titulares != null ? `${fmtInt(titulares)} titulares` : "selección";
  }
  const n = corrida.n_objetivo ?? corrida.resumen?.n;
  return n != null ? `n ${fmtInt(n)}` : "cálculo";
}

type FilaComparacion = {
  id: string;
  label: string;
  /** Valor crudo para el delta (solo si ambas corridas lo traen). */
  valor: (corrida: CalcMuestraCorrida) => number | undefined;
  formato: (valor: number) => string;
  /** Formato del delta; por defecto el mismo de la fila con signo. */
  delta?: (delta: number) => string;
};

const FILAS_COMPARACION: FilaComparacion[] = [
  { id: "n", label: "n objetivo", valor: (c) => c.n_objetivo ?? c.resumen?.n, formato: fmtInt },
  { id: "confianza", label: "Confianza (z)", valor: (c) => c.parametros?.z, formato: (v) => fmtDec(v, 2) },
  { id: "e", label: "Margen e", valor: (c) => c.parametros?.e, formato: fmtPct },
  { id: "p", label: "p", valor: (c) => c.parametros?.p, formato: fmtPct },
  { id: "deff", label: "DEFF", valor: (c) => c.parametros?.deff, formato: (v) => fmtDec(v, 2) },
  { id: "sobremuestra", label: "Sobremuestra", valor: (c) => c.parametros?.sobremuestra, formato: fmtPct },
  { id: "waves", label: "Bolsas de reemplazo", valor: (c) => c.parametros?.waves, formato: fmtInt },
  { id: "titulares", label: "Cursos-horario titulares", valor: (c) => c.resumen?.titulares, formato: fmtInt },
  { id: "reservas", label: "Reservas", valor: (c) => c.resumen?.reservas, formato: fmtInt },
  { id: "esperados", label: "Elegibles esperados", valor: (c) => c.resumen?.esperados, formato: fmtInt },
  {
    id: "representatividad",
    label: "Representatividad",
    // El score del motor puede venir en escala 0-1 o 0-100 (misma convención
    // que classroomScore): se normaliza a 0-100 antes de mostrar y de restar.
    valor: (c) => {
      const raw = c.resumen?.representatividad;
      if (raw == null || !Number.isFinite(raw)) return undefined;
      return raw >= 0 && raw <= 1 ? raw * 100 : raw;
    },
    formato: (v) => `${fmtDec(v, 0)}/100`,
    delta: (d) => `${d > 0 ? "+" : ""}${fmtDec(d, 0)}`,
  },
];

function deltaTexto(fila: FilaComparacion, a: number, b: number): string {
  const delta = b - a;
  if (delta === 0) return "=";
  if (fila.delta) return fila.delta(delta);
  return `${delta > 0 ? "+" : "−"}${fila.formato(Math.abs(delta))}`;
}

export function HistorialCorridas({ workspace }: { workspace: CalcMuestraWorkspace }) {
  const corridas = useMemo(() => [...historialCorridas(workspace)].reverse(), [workspace]);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const elegidas = seleccion
    .map((id) => corridas.find((c) => c.id === id))
    .filter((c): c is CalcMuestraCorrida => Boolean(c));
  const [corridaA, corridaB] = elegidas.length === 2
    ? [...elegidas].sort((x, y) => x.timestamp.localeCompare(y.timestamp))
    : [undefined, undefined];

  function alternar(id: string) {
    setSeleccion((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length < 2) return [...prev, id];
      // Con dos elegidas, la nueva reemplaza a la más antigua de la selección.
      return [prev[1], id];
    });
  }

  if (corridas.length === 0) return null;

  const filasVisibles = corridaA && corridaB
    ? FILAS_COMPARACION.filter((fila) => fila.valor(corridaA) != null || fila.valor(corridaB) != null)
    : [];

  return (
    <PanelAvanzado
      titulo="Historial de corridas"
      descripcion={`últimas ${fmtInt(corridas.length)} · elige dos para compararlas`}
    >
      <div className="cmv2-sal-historial">
        <ul className="cmv2-sal-historial-lista" aria-label="Corridas registradas">
          {corridas.map((corrida) => {
            const activa = seleccion.includes(corrida.id);
            return (
              <li key={corrida.id}>
                <button
                  type="button"
                  aria-pressed={activa}
                  data-activa={activa || undefined}
                  onClick={() => alternar(corrida.id)}
                >
                  <span className="cmv2-sal-historial-check" aria-hidden="true" />
                  <span className="cmv2-sal-historial-fecha">{fechaCorrida(corrida.timestamp)}</span>
                  <span className="cmv2-pill-soft" data-tipo={corrida.tipo}>
                    {corrida.tipo === "seleccion" ? "Selección" : "Cálculo"}
                  </span>
                  <span className="cmv2-sal-historial-metodo">{metodoCorrida(corrida)}</span>
                  {corrida.semilla != null && (
                    <span className="cmv2-sal-historial-semilla">semilla {String(corrida.semilla)}</span>
                  )}
                  <b>{cifraCorrida(corrida)}</b>
                </button>
              </li>
            );
          })}
        </ul>

        {corridaA && corridaB ? (
          <div className="cmv2-sal-historial-comparacion" aria-label="Comparación de dos corridas">
            <div className="cmv2-sal-historial-comparacion-head">
              <GitCompareArrows size={14} aria-hidden="true" />
              <strong>
                {metodoCorrida(corridaA)} ({fechaCorrida(corridaA.timestamp)}) frente a {metodoCorrida(corridaB)} ({fechaCorrida(corridaB.timestamp)})
              </strong>
            </div>
            <table>
              <thead>
                <tr>
                  <th scope="col">Parámetro / resultado</th>
                  <th scope="col">A · {fechaCorrida(corridaA.timestamp)}</th>
                  <th scope="col">B · {fechaCorrida(corridaB.timestamp)}</th>
                  <th scope="col">Δ (B − A)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Método</th>
                  <td>{metodoCorrida(corridaA)}</td>
                  <td>{metodoCorrida(corridaB)}</td>
                  <td>{metodoCorrida(corridaA) === metodoCorrida(corridaB) ? "=" : "cambió"}</td>
                </tr>
                <tr>
                  <th scope="row">Semilla</th>
                  <td>{corridaA.semilla != null ? String(corridaA.semilla) : "—"}</td>
                  <td>{corridaB.semilla != null ? String(corridaB.semilla) : "—"}</td>
                  <td>{corridaA.semilla === corridaB.semilla ? "=" : "cambió"}</td>
                </tr>
                {filasVisibles.map((fila) => {
                  const a = fila.valor(corridaA);
                  const b = fila.valor(corridaB);
                  return (
                    <tr key={fila.id}>
                      <th scope="row">{fila.label}</th>
                      <td>{a != null ? fila.formato(a) : "—"}</td>
                      <td>{b != null ? fila.formato(b) : "—"}</td>
                      <td data-delta={a != null && b != null && b !== a ? (b > a ? "sube" : "baja") : undefined}>
                        {a != null && b != null ? deltaTexto(fila, a, b) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="cmv2-sal-nota">
            {corridas.length < 2
              ? "Con una segunda corrida podrás comparar dos diseños lado a lado."
              : "Elige dos corridas de la lista para ver parámetros y resultados lado a lado."}
          </p>
        )}
      </div>
    </PanelAvanzado>
  );
}
