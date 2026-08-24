import { useMemo } from "react";

import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { avanceProyectado, celdasQuePidenAccion, type CeldaAvance } from "./avanceProyectado";
import { fmt } from "./kpisDeAulas";

/**
 * Si cada celda de cuota **va a llegar**, y si el campo se comporta como el
 * modelo dice.
 *
 * Es la lectura que le faltaba al perfil. El resumen de cuotas dice dónde
 * estás; éste dice si vas a llegar — y para cuando «ya no llegaste» es visible,
 * no queda nada que hacer. En 2025 la única celda incumplida fue EE.GG. Letras
 * hombres, con un sesgo de composición de +3,4 pp hacia mujeres que estuvo ahí
 * todo el campo sin que nadie pudiera verlo.
 *
 * **Es el único panel del perfil que manda a alguien a un aula**, así que va
 * separado de los referenciales y encabeza por lo que exige una decisión hoy.
 *
 * Ninguna frase se redacta aquí: vienen del motor, que es donde vive el test
 * anti-jerga. Con dos redacciones vivas del mismo estado, la pantalla acaba
 * diciendo dos cosas y ningún test lo ve.
 */

const TONO: Record<string, string> = {
  deficit_no_subsanable: COLOR_RESULTADO.pendiente,
  deficit_proyectado: COLOR_RESULTADO.pendiente,
  ajustada: COLOR_RESULTADO.parcial,
  asegurada: COLOR_RESULTADO.efectiva,
};

export function AulasAvanceProyectado({ celdas }: { celdas?: ReadonlyArray<CeldaAvance> | null }) {
  const filas = useMemo(() => avanceProyectado(celdas), [celdas]);
  const piden = celdasQuePidenAccion(filas);

  // **Nada verde por ausencia, pero un solo dueño del aviso.**
  //
  // La ausencia de celdas no significa que todo vaya bien: significa que no hay
  // con qué proyectar, y eso hay que decirlo. Pero ya lo dice `AulasCuotasResumen`
  // justo encima —«El plan no declara composición por sexo para estos
  // cursos-horario»— y verlo en la app lo dejó claro: la sección repetía el mismo
  // hecho cinco veces, entre los dos KPIs en «S/D» y tres párrafos casi
  // idénticos. Repetirlo una sexta no informa, tapa.
  //
  // Así que aquí se calla y el aviso queda donde ya vivía. Si algún día este
  // panel se monta sin ese vecino, hay que devolverle la frase: la regla es que
  // la ausencia se declare UNA vez, no ninguna.
  if (!filas.length) return null;

  return (
    <div className="aulas-avance-proyectado" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      {/* El titular dice cuántas piden decisión, no cuántas hay: el denominador
          a la vista y sin obligar a contar filas. Cero es cero, no «todo bien». */}
      <p className="aulas-avance-titular">
        {piden === 0
          ? `Ninguna de las ${fmt(filas.length)} celdas se queda corta con lo que falta por aplicar.`
          : `${fmt(piden)} de ${fmt(filas.length)} celdas no van a llegar con lo que falta por aplicar.`}
      </p>

      <ul className="aulas-avance-lista">
        {filas.map((f) => (
          <li key={f.clave} className="aulas-avance-fila" data-estado={f.estado}>
            <span className="aulas-avance-celda">
              <strong>{f.facultad}</strong> · {f.sexo}
            </span>
            <span className="aulas-avance-pista" role="img"
                  aria-label={`${f.facultad} ${f.sexo}: ${f.etiqueta}`}>
              <span style={{
                width: `${Math.min(100, f.cuota > 0 ? Math.round((f.proyeccion / f.cuota) * 100) : 0)}%`,
                background: TONO[f.estado] ?? COLOR_RESULTADO.pendiente,
              }} />
            </span>
            <span className="aulas-avance-dicho">
              <strong>{f.etiqueta}</strong>
              {/* La causa, sólo donde hay algo que explicar. */}
              {f.porque ? <em>{f.porque}</em> : null}
              {/* Y cómo se está comportando el campo, que es otra pregunta. */}
              {f.etiquetaCalibracion ? <small>{f.etiquetaCalibracion}</small> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
