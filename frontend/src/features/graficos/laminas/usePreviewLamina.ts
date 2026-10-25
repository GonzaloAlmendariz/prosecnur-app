// Vista previa real de la lámina seleccionada (F6.1). No reimplementa debounce ni cancelación: usa
// `crearCoordinadorPreviewLamina` (F6.0b.2), un coordinador por lámina para que «la imagen anterior» que se muestra
// como desactualizada sea siempre de ESTA lámina y no de la que se miraba antes. Volver a una lámina sin cambios
// responde al instante desde el coordinador, también tras desmontar el visor: los coordinadores y lo ya dibujado viven
// en un registro de módulo (U6, previewLaminaRegistro.ts). El render corre como job (`/preview-slide-job`, F6 §5.3): Plumber no queda
// bloqueado y la vista muestra el progreso; si el backend no tiene la ruta, se cae al síncrono (`previewPorJob.ts`).

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getSession } from "../../../api/core";
import { apiGraficosPreviewSlide, normalizePreviewFormas, type PreviewFormas, type Slide } from "../../../api/graficos";
import { apiGraficosPreviewSlideJob } from "../../../api/graficosMiniaturas";
import { apiJobCancel } from "../../../api/jobs";
import { iniciarJobPoll } from "../../../hooks/useJob";
import { buildGraficosConfigFromStore } from "../configSnapshot";
import { clavePreview, crearCoordinadorPreviewLamina, estaDesactualizada, type EstadoPreviewLamina } from "../previewLaminaCoordinador";
import { useGraficosReportScope } from "../reportScope";
import { usePlanStore } from "../store";
import { estadoDeLamina, leerLaminaVisor, type LaminaVisor } from "./estadoLamina";
import { useLaminasUi } from "./laminasStore";
import { crearCargaPreviewPorJob, type ProgresoPreview } from "./miniaturas/previewPorJob";
import { crearRegistroPreviewLaminas } from "./previewLaminaRegistro";

/** Una sola instancia por app: recuerda si el backend tiene la ruta del job. */
const cargarPreview = crearCargaPreviewPorJob({
  lanzar: apiGraficosPreviewSlideJob,
  sincrono: apiGraficosPreviewSlide,
  poll: (jobId, onUpdate) => iniciarJobPoll(jobId, onUpdate),
  cancelar: apiJobCancel,
});

/**
 * Lo que el cargador de un coordinador lee al disparar: el alcance vigente y quién escucha el progreso. Vive en el
 * módulo porque el coordinador sobrevive al hook que lo creó (U6); el hook montado lo actualiza.
 */
const vivo: { alcance: string; onProgreso: ((slideId: string, p: ProgresoPreview) => void) | null } = { alcance: "active", onProgreso: null };

/** Coordinadores por lámina y respuestas por clave, a nivel de módulo (U6, previewLaminaRegistro.ts). */
const registro = crearRegistroPreviewLaminas((id, cache) => crearCoordinadorPreviewLamina((_clave, { signal }) => {
  const slide = usePlanStore.getState().plan.slides.find((s) => s.id === id);
  if (!slide) return Promise.reject(new Error("La lámina ya no está en el informe."));
  return cargarPreview({
    // El cargador lee la lámina vigente del plan al disparar (después del debounce), no la de un render.
    slide,
    config: buildGraficosConfigFromStore(),
    options: {
      include_images: false,
      preview_quality: calidadParaPantalla(),
      render_slide_preview: true,
      preview_partes: true,
      preview_formas: true,
      ...(vivo.alcance === "consolidated" ? { scope: "consolidated" as const } : {}),
    },
    signal,
    onProgreso: (p) => { if (!signal.aborted) vivo.onProgreso?.(id, p); },
  });
}, { cache }));

// Lo dibujado deja de valer si cambia la sesión, la base activa o los datos que lee el motor.
if (typeof window !== "undefined") {
  for (const ev of ["pulso:session-changed", "pulso:session-lost", "pulso:project-closed", "pulso:active-base-changed",
    "pulso:analitica-source-changed", "pulso:codif-source-changed"]) window.addEventListener(ev, () => registro.olvidar());
}

export type VistaPreviaLamina = {
  /** Fase del coordinador: inactiva, esperando (debounce), cargando, lista o error. */
  fase: EstadoPreviewLamina["estado"];
  /** Lo que se dibuja: la respuesta lista o, mientras llega otra, la anterior de esta lámina. */
  lamina: LaminaVisor | null;
  desactualizada: boolean;
  error: string | null;
  /** Progreso del job mientras la fase es «cargando»; null en las demás. */
  progreso: ProgresoPreview | null;
  reintentar: () => void;
  /** Formas y ranuras del estándar de lo que se dibuja (K11), para las guías del visor; null sin respuesta. */
  formas: PreviewFormas | null;
};

