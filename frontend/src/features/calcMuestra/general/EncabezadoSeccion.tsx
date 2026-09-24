import { BarChart3, ClipboardList, Database, Grid3X3, NotepadText, Settings2 } from "lucide-react";

import type { EstadoMesa } from "./bandaDisenoModelo";
import { encabezadoDeSeccion, MODO_ETIQUETA, type ModoMesa } from "./secciones";
import { SiguienteCondicion } from "./SiguienteCondicion";
import "./mesa.css";

const ICONO: Record<string, typeof Database> = {
  marco: Database,
  metodo: Settings2,
  seleccion: Grid3X3,
  resultados: BarChart3,
  actores: ClipboardList,
  contexto: NotepadText,
};

/**
 * La sección activa se declara a sí misma (C1) en una sola línea: el modo como
 * antetítulo, la sección como H2 y, a la derecha, el estado de la mesa con la
 * siguiente condición. Ya no es una tarjeta que repite lo que dice el rail:
 * lo que agrega es en qué punto está el diseño y qué falta.
 *
 * Sin acción global (E15 · P4, patrones 9–10 de aulas): la cabecera no
 * calcula ni sortea; a lo sumo enlaza con la pestaña donde eso se hace.
 */
export function EncabezadoSeccion({
  modo,
  seccion,
  pestana = null,
  estado,
}: {
  modo: ModoMesa;
  seccion: string;
  /** La pestaña activa ya resuelta: la siguiente condición no enlaza consigo misma. */
  pestana?: string | null;
  estado?: EstadoMesa;
}) {
  const { titulo, linea } = encabezadoDeSeccion(modo, seccion);
  const Icono = ICONO[seccion] ?? Database;
  return (
    <header className="cmg-encabezado" aria-labelledby="cmg-seccion-titulo" data-status={estado?.clave}>
      <div className="cmg-encabezado-id">
        <span className="cmv2-desk-icon cmg-encabezado-icono"><Icono size={16} aria-hidden="true" /></span>
        <div className="cmg-encabezado-texto">
          <span className="cmv2-eyebrow">{MODO_ETIQUETA[modo]}</span>
          <h2 id="cmg-seccion-titulo">{titulo}</h2>
        </div>
        <p className="cmg-encabezado-linea" title={linea}>{linea}</p>
      </div>
      {estado && <SiguienteCondicion modo={modo} estado={estado} seccion={seccion} pestana={pestana} />}
    </header>
  );
}
