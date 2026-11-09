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

import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { HojasRutaState } from "../../../api/hojasRuta";
import type { UnidadesTerritoriales, UnidadTerritorial } from "../../../api/materialTerritorial";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { formatoConteo } from "../../../lib/formatoNumero";
import { conNivel } from "../../../lib/navegacion/direccion";
import { FileText, MapPinned } from "../../../vendor/lucide-react";
import { FichaPorUmp } from "./FichaPorUmp";
import { MaquetaDeZona } from "./MaquetaDeHoja";
import "./ficha.css";
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
  const navigate = useNavigate();
  // Las zonas en el orden en que llegan, con sus UMP: la maqueta dibuja la elegida.
  const zonas = useMemo(() => {
    const porZona = new Map<string, { clave: string; zona: string; distrito: string; units: UnidadTerritorial[] }>();
    for (const u of unidades.units) {
      const clave = `${u.ubigeo}|${u.zona}`;
      const z = porZona.get(clave) ?? { clave, zona: u.zona, distrito: u.distrito, units: [] };
      z.units.push(u);
      porZona.set(clave, z);
    }
    return [...porZona.values()];
  }, [unidades]);
  const [elegida, setElegida] = useState(zonas[0]?.clave ?? "");
  const zona = zonas.find((z) => z.clave === elegida) ?? zonas[0] ?? null;
  const aPaquetes = `${location.pathname}${conNivel(conNivel(location.search, "seccion", "paquetes"), "pestana", "armado")}`;
  // Pasada de diseño (2 nov 2026): el esquema de Fichas, con la hoja de la zona elegida en maqueta.
  return (
    <div className="rec-terr-ficha" data-qa-geometry-member>
      <figure className="rec-terr-ficha-escenario" data-qa-geometry-capacity="owned">
        {zona ? <MaquetaDeZona unidades={zona.units} zona={zona.zona} /> : null}
        <figcaption>{zona ? `${zona.distrito}, zona ${zona.zona || "—"}, estructura de la hoja` : ""}</figcaption>
      </figure>
      <aside className="rec-terr-ficha-panel" aria-labelledby="rec-terr-hoja-zona">
        <div>
          <h2 id="rec-terr-hoja-zona"><MapPinned size={18} aria-hidden /> Hoja de zona</h2>
          <p className="rec-terr-nota">
            Una página apaisada por zona con todas sus rutas sobre el mismo mapa: titulares numeradas, reemplazos con
            borde discontinuo e insignia "R", y al lado la tabla de rutas.
          </p>
        </div>
        <dl className="rec-terr-cifras">
          <div><dt>Hojas de zona</dt><dd>{formatoConteo(zonas.length)}</dd></div>
          <div><dt>UMP en ellas</dt><dd>{formatoConteo(unidades.units.length)}</dd></div>
        </dl>
        <div className="rec-terr-campo">
          <span aria-hidden>Zona</span>
          <PulsoSelect
            size="sm"
            ariaLabel="Zona de la maqueta"
            value={elegida || undefined}
            onValueChange={setElegida}
            options={zonas.map((z) => ({ value: z.clave, label: `${z.distrito}, zona ${z.zona || "—"}` }))}
          />
        </div>
        <p className="rec-terr-nota">No tiene vista previa suelta: sale dentro del ZIP del paquete.</p>
        <div className="rec-terr-ficha-acciones">
          <PulsoButton variant="secondary" onClick={() => navigate(aPaquetes)}>Ir a Paquetes</PulsoButton>
        </div>
      </aside>
    </div>
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
