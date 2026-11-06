// H4: una sección de la tarjeta del gráfico (Datos, Categorías y orden, Cifras, Diferencias entre grupos, Colores, En el
// Word) que se pliega. Abierta o cerrada se recuerda en el store de la vista (laminasStore); el marco es `Plegable`.

import { useCallback, type ReactNode } from "react";
import { useLaminasUi } from "../laminasStore";
import { seccionAbierta, TITULO_GRUPO, type SeccionTarjeta } from "../gruposTarjeta";
import { Plegable } from "./Plegable";

type Props = { seccion: SeccionTarjeta; children: ReactNode };

export function SeccionPlegable({ seccion, children }: Props) {
  const abierta = useLaminasUi((s) => seccionAbierta(s.seccionesTarjeta, seccion));
  const alternar = useLaminasUi((s) => s.alternarSeccionTarjeta);
  const abrir = useLaminasUi((s) => s.abrirSeccionTarjeta);
  const onAlternar = useCallback(() => alternar(seccion), [alternar, seccion]);
  const onAbrir = useCallback(() => abrir(seccion), [abrir, seccion]);
  return (
    <Plegable clave={seccion} titulo={TITULO_GRUPO[seccion]} abierta={abierta} onAlternar={onAlternar} onAbrir={onAbrir}>
      {children}
    </Plegable>
  );
}
