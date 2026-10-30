import { Fragment } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { pctConEspacio } from "../../../core/formatoComun";
import { fmt } from "../formato";
import { useResumenDelCorte } from "../navegacion/resumenDelCorte";
import { VacioDeBloque } from "../piezas/AvisoDeTarjeta";
import "./embudoDeRespuestas.css";

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

  const base = Math.max(1, embudo.recibidas);
  const pasos = [
    { key: "ingesta", label: "Respuestas", value: embudo.recibidas, hint: "llegaron de las encuestas" },
    { key: "procesable", label: "Cruzan", value: embudo.cruzan, hint: "están en las bases de envío" },
    { key: "oficial", label: "Efectivas", value: embudo.efectivas, hint: "cuentan como avance" },
  ];
  // Cada merma va en el tramo donde se pierde, no en una fila suelta debajo
  // (Gonzalo, 30/10: el embudo «podría verse mejor»).
  const tramos = [
    [
      { clave: "sin-llave", valor: embudo.sinLlave, regla: "sin llave (pruebas o enlace sin id)", direccion: "seccion=control&pestana=respuestas" },
      { clave: "sin-cruce", valor: embudo.sinCruce, regla: "con llave fuera de las bases", direccion: "seccion=control&pestana=resolver" },
    ],
    [
      { clave: "no-cuentan", valor: embudo.noCuentan, regla: "parciales, rechazos o repetidas", direccion: "seccion=control&pestana=respuestas" },
    ],
  ].map((mermas) => mermas.filter((merma) => merma.valor > 0));

  return (
    <section className="acr-emb" aria-label="Embudo de las respuestas del corte">
      {pasos.map((paso, index) => {
        const mermas = tramos[index] ?? [];
        const perdidas = mermas.reduce((suma, merma) => suma + merma.valor, 0);
        return (
          <Fragment key={paso.key}>
            <div className={`acr-emb-paso is-${paso.key}`}>
              <span className="acr-emb-rotulo">{paso.label}</span>
              <b className="acr-av-num">{fmt(paso.value)}</b>
              <span className="acr-emb-pista" aria-hidden="true"><i style={{ width: `${Math.min(100, (paso.value / base) * 100)}%` }} /></span>
              <small title={paso.hint}>{index === 0 ? paso.hint : `${pctConEspacio((paso.value / base) * 100)} de las respuestas`}</small>
            </div>
            {index < pasos.length - 1 ? (
              <div className="acr-emb-tramo" aria-label={`Se pierden ${fmt(perdidas)} entre ${paso.label} y ${pasos[index + 1].label}`}>
                <span className="acr-emb-flecha" aria-hidden="true" />
                {perdidas > 0 ? <b className="acr-av-num">&minus;{fmt(perdidas)}</b> : <span className="acr-av-tenue">sin pérdidas</span>}
                {mermas.map((merma) => (
                  <button key={merma.clave} type="button" className="acr-emb-merma" onClick={() => irA(merma.direccion)} title="Ver estas respuestas">
                    <span className="acr-av-num">{fmt(merma.valor)}</span> {merma.regla}
                  </button>
                ))}
              </div>
            ) : null}
          </Fragment>
        );
      })}
    </section>
  );
}
