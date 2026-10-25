import { memo, useMemo } from "react";
import { LIMA_DISTRICT_FEATURES } from "../TerritorialRouteCoverageAtlas";
import { buscarDistrito, construirSilueta } from "./siluetaModel";

/**
 * El contorno del distrito como sello de la tarjeta de UMP. Decorativo: el
 * nombre del distrito ya va escrito al lado, así que no lleva nombre accesible.
 * Sin geometría para ese distrito no pinta nada (no se inventa un contorno).
 */
function SiluetaDeDistritoImpl({
  distrito,
  manzana = null,
  lado = 44,
  tono = "neutro",
}: {
  distrito: string;
  manzana?: { lon: number; lat: number } | null;
  lado?: number;
  tono?: "neutro" | "falta" | "ok" | "info";
}) {
  const silueta = useMemo(() => {
    const feature = buscarDistrito(LIMA_DISTRICT_FEATURES, distrito);
    return feature ? construirSilueta(feature, 64, 4, manzana) : null;
  }, [distrito, manzana]);
  if (!silueta) return null;
  return (
    <svg
      className={`mon-ter-silueta is-${tono}`}
      viewBox={`0 0 ${silueta.lado} ${silueta.lado}`}
      width={lado}
      height={lado}
      aria-hidden="true"
      focusable="false"
      data-silueta={silueta.ubigeo}
    >
      <path d={silueta.trazo} />
      {silueta.punto ? <circle cx={silueta.punto.x} cy={silueta.punto.y} r={4.5} /> : null}
    </svg>
  );
}

export const SiluetaDeDistrito = memo(SiluetaDeDistritoImpl);
