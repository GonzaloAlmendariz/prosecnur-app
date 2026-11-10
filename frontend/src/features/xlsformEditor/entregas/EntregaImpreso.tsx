// El cuestionario impreso exportado (PDF o Word), en bloque bajo la cabecera
// de la pestaña Impreso (ADR 0133, fase 5). Los avisos que el motor dejó al
// dibujarlo van al pie del contenedor, en texto llano.

import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import type { EstadoGeneracion } from "../../../components/entregables/tipos";
import "./entregas.css";

export type EntregaImpresoVista = { estado: EstadoGeneracion; cerrar: () => void; avisos: readonly string[] };

export function EntregaImpreso({ entrega }: { entrega: EntregaImpresoVista }) {
  if (entrega.estado.fase === "inactiva") return null;
  const avisos = entrega.estado.fase === "lista" ? entrega.avisos : [];
  return (
    <div className="xf-entrega-bloque">
      <ContenedorEntregable
        estado={entrega.estado}
        forma="bloque"
        onCerrar={entrega.cerrar}
        pie={avisos.length ? (
          <ul className="xf-entrega-avisos" aria-label="Avisos del impreso">
            {avisos.map((aviso) => <li key={aviso}>{aviso}</li>)}
          </ul>
        ) : undefined}
      />
    </div>
  );
}
