import type { ReactNode } from "react";

/**
 * Marco común de un gráfico del explorador. El título es el cruce de las
 * variables, o la variable sola (D1, 2026-11-03): sin titular ni respuesta
 * calculada, lo relevante lo marca el gráfico. La leyenda va centrada bajo el
 * gráfico (D4) y los controles de lectura, arriba a la derecha.
 */
export default function GraficoTarjeta({
  titulo,
  etiqueta,
  bajada,
  acciones,
  tipo,
  aviso,
  children,
  leyenda,
  pie,
}: {
  titulo: ReactNode;
  /** Nombre accesible de la tarjeta cuando el título no es texto plano. */
  etiqueta?: string;
  bajada?: string | null;
  acciones?: ReactNode;
  tipo?: string;
  /** Aviso antes del gráfico (un dato imposible): va primero porque cambia cómo se lee. */
  aviso?: ReactNode;
  children: ReactNode;
  leyenda?: ReactNode;
  pie?: string | null;
}) {
  return (
    <section
      className={`vx-tarjeta vx-grafico${tipo ? ` vx-tipo-${tipo}` : ""}`}
      aria-label={etiqueta ?? (typeof titulo === "string" ? titulo : undefined)}
    >
      <div className="vx-grafico-cab">
        <div>
          <h4>{titulo}</h4>
          {bajada && <p>{bajada}</p>}
        </div>
        {acciones}
      </div>
      {aviso}
      {children}
      {leyenda}
      {pie && <p className="vx-pie">{pie}</p>}
    </section>
  );
}
