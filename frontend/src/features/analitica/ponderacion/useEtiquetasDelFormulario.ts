// Lee una vez las etiquetas de las categorías del formulario para la base
// activa. El panel se monta de nuevo al cambiar de base, así que no hace falta
// volver a pedirlas.

import { useEffect, useState } from "react";

import { apiAnaliticaDataReview } from "../../../api/analitica";
import { indiceDeEtiquetas, type EtiquetasDelFormulario } from "./etiquetasDeCategorias";

export function useEtiquetasDelFormulario(activo: boolean): EtiquetasDelFormulario {
  const [etiquetas, setEtiquetas] = useState<EtiquetasDelFormulario>({});
  useEffect(() => {
    if (!activo) return;
    let vigente = true;
    apiAnaliticaDataReview().then(
      (r) => { if (vigente) setEtiquetas(indiceDeEtiquetas(r.variables ?? [])); },
      // Sin esta lectura la tabla sigue funcionando: muestra el código, que es lo que había.
      () => undefined,
    );
    return () => { vigente = false; };
  }, [activo]);
  return etiquetas;
}
