import type { MutableRefObject } from "react";

// Campo de la fórmula de un cálculo (columna `calculation`). El borrador vive en la pestaña: «Probar con respuestas»
// lo evalúa mientras se escribe y el catálogo inserta funciones en el cursor. Se guarda en la fila con el mismo camino
// que usa el Constructor.
export function EditorFormula({ valor, texto, onTexto, onGuardar, campoRef }: {
  valor: string;
  texto: string;
  onTexto: (texto: string) => void;
  onGuardar: (valor: string) => void;
  campoRef?: MutableRefObject<HTMLTextAreaElement | null>;
}) {
  const cambio = texto.trim() !== valor.trim();
  return (
    <div className="xfp-formula">
      <label className="xfp-formula__rot" htmlFor="xfp-formula-campo">Expresión en XLSForm</label>
      <textarea
        ref={campoRef}
        id="xfp-formula-campo"
        className="xfp-formula__campo"
        value={texto}
        rows={Math.min(6, Math.max(2, Math.ceil(texto.length / 70)))}
        spellCheck={false}
        placeholder="Por ejemplo: ${p1} + ${p2}"
        onChange={(e) => onTexto(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && cambio) { e.preventDefault(); onGuardar(texto.trim()); } }}
      />
      <div className="xfp-formula__pie">
        <button type="button" className="xfp-boton" disabled={!cambio} onClick={() => onTexto(valor)}>Descartar</button>
        <button type="button" className="xfp-boton is-primario" disabled={!cambio} onClick={() => onGuardar(texto.trim())}>Guardar fórmula</button>
      </div>
    </div>
  );
}
