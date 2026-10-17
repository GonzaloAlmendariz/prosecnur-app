import type { CSSProperties } from "react";

import {
  materialTemplatePreviewSrc,
  type MaterialPreview,
  type MaterialPreviewAccessSource,
  type MaterialPreviewZone,
} from "../../../api/materialPreview";
import { PulsoButton } from "../../../components/PulsoButton";
import { ImageOff, Loader2, RefreshCw } from "../../../vendor/lucide-react";
import { nombreDeZona, zonaAEstilo } from "./modeloEditor";

export type ZonaDelPliego = {
  zona: MaterialPreviewZone;
  blockId: string;
  rotulo: string;
  /** Lo llena cada unidad: se tiñe con el acento (ADR 0108 §7). */
  deLaUnidad: boolean;
  conProblema: boolean;
};

type Props = {
  /** La página de esta cara, aunque sea de un borrador anterior. */
  vista: MaterialPreview | null;
  /** Proporción del papel cuando todavía no hay imagen. */
  papel: { w: number; h: number };
  zonas: readonly ZonaDelPliego[];
  seleccion: string | null;
  onSeleccionar: (blockId: string) => void;
  alt: string;
  cargando: boolean;
  desactualizada: boolean;
  /** Qué falló, si falló y no hay imagen al día. */
  fallo: { mensaje: string; reintentable: boolean } | null;
  onReintentar: () => void;
  acceso: MaterialPreviewAccessSource | null;
};

const ETIQUETA_DE_ACCESO: Partial<Record<MaterialPreviewAccessSource, string>> = {
  ejemplo: "enlace de ejemplo",
  sin_enlace: "sin enlace",
};

/**
 * La página real de la receta —el PNG del mismo dibujante que el PDF— con un
 * botón encima de cada bloque. La zona no se dibuja a mano: su caja la da el
 * backend en fracción de página y aquí sólo se pasa a porcentaje.
 */
export function PliegoReal({
  vista,
  papel,
  zonas,
  seleccion,
  onSeleccionar,
  alt,
  cargando,
  desactualizada,
  fallo,
  onReintentar,
  acceso,
}: Props) {
  const mm = vista?.page_mm ?? papel;
  const estiloDelPliego = { "--rec-ed-papel-w": mm.w, "--rec-ed-papel-h": mm.h } as CSSProperties;
  const etiquetaDeAcceso = acceso ? ETIQUETA_DE_ACCESO[acceso] ?? null : null;
  const clases = [
    "rec-ed-pliego",
    vista ? "" : "is-vacio",
    desactualizada ? "is-desactualizada" : "",
    cargando ? "is-cargando" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={clases} style={estiloDelPliego} aria-busy={cargando || undefined}>
      {vista ? (
        <img className="rec-ed-hoja" src={materialTemplatePreviewSrc(vista)} alt={alt} draggable={false} />
      ) : (
        <div className="rec-ed-hoja rec-ed-hoja--vacia" role="img" aria-label={fallo ? `${alt}: ${fallo.mensaje}` : `${alt}: dibujando`}>
          {fallo ? (
            <span className="rec-ed-hoja-aviso">
              <ImageOff size={20} aria-hidden />
              <span>{fallo.mensaje}</span>
              {fallo.reintentable ? (
                <PulsoButton variant="secondary" size="sm" onClick={onReintentar}>
                  <RefreshCw size={14} aria-hidden /> Reintentar
                </PulsoButton>
              ) : null}
            </span>
          ) : (
            <span className="rec-ed-hoja-aviso">
              <Loader2 size={18} className="pulso-spin" aria-hidden />
              <span>Dibujando la página…</span>
            </span>
          )}
        </div>
      )}
      {vista ? (
        <div className="rec-ed-zonas" data-qa-geometry-group="material-editor-zonas" data-qa-geometry-contract="intrinsic">
          {zonas.map(({ zona, blockId, rotulo, deLaUnidad, conProblema }) => {
            const elegida = seleccion === blockId;
            const etiqueta = zona.type === "access_qr" ? etiquetaDeAcceso : null;
            const nombre = nombreDeZona(rotulo, zona.bbox) + (etiqueta ? `, ${etiqueta}` : "");
            return (
              <button
                key={blockId}
                type="button"
                className={[
                  "rec-ed-zona",
                  deLaUnidad ? "is-unidad" : "is-fijo",
                  elegida ? "is-elegida" : "",
                  conProblema ? "is-problema" : "",
                ].filter(Boolean).join(" ")}
                style={zonaAEstilo(zona.bbox)}
                aria-label={nombre}
                aria-current={elegida ? "true" : undefined}
                title={rotulo}
                // C3: el interior de la zona es el bloque dibujado en la
                // imagen de debajo; su «vacío» es la tinta, no capacidad suelta.
                data-qa-geometry-capacity="owned"
                onClick={() => onSeleccionar(blockId)}
              >
                {etiqueta ? <span className="rec-ed-zona-etiqueta" aria-hidden>{etiqueta}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
      {vista && (desactualizada || cargando) ? (
        <span className={`rec-ed-pliego-estado${desactualizada ? " is-desactualizada" : ""}`} role="status">
          {desactualizada ? "Desactualizada" : <><Loader2 size={12} className="pulso-spin" aria-hidden /> Actualizando</>}
        </span>
      ) : null}
    </div>
  );
}
