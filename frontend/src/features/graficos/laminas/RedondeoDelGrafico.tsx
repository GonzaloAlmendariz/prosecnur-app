// «Redondeo» en la tarjeta del gráfico (R4 del rediseño, 2026-10-15): por defecto el gráfico sigue la regla del informe
// (Reglas › Redondeo y decimales); «Propio» le da su método y sus decimales como excepción explícita, que la regla lista
// debajo. Sólo en los tipos que rotulan porcentajes (`preset.calculos.familia_porcentaje`, lo sirve el motor).
//
// Oleada I2, ítem 6: debajo, lo que suma la lámina con cada método («Estándar: suma 99%» y «Reparto: 100%», en dos
// líneas) y, junto a los decimales, la cifra mayor ya redondeada; del detalle del motor. Sin detalle, sin cifras.

import { useMemo } from "react";
import { graficadorToPresetType } from "../graficadorPresetMap";
import { usePlanStore } from "../store";
import { usePresetsDefaults } from "../usePresetsDefaults";
import { usePresetsMetadata } from "../usePresetsMetadata";
import { Segmentado } from "../subpestanas/Segmentado";
import { filasCalculos, type FilaCalculo } from "../estiloInforme/modeloEstiloInforme";
import { conRedondeo, leerRedondeo, METODO_ESTANDAR, METODO_REPARTO, sinRedondeo } from "./modeloRedondeoGrafico";
import { useDetalleCifras } from "./cifrasInspector/useDetalleCifras";
import { cifrasRedondeo, type CifrasRedondeo } from "./cifrasInspector/modeloCifrasRedondeo";
import { CifraEstado } from "./cifrasInspector/CifraEstado";

type Args = Record<string, unknown>;

/** La fila de cálculos del tipo de este gráfico, o `null` si no rotula porcentajes. */
export function useFilaCalculo(graficador: string): FilaCalculo | null {
  const { presets: catalogo } = usePresetsMetadata();
  const { presets: defaults } = usePresetsDefaults();
  const presets = usePlanStore((s) => s.presets);
  const filas = useMemo(() => filasCalculos(catalogo, presets, defaults), [catalogo, presets, defaults]);
  const preset = graficadorToPresetType(graficador);
  return filas.find((f) => f.preset === preset) ?? null;
}

const dichoMetodo = (m: string) => (m === METODO_REPARTO ? "reparto a 100 %" : "estándar");
const dichoDecimales = (d: number) => (d === 0 ? "sin decimales" : d === 1 ? "un decimal" : `${d} decimales`);

export function RedondeoDelGrafico({ graficador, args, scope = "active", onCambio }: {
  graficador: string; args: Args; scope?: "active" | "consolidated"; onCambio: (overrides: Args) => void;
}) {
  const fila = useFilaCalculo(graficador);
  const aplica = !!fila && (fila.admiteMetodo || !!fila.campoDecimales);
  const det = useDetalleCifras(aplica ? graficador : "", scope, [{ clave: "actual", args }]).actual;
  if (!fila || !aplica) return null;
  const cifras = det && !det.sinDetalle ? { ...cifrasRedondeo(det.detalle), vigente: det.vigente } : null;
  return <RedondeoDelGraficoVista fila={fila} args={args} onCambio={onCambio} cifras={cifras} />;
}

/** Presentación pura (se prueba sin catálogo ni store). */
export function RedondeoDelGraficoVista({ fila, args, onCambio, cifras = null }: {
  fila: FilaCalculo; args: Args; onCambio: (overrides: Args) => void;
  /** Las sumas con cada método y la mayor, del detalle; null sin detalle. `vigente: false` mientras llega lo nuevo. */
  cifras?: (Partial<CifrasRedondeo> & { vigente: boolean }) | null;
}) {
  const r = leerRedondeo(args, fila);
  const delInforme = [fila.admiteMetodo ? dichoMetodo(fila.metodo) : "", fila.campoDecimales ? dichoDecimales(fila.decimales) : ""].filter(Boolean).join(", ");
  return (
    <div className="pulso-f6-dato is-apilado pulso-f6-redondeo-grafico" role="group" aria-label="Redondeo de este gráfico">
      <span className="pulso-f6-dato-rotulo">Redondeo</span>
      <Segmentado etiqueta="Redondeo de este gráfico" valor={r.propio ? "propio" : "informe"}
        onCambiar={(k) => onCambio(k === "propio" ? conRedondeo(args, fila, {}) : sinRedondeo(args))}
        opciones={[{ clave: "informe", rotulo: "Como el informe" }, { clave: "propio", rotulo: "Propio" }]} />
      {r.propio ? (
        <>
          {fila.admiteMetodo && (
            <Segmentado etiqueta="Método de este gráfico" valor={r.metodo === METODO_REPARTO ? METODO_REPARTO : METODO_ESTANDAR}
              onCambiar={(m) => onCambio(conRedondeo(args, fila, { metodo: m }))}
              opciones={[{ clave: METODO_ESTANDAR, rotulo: "Estándar" }, { clave: METODO_REPARTO, rotulo: "Reparto a 100 %" }]} />
          )}
          {fila.campoDecimales && (
            <span className="pulso-f6-redondeo-decimales">
              <Segmentado etiqueta="Decimales de este gráfico" valor={r.decimales >= 1 ? "1" : "0"}
                onCambiar={(d) => onCambio(conRedondeo(args, fila, { decimales: Number(d) }))}
                opciones={[{ clave: "0", rotulo: "Sin decimales" }, { clave: "1", rotulo: "Un decimal" }]} />
              {cifras && <CifraEstado texto={cifras.mayor ?? null} vigente={cifras.vigente} qa="redondeo-mayor" />}
            </span>
          )}
          <span className="pulso-f6-dato-ayuda">Sólo este gráfico; el informe usa {delInforme}.</span>
        </>
      ) : (
        <span className="pulso-f6-dato-ayuda">Sigue la regla del informe: {delInforme}.</span>
      )}
      {cifras && (cifras.estandar || !cifras.vigente) && <CifraEstado texto={cifras.estandar ?? null} vigente={cifras.vigente} qa="redondeo-estandar" />}
      {cifras?.reparto && <CifraEstado texto={cifras.reparto} vigente={cifras.vigente} qa="redondeo-reparto" />}
    </div>
  );
}
