import type { ReactNode } from "react";

/** Marco común de un gráfico del explorador: título, bajada, acciones y cuerpo. */
export default function GraficoTarjeta({
  titulo,
  bajada,
  acciones,
  tipo,
  children,
  pie,
}: {
  titulo: string;
  bajada?: string | null;
  acciones?: ReactNode;
  tipo?: string;
  children: ReactNode;
  pie?: string | null;
}) {
  return (
    <section className={`vx-tarjeta vx-grafico${tipo ? ` vx-tipo-${tipo}` : ""}`} aria-label={titulo}>
      <div className="vx-grafico-cab">
        <div>
          <h4>{titulo}</h4>
          {bajada && <p>{bajada}</p>}
        </div>
        {acciones}
      </div>
      {children}
      {pie && <p className="vx-pie">{pie}</p>}
    </section>
  );
}
