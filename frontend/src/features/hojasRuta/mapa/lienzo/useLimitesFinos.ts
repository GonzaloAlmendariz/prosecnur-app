import { useEffect, useState } from "react";
import { limitesDePeru, type LimitesCrudos, type LimitesPeru } from "./limites";

// Una promesa para toda la sesión de la app: el trazo fino (418 KB) va en su propio chunk y no se vuelve a pedir.
let promesa: Promise<LimitesPeru> | null = null;

/**
 * País y departamentos en el nivel fino, para cuando un departamento llena la pantalla. Hasta que llega
 * (o si el chunk no carga) el lienzo sigue con el nivel nacional del bundle.
 */
export function useLimitesFinos(): LimitesPeru | null {
  const [finos, setFinos] = useState<LimitesPeru | null>(null);
  useEffect(() => {
    let vivo = true;
    promesa ??= import("../../peruDepartamentosDetalle.json").then((m) => limitesDePeru(m.default as LimitesCrudos));
    promesa.then(
      (l) => vivo && setFinos(l),
      () => {
        promesa = null;
      },
    );
    return () => {
      vivo = false;
    };
  }, []);
  return finos;
}