export function usePreviewLamina(slide: Slide | null, antetituloHeredado: string | null, habilitada: boolean): VistaPreviaLamina {
  const { search } = useLocation();
  const scope = useGraficosReportScope(search);
  const plan = usePlanStore((s) => s.plan);
  const presets = usePlanStore((s) => s.presets);
  const paletas = usePlanStore((s) => s.paletas);
  const paletasVinculos = usePlanStore((s) => s.paletasVinculos);
  const iconos = usePlanStore((s) => s.iconos);
  const estiloCliente = usePlanStore((s) => s.estiloCliente);
  const overrides = usePlanStore((s) => s.overridesReusables);
  const scopeRules = usePlanStore((s) => s.scopeRules);
  const registrarResumen = useLaminasUi((s) => s.registrarResumen);
  const registrarMiniatura = useLaminasUi((s) => s.registrarMiniatura);
  const [estado, setEstado] = useState<EstadoPreviewLamina>({ estado: "inactiva" });
  const [intento, setIntento] = useState(0);
  const [progreso, setProgreso] = useState<ProgresoPreview | null>(null);
  // El progreso sólo se pinta si viene del coordinador de la lámina que se mira.
  const activa = useRef<string | null>(null);
  activa.current = slide && habilitada ? slide.id : null;
  vivo.alcance = scope;
  useEffect(() => {
    const oir = (id: string, p: ProgresoPreview) => { if (activa.current === id) setProgreso(p); };
    vivo.onProgreso = oir;
    return () => { if (vivo.onProgreso === oir) vivo.onProgreso = null; };
  }, []);

  // Lo que define la imagen: la lámina, el antetítulo que hereda y lo del plan que no son láminas (estilo, paletas y
  // sus vínculos, íconos, reglas por alcance). Las demás láminas no entran: editar otra no invalida ésta.
  const planSinLaminas = useMemo(() => { const { slides: _s, ...resto } = plan; return resto; }, [plan]);
  const clave = useMemo(
    () => (slide ? clavePreview({ slide, antetituloHeredado, presets, paletas, paletasVinculos, iconos, estiloCliente, overrides, scopeRules, planSinLaminas, scope }) : ""),
    [slide, antetituloHeredado, presets, paletas, paletasVinculos, iconos, estiloCliente, overrides, scopeRules, planSinLaminas, scope],
  );

  useEffect(() => {
    if (!slide || !habilitada) { setEstado({ estado: "inactiva" }); return; }
    const coord = registro.coordinador(`${getSession() ?? ""}|${scope}`, slide.id);
    let vigente = true;
    const id = slide.id;
    void coord.solicitar(clave, (e) => {
      if (!vigente) return;
      setEstado(e);
      if (e.estado !== "cargando") setProgreso(null);
      if (e.estado === "lista") {
        const l = leerLaminaVisor(e.respuesta);
        registrarResumen(id, { estado: estadoDeLamina(l), partes: l.partes.length, avisos: l.avisos.length, avisosTexto: l.avisos });
        const primera = l.partes[0]?.imagen;
        if (primera) registrarMiniatura(id, primera);
      }
    });
    // Al salir se cancela lo pendiente; lo ya dibujado queda en el registro para la vuelta.
    return () => { vigente = false; coord.cancelar(); };
    // `slide` entra por la clave: el cargador del coordinador lee el plan vigente al disparar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide?.id, clave, habilitada, intento, scope]);

  const respuesta = estado.estado === "lista" ? estado.respuesta : "anterior" in estado ? estado.anterior : undefined;
  const lamina = useMemo(() => (respuesta ? leerLaminaVisor(respuesta) : null), [respuesta]);
  const formas = useMemo(() => (respuesta ? normalizePreviewFormas(respuesta) : null), [respuesta]);
  return {
    fase: estado.estado,
    lamina,
    desactualizada: estaDesactualizada(estado),
    error: estado.estado === "error" ? estado.mensaje : null,
    progreso: estado.estado === "cargando" ? progreso : null,
    // Reintentar fuerza otra vuelta al backend: con la misma clave el coordinador devolvería la respuesta sin imagen.
    reintentar: () => {
      if (slide) registro.coordinador(`${getSession() ?? ""}|${scope}`, slide.id).olvidar();
      setIntento((n) => n + 1);
    },
    formas,
  };
}

/**
 * «quick» rasteriza a 160 dpi (≈2130 px de ancho para 13,33 pulgadas) y «normal» a 220 (≈2930 px). La lámina más
 * grande que dibuja el visor mide su ancho en CSS por la densidad de la pantalla; si eso supera lo que da «quick»,
 * se pide «normal» para que no se vea borrosa.
 */
export function calidadParaPantalla(anchoVentana = typeof window === "undefined" ? 1440 : window.innerWidth,
  densidad = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1): "quick" | "normal" {
  // El visor nunca pasa de ~70 % del ancho de la ventana (zoom 150 % incluido se desplaza, no se re-rasteriza).
  return anchoVentana * 0.7 * densidad > 2130 ? "normal" : "quick";
}
