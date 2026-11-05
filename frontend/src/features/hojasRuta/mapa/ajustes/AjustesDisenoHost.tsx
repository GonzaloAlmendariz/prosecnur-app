import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { HojasRutaAgeRange, HojasRutaEstratoMuestral, HojasRutaIntegratedConfig, HojasRutaTerritory } from "../../../../api/hojasRuta";
import { payloadDeRangos } from "../poblacion/aplicarRangos";
import type { ResumenMatriz } from "../poblacion/matriz";
import { useModoRangos } from "../poblacion/PoblacionPaneles";
import { GrupoCuotas } from "./grupos/GrupoCuotas";
import { GrupoFase } from "./grupos/GrupoFase";
import { GrupoMarco } from "./grupos/GrupoMarco";
import { GrupoRecorrido } from "./grupos/GrupoRecorrido";
import { GrupoSorteo } from "./grupos/GrupoSorteo";
import type { ResultadoTamano } from "../muestra/motorTamano";
import { useLienzoHojasRuta } from "../store";
import { AjustesDiseno, type VistaPreviaDiseno } from "./AjustesDiseno";
import { cambiosSinAplicar } from "./BotonDiseno";
import type { GrupoAjustesId } from "./gruposAjustes";
import { GrupoReparto } from "./grupos/GrupoReparto";
import { GrupoTamano } from "./grupos/GrupoTamano";
import { GrupoVisitas } from "./grupos/GrupoVisitas";
import { useAjustesDiseno } from "./useAjustesDiseno";

type Props = {
  config: HojasRutaIntegratedConfig | null;
  /** La config de muestra con el borrador encima: la que leen los controles del grupo Tamaño. */
  configMuestra: HojasRutaIntegratedConfig | null;
  fase: string;
  tamano: ResultadoTamano | null;
  margenPara?: (n: number) => number | null;
  bloqueado: boolean;
  guardando: boolean;
  territorios: readonly HojasRutaTerritory[];
  estratoServidor: HojasRutaEstratoMuestral | null;
  /** El guardar de la muestra de la página (el mismo de antes de la mudanza). */
  onAplicarMuestra: () => void;
  rangosConfig: readonly HojasRutaAgeRange[];
  matriz: ResumenMatriz;
  /** Los guardados de Población (los mismos que usaba su inspector). */
  onGuardarYCalcularPoblacion: (cambios: Partial<HojasRutaIntegratedConfig>) => void;
  onGuardarCaracter: (caracter: NonNullable<HojasRutaIntegratedConfig["caracter_cuotas"]>) => void;
  /** La config con el borrador del sorteo encima y el panel del marco elegible que arma la página. */
  configSorteo: HojasRutaIntegratedConfig | null;
  listoParaSortear: boolean;
  marcoElegible: ReactNode;
  /** Totales del territorio para el salto automático del recorrido. */
  viviendas: number;
  manzanas: number;
  /** La regla del piloto (ReglaPiloto) que arma la página; null si no aplica. */
  reglaPiloto: ReactNode;
};

const vistaDe = (config: HojasRutaIntegratedConfig, tamano: ResultadoTamano | null): VistaPreviaDiseno => {
  const k = config.entrevistas_por_manzana;
  const n = tamano?.nUsado ?? null;
  return { n, rutas: n != null && k > 0 ? Math.floor(n / k) : null, distritos: config.territorios.length, margen: tamano?.margenTotal ?? null };
};

/**
 * Monta «Ajustes del diseño» sobre el lienzo con lo que la página ya tiene. Vive en su archivo para no hacer
 * crecer `HojasRutaMapaPage.tsx`. Recalcular fija la vista previa con el borrador vigente sin guardar; si el
 * borrador cambia después, la vista previa queda atenuada hasta volver a recalcular. Aplicar guarda.
 */
