import { Check } from "lucide-react";

import { PASOS_MARCO, type PasoMarco } from "./modeloMarco";

/**
 * Los cuatro pasos del marco repartidos a lo ancho: el círculo lleva el check si el paso está hecho y el número si
 * no; la línea hasta el siguiente se llena cuando el paso quedó atrás. Un paso aún no disponible no se puede pulsar.
 */
export function PasosDelMarco({ actual, disponible, onIr, etiqueta }: {
  actual: PasoMarco;
  disponible: (indice: number) => boolean;
  onIr: (paso: PasoMarco) => void;
  etiqueta: string;
}) {
  const indice = PASOS_MARCO.findIndex((p) => p.id === actual);
  return (
    <nav className="cmmp-pasos" aria-label={etiqueta}>
      <ol>
        {PASOS_MARCO.map((p, k) => {
          const estado = k < indice ? "hecho" : k === indice ? "actual" : "pendiente";
          const libre = disponible(k);
          return (
            <li key={p.id} data-estado={estado}>
              <button
                type="button"
                aria-current={estado === "actual" ? "step" : undefined}
                disabled={!libre || estado === "actual"}
                title={libre ? undefined : "Completa los pasos anteriores."}
                onClick={() => onIr(p.id)}
              >
                <span className="cmmp-paso-circulo" aria-hidden="true">{estado === "hecho" ? <Check size={13} /> : k + 1}</span>
                <span className="cmmp-paso-rotulo">{p.rotulo}</span>
              </button>
              {k < PASOS_MARCO.length - 1 ? <span className="cmmp-paso-linea" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
