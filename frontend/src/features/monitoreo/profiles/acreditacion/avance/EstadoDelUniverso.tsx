import { pctConEspacio } from "../../../core/formatoComun";
import { fmt } from "../formato";
import type { TotalesDeAvance } from "./avanceModelo";

type Estado = { clave: "efectiva" | "parcial" | "rechazo" | "sin-respuesta"; etiqueta: string; valor: number };

export function estadosDelUniverso(totales: Pick<TotalesDeAvance, "efectivas" | "parciales" | "rechazos" | "sinRespuesta">): Estado[] {
  return [
    { clave: "efectiva", etiqueta: "Efectivas", valor: totales.efectivas },
    { clave: "parcial", etiqueta: "Parciales", valor: totales.parciales },
    { clave: "rechazo", etiqueta: "Rechazos", valor: totales.rechazos },
    { clave: "sin-respuesta", etiqueta: "Sin respuesta", valor: totales.sinRespuesta },
  ];
}

/** Barra apilada del universo con su leyenda de cifras (G10: colores por luminosidad). */
export function EstadoDelUniverso({ totales }: { totales: TotalesDeAvance }) {
  const estados = estadosDelUniverso(totales);
  const universo = Math.max(1, estados.reduce((suma, estado) => suma + estado.valor, 0));
  return (
    <div className="acr-av-universo">
      <div className="acr-av-apilada is-alta" role="img" aria-label={estados.map((estado) => `${estado.etiqueta}: ${fmt(estado.valor)}`).join("; ")}>
        {estados.map((estado) => (estado.valor > 0 ? (
          <span key={estado.clave} className={`is-${estado.clave}`} style={{ flexGrow: estado.valor }} />
        ) : null))}
      </div>
      <div className="acr-av-universo-leyenda" data-qa-geometry-group="acreditacion-universo-estados" data-qa-geometry-contract="equal">
        {estados.map((estado) => (
          <div key={estado.clave} className="acr-res-kpi" data-qa-geometry-member>
            <small><i className={`acr-av-punto is-${estado.clave}`} aria-hidden="true" />{estado.etiqueta}</small>
            <b className="acr-av-num">{fmt(estado.valor)}</b>
            <small>{pctConEspacio((estado.valor / universo) * 100)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