export function AjustesDisenoHost({ config, configMuestra, fase, tamano, margenPara, bloqueado, guardando, territorios, estratoServidor, onAplicarMuestra, rangosConfig, matriz, onGuardarYCalcularPoblacion, onGuardarCaracter, configSorteo, listoParaSortear, marcoElegible, viviendas, manzanas, reglaPiloto }: Props) {
  const { abierto, grupo, cerrar, irAGrupo } = useAjustesDiseno();
  const { rangosBorrador, cortesBorrador, muestraBorrador } = useLienzoHojasRuta();
  const location = useLocation();
  const navigate = useNavigate();
  const firma = JSON.stringify(muestraBorrador ?? null);
  // useModoRangos lee la config; sin config aún, una vacía basta (el host no dibuja nada).
  const rangos = useModoRangos(config ?? ({} as HojasRutaIntegratedConfig));
  const [fijada, setFijada] = useState<{ firma: string; vista: VistaPreviaDiseno } | null>(null);
  // La vista aplicada (sin borrador) es la base: con cambios sin recalcular se muestra ella, atenuada.
  const [base, setBase] = useState<VistaPreviaDiseno | null>(null);
  const baseNueva = config && !muestraBorrador ? vistaDe(configMuestra ?? config, tamano) : null;
  const firmaBase = JSON.stringify(baseNueva);
  useEffect(() => {
    if (!muestraBorrador) {
      setFijada(null);
      setBase(baseNueva);
    }
    // la firma resume la base; el objeto cambia en cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muestraBorrador, firmaBase]);

  const irSeccion = useCallback((s: "manzanas") => {
    const p = new URLSearchParams(location.search);
    p.delete("panel");
    p.delete("foco");
    p.set("seccion", s);
    navigate({ pathname: location.pathname, search: `?${p.toString()}` });
  }, [location.pathname, location.search, navigate]);

  const contenidoDe = useCallback(
    (g: GrupoAjustesId) => {
      if (!configMuestra) return null;
      if (g === "tamano" && tamano) return <GrupoTamano config={configMuestra} resultado={tamano} bloqueado={bloqueado} guardando={guardando} margenPara={margenPara} />;
      if (g === "reparto") return <GrupoReparto config={configMuestra} territorios={territorios} estratoServidor={estratoServidor} deshabilitado={bloqueado || guardando} />;
      if (g === "visitas") return <GrupoVisitas config={configMuestra} estratoServidor={estratoServidor} deshabilitado={bloqueado || guardando} />;
      if (g === "marco" && marcoElegible) return <GrupoMarco panel={marcoElegible} />;
      if (g === "sorteo" && configSorteo) return <GrupoSorteo config={configSorteo} listoParaSortear={listoParaSortear} deshabilitado={bloqueado || guardando} onIrASortear={() => irSeccion("manzanas")} />;
      if (g === "recorrido" && configSorteo) return <GrupoRecorrido config={configSorteo} viviendas={viviendas} manzanas={manzanas} deshabilitado={bloqueado || guardando} onIrASortear={() => irSeccion("manzanas")} />;
      if (g === "fase") return <GrupoFase fase={fase} reglaPiloto={reglaPiloto} />;
      if (g === "cuotas" && config) return <GrupoCuotas config={config} rangosConfig={rangosConfig} matriz={matriz} bloqueado={bloqueado} guardando={guardando} onGuardarYCalcular={onGuardarYCalcularPoblacion} onGuardarCaracter={onGuardarCaracter} />;
      return null;
    },
    [config, configMuestra, tamano, bloqueado, guardando, margenPara, territorios, estratoServidor, rangosConfig, matriz, onGuardarYCalcularPoblacion, onGuardarCaracter, configSorteo, listoParaSortear, marcoElegible, irSeccion, viviendas, manzanas, reglaPiloto, fase],
  );

  if (!config) return null;
  const actual = vistaDe(configMuestra ?? config, tamano);
  const desfasada = Boolean(muestraBorrador) && fijada?.firma !== firma;
  const vista = muestraBorrador ? (fijada?.vista ?? base ?? actual) : actual;
  return (
    <AjustesDiseno
      abierto={abierto}
      grupo={grupo}
      config={configMuestra ?? config}
      fase={fase}
      vista={vista}
      onGrupo={irAGrupo}
      onCerrar={cerrar}
      contenidoDe={contenidoDe}
      // El sorteo no cuenta aquí: sus cambios se aplican al sortear, en Manzanas (GrupoSorteo lo dice).
      pendientes={cambiosSinAplicar({ rangos: rangosBorrador, cortes: cortesBorrador, muestra: muestraBorrador, sorteo: null })}
      desfasada={desfasada}
      onRecalcular={() => setFijada({ firma, vista: actual })}
      onAplicar={muestraBorrador || rangosBorrador || cortesBorrador ? () => {
        // Cada borrador se guarda con su guardar de siempre: la muestra con el de Muestra, los rangos con el de Población.
        if (muestraBorrador) onAplicarMuestra();
        if (rangosBorrador || cortesBorrador) onGuardarYCalcularPoblacion(payloadDeRangos(rangos.modo, rangos.base, rangosBorrador ?? rangosConfig));
      } : undefined}
      aplicando={guardando}
    />
  );
}
