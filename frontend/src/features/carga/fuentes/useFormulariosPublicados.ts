// Catálogo de formularios publicados para Carga (ADR 0102). Si el backend no lo
// ofrece (proyecto sin Formularios, endpoint ausente) el catálogo queda vacío y
// la opción «Formulario publicado» simplemente no aparece: no es un error que
// deba ver el usuario.

import { useCallback, useEffect, useState } from "react";
import { apiCargaFormulariosPublicados, type FormularioPublicado } from "../../../api/cargaFormularioPublicado";

export type CatalogoPublicados = {
  formularios: FormularioPublicado[];
  cargado: boolean;
  recargar: () => void;
};

export function useFormulariosPublicados(): CatalogoPublicados {
  const [estado, setEstado] = useState<{ formularios: FormularioPublicado[]; cargado: boolean }>({ formularios: [], cargado: false });
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    let vivo = true;
    apiCargaFormulariosPublicados()
      .then((formularios) => { if (vivo) setEstado({ formularios, cargado: true }); })
      .catch(() => { if (vivo) setEstado({ formularios: [], cargado: true }); });
    return () => { vivo = false; };
  }, [vuelta]);
  const recargar = useCallback(() => setVuelta((v) => v + 1), []);
  return { ...estado, recargar };
}
