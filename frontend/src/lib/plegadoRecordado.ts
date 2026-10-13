// Un bloque plegable que recuerda cómo lo dejó el usuario.
//
// Para ayudas largas que se repiten cada vez que se abre una superficie: quien
// ya las leyó las pliega una vez y no vuelven a ocupar alto. Se guarda en
// `localStorage` por clave; si el almacenamiento no está disponible (modo
// privado, cuota llena, entorno sin `window`) se usa el valor por defecto y la
// UI sigue funcionando: recordar es una comodidad, no un requisito.

import { useCallback, useState } from "react";

const PREFIJO = "pulso.plegado.";

export function leerPlegado(clave: string, porDefecto: boolean): boolean {
  try {
    const v = globalThis.localStorage?.getItem(PREFIJO + clave);
    return v === "abierto" ? true : v === "cerrado" ? false : porDefecto;
  } catch {
    return porDefecto;
  }
}

export function guardarPlegado(clave: string, abierto: boolean): void {
  try {
    globalThis.localStorage?.setItem(PREFIJO + clave, abierto ? "abierto" : "cerrado");
  } catch {
    // Sin almacenamiento la preferencia dura lo que dure la vista.
  }
}

/** `[abierto, alAlternar]` para un `<details>`: pásalo a `open` y `onToggle`. */
export function usePlegadoRecordado(
  clave: string,
  abiertoPorDefecto: boolean,
): [boolean, (abierto: boolean) => void] {
  const [abierto, setAbierto] = useState(() => leerPlegado(clave, abiertoPorDefecto));
  const cambiar = useCallback(
    (siguiente: boolean) => {
      setAbierto(siguiente);
      guardarPlegado(clave, siguiente);
    },
    [clave],
  );
  return [abierto, cambiar];
}
