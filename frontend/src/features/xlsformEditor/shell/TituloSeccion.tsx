// Título de una sección en la Vista del cuestionario. Si no es legible (ver tituloTecnico), se muestra atenuado con
// «Ponerle título», que lo edita ahí mismo y lo guarda en la etiqueta de la sección.

import { useState } from "react";
import { PencilLine } from "../../../vendor/lucide-react";

export function TituloSeccion({ rotulo, onTitular }: { rotulo: string; onTitular: (texto: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const guardar = () => {
    const limpio = texto.trim();
    if (limpio) onTitular(limpio);
    setEditando(false);
  };
  if (editando) {
    return (
      <input
        className="pulso-xf-cue-titular"
        autoFocus
        value={texto}
        placeholder="Título de la sección"
        aria-label={`Título para ${rotulo || "la sección"}`}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => {
          if (e.key === "Enter") guardar();
          if (e.key === "Escape") setEditando(false);
        }}
      />
    );
  }
  return (
    <span className="pulso-xf-cue-sintitulo">
      <span className="pulso-xf-cue-sintitulo-rotulo">{rotulo || "Sin título"}</span>
      <button type="button" className="pulso-xf-cue-titular-btn" onClick={() => { setTexto(""); setEditando(true); }}>
        <PencilLine size={12} aria-hidden="true" /> Ponerle título
      </button>
    </span>
  );
}
