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
 */
export function EncabezadoSeccion({
  modo,
  seccion,
  estado,
  onCalcular,
  calculando = false,
}: {
  modo: ModoMesa;
  seccion: string;
  estado?: EstadoMesa;
  onCalcular?: () => void;
  calculando?: boolean;
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
        <p className="cmg-encabezado-linea">{linea}</p>
      </div>
      {estado && <SiguienteCondicion estado={estado} seccion={seccion} onCalcular={onCalcular} calculando={calculando} />}
    </header>
  );
}
