// Los sensores del arrastre del mazo (patrón de recopiladores/correos/ColumnaDeBloques.tsx): puntero con 4 px de
// umbral, para que un clic en el asa no se vuelva arrastre, y teclado con las coordenadas de las listas ordenables.
//
// Escape durante un arrastre cancela el arrastre, no cierra el diálogo: Radix cierra en su listener de document salvo que
// el evento llegue con preventDefault, y dnd-kit cancela por el código de tecla sin mirar eso. Por eso aquí sólo se
// previene (en captura sobre window, que corre antes), sin cortar la propagación que dnd-kit necesita.

import { useEffect, useRef } from "react";
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

export function useArrastreMazo() {
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const arrastrando = useRef(false);
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (arrastrando.current && e.key === "Escape") e.preventDefault(); };
    window.addEventListener("keydown", alTeclear, true);
    return () => window.removeEventListener("keydown", alTeclear, true);
  }, []);
  return {
    sensores,
    alEmpezar: () => { arrastrando.current = true; },
    alTerminar: () => { arrastrando.current = false; },
  };
}
