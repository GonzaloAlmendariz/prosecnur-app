// Las salidas del Editor de formularios (ADR 0133, fase 5): el XLSForm (en la
// banda, contenedor anclado bajo "Exportar") y el cuestionario impreso en PDF
// o Word (pestaña Impreso, contenedor en bloque). Reemplazan al panel
// "Procesando", al panel "XLSForm listo" y a los avisos con "Descargar"; el
// guardado a mano en la raíz del proyecto se retira: la copia junto al
// proyecto la hace el motor (`Entregables\Formularios`) cuando el catálogo lo
// permite.

import { useState } from "react";
import { useGeneracion, type Generacion, type ResultadoGeneracion } from "../../../components/entregables/useGeneracion";
import { EXPORTES, MODULO_FORMULARIOS, avisosDelImpreso } from "./modeloEntrega";

export type EntregaFormulario = Generacion & { enCurso: boolean };

export type EntregaImpreso = EntregaFormulario & {
  /** Avisos del motor sobre el último impreso generado (al pie del contenedor). */
  avisos: string[];
  exportar: (formato: "pdf" | "word", generar: () => Promise<unknown>) => Promise<ResultadoGeneracion>;
};

export function useExportacionXlsform(): EntregaFormulario {
  const { titulo, articulo, formato } = EXPORTES.xlsx;
  const gen = useGeneracion({ titulo, modulo: MODULO_FORMULARIOS, formato, articulo });
  return { ...gen, enCurso: gen.estado.fase === "en_curso" };
}

export function useExportacionImpresa(): EntregaImpreso {
  const gen = useGeneracion({ titulo: EXPORTES.pdf.titulo, modulo: MODULO_FORMULARIOS, formato: "pdf", articulo: "el" });
  const [avisos, setAvisos] = useState<string[]>([]);
  const exportar: EntregaImpreso["exportar"] = async (salida, generar) => {
    setAvisos([]);
    const { titulo, articulo, formato } = EXPORTES[salida];
    const resultado = await gen.ejecutar(generar, { titulo, articulo, formato });
    if (resultado.ok) setAvisos(avisosDelImpreso(resultado.datos));
    return resultado;
  };
  return { ...gen, enCurso: gen.estado.fase === "en_curso", avisos, exportar };
}
