// Cabecera de Equivalencias y su esqueleto de lectura (ronda de pulido, P-A8).
//
// La lectura inicial trae la declaración y el catálogo de variables de cada
// base. Mientras llegan, la superficie conserva su marco (C2): la misma
// cabecera, el orden de la serie, la cabecera de la tabla y sus filas, en
// gris. Antes era una frase suelta, «Revisando la declaración del estudio…»,
// que ni ocupaba el lugar de la tabla ni retenía la readiness.

import { GitCompare } from "../../vendor/lucide-react";
import "./EquivalenciasEsqueleto.css";

/** Título, explicación y «¿Qué es armonizar?»: igual cargando que cargada. */
export function EquivalenciasTitulo() {
  return (
    <div className="pulso-equiv-title">
      <GitCompare size={18} aria-hidden="true" />
      <div>
        <strong>La misma pregunta en cada base</strong>
        <small>
          Cada base nombra sus variables a su manera. Aquí declaras cuál es la misma
          pregunta en cada una y, si sus respuestas usan códigos distintos, las armonizas.
        </small>
        {/* U1: «armonizar» se explica donde aparece, con un ejemplo y no con
            una definición. Plegado por defecto: quien ya lo sabe no lo relee. */}
        <details className="pulso-equiv-que-es">
          <summary>¿Qué es armonizar?</summary>
          <p>
            Es poner las respuestas de todas las bases en una misma escala. Por ejemplo, una
            base codifica «No sabe» como 0 y otra como 99. Armonizar es declarar que las dos son
            la misma respuesta, para que la comparación cuente lo mismo.
          </p>
          <p>
            Se hace pregunta por pregunta desde la marca «Sin armonizar» o «Armonizada» que
            acompaña a cada tema. Solo las preguntas armonizadas entran a los comparativos de
            Analítica.
          </p>
        </details>
      </div>
    </div>
  );
}

/** Cuántas columnas de base y filas dibuja el esqueleto. No es un dato: es forma. */
const COLUMNAS_DE_BASE = 3;
const FILAS = 8;

export function EquivalenciasEsqueleto() {
  return (
    <section
      className="pulso-equiv"
      aria-label="Equivalencias entre bases"
      aria-busy="true"
      // Transitorio: la reemplaza la superficie al terminar la lectura, con
      // datos, vacía o con su error (FALSE_TRANSITORIO en readinessAnidada).
      data-audit-ready="false"
      data-qa-geometry-group="carga-equivalencias"
      data-qa-geometry-contract="intrinsic"
    >
      <header className="pulso-equiv-head" data-qa-geometry-member>
        <EquivalenciasTitulo />
        <div className="pulso-equiv-actions" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="pulso-equiv-esq-boton pulso-equiv-esq-brillo" />
          ))}
        </div>
      </header>

      <div
        className="pulso-equiv-cuerpo"
        data-qa-geometry-member
        data-qa-geometry-capacity="owned"
        data-surface-contract="carga-equivalencias"
      >
        <p className="pulso-sr-only" role="status">Revisando la declaración del estudio…</p>
        <div className="pulso-equiv-esq" aria-hidden="true">
          <div className="pulso-equiv-esq-serie">
            <span className="pulso-equiv-esq-rotulo pulso-equiv-esq-brillo" />
            {Array.from({ length: COLUMNAS_DE_BASE }, (_, i) => (
              <span key={i} className="pulso-equiv-esq-chip pulso-equiv-esq-brillo" />
            ))}
          </div>
          <div className="pulso-equiv-esq-tabla">
            <div className="pulso-equiv-esq-fila is-cabecera">
              <span className="pulso-equiv-esq-brillo" />
              {Array.from({ length: COLUMNAS_DE_BASE }, (_, i) => (
                <span key={i} className="pulso-equiv-esq-brillo" />
              ))}
              <span className="pulso-equiv-esq-brillo" />
            </div>
            {Array.from({ length: FILAS }, (_, fila) => (
              <div key={fila} className="pulso-equiv-esq-fila">
                <span className="pulso-equiv-esq-brillo is-tema" />
                {Array.from({ length: COLUMNAS_DE_BASE }, (_, i) => (
                  <span key={i} className="pulso-equiv-esq-brillo" />
                ))}
                <span className="pulso-equiv-esq-brillo is-corto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
