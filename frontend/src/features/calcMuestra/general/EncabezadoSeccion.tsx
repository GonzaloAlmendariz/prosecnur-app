import { BarChart3, ClipboardList, Database, Grid3X3, Settings2 } from "lucide-react";

import { encabezadoDeSeccion, MODO_ETIQUETA, type ModoMesa } from "./secciones";

const ICONO: Record<string, typeof Database> = {
  marco: Database,
  metodo: Settings2,
  seleccion: Grid3X3,
  resultados: BarChart3,
  actores: ClipboardList,
  contexto: Database,
};

/**
 * La sección activa se declara a sí misma (C1): el modo como antetítulo y la
 * sección con su línea. Antes las cuatro secciones repetían el mismo bloque.
 */
export function EncabezadoSeccion({ modo, seccion }: { modo: ModoMesa; seccion: string }) {
  const { titulo, linea } = encabezadoDeSeccion(modo, seccion);
  const Icono = ICONO[seccion] ?? Database;
  return (
    <header className="cmv2-desk-head" aria-labelledby="cmg-seccion-titulo">
      <div className="cmv2-desk-title">
        <span className="cmv2-desk-icon"><Icono size={18} aria-hidden="true" /></span>
        <div>
          <span className="cmv2-eyebrow">{MODO_ETIQUETA[modo]}</span>
          <h2 id="cmg-seccion-titulo">{titulo}</h2>
          <p>{linea}</p>
        </div>
      </div>
    </header>
  );
}
