import type { ReactNode } from "react";

import { AulasTablasDeAvance } from "./AulasTablasDeAvance";

/**
 * Las cinco tablas del libro, en la pestaña donde se decide publicarlas.
 *
 * **Por qué aquí y no en Metas.** Estuvieron en Metas del 2026-09-08 hasta ese
 * mismo día, y Gonzalo las devolvió: «se supone que aquí todo debe ser visual y
 * con gráficos, y las has metido como tablas como sea cuando deberían muchas de
 * ellas ser gráficos mejor diseñados y visuales». El censo de la sección le dio
 * la razón con números — **ninguna de las cinco aportaba una cifra que Avance
 * no pintara ya**:
 *
 * | La tabla | Ya lo decía |
 * |---|---|
 * | Avance general (4 columnas) | la banda de 7 KPIs |
 * | Avance por facultad (**20 columnas**) | las barras por sexo de Metas |
 * | Rendimiento por facultad (10) | «Qué está rindiendo más» |
 * | Producción por aplicador (10) | «Quién consigue más» |
 * | Avance diario (11) | el gráfico del día |
 *
 * Veinte columnas no se leen en una pantalla: se leen en una hoja que puedes
 * congelar, filtrar y copiar. Estas cinco nacieron para el libro y para el
 * Sheets, y ahí la tabla es la forma CORRECTA, porque quien las abre busca una
 * celda concreta. Lo que estaba mal no era la tabla: era el sitio.
 *
 * Aquí sí sirven, y por una razón distinta a la de un panel de lectura: **son
 * lo que se va a publicar**. Antes de mandar el corte al Sheets o de generar el
 * libro, esto es lo que va a salir, con los mismos rótulos, el mismo orden y el
 * mismo semáforo. Es una vista previa, no un tablero.
 *
 * No se recalcula nada: el contrato de formato —qué columna es porcentaje, qué
 * escala de color le toca— viaja con los datos desde el motor, que es el mismo
 * que escribe el libro. Si esta pantalla decidiera el formato por su cuenta,
 * habría dos respuestas a la misma pregunta y una acabaría mintiendo.
 *
 * El endpoint se comparte con el gráfico del día de Rendimiento a través de la
 * caché de promesa de `useTablasDeAvance`: quitarlas de Metas no le quitó los
 * datos a ese gráfico, que las pide por su cuenta.
 */
export function AulasVistaPreviaDelLibro(): ReactNode {
  return (
    <section
      className="mon-profile-panel"
      data-qa-geometry-group="monitoring-aulas-salidas"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="mon-profile-panel-head">
        {/* El título dice QUÉ ES —lo que se va a publicar— y no «Avance de
            campo en tablas», que era el nombre en Metas y prometía un tablero.
            C1: la superficie declara su función en su rótulo. */}
        <h3>Así se verá el libro</h3>
        <span>las cinco hojas del corte, tal como saldrán al Sheets</span>
      </div>
      <AulasTablasDeAvance />
    </section>
  );
}
