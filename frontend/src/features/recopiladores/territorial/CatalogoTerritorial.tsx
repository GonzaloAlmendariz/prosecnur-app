// Territorial › Catálogo (ADR 0118 §1): las dos piezas que se imprimen, con los
// mismos motores de Hojas de ruta (layout legacy de E2).
//
// - Ficha por UMP: qué dice cada cara y una prueba sobre una UMP elegida o
//   sobre una manzana al azar (`ficha-ump`, `random-pdf`).
// - Hoja de zona: qué trae y cuántas salen; no tiene vista previa propia en el
//   backend, se genera dentro del ZIP de Paquetes.
//
// Contrato de Superficie: cada pieza es una tarjeta con título y su propio
// vacío (C1/C3); el scroll es del panel de la sección (C4).

import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";

import type { HojasRutaState } from "../../../api/hojasRuta";
import type { UnidadesTerritoriales } from "../../../api/materialTerritorial";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { conNivel } from "../../../lib/navegacion/direccion";
import { FileText, MapPinned } from "../../../vendor/lucide-react";
import { FichaPorUmp } from "./FichaPorUmp";
import { CodigosDeResultado, HojaDePapel } from "./HojasDeCampo";
import { AvisoDesactualizada, VacioSinFuente } from "./UnidadesTerritoriales";



const PESTANAS_DE_CATALOGO = ["fichas", "zonas", "ruteo", "consolidados", "codigos"] as const;
export type PestanaDeCatalogo = (typeof PESTANAS_DE_CATALOGO)[number];

export function esPestanaDeCatalogo(valor: string): valor is PestanaDeCatalogo {
  return (PESTANAS_DE_CATALOGO as readonly string[]).includes(valor);
}

type Props = {
  pestana: PestanaDeCatalogo;
  campaignId: string;
  unidades: UnidadesTerritoriales | null;
  hojas: HojasRutaState | null;
};

function HojaDeZona({ unidades }: { unidades: UnidadesTerritoriales }) {
  const location = useLocation();
  const zonas = useMemo(() => new Set(unidades.units.map((u) => `${u.ubigeo}|${u.zona}`)).size, [unidades]);
  const aPaquetes = `${location.pathname}${conNivel(conNivel(location.search, "seccion", "paquetes"), "pestana", "armado")}`;
  return (
    <article className="rec-terr-tarjeta" data-qa-geometry-member>
      <h3><MapPinned size={15} aria-hidden /> Hoja de zona</h3>
      <p className="rec-terr-nota">
        Una página apaisada por zona con todas sus rutas sobre el mismo mapa de la cara 2: titulares rellenas y numeradas,
        reemplazos con borde discontinuo e insignia «R», y al lado el resumen y la tabla de rutas.
      </p>
      <dl className="rec-terr-cifras">
        <div><dt>Hojas de zona</dt><dd>{zonas.toLocaleString("es-PE")}</dd></div>
        <div><dt>UMP en ellas</dt><dd>{unidades.units.length.toLocaleString("es-PE")}</dd></div>
      </dl>
      <p className="rec-terr-nota">
        No tiene vista previa suelta: sale dentro del ZIP del paquete. <Link to={aPaquetes}>Ir a Paquetes</Link>
      </p>
    </article>
  );
}

export function CatalogoTerritorial({ pestana, campaignId, unidades, hojas }: Props) {
  if (!unidades) {
    return (
      <div className="rec-terr-seccion" data-qa-geometry-capacity="owned">
        <VacioSinFuente mensaje={null} />
      </div>
    );
  }
  return (
    <div className="rec-terr-seccion">
      {unidades.stale ? <AvisoDesactualizada enviadoAt={unidades.enviado_at} /> : null}
      <div className="rec-terr-tarjetas" data-qa-geometry-group={`material-campo/territorial/catalogo-${pestana}`} data-qa-geometry-contract="intrinsic">
        {pestana === "zonas" ? <HojaDeZona unidades={unidades} /> : null}
        {pestana === "codigos" ? <CodigosDeResultado campaignId={campaignId} /> : null}
        {(pestana === "fichas" || pestana === "ruteo" || pestana === "consolidados") && !unidades.units.length ? (
          <EstadoVacio icono={<FileText size={18} />} titulo="La muestra enviada no trae UMP" descripcion="Vuelve a enviarla desde Hojas de ruta." />
        ) : null}
        {pestana === "fichas" && unidades.units.length ? <FichaPorUmp unidades={unidades} hojas={hojas} /> : null}
        {(pestana === "ruteo" || pestana === "consolidados") && unidades.units.length ? (
          <HojaDePapel key={pestana} pieza={pestana} campaignId={campaignId} unidades={unidades} />
        ) : null}
      </div>
    </div>
  );
}
