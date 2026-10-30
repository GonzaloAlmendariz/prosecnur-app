import { useLocation, useNavigate } from "react-router-dom";
import { fmt } from "../formato";
import { useResumenDelCorte } from "../navegacion/resumenDelCorte";
import { VacioDeBloque } from "../piezas/AvisoDeTarjeta";
import "../embudoDeCorte.css";

/**
 * El embudo de Avance contado por respuestas: las que llegaron, las que cruzan
 * con las bases y las que cuentan. El de antes sumaba el padrón y las
 * respuestas en una sola cifra («45 956 recibidas», «−836 fuera del
 * universo»); Gonzalo pidió contarlo sólo por respuestas (29/10/2026). Las
 * cifras son las de Control › Respuestas, y cada merma lleva a revisarla.
 */
export function EmbudoDeRespuestas() {
  const embudo = useResumenDelCorte((estado) => estado.embudo);
  const fallaron = useResumenDelCorte((estado) => estado.casosFallaron);
  const navigate = useNavigate();
  const location = useLocation();

  const irA = (direccion: string) => {
    const params = new URLSearchParams(location.search);
    for (const [clave, valor] of new URLSearchParams(direccion)) params.set(clave, valor);
    params.delete("panel");
    navigate({ pathname: location.pathname, search: `?${params.toString()}` });
  };

  if (!embudo) {
    if (fallaron) return null;
    return <VacioDeBloque vacio="cargando" icono={null} titulo="Contando las respuestas del corte." descripcion="El embudo llega con los casos." />;
  }

  const pasos = [
    { key: "ingesta", label: "Respuestas", value: embudo.recibidas, hint: "llegaron de las encuestas" },
    { key: "procesable", label: "Cruzan", value: embudo.cruzan, hint: "están en las bases de envío" },
    { key: "oficial", label: "Efectivas", value: embudo.efectivas, hint: "cuentan como avance" },
  ];
  const mermas = [
    { clave: "sin-llave", valor: embudo.sinLlave, regla: "llegaron sin llave (pruebas o enlace sin id)", direccion: "seccion=control&pestana=respuestas" },
    { clave: "sin-cruce", valor: embudo.sinCruce, regla: "traen una llave que no está en las bases", direccion: "seccion=control&pestana=resolver" },
    { clave: "no-cuentan", valor: embudo.noCuentan, regla: "cruzan pero no cuentan: parciales, rechazos o repetidas", direccion: "seccion=control&pestana=respuestas" },
  ].filter((merma) => merma.valor > 0);

  return (
    <section className="mon-acr-embudo is-avance" aria-label="Embudo de las respuestas del corte">
      <ol className="mon-acr-embudo-pasos">
        {pasos.map((paso, index) => (
          <li key={paso.key} className={`is-${paso.key}`}>
            <strong>{fmt(paso.value)}</strong>
            <em>{paso.label}</em>
            <small>{paso.hint}</small>
            {index < pasos.length - 1 ? <i aria-hidden="true" /> : null}
          </li>
        ))}
      </ol>
      {mermas.length ? (
        <ul className="mon-acr-embudo-mermas" aria-label="Respuestas que no llegan al avance">
          {mermas.map((merma) => (
            <li key={merma.clave}>
              <button type="button" onClick={() => irA(merma.direccion)} title="Ver estas respuestas">
                <strong>&minus;{fmt(merma.valor)}</strong>
                <span>{merma.regla}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
