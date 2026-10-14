import { useState } from "react";
import { Combine } from "../../../vendor/lucide-react";
import { PulsoButton } from "../../../components/PulsoButton";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { validarNombreLista, type GrupoListasRepetidas } from "./listasModel";
import { OpcionesChips } from "./OpcionesChips";
import { CampoNombreLista } from "./CampoNombreLista";

/** Una escala repetida: cuántas preguntas la usan, sus opciones y el nombre
 *  con el que quedará unificada. El nombre lo guarda el panel para que dos
 *  escalas pendientes no puedan quedar con el mismo. */
export function GrupoListasCard({
  grupo,
  workbook,
  nombre,
  reservados,
  onNombreChange,
  onUnificar,
}: {
  grupo: GrupoListasRepetidas;
  workbook: XlsformEditorWorkbook;
  nombre: string;
  /** Nombres pendientes de las OTRAS escalas repetidas. */
  reservados: readonly string[];
  onNombreChange: (nombre: string) => void;
  onUnificar: (grupo: GrupoListasRepetidas, nombre: string) => string | null;
}) {
  const [errorAplicar, setErrorAplicar] = useState<string | null>(null);
  const motivo = validarNombreLista(workbook, nombre, grupo.listas, reservados);
  const error = motivo ?? errorAplicar;
  const limpio = nombre.trim();
  const n = grupo.preguntas.length;

  function aplicar() {
    if (motivo) return;
    setErrorAplicar(onUnificar(grupo, limpio));
  }

  return (
    <article className="pulso-xf-listas-grupo" data-qa-geometry-member="">
      <header className="pulso-xf-listas-grupo-cabecera">
        <h3>
          Esta escala se repite en {n} {n === 1 ? "pregunta" : "preguntas"}
        </h3>
        <p title={grupo.listas.join(", ")}>
          {grupo.listas.length} listas idénticas · {grupo.opciones.length} opciones
        </p>
      </header>
      <OpcionesChips opciones={grupo.opciones} />
      <div className="pulso-xf-listas-grupo-accion">
        <CampoNombreLista
          etiqueta="Nombre de la lista unificada"
          valor={nombre}
          error={error}
          reservarError
          onChange={(valor) => { onNombreChange(valor); setErrorAplicar(null); }}
          onEnter={aplicar}
        />
        <PulsoButton
          variant="primary"
          size="sm"
          className="pulso-xf-listas-grupo-boton"
          disabled={Boolean(error)}
          onClick={aplicar}
        >
          <Combine size={14} aria-hidden="true" />
          Unificar como «{limpio || "…"}»
        </PulsoButton>
      </div>
    </article>
  );
}
