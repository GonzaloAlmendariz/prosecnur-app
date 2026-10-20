// «Se repite» en la pestaña Listas de opciones (E2): unificar reescribe varias preguntas a la vez, así que pide
// confirmación en línea, en dos pasos y cancelable. El nombre propuesto es corto: el de la lista más usada del grupo.

import { useEffect, useState } from "react";
import { Copy } from "../../../vendor/lucide-react";
import { PanelCard } from "../kit";
import type { GrupoListasRepetidas } from "../listas/listasModel";

type Props = {
  grupo: GrupoListasRepetidas;
  actual: string;
  propuesto: string;
  onUnificar: (grupo: GrupoListasRepetidas, nombre: string) => string | null;
};

export function UnificarListas({ grupo, actual, propuesto, onUnificar }: Props) {
  const [nombre, setNombre] = useState(propuesto);
  const [confirmando, setConfirmando] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  useEffect(() => { setNombre(propuesto); setConfirmando(false); setMotivo(null); }, [grupo.firma, propuesto]);
  const limpio = nombre.trim();
  const n = grupo.preguntas.length;

  const aplicar = () => {
    const error = onUnificar(grupo, limpio);
    setMotivo(error);
    setConfirmando(false);
  };

  return (
    <PanelCard title="Se repite" icon={<Copy size={14} aria-hidden="true" />} meta={`${grupo.listas.length} listas`}>
      <p className="xfo-nota xfo-nota--linea">Mismas opciones en {grupo.listas.length} listas.</p>
      <ul className="xfo-gemelas">
        {grupo.listas.map((l) => <li key={l} className={l === actual ? "is-actual" : undefined}><code title={l}>{l}</code></li>)}
      </ul>
      <label className="xfo-unificada">
        <span>Nombre de la lista unificada</span>
        <input value={nombre} spellCheck={false} title={nombre}
          onChange={(e) => { setNombre(e.target.value); setConfirmando(false); setMotivo(null); }} />
      </label>
      {confirmando ? (
        <div className="xfo-confirma" role="group" aria-label="Confirmar la unificación">
          <p className="xfo-nota">
            Quedará una sola lista, <code>{limpio}</code>, para {n} {n === 1 ? "pregunta" : "preguntas"}. {grupo.listas.length === 2 ? "La otra se borra." : `Las otras ${grupo.listas.length - 1} se borran.`}
          </p>
          <div className="xfo-confirma__acciones">
            <button type="button" className="xfo-unificar" onClick={aplicar} autoFocus>Unificar</button>
            <button type="button" className="xfo-cancelar" onClick={() => setConfirmando(false)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button type="button" className="xfo-unificar" disabled={!limpio} onClick={() => setConfirmando(true)}>
          Unificar {grupo.listas.length} listas…
        </button>
      )}
      {motivo ? <p className="xfo-nota is-aviso" role="status">{motivo}</p> : null}
    </PanelCard>
  );
}
