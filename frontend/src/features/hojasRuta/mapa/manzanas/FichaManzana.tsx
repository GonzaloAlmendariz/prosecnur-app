import { PulsoButton } from "../../../../components/PulsoButton";
import { Grid3x3, X } from "../../../../vendor/lucide-react";
import { InspectorCabecera } from "../InspectorCabecera";
import type { PiezaManzana } from "../lienzo/piezas";
import { nombreDistrito } from "../nombres";
import { NSE } from "../territorio/TerritorioGraficos";

/**
 * Ficha de cualquier manzana del marco (paridad §7 del checklist del revamp: la página
 * clásica abría la ficha de cualquier manzana; el lienzo sólo la de las titulares). Un
 * clic en Manzanas, o en Selección fuera de una titular, la abre: cifras del marco, si
 * entra al marco elegible declarado y qué papel tiene en la muestra.
 */
type Props = {
  manzana: PiezaManzana;
  /** Nombre del distrito tal como lo da el marco (la pieza sólo trae el ubigeo). */
  distrito: string;
  /** «titular» o «reemplazo» con su UMP, o null si no salió en la muestra. */
  enMuestra: { rol: "titular" | "reemplazo"; ump: string } | null;
  /** Mínimo de viviendas del marco elegible declarado; null si no hay. */
  minimo: number | null;
  onCerrar: () => void;
};

const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(n));

export function FichaManzana({ manzana, distrito, enMuestra, minimo, onCerrar }: Props) {
  const nse = NSE.find(([codigo]) => codigo === manzana.nse)?.[1] ?? "Sin dato";
  const fuera = minimo !== null && manzana.viviendas < minimo;
  return (
    <>
      <InspectorCabecera
        icono={Grid3x3}
        sobre={`Manzana · ${distrito ? nombreDistrito(distrito) : manzana.ubigeo}`}
        titulo={`Zona ${manzana.zona} · Manzana ${String(manzana.id).slice(-4)}`}
        derecha={<PulsoButton variant="icon" size="sm" aria-label="Cerrar la ficha" onClick={onCerrar}><X size={14} /></PulsoButton>}
      />
      <div className="hr-mapa-ins-cuerpo">
        <div className="hr-mapa-cifras">
          <div><small>Viviendas</small><strong data-tono={manzana.viviendas === 0 ? "error" : undefined}>{fmt(manzana.viviendas)}</strong></div>
          <div><small>NSE</small><strong>{nse}</strong></div>
        </div>
        <dl className="hr-mapa-filas">
          <div><dt>Manzana</dt><dd>{manzana.id}</dd></div>
          <div><dt>Zona</dt><dd>{manzana.zona}</dd></div>
          <div><dt>En la muestra</dt><dd>{enMuestra ? `${enMuestra.rol === "titular" ? "Titular" : "Reemplazo"} · ${enMuestra.ump}` : "No salió"}</dd></div>
          {minimo !== null ? <div><dt>Marco elegible</dt><dd>{fuera ? `Queda fuera: menos de ${fmt(minimo)} viviendas` : "Entra"}</dd></div> : null}
        </dl>
        {manzana.viviendas === 0 ? <p className="hr-mapa-aviso">El censo no registra viviendas en esta manzana.</p> : null}
      </div>
    </>
  );
}
