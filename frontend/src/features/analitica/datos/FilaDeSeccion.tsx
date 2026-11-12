// La fila de una sección en la lista de Analítica › Datos (prototipo, fila
// `sec` de "Variables de la base"): su nombre, cuántas de sus variables entran y,
// a la vista, lo que se decide sobre la sección entera: renombrarla, incluir o
// excluir todas sus variables y ocultarla en los agrupadores de las tablas.

import { useState } from "react";

import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoInput } from "../../../components/PulsoInput";
import { formatoConteo } from "../../../lib/formatoNumero";
import { textoPlano } from "../../../lib/textoPlano";
import { EyeOff, Pencil } from "../../../vendor/lucide-react";
import type { DataReviewSectionGroup } from "./borradorDeEtiquetas";

export function FilaDeSeccion({ grupo, incluidas, onIncluirTodas, onRenombrar, onOcultar }: {
  grupo: DataReviewSectionGroup;
  incluidas: number;
  onIncluirTodas: (incluir: boolean) => void;
  onRenombrar: (nombre: string) => void;
  onOcultar: (ocultar: boolean) => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const nombre = textoPlano(grupo.name);
  const total = grupo.variables.length;
  const todas = incluidas === total;

  function confirmarNombre() {
    const limpio = (editando ?? "").trim();
    if (limpio && limpio !== grupo.name) onRenombrar(limpio);
    setEditando(null);
  }

  return (
    <div role="row" className="datos-seccion" data-oculta={grupo.hidden ? "" : undefined}>
      <span role="rowheader" aria-colspan={6} className="datos-seccion-celda">
        <span className="datos-seccion-nombre">
          {editando !== null ? (
            <PulsoInput
              size="sm"
              autoFocus
              value={editando}
              aria-label={`Nombre de la sección ${nombre}`}
              onChange={(e) => setEditando(e.target.value)}
              onBlur={confirmarNombre}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmarNombre();
                if (e.key === "Escape") setEditando(null);
              }}
            />
          ) : (
            <>
              <strong>{nombre}</strong>
              {grupo.synthetic ? null : (
                <PulsoButton
                  variant="icon"
                  size="sm"
                  aria-label={`Renombrar la sección ${nombre}`}
                  title="Renombrar"
                  onClick={() => setEditando(grupo.name)}
                >
                  <Pencil size={12} aria-hidden="true" />
                </PulsoButton>
              )}
            </>
          )}
          {grupo.manual ? <span className="datos-seccion-marca" title="La renombraste o cambiaste sus variables; Detectar secciones la conserva">Editada</span> : null}
          {grupo.hidden ? <span className="datos-seccion-marca"><EyeOff size={12} aria-hidden="true" />Oculta en las tablas</span> : null}
          {grupo.synthetic ? <span className="datos-seccion-marca" title="El formulario no declara esta sección: la variable la trae en sus datos. Usa Detectar secciones para administrarla.">Sin sección del formulario</span> : null}
        </span>
        <span className="datos-seccion-conteo">
          {formatoConteo(incluidas)} de {formatoConteo(total)} {incluidas === 1 && total === 1 ? "incluida" : "incluidas"}
        </span>
        <span className="datos-seccion-acciones">
          <PulsoButton
            variant="link"
            size="sm"
            disabled={total === 0 || grupo.hidden}
            onClick={() => onIncluirTodas(!todas)}
            aria-label={`${todas ? "Excluir todas las variables" : "Incluir todas las variables"} de ${nombre}`}
          >
            {todas ? "Excluir todas" : "Incluir todas"}
          </PulsoButton>
          {grupo.synthetic ? null : (
            <PulsoButton
              variant="link"
              size="sm"
              onClick={() => onOcultar(!grupo.hidden)}
              aria-label={`${grupo.hidden ? "Mostrar" : "Ocultar"} la sección ${nombre}`}
              title={grupo.hidden ? undefined : "Oculta la sección en los agrupadores de las tablas y excluye sus variables"}
            >
              {grupo.hidden ? "Mostrar sección" : "Ocultar sección"}
            </PulsoButton>
          )}
        </span>
      </span>
    </div>
  );
}
