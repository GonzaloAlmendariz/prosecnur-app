/**
 * Paso 0 de «Cursos-horario requeridos»: qué se busca.
 *
 * Gonzalo, textual: «hasta ahora siempre resuelves el universo, siempre
 * resuelves los elegibles, pero nunca resuelves la muestra objetivo y la
 * sobremuestra operativa, y ese valor es como muy necesario para hacer el
 * resto de cálculo y toda la selección, y no lo veo hasta ahora en la
 * interfaz».
 *
 * La pestaña arrancaba en los elegibles y saltaba directo a la tasa que
 * «convierte cuota en titulares», sin decir nunca de dónde sale esa cuota. Es
 * la sobremuestra operativa repartida entre las facultades: el número que
 * gobierna todo lo que viene después. Acá se declara, y si todavía no está
 * resuelto se dice dónde se resuelve en vez de dejar la cadena muda.
 */
import { fmtInt } from "../../sharedCore";
import { muestraOperativa, type ComponenteConResultado } from "./muestraOperativaModel";
import "./muestraOperativa.css";

export function MuestraOperativaCard({
  comp,
  onIrACalculo,
}: {
  comp: ComponenteConResultado | null;
  /** Lleva a Propuestas, donde se fija la muestra y se calcula. */
  onIrACalculo?: () => void;
}) {
  const m = muestraOperativa(comp);

  if (!m.listo) {
    return (
      <section className="cmv2-generales-card cmv2-muop" aria-label="Muestra objetivo y sobremuestra operativa">
        <header>
          <strong>Qué se busca: la muestra objetivo y la sobremuestra operativa</strong>
          <span>de este número sale la cuota de cada facultad, y de la cuota salen los titulares</span>
        </header>
        <p className="cmv2-muop-falta" role="note">
          Todavía sin resolver.
          {m.nFormula != null
            ? ` La fórmula ya dio ${fmtInt(m.nFormula)} respuestas; falta fijar la muestra y calcular.`
            : " Se fija en Propuestas, a partir del diseño."}
          {onIrACalculo && (
            <button type="button" className="cmv2-muop-ir" onClick={onIrACalculo}>
              Ir a Propuestas
            </button>
          )}
        </p>
      </section>
    );
  }

  return (
    <section className="cmv2-generales-card cmv2-muop" aria-label="Muestra objetivo y sobremuestra operativa">
      <header>
        <strong>Qué se busca: la muestra objetivo y la sobremuestra operativa</strong>
        <span>de este número sale la cuota de cada facultad, y de la cuota salen los titulares</span>
      </header>
      <ol className="cmv2-muop-cadena">
        {m.nFormula != null && (
          <li className="cmv2-muop-paso" data-tono="soft">
            <b>{fmtInt(m.nFormula)}</b>
            <small>pide la fórmula</small>
          </li>
        )}
        <li className="cmv2-muop-paso" data-tono="clave">
          <b>{fmtInt(m.nObjetivo!)}</b>
          <small>muestra objetivo</small>
        </li>
        {m.sobremuestra != null && (
          <li className="cmv2-muop-paso" data-tono="soft">
            <b>
              +{fmtInt(m.sobremuestra)}
              {m.sobremuestraPct != null && (
                <i> ({Math.round(m.sobremuestraPct * 100)} %)</i>
              )}
            </b>
            <small>sobremuestra</small>
          </li>
        )}
        <li className="cmv2-muop-paso" data-tono="destino">
          <b>{fmtInt(m.nOperativo!)}</b>
          <small>operativa · se sale a buscar</small>
        </li>
      </ol>
      <p className="cmv2-muop-pie">
        Las <b>{fmtInt(m.nOperativo!)}</b> respuestas operativas se reparten entre las facultades en
        proporción a su población: eso es la cuota de cada una.
      </p>
    </section>
  );
}
