import { fmt } from "./kpisDeAulas";
import { UMBRAL_DE_RIESGO } from "./agendamiento";

/**
 * Cuántas llamadas cuesta cerrar un aula, y cuántas están en la cola cara.
 *
 * La agenda publicaba la **mediana** de gestiones y con ella dos tiles —«cuestan
 * más de una» y «van por la tercera»—, pero la mediana dice dónde está el centro
 * y **esconde la cola**, que es donde vive el riesgo: en el campo de 2025 la
 * mediana fue 2 y aun así **33 aulas de 170 llegaron a la cuarta llamada o más**.
 *
 * El corte no es decorativo ni elegido: de las aulas cerradas en una o dos
 * gestiones se cayó el **17-19 %**, y de la tercera en adelante el **36-38 %**.
 * Por eso las barras cambian de tono ahí y la marca lleva el número.
 */

export function AulasGestionesPorAula({ distribucion }: {
  distribucion: ReadonlyArray<{ gestiones: number; aulas: number; enRiesgo: boolean }>;
}) {
  // Sin ninguna gestión anotada no hay HISTOGRAMA que dibujar: una sola barra en
  // cero se leería como «todas salen a la primera», que es lo contrario de lo
  // que pasa cuando nadie apuntó nada.
  //
  // Pero devolver `null` dejaba a su panel con sólo el encabezado, y el runner
  // lo contaba a él como el contenedor de datos del grupo
  // `monitoring-aulas-table`: `capacity-drift` con 5 px de interior muerto,
  // medido en `modelo/agenda` sobre el proyecto derivado. Es el mismo defecto
  // que ya estaba documentado en `AulasControlDelLibro` —con datos el grupo iba
  // verde y el fallo sólo existía en el estado vacío—, así que el vacío vive
  // dentro de la caja y dice de dónde saldría el dato (C3).
  if (!distribucion.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        Todavía no hay gestiones anotadas. Se llenan desde el registro de campo,
        cuando el equipo apunta cuántas llamadas costó cerrar cada curso-horario.
      </p>
    );
  }

  const tope = Math.max(...distribucion.map((d) => d.aulas), 1);
  const enRiesgo = distribucion.filter((d) => d.enRiesgo).reduce((n, d) => n + d.aulas, 0);
  const total = distribucion.reduce((n, d) => n + d.aulas, 0);

  return (
    <details className="aulas-gestiones aulas-gestiones-detalle"
      data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      {/* **Plegado por defecto, y la cifra que decide en el resumen.** La
          sección es de política `viewport`: sus paneles se reparten el alto, así
          que un panel nuevo abierto le quita sitio a los demás —medido: dejó la
          franja de días del panel vecino en 0 px—. Cerrado no se pierde nada,
          porque el resumen lleva el número; la forma se abre cuando se quiere
          mirar la cola. */}
      <summary className="aulas-gestiones-lectura">
        <strong>{fmt(enRiesgo)}</strong> de {fmt(total)} cursos-horario con gestión anotada van
        por la {UMBRAL_DE_RIESGO}.ª llamada o más
        <small>
          en 2025 ésas se cayeron el doble que las cerradas en una o dos
        </small>
      </summary>
      {/* Las cifras de cada barra van en su propia etiqueta, así que la
          geometría es refuerzo y no la única forma de leerlas. */}
      <ol className="aulas-gestiones-barras">
        {distribucion.map((d) => (
          <li key={d.gestiones} className={d.enRiesgo ? "es-riesgo" : undefined}>
            <span className="aulas-gestiones-barra" aria-hidden="true">
              <i style={{ height: `${(100 * d.aulas) / tope}%` }} />
            </span>
            <span className="aulas-gestiones-n">{fmt(d.aulas)}</span>
            <span className="aulas-gestiones-x">{d.gestiones}</span>
          </li>
        ))}
      </ol>
      <p className="mon-profile-muted aulas-gestiones-pie">
        Llamadas hasta cerrar el curso-horario. A partir de la {UMBRAL_DE_RIESGO}.ª el curso-horario
        se cae el doble de veces, y eso se sabe antes de que se caiga.
      </p>
    </details>
  );
}
