import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "../../../vendor/lucide-react";
import {
  etiquetaEstado,
  type MonitoreoCorte,
  type MonitoreoSalidaReadiness,
} from "../corte/corteContract";

function fmt(value: number | null, ausente = "S/D") {
  if (value == null) return ausente;
  return value.toLocaleString("es-PE");
}

/**
 * Bloque de readiness del panel de salidas.
 *
 * La auditoría encontró `ESTADO Pendiente` y `EFECTIVAS S/D` conviviendo con
 * botones de PDF habilitados: el panel mostraba su estado y sus acciones como si
 * fueran cosas independientes. Acá el estado *es* la explicación de qué acciones
 * están disponibles, y cada bloqueo lleva su propia salida hacia la causa.
 */
export function MonitoreoOutputsReadiness({
  corte,
  readiness,
}: {
  corte: MonitoreoCorte;
  readiness: MonitoreoSalidaReadiness;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const irA = (direccion?: string) => {
    if (!direccion) return;
    const params = new URLSearchParams(location.search);
    for (const [clave, valor] of new URLSearchParams(direccion)) params.set(clave, valor);
    const query = params.toString();
    navigate({ pathname: location.pathname, search: query ? `?${query}` : "" });
  };

  return (
    <section
      className={`mon-outputs-readiness is-${readiness.estado}`}
      aria-label="Estado del corte para publicar"
    >
      <header className="mon-outputs-readiness__head">
        <span className="mon-outputs-readiness__badge">
          {readiness.puedePublicarCliente ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {etiquetaEstado(readiness.estado)}
        </span>
        <strong>
          {readiness.puedePublicarCliente
            ? "El corte puede publicarse a cliente"
            : "El corte todavía no puede publicarse a cliente"}
        </strong>
      </header>

      <dl className="mon-outputs-readiness__granos" aria-label="Granos del corte">
        <div>
          {/* «Snapshot» es vocabulario de la implementación; quien dirige el
              estudio piensa en respuestas que llegaron. */}
          <dt>Recibidas</dt>
          <dd>{fmt(corte.ingesta)}</dd>
          <small>llegaron de las fuentes</small>
        </div>
        <div>
          <dt>Procesables</dt>
          <dd>{fmt(corte.procesable)}</dd>
          <small>pasan el filtro</small>
        </div>
        <div className="is-oficial">
          <dt>Válidas</dt>
          <dd>{fmt(corte.oficial, "sin determinar")}</dd>
          <small>{corte.meta != null ? `meta ${fmt(corte.meta)}` : "sin meta declarada"}</small>
        </div>
      </dl>

      {corte.saltos.length ? (
        <ul className="mon-outputs-readiness__saltos" aria-label="Por qué bajan los conteos">
          {corte.saltos.map((salto) => (
            <li key={`${salto.de}-${salto.a}`}>
              <strong>−{fmt(salto.descartados)}</strong>
              <span>{salto.regla}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {readiness.bloqueos.length ? (
        <ul className="mon-outputs-readiness__bloqueos" aria-label="Qué falta para publicar">
          {readiness.bloqueos.map((bloqueo) => (
            <li key={bloqueo.codigo}>
              <AlertTriangle size={13} />
              <span>{bloqueo.mensaje}</span>
              {bloqueo.direccion ? (
                <button type="button" onClick={() => irA(bloqueo.direccion)}>
                  Ir a la causa <ArrowRight size={12} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
