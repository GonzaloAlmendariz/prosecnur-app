import { useEffect, useState } from "react";

import { leerDecimal } from "./modeloParametros";

/**
 * Campo numérico de Parámetros como texto con teclado decimal (L14).
 *
 * Un <input type=number> lo formatea Chromium con el locale del sistema e
 * ignora `lang`: pintaba «0,5» junto a «z = 1.96» (medido con es-PE, es-419,
 * es-MX y en). Como texto se ve el número como lo guarda el motor («0.5»), y
 * al teclear acepta coma o punto. El borrador conserva los pasos intermedios
 * («0.») hasta que la entrada es un número completo.
 */
export function EntradaDecimal({
  id,
  valor,
  placeholder,
  entero = false,
  describedBy,
  invalido,
  onNumero,
}: {
  id: string;
  valor: number | null;
  placeholder?: string;
  entero?: boolean;
  describedBy?: string;
  invalido?: boolean;
  onNumero: (n: number) => void;
}) {
  const guardado = valor == null ? "" : String(valor);
  const [borrador, setBorrador] = useState(guardado);
  // Si el valor cambia desde fuera (preset, corrección del motor), el campo lo
  // adopta; si es el mismo número que ya se tecleó («0,5» = 0.5), respeta la
  // forma en que el usuario lo escribió.
  useEffect(() => {
    setBorrador((actual) => (leerDecimal(actual) === valor ? actual : guardado));
  }, [guardado, valor]);
  return (
    <input
      id={id}
      type="text"
      inputMode={entero ? "numeric" : "decimal"}
      autoComplete="off"
      placeholder={placeholder}
      value={borrador}
      aria-describedby={describedBy}
      aria-invalid={invalido ? true : undefined}
      onChange={(e) => {
        const texto = e.currentTarget.value;
        setBorrador(texto);
        const n = leerDecimal(texto);
        if (n != null) onNumero(entero ? Math.round(n) : n);
      }}
    />
  );
}
