import { useState } from "react";

// Campo de la fórmula de un cálculo (columna `calculation`): se escribe aquí y se guarda en la fila con el mismo camino
// que usa el Constructor. La lectura de arriba se actualiza al guardar (S13: la tarjeta «Fórmula» quedaba vacía).
export function EditorFormula({ valor, onGuardar }: { valor: string; onGuardar: (valor: string) => void }) {
  const [texto, setTexto] = useState(valor);
  const cambio = texto.trim() !== valor.trim();
  return (
    <div className="xfp-formula">
      <label className="xfp-formula__rot" htmlFor="xfp-formula-campo">Expresión en XLSForm</label>
      <textarea
        id="xfp-formula-campo"
        className="xfp-formula__campo"
        value={texto}
        rows={Math.min(6, Math.max(2, Math.ceil(texto.length / 70)))}
        spellCheck={false}
        placeholder="Por ejemplo: ${p1} + ${p2}"
        onChange={(e) => setTexto(e.target.value)}
      />
      <div className="xfp-formula__pie">
        <button type="button" className="xfp-boton" disabled={!cambio} onClick={() => setTexto(valor)}>Descartar</button>
        <button type="button" className="xfp-boton is-primario" disabled={!cambio} onClick={() => onGuardar(texto.trim())}>Guardar fórmula</button>
      </div>
    </div>
  );
}
