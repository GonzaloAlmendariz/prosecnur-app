/**
 * La distribución de la pregunta revisada (prototipo `pp-v-graf`,
 * `vistas.js:191`): el histograma con el límite de la regla marcado y su
 * rótulo, los tramos que caen fuera del límite en el tono del hallazgo, el eje
 * y, debajo, "Mediana", "La mitad central", "Más alto" y "Respondieron".
 *
 * Los tramos son los de Explorar (misma lectura). El límite sale del catálogo
 * (`limites`); sin límite numérico la vista dibuja la distribución sin marca.
 * Un tramo que el límite corta se tiñe solo en la parte que queda fuera, a la
 * altura del límite, como en el prototipo: no se atribuye al hallazgo lo que
 * está dentro del rango.
 */
import type { CSSProperties } from "react";
import { CargaDeBloque } from "../../../../components/CargaDeBloque";
import { ErrorBlock } from "../../../../components/States";
import { formatoConteo } from "../../../../lib/formatoNumero";
import type { LimitesDeRegla } from "../../../../api/validacionAuditoria";
import { fmtValor } from "../../tabs/explorar/explorarModelo";
import { numeroDe, partesFuera } from "../modeloHallazgos";
import type { LecturaDeDistribucion } from "../useDistribucion";

export function DistribucionDelHallazgo({
  lectura,
  limites,
  tono,
  etiqueta,
}: {
  lectura: LecturaDeDistribucion;
  limites: LimitesDeRegla | null;
  tono: "inconsistencia" | "revisar";
  etiqueta: string;
}) {
  if (lectura.fase === "inactiva") return null;
  if (lectura.fase === "cargando") {
    return (
      <div className="pulso-hz-grafico">
        <CargaDeBloque label="Leyendo la distribución" />
      </div>
    );
  }
  if (lectura.fase === "error") {
    return (
      <div className="pulso-hz-grafico">
        <ErrorBlock label="No se pudo leer la distribución" detail={lectura.mensaje} />
      </div>
    );
  }
  const num = lectura.num;
  if (!num || !num.bins.length) {
    return (
      <div className="pulso-hz-grafico">
        <p className="pulso-hz-nota">"{etiqueta}" no tiene valores numéricos que dibujar.</p>
      </div>
    );
  }
  const desde = Math.min(num.min, num.bins[0].desde);
  const hasta = Math.max(num.max, num.bins[num.bins.length - 1].hasta);
  const rango = hasta - desde || 1;
  const alto = Math.max(...num.bins.map((b) => b.n), 1);
  const min = numeroDe(limites?.min);
  const max = numeroDe(limites?.max);
  const fuera = (b: { desde: number; hasta: number }) => partesFuera(b, min, max).bajo + partesFuera(b, min, max).sobre > 0;
  const umbrales = [min, max].filter((u): u is number => u !== null && u > desde && u < hasta);
  const posicion = (v: number) => `${(((v - desde) / rango) * 100).toFixed(2)}%`;
  const rotuloDe = (u: number) => fmtValor(u);
  const nFuera = num.bins.filter(fuera).reduce((t, b) => t + b.n, 0);

  return (
    <div className="pulso-hz-grafico">
      <div
        className="pulso-hz-histograma"
        data-qa-geometry-group="validacion/hallazgos-histograma"
        data-qa-geometry-contract="intrinsic"
        role="img"
        aria-label={`Distribución de "${etiqueta}" en ${formatoConteo(num.bins.length)} tramos, de ${fmtValor(num.min)} a ${fmtValor(num.max)}${umbrales.length ? `; límite de la regla en ${umbrales.map(rotuloDe).join(" y ")}` : ""}${nFuera ? `; ${formatoConteo(nFuera)} fuera del límite` : ""}.`}
      >
        {num.bins.map((b, i) => (
          <span
            key={i}
            className="pulso-hz-tramo"
            data-fuera={fuera(b) ? tono : undefined}
            style={{
              "--pulso-hz-alto": `${Math.max((b.n / alto) * 100, b.n > 0 ? 3 : 0)}%`,
              "--pulso-hz-bajo": `${(partesFuera(b, min, max).bajo * 100).toFixed(1)}%`,
              "--pulso-hz-sobre": `${(100 - partesFuera(b, min, max).sobre * 100).toFixed(1)}%`,
            } as CSSProperties}
            title={`${fmtValor(b.desde)} a ${fmtValor(b.hasta)}: ${formatoConteo(b.n)} ${b.n === 1 ? "caso" : "casos"}`}
          />
        ))}
        {umbrales.map((u) => (
          <i key={u} className="pulso-hz-umbral" style={{ insetInlineStart: posicion(u) }}>
            <em>{rotuloDe(u)}</em>
          </i>
        ))}
      </div>
      <div className="pulso-hz-eje" aria-hidden="true">
        <span>{fmtValor(desde)}</span>
        <span>{fmtValor(desde + rango / 2)}</span>
        <span>{fmtValor(hasta)}</span>
      </div>
      <dl className="pulso-hz-resumen" data-qa-geometry-group="validacion/hallazgos-resumen" data-qa-geometry-contract="equal">
        <div data-qa-geometry-member="">
          <dt>Mediana</dt>
          <dd>{fmtValor(num.mediana)}</dd>
        </div>
        <div data-qa-geometry-member="">
          <dt>La mitad central</dt>
          <dd>{fmtValor(num.p25)} a {fmtValor(num.p75)}</dd>
        </div>
        <div data-qa-geometry-member="">
          <dt>Más alto</dt>
          <dd>{fmtValor(num.max)}</dd>
        </div>
        <div data-qa-geometry-member="">
          <dt>Respondieron</dt>
          <dd>
            {lectura.respondieron !== null ? formatoConteo(lectura.respondieron) : "Sin dato"}
            {lectura.total !== null ? ` de ${formatoConteo(lectura.total)}` : ""}
          </dd>
        </div>
      </dl>
    </div>
  );
}
