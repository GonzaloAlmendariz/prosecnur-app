// Avisos de la pieza en su ficha (C22): los mismos que marcan su fila en la Estructura (sin lista, código repetido,
// fila rota…), con su detalle. Sin avisos no ocupa lugar.

import { CircleAlert, TriangleAlert } from "../../../../vendor/lucide-react";
import type { BuilderDiagnostic } from "../../types";

export function AvisosFicha({ avisos }: { avisos: readonly BuilderDiagnostic[] }) {
  const visibles = avisos.filter((a) => a.level !== "info");
  if (!visibles.length) return null;
  return (
    <ul className="xfh-avisos" aria-label="Avisos de esta pieza">
      {visibles.map((a) => (
        <li key={a.id} className={`xfh-aviso is-${a.level}`}>
          {a.level === "error" ? <CircleAlert size={15} aria-hidden="true" /> : <TriangleAlert size={15} aria-hidden="true" />}
          <div>
            <b>{a.title}</b>
            {a.detail ? <p>{a.detail}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
