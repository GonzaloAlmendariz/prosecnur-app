import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { cuotasResumen, type CorteDeCuota } from "./cuotasResumen";

/**
 * La cuota del estudio en personas, y sus dos desagregados.
 *
 * El tablero decía «2/12 celdas» y eso no contesta la pregunta del operativo:
 * doce celdas pueden estar a una respuesta o a doscientas y el contador se ve
 * igual. Aquí se lee **cuánta gente falta**, en total, por facultad y por sexo.
 */

/** Una barra de cumplimiento con su cifra al lado. */
function Barra({ corte, destacado = false }: { corte: CorteDeCuota; destacado?: boolean }) {
  // Se recorta al 100 % sólo para pintar: la cifra sigue diciendo la verdad.
  const ancho = Math.min(100, corte.avance);
  const tono = corte.faltan === 0
    ? COLOR_RESULTADO.efectiva
    : corte.avance >= 50 ? COLOR_RESULTADO.parcial : COLOR_RESULTADO.pendiente;
  return (
    <div className={`aulas-cuota-fila${destacado ? " es-total" : ""}`}>
      <span className="aulas-cuota-etiqueta">{corte.etiqueta}</span>
      <span className="aulas-cuota-pista" role="img" aria-label={`${corte.avance}% de la cuota`}>
        <span style={{ width: `${ancho}%`, background: tono }} />
      </span>
      <span className="aulas-cuota-cifra">
        {corte.faltan === 0
          ? "cumplida"
          : <><strong>{corte.faltan.toLocaleString("es-PE")}</strong> por recoger</>}
      </span>
    </div>
  );
}

export function AulasCuotasResumen({ filas }: { filas: ReadonlyArray<MonitoreoRow> }) {
  const { general, porFacultad, porSexo, sinMeta } = useMemo(() => cuotasResumen(filas), [filas]);

  if (!general.celdas) {
    return (
      <p className="mon-profile-muted">
        {sinMeta
          ? `Las ${sinMeta} celdas de cuota del plan no declaran objetivo.`
          : "El plan no declara composición por sexo para estos cursos-horario."}
      </p>
    );
  }

  return (
    <div className="aulas-cuotas-resumen">
      <Barra corte={{ ...general, etiqueta: "Cuota del estudio" }} destacado />
      <p className="aulas-cuota-lectura">
        <strong>{general.logrado.toLocaleString("es-PE")}</strong> de{" "}
        <strong>{general.meta.toLocaleString("es-PE")}</strong> personas ·{" "}
        {general.celdasCumplidas} de {general.celdas} celdas cumplidas
        {sinMeta ? ` · ${sinMeta} sin objetivo declarado` : ""}
      </p>

      <div className="aulas-cuotas-cortes">
        <section>
          <h4>Por facultad</h4>
          {porFacultad.map((corte) => <Barra key={corte.etiqueta} corte={corte} />)}
        </section>
        <section>
          <h4>Por sexo</h4>
          {porSexo.map((corte) => <Barra key={corte.etiqueta} corte={corte} />)}
        </section>
      </div>
    </div>
  );
}
