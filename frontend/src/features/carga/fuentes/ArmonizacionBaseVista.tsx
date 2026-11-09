// Cuerpo de «Ver armonización» (ADR 0102): lo que quedó guardado al crear la
// base desde un formulario publicado. Solo lectura. Reusa la vista previa para
// veredicto, contadores, recodificaciones y lo que no calza; aquí sólo se suma
// la cabecera con formulario, revisión, fuente y fecha.

import type { ArmonizacionBase } from "../../../api/cargaArmonizacion";
import { FileCheck2, Loader2, Inbox } from "../../../vendor/lucide-react";
import { cabeceraArmonizacion } from "./compararFuentesModel";
import { VistaPreviaFormularioPublicado } from "./VistaPreviaFormularioPublicado";
import "./formularioPublicado.css";
import "./armonizacionBase.css";

import { EstadoVacio } from "../../../components/EstadoVacio";
import { LoadingBlock, ErrorBlock } from "../../../components/States";
export type CargaArmonizacion =
  | { tipo: "cargando" }
  | { tipo: "listo"; datos: ArmonizacionBase }
  | { tipo: "error"; mensaje: string };

export function ArmonizacionBaseVista({ carga }: { carga: CargaArmonizacion }) {
  if (carga.tipo === "cargando") {
    return (
      <div data-qa-geometry-capacity="owned">
        <LoadingBlock variant="inline" label="Leyendo la armonización guardada…" />
      </div>
    );
  }
  if (carga.tipo === "error") {
    return (
      <div data-qa-geometry-capacity="owned">
        <ErrorBlock label="No se pudo leer la armonización" detail={carga.mensaje} />
      </div>
    );
  }
  const datos = carga.datos;
  const cabecera = cabeceraArmonizacion(datos);
  return (
    <>
      {cabecera.length ? (
        <dl className="pulso-arb-cabecera" data-qa-geometry-group="carga/armonizacion-base/cabecera" data-qa-geometry-contract="equal">
          {cabecera.map((d) => (
            <div key={d.clave} className="pulso-arb-dato" data-qa-geometry-member>
              <dt>{d.rotulo}</dt>
              <dd>{d.clave === "formulario" ? <><FileCheck2 size={13} aria-hidden="true" />{d.valor}</> : d.valor}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {datos.disponible ? (
        <VistaPreviaFormularioPublicado vistaPrevia={datos.detalle} grupoQa="carga/armonizacion-base" />
      ) : (
        // C5: vacío legítimo. La base no guarda armonización: se creó por otra
        // vía o antes de que Prosecnur la registrara. No se inventa una.
        <div data-qa-geometry-capacity="owned">
          <EstadoVacio icono={<Inbox size={16} />} titulo="Esta base no guarda su armonización" descripcion='Se registra al crear la base desde "Formulario publicado". Esta se creó antes o por otra vía, así que no hay recodificaciones ni coberturas que mostrar. Para tenerlas, vuelve a crearla desde su formulario.' />
        </div>
      )}
    </>
  );
}
