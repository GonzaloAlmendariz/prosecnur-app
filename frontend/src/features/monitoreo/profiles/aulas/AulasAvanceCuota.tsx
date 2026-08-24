import { COLOR_RESULTADO } from "../../coloresDeResultado";
import type { VistaDeAvanceCuota } from "./avanceCuota";
import { fmt } from "./kpisDeAulas";

/**
 * Cumplimiento contra la cuota de alumnos del DISEÑO, por facultad.
 *
 * Es la pregunta que «Cuota sexo por facultad» no contesta: aquella mide las
 * celdas del plan; ésta mide lo recogido contra lo que el cálculo de muestra
 * pidió, con titulares caídos y reservas incluidos. Todo viene agregado del
 * motor; este componente sólo pinta el view-model de `avanceCuota()`, que es
 * el mismo que alimenta el chip del encabezado —los dos no pueden discrepar—.
 *
 * Molde visual: la barra del total de `AulasCuotasResumen` y la lista por
 * facultad de `AulasPerfilPorFacultad`. Barras en CSS, sin Plotly, como el
 * resto de la sección; clases de las hojas ya importadas por la página.
 */


export function AulasAvanceCuota({ vista }: { vista: VistaDeAvanceCuota }) {
  const { total, filas } = vista;
  // El vacío es del panel y se clasifica (C2/C3): el marco lo pone la página y
  // aquí se dice POR QUÉ no hay barras, nunca se desaparece en silencio.
  // La MISMA estructura que el vacío del hermano «Cuota sexo por facultad»
  // (el aviso dentro de `.mon-profile-table-wrap`), y no un `p` suelto: las
  // reglas de encogimiento del perfil cuelgan de `.mon-profile-table-wrap
  // :has(> .mon-profile-muted)` —quitan el margen del `p`, ciñen el panel y
  // gobiernan el `min-height` del layout compacto—, y un hijo directo no las
  // hereda. Medido por el QA: 17 px de blanco a 1440 y 112 px como
  // `:last-child` a 1024x600, ambos capacity-drift contra `intrinsic`.
  if (vista.vacio !== null || !total) {
    return (
      // `owned` + `member` porque el alto residual del wrap vacío es capacidad
      // del layout compacto (min-height del perfil), no blanco muerto: es la
      // misma declaración con la que el contrato bendice el vacío del hermano.
      <div className="mon-profile-table-wrap" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <p className="mon-profile-muted">
          {vista.vacio ?? "El diseño no publicó metas para este estudio."}
        </p>
      </div>
    );
  }

  // Mismo semáforo que la cuota de sexo: verde al cerrar, ámbar a medio
  // camino, gris de arranque. Se decide con las cifras del motor, no se
  // recalcula nada.
  const tono = total.brecha === 0
    ? COLOR_RESULTADO.efectiva
    : total.avance >= 50 ? COLOR_RESULTADO.parcial : COLOR_RESULTADO.pendiente;

  return (
    <div className="aulas-cuotas-resumen">
      <div className="aulas-cuota-fila es-total">
        <span className="aulas-cuota-etiqueta"><span>{total.etiqueta}</span></span>
        <span className="aulas-cuota-pista" role="img" aria-label={total.aria}>
          <span style={{ width: `${total.relleno}%`, background: tono }} />
        </span>
        <span className="aulas-cuota-cifra">
          {total.brecha > 0 ? (
            <>
              <strong>{fmt(total.brecha)}</strong> por recoger
            </>
          ) : (
            <em className="es-cumplida">cuota cumplida</em>
          )}
        </span>
      </div>
      <p className="aulas-cuota-lectura">
        <strong>{fmt(total.validas)}</strong> de <strong>{fmt(total.cuota)}</strong> personas ·{" "}
        {/* SIN cap: pasarse de 100 es información, no un error de la barra. */}
        {total.avanceTexto}%
        {/* Las mermas no se ocultan: fuera de universo y sin aula del plan son
            respuestas que existieron y no cuentan aquí, y callarlas haría que
            esta cifra y la de Procesamiento parecieran contradecirse. */}
        {total.notas.length ? <em> · {total.notas.join(" · ")}</em> : null}
      </p>
      <div className="aulas-facultades">
        <p className="aulas-facultades-lectura">
          <strong>{fmt(filas.length)}</strong>{" "}
          {filas.length === 1 ? "facultad" : "facultades"} ·{" "}
          <strong>{fmt(vista.cumplidas)}</strong> con su cuota cumplida
          {vista.sinCuota ? <> · {fmt(vista.sinCuota)} sin cuota del diseño</> : null}
        </p>
        <ol className="aulas-facultades-lista" data-qa-geometry-capacity="owned" data-qa-geometry-member>
          {filas.map((f) => (
            <li key={f.clave} title={f.titulo || undefined}>
              <span className="aulas-facultad-nombre">
                {f.facultad}
                {/* Con espacio: sin él, el nombre y su cuenta se leen pegados
                    —«Derecho412 de 380»— en lectores de pantalla, el mismo
                    defecto que ya arregló el perfil por facultad. */}
                <em>{" "}{f.subtexto}</em>
              </span>
              <span
                className="aulas-facultad-carril"
                // El carril mide la cuota de la facultad contra la más alta:
                // una facultad grande a medias se ve distinta de una pequeña
                // vacía. Sin cuota no hay carril que pintar (ancho 0), no un
                // carril inventado.
                style={{ width: `${f.carril}%` }}
                role="img"
                aria-label={f.aria}
              >
                {f.cuota != null ? (
                  <i style={{ width: `${f.relleno}%`, background: COLOR_RESULTADO.efectiva }} />
                ) : null}
              </span>
              <span className="aulas-facultad-cifra">
                {f.cifra ? <strong>{f.cifra}</strong> : null}
                {f.cumplida ? (
                  <em className="es-cumplida">{f.lectura}</em>
                ) : (
                  <em>{f.cifra ? " " : ""}{f.lectura}</em>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
