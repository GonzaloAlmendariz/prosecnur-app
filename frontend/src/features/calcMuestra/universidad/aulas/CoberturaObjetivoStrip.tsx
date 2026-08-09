/**
 * Veredicto de la selección: ¿los titulares cubren la muestra objetivo?
 *
 * Va arriba del todo en la pestaña de selección, antes del mapa y de la tabla,
 * porque es la pregunta que se hace quien abre esa pantalla. Las cifras de
 * abajo (score, exposición, pérdida por repetidos) explican el veredicto; no
 * lo reemplazan.
 */
import { fmtInt } from "../../sharedCore";
import type { CoberturaObjetivo } from "./coberturaObjetivoModel";
import "./coberturaObjetivo.css";

const PCT = new Intl.NumberFormat("es-PE", {
  style: "percent",
  maximumFractionDigits: 0,
});

const TITULO: Record<CoberturaObjetivo["estado"], string> = {
  sin_datos: "Cobertura sin medir",
  corta: "Los titulares no llegan a la muestra objetivo",
  justa: "Los titulares llegan justo",
  holgada: "Los titulares cubren la muestra objetivo",
};

export function CoberturaObjetivoStrip({ cobertura }: { cobertura: CoberturaObjetivo }) {
  const { cubiertos, objetivo, ratio, estado, facultadesCortas } = cobertura;

  return (
    <section
      className="cmv2-cobertura-objetivo"
      data-estado={estado}
      role="status"
      aria-label="Cobertura de la muestra objetivo"
      data-qa-geometry-group="calc-muestra/cobertura-objetivo"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="cmv2-cobertura-objetivo-titulo" data-qa-geometry-member>
        <strong>{TITULO[estado]}</strong>
        {estado === "sin_datos" ? (
          <span>
            El motor no publicó estudiantes únicos para esta selección; sin esa cifra la cobertura
            no se puede afirmar.
          </span>
        ) : (
          <span>
            {fmtInt(cubiertos ?? 0)} estudiantes distintos en los titulares frente a{" "}
            {fmtInt(objetivo ?? 0)} de muestra objetivo.
            {estado === "justa" &&
              " Sin margen: un aula que no se pueda aplicar deja la cuota corta."}
            {estado === "corta" &&
              " Los reemplazos no son contingencia acá: hacen falta desde el primer día."}
          </span>
        )}
      </div>

      {ratio != null && (
        <div className="cmv2-cobertura-objetivo-cifra" data-qa-geometry-member>
          <strong>{PCT.format(ratio)}</strong>
          <small>de la muestra objetivo</small>
        </div>
      )}

      {facultadesCortas.length > 0 && (
        <p className="cmv2-cobertura-objetivo-facultades" data-qa-geometry-member>
          Según la certeza medida en Cálculo, estas facultades no sostienen su cuota:{" "}
          <strong>{facultadesCortas.join(", ")}</strong>.
        </p>
      )}
    </section>
  );
}
