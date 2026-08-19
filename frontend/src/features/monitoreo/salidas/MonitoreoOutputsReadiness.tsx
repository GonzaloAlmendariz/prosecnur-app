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

  // Sólo cuando los tres granos están determinados Y coinciden. Con un
  // `oficial` en «sin determinar» no hay descarte conocido, que no es lo mismo
  // que no haber descarte.
  const sinDescartes = corte.procesable != null
    && corte.oficial != null
    && corte.ingesta === corte.procesable
    && corte.procesable === corte.oficial;

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
      ) : sinDescartes ? (
        /* La lista se llama «Por qué bajan los conteos» y, cuando no bajan,
           desaparecía: quedaban tres cifras idénticas sin nada que dijera si el
           filtro corrió y no perdió a nadie o si no había filtro que correr. En
           aulas las tres son 3 700 justamente porque la base no trae columna de
           estado —lo dice un control de Calidad, en otra pestaña—. Aquí no se
           explica el porqué, que es de cada estudio; se dice el hecho, que es lo
           que esta superficie puede afirmar. */
        <p className="mon-outputs-readiness__sin-saltos">
          Los tres granos traen la misma cifra: en este corte no se descarta ningún caso.
        </p>
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
