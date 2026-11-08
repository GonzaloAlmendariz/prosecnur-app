// H4 (continuación): la pestaña «Lámina» del inspector en secciones plegables, como la tarjeta del gráfico. Composición
// (con la dependencia entre gráficos) y Textos en toda lámina; en las de resumen, además sus ajustes y sus capítulos, con
// la propuesta del motor. Sólo la primera arranca abierta; con tres secciones o más, un índice pegado salta a cada una.
// Al volver a la pestaña o cambiar de lámina se vuelve a la última sección abierta.

import { useEffect, useMemo, useRef } from "react";
import type { Slide } from "../../../../api/graficos";
import { CierreHallazgos } from "../cierreHallazgos/CierreHallazgos";
import { CifraAlLado } from "../cifraLateral/CifraAlLado";
import { DependenciaLamina } from "../DependenciaLamina";
import { DependenciaTresLamina } from "../DependenciaTresLamina";
import { AjustesHallazgos } from "../hallazgos/AjustesHallazgos";
import { useLaminasUi } from "../laminasStore";
import type { LaminaEnEstructura } from "../modeloEstructura";
import { AjustesResumenDiferencias } from "../resumenDiferencias/AjustesResumenDiferencias";
import { SeccionComposicion } from "../SeccionComposicion";
import { IndicePlegables } from "../tarjetaGrafico/IndicePlegables";
import { irASeccion } from "../tarjetaGrafico/irASeccion";
import { SeccionLaminaPlegable } from "./SeccionLaminaPlegable";
import { esSeccionLamina, MIN_SECCIONES_INDICE, seccionesDeLamina, seccionLaminaAbierta, SECCIONES_LAMINA } from "./seccionesLamina";
import { TextosLamina, useContenidoLamina } from "./TextosLamina";

type Props = {
  slide: Slide;
  lamina: LaminaEnEstructura;
  ranura: number | null;
};

export function PestanaLamina({ slide, lamina, ranura }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const abrir = useLaminasUi((s) => s.abrirSeccionLamina);
  const { contenido, especial } = useContenidoLamina(slide.tipo);
  const payload = slide.payload as Record<string, unknown>;
  const presentes = useMemo(() => seccionesDeLamina(slide.tipo, especial.ajustes, payload), [slide.tipo, especial.ajustes, payload]);
  const titulo = (clave: string) => presentes.find((p) => p.clave === clave)?.titulo ?? "";

  // Al volver a la pestaña o cambiar de lámina se vuelve a la última sección que se abrió, si esta lámina la tiene.
  useEffect(() => {
    const { seccionRecienteLamina, seccionesLamina } = useLaminasUi.getState();
    if (seccionRecienteLamina && seccionRecienteLamina !== SECCIONES_LAMINA[0] && seccionLaminaAbierta(seccionesLamina, seccionRecienteLamina)) {
      irASeccion(raiz.current, seccionRecienteLamina, { enfocar: false, instantaneo: true });
    }
  }, [slide.id]);

  return (
    <div className="pulso-f6-datos" ref={raiz} data-qa-geometry-group="graficos/f6-lamina-secciones" data-qa-geometry-contract="intrinsic">
      {presentes.length >= MIN_SECCIONES_INDICE && (
        <IndicePlegables tarjeta={raiz} entradas={presentes} etiqueta="Secciones de la lámina"
          onAbrir={(c) => { if (esSeccionLamina(c)) abrir(c); }} />
      )}
      <SeccionLaminaPlegable seccion="composicion" titulo={titulo("composicion")}>
        <SeccionComposicion slide={slide} lamina={lamina} ranura={ranura} />
        <DependenciaLamina slide={slide} />
        <DependenciaTresLamina slide={slide} />
        {/* U13: la cifra al lado y el gráfico con sus grupos bajo cada barra (lamina_cifra_y_grafico.R). */}
        <CifraAlLado slide={slide} />
      </SeccionLaminaPlegable>
      <SeccionLaminaPlegable seccion="textos" titulo={titulo("textos")}>
        <TextosLamina slide={slide} lamina={lamina} contenido={contenido} especial={especial} />
      </SeccionLaminaPlegable>
      {especial.ajustes.length > 0 && (slide.tipo === "p_slide_resumen_diferencias"
        ? <AjustesResumenDiferencias slide={slide} args={especial.ajustes} />
        : slide.tipo === "p_slide_cierre_hallazgos"
          ? <CierreHallazgos slide={slide} args={especial.ajustes} />
          : <AjustesHallazgos slide={slide} args={especial.ajustes} />)}
    </div>
  );
}
