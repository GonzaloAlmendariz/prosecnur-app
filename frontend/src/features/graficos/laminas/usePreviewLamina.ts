// Vista previa real de la lámina seleccionada (F6.1). No reimplementa debounce ni cancelación: usa
// `crearCoordinadorPreviewLamina` (F6.0b.2), un coordinador por lámina para que «la imagen anterior» que se muestra
// como desactualizada sea siempre de ESTA lámina y no de la que se miraba antes. Volver a una lámina sin cambios
// responde al instante desde el coordinador.

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiGraficosPreviewSlide, type Slide } from "../../../api/graficos";
import { buildGraficosConfigFromStore } from "../configSnapshot";
import { clavePreview, crearCoordinadorPreviewLamina, estaDesactualizada, type EstadoPreviewLamina } from "../previewLaminaCoordinador";
import { useGraficosReportScope } from "../reportScope";
import { usePlanStore } from "../store";
import { estadoDeLamina, leerLaminaVisor, type LaminaVisor } from "./estadoLamina";
import { useLaminasUi } from "./laminasStore";

export type VistaPreviaLamina = {
  /** Fase del coordinador: inactiva, esperando (debounce), cargando, lista o error. */
  fase: EstadoPreviewLamina["estado"];
  /** Lo que se dibuja: la respuesta lista o, mientras llega otra, la anterior de esta lámina. */
  lamina: LaminaVisor | null;
  desactualizada: boolean;
  error: string | null;
  reintentar: () => void;
};

type Coordinador = ReturnType<typeof crearCoordinadorPreviewLamina>;

export function usePreviewLamina(slide: Slide | null, antetituloHeredado: string | null, habilitada: boolean): VistaPreviaLamina {
  const { search } = useLocation();
  const scope = useGraficosReportScope(search);
  const presets = usePlanStore((s) => s.presets);
  const paletas = usePlanStore((s) => s.paletas);
  const overrides = usePlanStore((s) => s.overridesReusables);
  const registrarResumen = useLaminasUi((s) => s.registrarResumen);
  const registrarMiniatura = useLaminasUi((s) => s.registrarMiniatura);
  const coordinadores = useRef(new Map<string, Coordinador>());
  const [estado, setEstado] = useState<EstadoPreviewLamina>({ estado: "inactiva" });
  const [intento, setIntento] = useState(0);

  // Lo que define la imagen: la lámina, el antetítulo que hereda del plan y el estilo global.
  const clave = useMemo(
    () => (slide ? clavePreview({ slide, antetituloHeredado, presets, paletas, overrides, scope }) : ""),
    [slide, antetituloHeredado, presets, paletas, overrides, scope],
  );

  useEffect(() => {
    if (!slide || !habilitada) { setEstado({ estado: "inactiva" }); return; }
    let coord = coordinadores.current.get(slide.id);
    if (!coord) {
      const id = slide.id;
      // El cargador lee la lámina vigente del plan al disparar (después del debounce), no la de este render.
      coord = crearCoordinadorPreviewLamina((_clave, { signal }) =>
        apiGraficosPreviewSlide(usePlanStore.getState().plan.slides.find((s) => s.id === id) ?? slide, buildGraficosConfigFromStore(), {
          include_images: false,
          preview_quality: calidadParaPantalla(),
          render_slide_preview: true,
          preview_partes: true,
          ...(scope === "consolidated" ? { scope: "consolidated" as const } : {}),
        }, { signal }));
      coordinadores.current.set(slide.id, coord);
    }
    let vigente = true;
    const id = slide.id;
    void coord.solicitar(clave, (e) => {
      if (!vigente) return;
      setEstado(e);
      if (e.estado === "lista") {
        const l = leerLaminaVisor(e.respuesta);
        registrarResumen(id, { estado: estadoDeLamina(l), partes: l.partes.length, avisos: l.avisos.length, avisosTexto: l.avisos });
        const primera = l.partes[0]?.imagen;
        if (primera) registrarMiniatura(id, primera);
      }
    });
    const actual = coord;
    return () => { vigente = false; actual.cancelar(); };
    // `slide` entra por la clave: el cargador del coordinador lee el plan vigente al disparar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide?.id, clave, habilitada, intento]);

  useEffect(() => () => { for (const c of coordinadores.current.values()) c.cancelar(); }, []);

  const respuesta = estado.estado === "lista" ? estado.respuesta : "anterior" in estado ? estado.anterior : undefined;
  const lamina = useMemo(() => (respuesta ? leerLaminaVisor(respuesta) : null), [respuesta]);
  return {
    fase: estado.estado,
    lamina,
    desactualizada: estaDesactualizada(estado),
    error: estado.estado === "error" ? estado.mensaje : null,
    reintentar: () => setIntento((n) => n + 1),
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
