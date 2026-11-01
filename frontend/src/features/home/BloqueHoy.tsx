// El bloque «hoy» del Home (L31): lo que cambió desde la última apertura de
// este proyecto en este equipo. El modelo y el almacenamiento viven en
// `desdeUltimaApertura.ts`.

import { useMemo } from "react";
import type { ProjectOverview } from "../../api/client";
import { formatoConteo } from "../../lib/formatoNumero";
import { History } from "../../vendor/lucide-react";
import {
  almacenDelEquipo,
  aperturaAnteriorDeLaSesion,
  claveDelProyecto,
  haceCuanto,
  leerHoy,
  type Cambio,
} from "./desdeUltimaApertura";

/** «+245 validadas en Monitoreo», «−3 casos por revisar en Monitoreo». */
export function textoDelCambio(cambio: Cambio): string {
  const delta = cambio.ahora - cambio.antes;
  const n = Math.abs(delta);
  return `${delta > 0 ? "+" : "−"}${formatoConteo(n)} ${n === 1 ? cambio.singular : cambio.etiqueta}`;
}

export function BloqueHoy({ overview }: { overview: ProjectOverview }) {
  const clave = claveDelProyecto(overview);
  // La apertura anterior se fija al montar; el overview que se recarga solo
  // sigue comparándose contra ella.
  const anterior = useMemo(
    () => (clave ? aperturaAnteriorDeLaSesion(clave, overview, almacenDelEquipo(), new Date()) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clave],
  );
  if (!clave) return null;
  const lectura = leerHoy(anterior, overview);

  return (
    <section className="home-hoy" aria-label="Desde tu última apertura">
      <span className="home-hoy-icono" aria-hidden="true">
        <History size={16} />
      </span>
      {lectura.tipo === "primera" ? (
        <p className="home-hoy-texto">
          <strong>Primera apertura en este equipo.</strong> La próxima vez verás aquí lo que cambió desde hoy.
        </p>
      ) : lectura.tipo === "sin-cambios" ? (
        <p className="home-hoy-texto">
          <strong>Sin cambios</strong> desde tu última apertura, {haceCuanto(lectura.desde, new Date())}.
        </p>
      ) : (
        <div className="home-hoy-texto">
          <strong>Desde tu última apertura, {haceCuanto(lectura.desde, new Date())}</strong>
          <ul className="home-hoy-cambios">
            {lectura.cambios.map((cambio) => (
              <li key={cambio.clave}>
                {textoDelCambio(cambio)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
