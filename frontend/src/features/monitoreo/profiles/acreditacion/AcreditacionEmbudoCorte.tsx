import { useLocation, useNavigate } from "react-router-dom";
import type { MonitoreoCorte } from "../../corte/corteContract";

/**
 * Embudo de efectividad del corte, visible desde cualquier sección.
 *
 * Una efectiva de acreditación no es "una respuesta más": es una respuesta
 * **completa**, con **consentimiento positivo**, que **cruza con la base real**
 * y que **sobrevive la deduplicación** (gana la de mayor duración). Las cuatro
 * compuertas son eliminatorias y el flujo no puede ser silencioso: el
 * entregable de un estudio de acreditación es un expediente defendible, y lo
 * primero que pregunta un comité es por qué entró cada caso y por qué no entró
 * el otro.
 *
 * La explicación correcta ya existía en la app, pero enterrada en la última
 * pestaña de la última sección (Avance › Salidas): el mismo `MonitoreoCorte`
 * con sus `saltos` y sus reglas. En el resto del módulo el número de efectivas
 * aparecía como un dato caído del cielo, repetido doce veces. Esto lo sube a la
 * franja de contexto.
 */
export function AcreditacionEmbudoCorte({ corte }: { corte: MonitoreoCorte }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Mismo patrón de navegación que MonitoreoOutputsReadiness: la dirección del
  // salto se mezcla con la query vigente para no perder el resto del contexto.
  const irA = (direccion?: string) => {
    if (!direccion) return;
    const params = new URLSearchParams(location.search);
    for (const [clave, valor] of new URLSearchParams(direccion)) params.set(clave, valor);
    const query = params.toString();
    navigate({ pathname: location.pathname, search: query ? `?${query}` : "" });
  };

  // Sin corte procesable u oficial no hay embudo que contar: se prefiere no
  // dibujar nada antes que inventar una compuerta con cero descartes.
  if (!corte.hasSnapshot || corte.procesable == null || corte.oficial == null) return null;

  const pasos = [
    { key: "ingesta", label: "Snapshot", value: corte.ingesta, hint: "registros crudos" },
    { key: "procesable", label: "Procesables", value: corte.procesable, hint: "cruzan la base" },
    { key: "oficial", label: "Efectivas", value: corte.oficial, hint: "cuentan como avance" },
  ];

  return (
    <section className="mon-acr-embudo" aria-label="Embudo de efectividad del corte">
      <ol className="mon-acr-embudo-pasos">
        {pasos.map((paso, index) => (
          <li key={paso.key} className={`is-${paso.key}`}>
            <strong>{paso.value.toLocaleString("es-PE")}</strong>
            <em>{paso.label}</em>
            <small>{paso.hint}</small>
            {index < pasos.length - 1 ? <i aria-hidden="true" /> : null}
          </li>
        ))}
      </ol>
      {corte.saltos.length ? (
        <ul className="mon-acr-embudo-mermas" aria-label="Casos descartados por compuerta">
          {corte.saltos.map((salto) => {
            const contenido = (
              <>
                <strong>&minus;{salto.descartados.toLocaleString("es-PE")}</strong>
                <span>{salto.regla}</span>
              </>
            );
            return (
              <li key={`${salto.de}-${salto.a}`}>
                {salto.direccion ? (
                  // Cada merma es navegable: el número solo sirve si se puede
                  // ir a ver quiénes son.
                  <button type="button" onClick={() => irA(salto.direccion)} title="Ver los casos descartados aquí">
                    {contenido}
                  </button>
                ) : (
                  <span className="mon-acr-embudo-merma-plana">{contenido}</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
