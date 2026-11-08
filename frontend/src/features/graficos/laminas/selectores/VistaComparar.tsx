// Vista partida «Comparar» del selector de láminas (auditoría del selector, hallazgo 3): dos tarjetas lado a lado, cada
// una con su hueco 16:9 (la lámina con los datos del estudio o, mientras llega o si al estudio le falta algo, el glifo o
// la composición), su ficha «Datos» y el botón que la usa, con el verbo del modo («Insertar esta» o «Cambiar a esta»,
// S5). Lo que difiere entre las dos (la clase y las filas de la ficha) se resalta (S6). Vive dentro del mismo diálogo
// en lugar de la galería y el detalle: no es otro panel ni otro `?panel=`. Al montar, el foco pasa a su título (el
// botón que la abrió desaparece con la galería).

import { useEffect, useId, useRef } from "react";
import { ArrowLeft, Check, X } from "../../../../vendor/lucide-react";
import type { SlideType } from "../../../../api/graficos";
import { Panel } from "../../../../components/Panel";
import { PulsoButton } from "../../../../components/PulsoButton";
import type { UsaGrafico } from "../../iconos/catalogoTipos.generated";
import { ComposicionLamina } from "../../iconos/ComposicionLamina";
import { GlifoGrafico } from "../../iconos/GlifoGrafico";
import { SLIDE_GRAF_SLOTS } from "../../store";
import { filasQueDifieren, type EstadoInventario } from "./fichaDatos";
import { FichaDatosCierre } from "./FichaDatosCierre";
import { FichaDatosTarjeta } from "./FichaDatosTarjeta";
import { atributosHueco, HuecoMiniatura } from "./HuecoMiniatura";
import type { MiniaturaSelector } from "./modeloMiniaturasSelector";
import { ROTULO_CLASE, type ClaseTarjeta } from "./intencionesContar";
import type { OpcionLamina } from "./opcionesLamina";
import type { ModoSelectorLamina } from "./selectoresStore";
import "./comparar.css";

export type ColumnaComparar = {
  opcion: OpcionLamina;
  tipo: SlideType;
  nombre: string;
  clase: ClaseTarjeta;
  /** Gráfico de partida de la tarjeta; sin él, el hueco dibuja la composición. */
  glifo?: string;
  usa: UsaGrafico | null;
  /** Lo que usa una tarjeta sin gráfico (el cierre con hallazgos): su ficha «Datos» en lugar de «Admite». */
  usaSinGrafico?: string;
  /** «Admite» de las láminas sin gráfico de partida (cuántos gráficos caben). */
  admite: string;
  actual: boolean;
  /** Gráficos de la lámina actual que no caben (solo al cambiar). */
  sobrantes: number;
  /** La lámina con los datos del estudio (useMiniaturasSelector); sin ella, el glifo o la composición. */
  miniatura?: MiniaturaSelector;
};

type Props = {
  columnas: readonly ColumnaComparar[];
  inventario: EstadoInventario;
  /** Láminas de resumen del informe, para la ficha del cierre con hallazgos. */
  laminasResumen?: number;
  modo: ModoSelectorLamina;
  onUsar: (opcion: OpcionLamina) => void;
  onQuitar: (opcion: OpcionLamina) => void;
  onVolver: () => void;
};

/** El verbo de «Usar esta» sigue al modo del selector (S5). */
export const verboUsar = (modo: ModoSelectorLamina): string => (modo === "insertar" ? "Insertar esta" : "Cambiar a esta");

