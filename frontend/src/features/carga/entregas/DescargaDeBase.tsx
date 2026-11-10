// «Descargar base» de cada base del estudio (Carga › Fuentes, varias bases) por
// el kit de entregables (ADR 0133, fase 5; forma «fila» del censo, CA-02). El
// botón queda en las acciones de la base y sólo se deshabilita mientras se
// prepara; el contenedor ocupa el pie de la misma fila con su línea, el
// archivo y Abrir / Mostrar en la carpeta, o la causa del fallo con Reintentar.

import { apiCargaExportNormalized } from "../../../api/xlsformEditor";
import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import { useGeneracion, type Generacion } from "../../../components/entregables/useGeneracion";
import "./entregas.css";

/** La base preparada de `nombre`, en Excel; el motor la archiva con Procesamiento (`data_normalizada`). */
export function useDescargaDeBase(nombre: string): Generacion & { descargar: () => void } {
  const gen = useGeneracion({ titulo: `Base preparada de ${nombre}`, modulo: "Procesamiento", formato: "xlsx", articulo: "la" });
  return { ...gen, descargar: () => { void gen.ejecutar(() => apiCargaExportNormalized("xlsx", nombre)); } };
}

/** El contenedor en el pie de la fila de la base, a todo su ancho. */
export function DescargaDeBaseEnFila({ gen }: { gen: Generacion }) {
  if (gen.estado.fase === "inactiva") return null;
  return (
    <div className="pulso-base-row-entrega">
      <ContenedorEntregable estado={gen.estado} forma="fila" onCerrar={gen.cerrar} />
    </div>
  );
}
