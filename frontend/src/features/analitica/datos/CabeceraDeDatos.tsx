// La cabecera de Analítica › Datos (prototipo, `tabHeading` de "Analítica,
// Variables"): antetítulo "Analítica", título del catálogo, el estado de las
// etiquetas, las cifras de la lista y "Detectar secciones". Es la cabecera
// común del kit; aquí solo se le da su contenido.

import type { To } from "react-router-dom";

import { CabeceraDePestana, type EstadoDePestana } from "../../../components/procesamiento/CabeceraDePestana";
import type { CifraDePestana } from "../../../components/procesamiento/CifrasDePestana";
import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteo } from "../../../lib/formatoNumero";
import { PROCESAMIENTO_PESTANAS } from "../../../lib/navegacion/catalogos/procesamiento";
import { FolderSearch, RefreshCw } from "../../../vendor/lucide-react";
import type { LecturaDeEstructura } from "./useRevisionDeDatos";

export type CifrasDeDatos = {
  /** Variables que llegaron en la lectura del servicio. */
  total: number;
  incluidas: number;
  /** Toda la lista de excluidas de la config, estén o no en esta base (U5). */
  excluidas: number;
  /** Excluidas que no están entre las variables de esta base. */
  excluidasAusentes: number;
  secciones: number;
  /** Etiquetas cambiadas que la config ya guarda. */
  editadas: number;
};

/** El estado dice lo que falta hacer; sin nada pendiente no hay estado que anunciar. */
export function estadoDeDatos(pendientes: number, vacias: number): EstadoDePestana | null {
  if (vacias > 0) return { tono: "atencion", texto: `${formatoConteo(vacias)} ${vacias === 1 ? "etiqueta vacía" : "etiquetas vacías"}` };
  if (pendientes > 0) return { tono: "parcial", texto: `${formatoConteo(pendientes)} ${pendientes === 1 ? "etiqueta por confirmar" : "etiquetas por confirmar"}` };
  return null;
}

export function cifrasDeDatos(c: CifrasDeDatos, enlaceExcluidas: To): CifraDePestana[] {
  const total = formatoConteo(c.total);
  const cifras: CifraDePestana[] = [
    { clave: "incluidas", valor: formatoConteo(c.incluidas), base: total, rotulo: "variables incluidas", rango: 1 },
    { clave: "secciones", valor: formatoConteo(c.secciones), rotulo: c.secciones === 1 ? "sección" : "secciones" },
    {
      clave: "excluidas",
      valor: formatoConteo(c.excluidas),
      base: total,
      rotulo: c.excluidas === 1 ? "excluida" : "excluidas",
      enlace: enlaceExcluidas,
      titulo: c.excluidasAusentes > 0
        ? `Cuenta ${formatoConteo(c.excluidasAusentes)} que no ${c.excluidasAusentes === 1 ? "está" : "están"} en esta base. Abre la lista para verlas y editarlas.`
        : "Abre la lista de variables que no salen en los entregables",
    },
  ];
  if (c.editadas > 0) {
    cifras.push({ clave: "editadas", valor: formatoConteo(c.editadas), rotulo: c.editadas === 1 ? "etiqueta editada" : "etiquetas editadas", rango: 3 });
  }
  return cifras;
}

export function CabeceraDeDatos({ cifras, estado, deteccion, listo, onDetectar }: {
  cifras: CifraDePestana[];
  estado: EstadoDePestana | null;
  deteccion: LecturaDeEstructura;
  /** La lista ya llegó: antes no hay cifras que dar. */
  listo: boolean;
  onDetectar: () => void;
}) {
  const meta = PROCESAMIENTO_PESTANAS.analitica.find((p) => p.key === "datos") ?? PROCESAMIENTO_PESTANAS.analitica[0];
  const leyendo = deteccion.estado === "leyendo" && !deteccion.silenciosa;
  return (
    <CabeceraDePestana
      seccion="Analítica"
      titulo={meta.label}
      icono={meta.icon}
      estado={estado}
      cifras={listo ? cifras : []}
      ariaCifras="Cifras de las variables"
      className="datos-cabecera"
      acciones={(
        <>
          {/* La lectura automática se anuncia sin bloquear el botón; si falla, lo dice con su motivo. */}
          {deteccion.estado === "leyendo" && deteccion.silenciosa ? (
            <span className="datos-lectura" role="status">
              <RefreshCw size={12} className="pulso-spin" aria-hidden="true" />
              Leyendo secciones
            </span>
          ) : null}
          {deteccion.estado === "error" && deteccion.silenciosa ? (
            <span className="datos-lectura" data-tono="aviso" role="status" title={deteccion.mensaje}>
              Secciones sin leer
            </span>
          ) : null}
          <PulsoButton
            variant="secondary"
            onClick={onDetectar}
            disabled={leyendo}
            aria-busy={leyendo}
            title="Vuelve a leer las secciones del formulario y conserva las que editaste"
          >
            {leyendo ? <RefreshCw size={14} className="pulso-spin" aria-hidden="true" /> : <FolderSearch size={14} aria-hidden="true" />}
            Detectar secciones
          </PulsoButton>
        </>
      )}
    />
  );
}
