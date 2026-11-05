// H4: una sección de la pestaña «Lámina» del inspector que se pliega, con la misma conducta que las de la tarjeta del
// gráfico (Plegable): sólo la primera abierta por defecto y la última abierta se recuerda en laminasStore.

import { useCallback, type ReactNode } from "react";
import { useLaminasUi } from "../laminasStore";
import { Plegable } from "../tarjetaGrafico/Plegable";
import { seccionLaminaAbierta, type SeccionLamina } from "./seccionesLamina";

type Props = { seccion: SeccionLamina; titulo: string; children: ReactNode };

export function SeccionLaminaPlegable({ seccion, titulo, children }: Props) {
  const abierta = useLaminasUi((s) => seccionLaminaAbierta(s.seccionesLamina, seccion));
  const alternar = useLaminasUi((s) => s.alternarSeccionLamina);
  const abrir = useLaminasUi((s) => s.abrirSeccionLamina);
  const onAlternar = useCallback(() => alternar(seccion), [alternar, seccion]);
  const onAbrir = useCallback(() => abrir(seccion), [abrir, seccion]);
  return (
    <Plegable clave={seccion} titulo={titulo} abierta={abierta} onAlternar={onAlternar} onAbrir={onAbrir}>
      {children}
    </Plegable>
  );
}
