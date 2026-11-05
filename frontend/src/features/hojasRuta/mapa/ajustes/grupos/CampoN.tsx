import { useEffect, useState } from "react";

import { fmt } from "../../muestra/controlesMuestra";
import { leerN, multiplosCercanos } from "./tamanoN";

/**
 * El N como campo de texto (maqueta aprobada): se escribe libre y se confirma al salir o con Enter. Si no es
 * múltiplo de k no se aplica: se ofrecen los dos múltiplos más cercanos.
 */
export function CampoN({ valor, k, deshabilitado, onCambio }: { valor: number; k: number; deshabilitado?: boolean; onCambio: (n: number) => void }) {
  const [texto, setTexto] = useState(fmt(valor));
  const [propuesto, setPropuesto] = useState<number | null>(null);
  useEffect(() => {
    setTexto(fmt(valor));
    setPropuesto(null);
  }, [valor]);
  const confirmar = () => {
    const n = leerN(texto);
    if (n == null) {
      setTexto(fmt(valor));
      setPropuesto(null);
      return;
    }
    if (n % k === 0) {
      setPropuesto(null);
      if (n !== valor) onCambio(n);
      else setTexto(fmt(valor));
      return;
    }
    setPropuesto(n);
  };
  const cercanos = propuesto != null ? multiplosCercanos(propuesto, k) : null;
  return (
    <div className="hr-muestra-campo hr-campo-n">
      <label htmlFor="hr-campo-n">Encuestas completas (N)</label>
      <input
        id="hr-campo-n"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={texto}
        disabled={deshabilitado}
        aria-invalid={cercanos ? true : undefined}
        aria-describedby={cercanos ? "hr-campo-n-aviso" : undefined}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => e.key === "Enter" && confirmar()}
      />
      {cercanos ? (
        <p id="hr-campo-n-aviso" className="hr-campo-n-aviso" role="status">
          <span>No es múltiplo de {k}. Usa</span>
          {[...new Set(cercanos)].map((m) => (
            <button key={m} type="button" className="hr-campo-n-opcion" onClick={() => onCambio(m)}>{fmt(m)}</button>
          ))}
        </p>
      ) : null}
    </div>
  );
}
