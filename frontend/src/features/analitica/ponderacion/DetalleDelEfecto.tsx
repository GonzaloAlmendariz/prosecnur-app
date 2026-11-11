// Bajo las cifras del efecto: qué hizo el recorte de pesos extremos y cuántos
// casos se imputaron por variable. Filas de rótulo y dato separadas por una línea.

import type { PonderPreview } from "../../../api/analitica";
import { formatoConteo, formatoDecimal, SIN_CIFRA } from "../../../lib/formatoNumero";
import { enumerar } from "../../../lib/enumerar";

const veces = (x: number | null | undefined) => (x != null && Number.isFinite(x) ? x.toFixed(2) : SIN_CIFRA);

export function DetalleDelEfecto({ preview, etiquetaDe }: {
  preview: PonderPreview;
  etiquetaDe: (variable: string) => string;
}) {
  const rec = preview.recorte ?? null;
  const imputadas = Object.entries(preview.imputacion?.variables ?? {})
    .filter(([, x]) => x.imputados > 0 || x.sin_donante > 0);
  if (!rec && imputadas.length === 0) return null;
  return (
    <>
      {rec ? (
        <dl className="pond-efecto-detalle" aria-label="Recorte de pesos extremos">
          <div>
            <dt>Recorte</dt>
            <dd>a {rec.cap} veces la media</dd>
          </div>
          <div>
            <dt>Mayor peso, en veces la media</dt>
            <dd>de {veces(rec.antes.max_sobre_media)} a {veces(rec.despues.max_sobre_media)}</dd>
          </div>
          <div>
            <dt>Recalibración</dt>
            <dd>
              {rec.modo === "recalibrar"
                ? enumerar([`${rec.ciclos} ${rec.ciclos === 1 ? "ciclo" : "ciclos"}`, !rec.convergio && "sin conciliar"])
                : "Sin recalibrar"}
            </dd>
          </div>
          {/* Sin variables de ajuste aplicadas el motor fija el desvío en 0: no es un margen que se cumple. */}
          {preview.rake_applied ? (
            <div data-pond-desvio="" title={`Tolerancia: ${formatoDecimal(rec.tol_margen * 100, 1)} puntos porcentuales.`}>
              <dt>Desvío máximo de margen</dt>
              <dd>{(rec.max_desvio_margen * 100).toFixed(2)} puntos porcentuales</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {imputadas.length > 0 ? (
        <dl className="pond-efecto-detalle" aria-label="Casos imputados por variable">
          {imputadas.map(([nombre, x]) => (
            <div key={nombre} data-pond-imputada={nombre} title={`Semilla ${preview.imputacion?.semilla}.`}>
              <dt>Imputados en {etiquetaDe(nombre)}</dt>
              <dd>
                {enumerar([
                  `${formatoConteo(x.imputados)} ${x.imputados === 1 ? "caso" : "casos"}`,
                  `${formatoDecimal(x.pct * 100, 1)} % sin dato`,
                  x.sin_donante > 0 && `${formatoConteo(x.sin_donante)} sin donante`,
                ])}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </>
  );
}