export function VistaComparar({ columnas, inventario, laminasResumen = 0, modo, onUsar, onQuitar, onVolver }: Props) {
  const id = useId();
  const [a, b] = columnas;
  const difiere = filasQueDifieren(a?.usa ?? null, b?.usa ?? null, inventario);
  const claseDifiere = !!a && !!b && a.clase !== b.clase;
  const tituloRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { tituloRef.current?.focus({ preventScroll: true }); }, []);
  return (
    <section className="pulso-f6-comparar" aria-labelledby={`${id}-titulo`} data-vista-comparar="">
      <div className="pulso-f6-galeria-cabeza">
        <h3 id={`${id}-titulo`} ref={tituloRef} tabIndex={-1}>Comparar</h3>
        <PulsoButton variant="ghost" size="sm" onClick={onVolver} data-volver-galeria="">
          <ArrowLeft size={14} aria-hidden="true" />
          Volver a las láminas
        </PulsoButton>
      </div>
      <div
        className="pulso-f6-comparar-columnas"
        data-qa-geometry-group="graficos/f6-selector-comparar"
        data-qa-geometry-contract="equal"
      >
        {columnas.map((c, i) => (
          <Panel key={c.opcion} className="pulso-f6-comparar-columna" aria-labelledby={`${id}-${i}`}
            data-columna-comparar={c.opcion} data-qa-geometry-member>
            <div className="pulso-f6-comparar-hueco" data-hueco-miniatura="" {...atributosHueco(c.miniatura)}>
              <HuecoMiniatura miniatura={c.miniatura} nombre={c.nombre}>
                {c.glifo
                  ? <GlifoGrafico tipo={c.glifo} titulo={`Esquema de “${c.nombre}”`} />
                  : <ComposicionLamina tipo={c.tipo} slots={SLIDE_GRAF_SLOTS[c.tipo] ?? []} titulo={`Composición de “${c.nombre}”`} />}
              </HuecoMiniatura>
            </div>
            <div className="pulso-f6-detalle-texto">
              <h4 id={`${id}-${i}`} className="pulso-f6-comparar-nombre">{c.nombre}</h4>
              <span className="pulso-f6-detalle-clase" data-clase-tarjeta={c.clase} data-difiere={claseDifiere ? "" : undefined}>
                {ROTULO_CLASE[c.clase]}
              </span>
            </div>
            {(c.actual || c.sobrantes > 0) && (
              <span className="pulso-f6-tarjeta-chips is-en-linea">
                {c.actual && <span className="pulso-f6-chip is-actual">Actual</span>}
                {c.sobrantes > 0 && (
                  <span className="pulso-f6-chip is-aviso">{c.sobrantes === 1 ? "Quita 1 gráfico" : `Quita ${c.sobrantes} gráficos`}</span>
                )}
              </span>
            )}
            {c.usa ? (
              <FichaDatosTarjeta usa={c.usa} inventario={inventario} grupo={`comparar-${i + 1}`} difiere={difiere} />
            ) : c.usaSinGrafico ? (
              <FichaDatosCierre usa={c.usaSinGrafico} laminasResumen={laminasResumen} grupo={`comparar-${i + 1}`} />
            ) : (
              <dl className="pulso-f6-ficha">
                <dt>Admite</dt>
                <dd>{c.admite}</dd>
              </dl>
            )}
            <div className="pulso-f6-comparar-acciones">
              <PulsoButton variant="secondary" size="sm" onClick={() => onQuitar(c.opcion)} aria-label={`Quitar “${c.nombre}” de la comparación`}>
                <X size={14} aria-hidden="true" />
                Quitar
              </PulsoButton>
              {/* W2-B: un solo primario por superficie, el CTA del pie del selector; aquí, dos columnas, secundario. */}
              <PulsoButton
                variant="secondary"
                size="sm"
                disabled={modo === "cambiar" && c.actual}
                onClick={() => onUsar(c.opcion)}
                aria-label={modo === "cambiar" && c.actual ? undefined : `${verboUsar(modo)}: “${c.nombre}”`}
                data-usar-comparada={c.opcion}
              >
                {modo === "cambiar" && c.actual && <Check size={14} aria-hidden="true" />}
                {modo === "cambiar" && c.actual ? "Es la lámina actual" : verboUsar(modo)}
              </PulsoButton>
            </div>
          </Panel>
        ))}
      </div>
    </section>
  );
}
