// Territorial › Unidades › Lista (ADR 0118 §1): las UMP de la foto, titulares
// con sus reemplazos debajo y agrupadas por distrito. `foco=<id_manzana>`
// resalta una; `panel=hoja` abre su hoja en grande (DialogoHojaUmp).
//
// Contrato de Superficie:
// - C1: `material-campo/territorial/distritos` (intrinsic), un distrito por miembro.
// - C3: sin foto o sin coincidencias, el vacío es de la lista (EstadoVacio).
// - C4: el scroll es del panel de la sección; la lista no fija alto propio.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import type { UnidadTerritorial, UnidadesTerritoriales as Unidades } from "../../../api/materialTerritorial";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PulsoInput } from "../../../components/PulsoInput";
import { ROTULO_DE_FASE } from "../campanas/modeloRegistro";
import { AlertTriangle, FileText, MapPinned, Search } from "../../../vendor/lucide-react";
import { DialogoHojaUmp } from "./DialogoHojaUmp";
import { agruparUnidades, fechaDelEnvio, rangoDeLaUmp, unidadDelFoco } from "./modeloUnidades";

/** Selección › Entrega en Hojas de ruta: donde se (re)envía la muestra. */
export const HREF_REENVIO = "/hojas-ruta?seccion=seleccion&panel=salidas";

type Props = {
  unidades: Unidades | null;
  /** El mensaje del 409 cuando la foto ya no está. */
  sinFuente: string | null;
  foco: string | null;
  hrefDeFoco: (foco: string) => string;
  hrefDeHoja: (foco: string) => string;
};

export function AvisoDesactualizada({ enviadoAt }: { enviadoAt: string | null }) {
  const cuando = fechaDelEnvio(enviadoAt);
  return (
    <div className="rec-terr-aviso" role="status">
      <AlertTriangle size={15} aria-hidden />
      <p>
        La muestra cambió en Hojas de ruta desde el envío{cuando ? ` del ${cuando}` : ""}. Mientras no se reenvíe, aquí no se genera material: saldría de una muestra distinta de la enviada.{" "}
        <Link to={HREF_REENVIO}>Ir a Hojas de ruta</Link>
      </p>
    </div>
  );
}

export function VacioSinFuente({ mensaje }: { mensaje: string | null }) {
  return (
    <EstadoVacio
      tamano="normal"
      icono={<MapPinned size={22} />}
      titulo="No hay muestra enviada"
      descripcion={mensaje ?? "Envía la muestra desde Hojas de ruta › Selección › Entrega para ver sus UMP aquí."}
      accion={<Link className="rec-terr-enlace" to={HREF_REENVIO}>Ir a Hojas de ruta</Link>}
    />
  );
}

function FilaUmp({ u, enfocada, hrefDeFoco, hrefDeHoja }: { u: UnidadTerritorial; enfocada: boolean; hrefDeFoco: string; hrefDeHoja: string }) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (enfocada) ref.current?.scrollIntoView({ block: "nearest" });
  }, [enfocada]);
  const detalle = [u.zona ? `Zona ${u.zona}` : "", u.manzana ? `Mz ${u.manzana}` : "", rangoDeLaUmp(u)].filter(Boolean).join(" · ");
  return (
    <li ref={ref} className={`rec-terr-ump is-${u.role}`} data-foco={enfocada || undefined}>
      <Link className="rec-terr-ump-enlace" to={hrefDeFoco} aria-current={enfocada ? "location" : undefined}>
        <strong>{u.label}</strong>
        <small>{detalle || u.unit_id}</small>
      </Link>
      <Link className="rec-terr-ump-hoja" to={hrefDeHoja} aria-label={`Ver la hoja de ${u.label}`}>
        <FileText size={13} aria-hidden /> Hoja
      </Link>
    </li>
  );
}

export function UnidadesTerritoriales({ unidades, sinFuente, foco, hrefDeFoco, hrefDeHoja }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const grupos = useMemo(() => agruparUnidades(unidades?.units ?? [], busqueda), [busqueda, unidades]);
  const enfocada = unidadDelFoco(unidades?.units ?? [], foco);

  if (!unidades) {
    return (
      <div className="rec-terr-seccion" data-qa-geometry-capacity="owned">
        <VacioSinFuente mensaje={sinFuente} />
      </div>
    );
  }

  const cuando = fechaDelEnvio(unidades.enviado_at);
  return (
    <div className="rec-terr-seccion">
      {unidades.stale ? <AvisoDesactualizada enviadoAt={unidades.enviado_at} /> : null}
      <header className="rec-terr-cabeza">
        <span>
          <h2>UMP de la muestra</h2>
          <p>
            {unidades.n_titulares.toLocaleString("es-PE")} titulares y {unidades.n_reemplazos.toLocaleString("es-PE")} reemplazos
            {` · ${ROTULO_DE_FASE[unidades.fase]}`}
            {cuando ? ` · enviada el ${cuando}` : ""}
          </p>
        </span>
        <label className="rec-terr-buscar">
          <Search size={14} aria-hidden />
          <PulsoInput
            type="search"
            aria-label="Buscar UMP"
            placeholder="UMP, distrito, zona o manzana"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </label>
      </header>

      {grupos.length ? (
        <div className="rec-terr-distritos" data-qa-geometry-group="material-campo/territorial/distritos" data-qa-geometry-contract="intrinsic">
          {grupos.map((g) => (
            <section key={g.clave} className="rec-terr-distrito" data-qa-geometry-member aria-label={`Distrito ${g.distrito || g.clave}`}>
              <h3>
                {g.distrito || g.clave}
                <small>{g.titulares.length.toLocaleString("es-PE")} {g.titulares.length === 1 ? "titular" : "titulares"}</small>
              </h3>
              <ul className="rec-terr-umps">
                {g.titulares.map(({ titular, reemplazos }) => (
                  <li key={titular.unit_id} className="rec-terr-par">
                    <ul className="rec-terr-umps">
                      <FilaUmp u={titular} enfocada={foco === titular.unit_id} hrefDeFoco={hrefDeFoco(titular.unit_id)} hrefDeHoja={hrefDeHoja(titular.unit_id)} />
                      {reemplazos.map((r) => (
                        <FilaUmp key={r.unit_id} u={r} enfocada={foco === r.unit_id} hrefDeFoco={hrefDeFoco(r.unit_id)} hrefDeHoja={hrefDeHoja(r.unit_id)} />
                      ))}
                    </ul>
                  </li>
                ))}
                {g.sueltos.map((r) => (
                  <FilaUmp key={r.unit_id} u={r} enfocada={foco === r.unit_id} hrefDeFoco={hrefDeFoco(r.unit_id)} hrefDeHoja={hrefDeHoja(r.unit_id)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <EstadoVacio
          icono={<Search size={18} />}
          titulo={unidades.units.length ? `Ninguna UMP coincide con «${busqueda}»` : "La muestra enviada no trae UMP"}
          descripcion={unidades.units.length ? "Prueba con el código, el distrito o la zona." : "Vuelve a enviarla desde Hojas de ruta."}
        />
      )}

      <DialogoHojaUmp unidad={enfocada} stale={unidades.stale} />
    </div>
  );
}
