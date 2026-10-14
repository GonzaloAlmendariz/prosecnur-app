// Panel «Ver armonización» de una base (ADR 0102). Direccionable:
// `?panel=armonizacion-base&foco=<base>`; un enlace guardado abre la misma base.

import { useCallback, useEffect, useState } from "react";
import { useInRouterContext, useLocation, useNavigate } from "react-router-dom";
import { apiCargaArmonizacionBase } from "../../../api/cargaArmonizacion";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { useSeccion } from "../../../lib/navegacion/useDireccion";
import { ArmonizacionBaseVista, type CargaArmonizacion } from "./ArmonizacionBaseVista";
import { PANEL_ARMONIZACION_BASE, searchSinPanelYFoco } from "./compararFuentesModel";
import { PanelLateralFuentes } from "./PanelLateralFuentes";

/** Readiness del panel: `false` sólo mientras lee (AD6). */
export function readinessArmonizacion(carga: CargaArmonizacion, foco: string | null): string {
  if (!foco) return "vacio:sin-base";
  if (carga.tipo === "cargando") return "false";
  if (carga.tipo === "error") return "vacio:error";
  return carga.datos.disponible ? "true" : "vacio:sin-armonizacion";
}

function PanelConDireccion() {
  const panel = usePanelDireccionable(PANEL_ARMONIZACION_BASE);
  const procesamiento = useSeccion("procesamiento");
  const location = useLocation();
  const navigate = useNavigate();
  const foco = panel.abierto ? procesamiento.foco?.trim() || null : null;
  const [carga, setCarga] = useState<CargaArmonizacion>({ tipo: "cargando" });

  useEffect(() => {
    if (!foco) return;
    let vigente = true;
    setCarga({ tipo: "cargando" });
    apiCargaArmonizacionBase(foco)
      .then((datos) => { if (vigente) setCarga({ tipo: "listo", datos }); })
      .catch((e: unknown) => { if (vigente) setCarga({ tipo: "error", mensaje: e instanceof Error ? e.message : String(e) }); });
    return () => { vigente = false; };
  }, [foco]);

  const cerrar = useCallback(
    () => navigate({ pathname: location.pathname, search: searchSinPanelYFoco(location.search) }, { replace: true }),
    [location.pathname, location.search, navigate],
  );

  return (
    <PanelLateralFuentes
      panel={panel}
      antetitulo="Carga › Bases del estudio"
      titulo={foco ? `Armonización de «${foco}»` : "Armonización de la base"}
      descripcion="Cómo se llevaron las respuestas a las variables y los códigos del formulario al crear la base. Solo lectura."
      auditReady={readinessArmonizacion(carga, foco)}
      claveDisparador={foco ? `armonizacion:${foco}` : null}
      onCerrar={cerrar}
    >
      {foco ? (
        <ArmonizacionBaseVista carga={carga} />
      ) : (
        <div className="pulso-plf-estado" role="status" data-qa-geometry-capacity="owned">
          <p>El enlace no nombra ninguna base. Ábrela desde su tarjeta en Bases del estudio.</p>
        </div>
      )}
    </PanelLateralFuentes>
  );
}

/** Fuera de un router (renders estáticos) no hay dirección que lo abra. */
export function ArmonizacionBasePanel() {
  return useInRouterContext() ? <PanelConDireccion /> : null;
}
