// Cuerpo de «Ver armonización» (ADR 0102): lo que quedó guardado al crear la
// base desde un formulario publicado. Solo lectura. Reusa la vista previa para
// veredicto, contadores, recodificaciones y lo que no calza; aquí sólo se suma
// la cabecera con formulario, revisión, fuente y fecha.

import type { ArmonizacionBase } from "../../../api/cargaArmonizacion";
import { FileCheck2, Loader2 } from "../../../vendor/lucide-react";
import { cabeceraArmonizacion } from "./compararFuentesModel";
import { VistaPreviaFormularioPublicado } from "./VistaPreviaFormularioPublicado";
import "./formularioPublicado.css";
import "./armonizacionBase.css";

export type CargaArmonizacion =
  | { tipo: "cargando" }
  | { tipo: "listo"; datos: ArmonizacionBase }
  | { tipo: "error"; mensaje: string };

export function ArmonizacionBaseVista({ carga }: { carga: CargaArmonizacion }) {
  if (carga.tipo === "cargando") {
    return (
      <div className="pulso-plf-estado" role="status" data-qa-geometry-capacity="owned">
        <Loader2 size={16} aria-hidden="true" className="pulso-bfp-giro" />
        <p>Leyendo la armonización guardada…</p>
      </div>
    );
  }
  if (carga.tipo === "error") {
    return (
      <div className="pulso-plf-estado is-error" role="alert" data-qa-geometry-capacity="owned">
        <strong>No se pudo leer la armonización</strong>
        <p>{carga.mensaje}</p>
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
        <div className="pulso-plf-estado" role="status" data-qa-geometry-capacity="owned">
          <strong>Esta base no guarda su armonización</strong>
          <p>
            Se registra al crear la base desde «Formulario publicado». Esta se creó antes o por otra vía, así que no hay
            recodificaciones ni coberturas que mostrar. Para tenerlas, vuelve a crearla desde su formulario.
          </p>
        </div>
      )}
    </>
  );
}
