import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { HojasRutaIntegratedConfig } from "../../../../api/hojasRuta";
import type { ResultadoTamano } from "../muestra/motorTamano";
import { useLienzoHojasRuta } from "../store";
import { AjustesDiseno, type VistaPreviaDiseno } from "./AjustesDiseno";
import { cambiosSinAplicar } from "./BotonDiseno";
import type { GrupoAjustesId, SeccionOrigen } from "./gruposAjustes";
import { GrupoTamano } from "./grupos/GrupoTamano";
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
  /** El guardar de la muestra de la página (el mismo de antes de la mudanza). */
  onAplicarMuestra: () => void;
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
export function AjustesDisenoHost({ config, configMuestra, fase, tamano, margenPara, bloqueado, guardando, onAplicarMuestra }: Props) {
  const { abierto, grupo, cerrar, irAGrupo } = useAjustesDiseno();
  const { rangosBorrador, cortesBorrador, muestraBorrador, sorteoBorrador } = useLienzoHojasRuta();
  const location = useLocation();
  const navigate = useNavigate();
  const firma = JSON.stringify(muestraBorrador ?? null);
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

  const irSeccion = useCallback((s: SeccionOrigen) => {
    const p = new URLSearchParams(location.search);
    p.delete("panel");
    p.delete("foco");
    p.set("seccion", s);
    navigate({ pathname: location.pathname, search: `?${p.toString()}` });
  }, [location.pathname, location.search, navigate]);

  const contenidoDe = useCallback(
    (g: GrupoAjustesId) => (g === "tamano" && configMuestra && tamano ? <GrupoTamano config={configMuestra} resultado={tamano} bloqueado={bloqueado} guardando={guardando} margenPara={margenPara} /> : null),
    [configMuestra, tamano, bloqueado, guardando, margenPara],
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
      onIrSeccion={irSeccion}
      contenidoDe={contenidoDe}
      pendientes={cambiosSinAplicar({ rangos: rangosBorrador, cortes: cortesBorrador, muestra: muestraBorrador, sorteo: sorteoBorrador })}
      desfasada={desfasada}
      onRecalcular={() => setFijada({ firma, vista: actual })}
      onAplicar={muestraBorrador ? onAplicarMuestra : undefined}
      aplicando={guardando}
    />
  );
}
