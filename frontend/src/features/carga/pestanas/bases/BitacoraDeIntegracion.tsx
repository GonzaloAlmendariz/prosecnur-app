// Bitácora de la integración (Carga › Bases, R2): el detalle técnico completo
// que `IntegratedHistoryPanel` guardaba bajo un acordeón, ahora en su panel
// lateral: `panel=bitacora-integracion&foco=<base>`. Al cerrarlo queda abierto
// el inspector de la misma base.

import { EstadoVacio } from "../../../../components/EstadoVacio";
import { Sideover } from "../../../../components/Sideover";
import { useSeccion } from "../../../../lib/navegacion/useDireccion";
import { Inbox, ScrollText } from "../../../../vendor/lucide-react";
import { PANEL_BITACORA_INTEGRACION } from "../../panelesCarga";
import type { ColeccionDeBases } from "./basesModel";
import { resumenDeIntegracion } from "./integracionModel";

function Vacio({ titulo }: { titulo: string }) {
  return <EstadoVacio icono={<Inbox size={16} />} titulo={titulo} />;
}

export function BitacoraDeIntegracion({ coleccion }: { coleccion: ColeccionDeBases }) {
  const { foco } = useSeccion("procesamiento");
  const fila = coleccion.bases.find((b) => b.nombre === foco) ?? null;
  const base = fila?.base ?? null;
  const resumen = base ? resumenDeIntegracion(base) : null;
  return (
    <Sideover
      panel={PANEL_BITACORA_INTEGRACION}
      title={fila && base ? `Bitácora de la integración de ${fila.etiqueta}` : "Bitácora de la integración"}
      icon={<ScrollText size={16} aria-hidden="true" />}
      className="pulso-bases-bitacora"
    >
      {resumen ? (
        <div className="pulso-bases-bitacora-cuerpo">
          <section aria-labelledby="bitacora-origenes">
            <h4 id="bitacora-origenes" className="pulso-bases-bloque-titulo">Orígenes</h4>
            {resumen.origenes.length ? (
              <ul className="pulso-bases-bitacora-lista">
                {resumen.origenes.map((o) => (
                  <li key={o.clave}><code>{o.llave}</code><span>{o.etiqueta}</span><small>{o.fuente}</small></li>
                ))}
              </ul>
            ) : <Vacio titulo="Sin orígenes registrados" />}
          </section>
          <section aria-labelledby="bitacora-comun">
            <h4 id="bitacora-comun" className="pulso-bases-bloque-titulo">Fraseo final común</h4>
            {resumen.fraseoComun.length ? (
              <ul className="pulso-bases-bitacora-lista">
                {resumen.fraseoComun.map((e) => (
                  <li key={e.key}><code>{e.variable}</code><span>{e.value}</span></li>
                ))}
              </ul>
            ) : <Vacio titulo="Sin cambios de fraseo" />}
          </section>
          <section aria-labelledby="bitacora-por-origen">
            <h4 id="bitacora-por-origen" className="pulso-bases-bloque-titulo">Fraseos propios por origen</h4>
            {resumen.fraseosPorOrigen.length ? resumen.fraseosPorOrigen.map((g) => (
              <div key={g.origin} className="pulso-bases-bitacora-grupo">
                <strong>{g.origin}</strong>
                <ul className="pulso-bases-bitacora-lista">
                  {g.entries.map((e) => (
                    <li key={e.key}><code>{e.variable}</code><span>{e.value}</span></li>
                  ))}
                </ul>
              </div>
            )) : <Vacio titulo="Sin fraseos propios" />}
          </section>
          <section aria-labelledby="bitacora-variantes">
            <h4 id="bitacora-variantes" className="pulso-bases-bloque-titulo">Variables preservadas por origen</h4>
            {resumen.variantes.length ? (
              <ul className="pulso-bases-bitacora-lista">
                {resumen.variantes.flatMap((g) => g.rows.map((v, i) => (
                  <li key={`${g.from}-${v.to}-${i}`}>
                    <code>{g.from}</code>
                    <span>{v.to || "sin variante"}</span>
                    {v.origin || v.ref ? <small>{v.origin || v.ref}</small> : null}
                  </li>
                )))}
              </ul>
            ) : <Vacio titulo="Sin variantes" />}
          </section>
        </div>
      ) : (
        <div data-qa-geometry-capacity="owned">
          <Vacio titulo="El enlace no nombra una base integrada" />
        </div>
      )}
    </Sideover>
  );
}
