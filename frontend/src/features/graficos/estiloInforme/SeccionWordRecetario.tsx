// C49 reducida (decisión 29): del «Base Word» del editor anterior sólo queda lo que el Word de verdad usa. Una opción que
// llega al documento (no repetir el título como etiqueta del eje) y, por tipo de gráfico, lo que fija el recetario con
// candado visible (`LineaFijadaRecetario`, el mismo de los ajustes de la lámina). No se envuelve `WordPresetsEditor` ni
// su maqueta de espacios: lo demás que guardaba no llega al Word del recetario.

import { useId } from "react";
import { LineaFijadaRecetario } from "../LineaFijadaRecetario";
import { SelloProcedencia } from "../estilo/SelloProcedencia";
import { CabeceraSeccion } from "./CabeceraSeccion";
import type { BloqueFijado, OpcionWord } from "./modeloEstiloInforme";

export function SeccionWordRecetario({
  opcion,
  bloques,
  motivoNoEditable,
  onOpcion,
  estado,
}: {
  opcion: OpcionWord;
  bloques: readonly BloqueFijado[];
  /** En el informe compartido el Word no sale: la opción se ve, deshabilitada, con este motivo. */
  motivoNoEditable: string | null;
  onOpcion: (activa: boolean) => void;
  estado?: string;
}) {
  const tituloId = useId();
  const opcionId = useId();
  const motivoId = useId();
  return (
    <section className="pulso-f6-informe-seccion" aria-labelledby={tituloId} data-qa-geometry-member data-seccion="word">
      <CabeceraSeccion
        id={tituloId}
        titulo="Word"
        modificado={opcion.procedencia === "propio" && !motivoNoEditable}
        etiquetaVolver="Volver a la opción del Word del recetario"
        onVolver={() => onOpcion(opcion.porDefecto)}
      />
      <p className="pulso-f6-informe-ayuda">
        El Word sale del recetario. Aquí queda lo único que se decide; lo demás lo fija el recetario y se muestra con su
        valor.
      </p>

      <div className="pulso-f6-informe-nota">
        <input
          id={opcionId}
          type="checkbox"
          checked={opcion.activa}
          disabled={!!motivoNoEditable}
          aria-describedby={motivoNoEditable ? motivoId : undefined}
          onChange={(e) => onOpcion(e.target.checked)}
        />
        <label htmlFor={opcionId}>
          <strong>No repetir el título como etiqueta del eje.</strong> Cuando el título va encima del gráfico, las barras
          apiladas y las listas multiapiladas dejan limpia la etiqueta lateral.
        </label>
        <SelloProcedencia procedencia={opcion.procedencia} />
      </div>
      {motivoNoEditable ? <p id={motivoId} className="pulso-f6-informe-motivo" role="note">{motivoNoEditable}</p> : null}

      {estado ? (
        <p className="pulso-f6-informe-estado" role="status">{estado}</p>
      ) : bloques.length === 0 ? (
        <p className="pulso-f6-informe-estado" role="status">El recetario no fija ajustes del Word en ningún tipo de gráfico.</p>
      ) : (
        <div className="pulso-f6-informe-fijados" data-qa-geometry-group="graficos/f6-estilo-informe-word-fijados" data-qa-geometry-contract="intrinsic">
          {bloques.map((bloque) => (
            <section key={bloque.preset} className="pulso-f6-informe-fijado-bloque" aria-label={`Lo fija el recetario en ${bloque.titulo}`} data-qa-geometry-member>
              <h4 className="pulso-f6-informe-subtitulo">{bloque.titulo}</h4>
              {bloque.lineas.map((l) => (
                <LineaFijadaRecetario key={l.fijado.arg} fijado={l.fijado} meta={l.meta} guardado={l.guardado} />
              ))}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
