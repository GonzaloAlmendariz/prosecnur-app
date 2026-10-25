import { useEffect, useMemo, useRef, useState } from "react";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import { getMonitoreoMailchimpEstado } from "../../../../../api/monitoreoMailchimp";
import type { MonitoreoWorkbenchRailTab } from "../../../components/MonitoreoWorkbenchRail";
import { useRegistrarPestanasMonitoreo } from "../../../useRegistrarPestanas";
import { indicadoresDeAcreditacion, insigniasDeAcreditacion } from "./barraAcreditacion";
import {
  direccionDeVista,
  vistaDeSeccion,
  type DireccionAcreditacion,
  type SeccionInterna,
  type VistaInterna,
} from "./direccionAcreditacion";
import { disponibilidad, pestanasDelRail } from "./modeloDelRail";
import { useResumenDelCorte } from "./resumenDelCorte";

/**
 * ¿El estudio tiene audiencia de Mailchimp? Es lo que decide si existe
 * Control › Correo. Se pregunta una vez al montar: la audiencia se declara en
 * la propia pestaña y no cambia mientras se navega.
 */
function useAudienciaDeCorreo(): boolean | null {
  const [tiene, setTiene] = useState<boolean | null>(null);
  useEffect(() => {
    let vivo = true;
    getMonitoreoMailchimpEstado()
      .then((estado) => { if (vivo) setTiene(Boolean(estado.list_id)); })
      // Sin respuesta no se sabe: la pestaña se sigue ofreciendo y su vista
      // dice qué falta, como hoy.
      .catch(() => undefined);
    return () => { vivo = false; };
  }, []);
  return tiene;
}

/**
 * Navegación del modo Acreditación (A1): dirección pública con alias de
 * lectura, pestañas condicionales, rail, registro para el inspector, barra
 * del modo. La página congelada solo la monta; la sincronización con la URL
 * (`useMonitoreoDireccionTraducida`) la llama la página, que es donde el
 * contrato de readiness la busca.
 */
const LEEN_CASOS: readonly string[] = ["avance/resumen", "avance/publicos"];

/**
 * Resumen y Por público muestran los casos, que llegan con el corte de
 * Control: la pestaña no está lista hasta que llegan o su lectura falla.
 */
export function useLecturaCompleta(seccion: string, pestana: string): boolean {
  const publica = direccionDeVista({ seccion, pestana });
  const casos = useResumenDelCorte((estado) => estado.casos);
  const fallaron = useResumenDelCorte((estado) => estado.casosFallaron);
  return !LEEN_CASOS.includes(`${publica.seccion}/${publica.pestana}`) || casos != null || fallaron;
}

/** Readiness por pestaña (G5): `monitoreo-acreditacion-<sección>-<pestaña>`. */
export function readinessDeAcreditacion(seccion: string, pestana: string): string {
  const publica = direccionDeVista({ seccion, pestana });
  return `monitoreo-acreditacion-${publica.seccion}-${publica.pestana}`;
}

export function useNavegacionAcreditacion({
  vistaActiva,
  state,
  reports,
  tieneBarrido,
  internas,
  modo,
  ir,
}: {
  vistaActiva: VistaInterna;
  state: MonitoreoState | null;
  reports: MonitoreoAcreditacionReports | null;
  /** `null` mientras no hay estado. */
  tieneBarrido: boolean | null;
  internas: (seccion: SeccionInterna) => readonly MonitoreoWorkbenchRailTab[];
  modo: string;
  ir: (vista: VistaInterna) => void;
}) {
  const correo = useAudienciaDeCorreo();
  const disponible = useMemo(() => disponibilidad({ correo, barrido: tieneBarrido }), [correo, tieneBarrido]);
  const publica: DireccionAcreditacion = direccionDeVista(vistaActiva);

  // Una pestaña condicional que el estudio no tiene cede su lugar a la primera
  // de su sección, en cuanto se sabe que no existe.
  const irRef = useRef(ir);
  irRef.current = ir;
  const existe = disponible(publica.seccion, publica.pestana);
  useEffect(() => {
    if (!existe) irRef.current(vistaDeSeccion(publica.seccion, disponible));
  }, [existe, publica.seccion, disponible]);

  // `internas` es una función nueva en cada render; lo que decide el rail es
  // el corte, así que se lee por referencia.
  const internasRef = useRef(internas);
  internasRef.current = internas;
  const pestanas = useMemo(
    () => pestanasDelRail(publica.seccion, (seccion) => internasRef.current(seccion), disponible),
    [publica.seccion, state, reports, disponible],
  );
  useRegistrarPestanasMonitoreo(modo, publica.seccion, pestanas);

  const goals = state?.config?.goals;
  const observar = useResumenDelCorte((estado) => estado.observar);
  const olvidar = useResumenDelCorte((estado) => estado.olvidar);
  useEffect(() => { observar(reports, goals ?? []); }, [observar, reports, goals]);
  useEffect(() => () => olvidar(), [olvidar]);

  const avance = useResumenDelCorte((estado) => estado.avance);
  const casos = useResumenDelCorte((estado) => estado.casos);
  const declarados = state?.config?.monitoreo_profile?.units?.length ?? 0;

  return {
    publica,
    disponible,
    pestanas,
    indicadores: indicadoresDeAcreditacion(avance?.tarjetas ?? null, declarados),
    insignias: insigniasDeAcreditacion(avance, casos),
  };
}
