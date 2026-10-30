import { fmt } from "../formato";
import { Minibarras } from "./graficosDeAvance";
import type { RitmoDePublico } from "./ritmoPorPublicoModelo";
import "./ritmoPorPublico.css";

const UNA_DECIMAL = (valor: number) => valor.toLocaleString("es-PE", { maximumFractionDigits: 1 });

/** «la última semana», o «los últimos 2 días» mientras el campo no cumple siete. */
function ventana(item: RitmoDePublico) {
  if (item.diasDelPromedio >= 7) return "la última semana";
  return item.diasDelPromedio === 1 ? "su único día" : `los últimos ${item.diasDelPromedio} días`;
}

function Proyeccion({ item }: { item: RitmoDePublico }) {
  if (item.meta == null) return <span className="acr-av-chip">Sin meta</span>;
  if (item.faltan === 0) return <span className="acr-av-chip is-cumple">Meta cumplida</span>;
  if (item.diasALaMeta == null) return <span className="acr-av-chip is-falta" title="Sin efectivas en los últimos siete días">Sin ritmo</span>;
  return <span className="acr-av-chip" title={`Al ritmo de ${UNA_DECIMAL(item.promedio7)} efectivas diarias de ${ventana(item)}`}>{`≈ ${fmt(item.diasALaMeta)} ${item.diasALaMeta === 1 ? "día" : "días"}`}</span>;
}

/**
 * Una tarjeta por público, con el color de su capa en el apilado: efectivas
 * frente a la meta, sus últimos 14 días y a qué ritmo llega. Los más lejos de
 * su meta van primero.
 */
export function RitmoPorPublico({ publicos }: { publicos: readonly RitmoDePublico[] }) {
  if (!publicos.length) return null;
  return (
    <section className="acr-av-panel acr-rp" aria-label="Ritmo por público">
      <header className="acr-av-panel-cabecera">
        <h3>Ritmo por público <span className="acr-av-tenue">{`Últimos 14 días y días a la meta al ritmo de ${publicos[0] ? ventana(publicos[0]) : "la última semana"}`}</span></h3>
      </header>
      <ul className="acr-rp-grilla" data-qa-geometry-group="acreditacion-ritmo-publicos" data-qa-geometry-contract="equal">
        {publicos.map((item) => {
          const avance = item.meta ? Math.min(100, (item.efectivas / item.meta) * 100) : 0;
          return (
            <li key={item.publico} className={`acr-rp-publico is-capa-${item.capa}`} data-qa-geometry-member>
              <div className="acr-rp-linea">
                <b className="acr-rp-nombre"><i className={`acr-av-capa-muestra is-capa-${item.capa}`} aria-hidden="true" />{item.publico}</b>
                <Proyeccion item={item} />
              </div>
              <div className="acr-rp-cifra">
                <b className="acr-av-num">{fmt(item.efectivas)}</b>
                <span className="acr-av-tenue">{item.meta != null ? `de ${fmt(item.meta)}` : "efectivas"}</span>
              </div>
              {item.meta != null ? <span className="acr-av-pista"><i style={{ width: `${avance}%` }} /></span> : null}
              <div className="acr-rp-pie">
                <Minibarras valores={item.ultimos} etiqueta={`Efectivas de ${item.publico} en los últimos 14 días`} />
                <small className="acr-av-tenue">{`${UNA_DECIMAL(item.promedio7)} por día`}</small>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
