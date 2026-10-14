import { useState } from "react";
import { Pencil } from "../../../vendor/lucide-react";
import { PulsoButton } from "../../../components/PulsoButton";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { validarNombreLista, type ListaOpciones } from "./listasModel";
import { OpcionesChips } from "./OpcionesChips";
import { CampoNombreLista } from "./CampoNombreLista";

/** Lista sin gemela: nombre técnico, uso y renombrar inline. */
export function ListaUnicaFila({
  lista,
  workbook,
  reservados,
  onRenombrar,
}: {
  lista: ListaOpciones;
  workbook: XlsformEditorWorkbook;
  /** Nombres pendientes de las escalas repetidas. */
  reservados: readonly string[];
  onRenombrar: (lista: string, nombre: string) => string | null;
}) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(lista.nombre);
  const [errorAplicar, setErrorAplicar] = useState<string | null>(null);
  const error = editando ? validarNombreLista(workbook, nombre, [lista.nombre], reservados) ?? errorAplicar : null;
  const n = lista.preguntas.length;

  function guardar() {
    if (validarNombreLista(workbook, nombre, [lista.nombre], reservados)) return;
    const motivo = onRenombrar(lista.nombre, nombre);
    if (motivo) { setErrorAplicar(motivo); return; }
    setEditando(false);
  }

  function cancelar() {
    setNombre(lista.nombre);
    setErrorAplicar(null);
    setEditando(false);
  }

  return (
    <li className="pulso-xf-listas-unica">
      <div className="pulso-xf-listas-unica-fila">
        <code className="pulso-xf-listas-nombre">{lista.nombre}</code>
        <span className="pulso-xf-listas-uso">
          {n === 0 ? "Sin preguntas" : `${n} ${n === 1 ? "pregunta" : "preguntas"}`}
        </span>
        {!editando ? (
          <PulsoButton
            variant="ghost"
            size="sm"
            aria-label={`Renombrar la lista ${lista.nombre}`}
            onClick={() => { setNombre(lista.nombre); setEditando(true); }}
          >
            <Pencil size={13} aria-hidden="true" />
            Renombrar
          </PulsoButton>
        ) : null}
      </div>
      <OpcionesChips opciones={lista.opciones} max={4} />
      {editando ? (
        <div className="pulso-xf-listas-unica-edicion">
          <CampoNombreLista
            etiqueta={`Nuevo nombre de «${lista.nombre}»`}
            valor={nombre}
            error={error}
            autoFocus
            onChange={(valor) => { setNombre(valor); setErrorAplicar(null); }}
            onEnter={guardar}
            onEscape={cancelar}
          />
          <PulsoButton variant="secondary" size="sm" onClick={cancelar}>Cancelar</PulsoButton>
          <PulsoButton variant="primary" size="sm" disabled={Boolean(error)} onClick={guardar}>Guardar</PulsoButton>
        </div>
      ) : null}
    </li>
  );
}
