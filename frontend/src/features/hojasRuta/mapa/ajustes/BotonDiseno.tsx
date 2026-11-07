import type { HojasRutaIntegratedConfig } from "../../../../api/hojasRuta";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { nombreDeAtajo } from "../../../../lib/teclado";
import { SlidersHorizontal } from "../../../../vendor/lucide-react";
import { useLienzoHojasRuta } from "../store";
import { ESTRATOS, estratoDe } from "../muestra/EstratoMuestral";
import { useAbrirAjustes } from "./useAjustesDiseno";
import "./ajustes.css";

/** Cuántos grupos tienen cambios en borrador, sin aplicar: rangos o cortes de edad, muestra y sorteo. */
export function cambiosSinAplicar(b: { rangos: unknown; cortes: unknown; muestra: unknown; sorteo: unknown }): number {
  return (b.rangos || b.cortes ? 1 : 0) + (b.muestra ? 1 : 0) + (b.sorteo ? 1 : 0);
}

/**
 * El resumen del botón: «1,200, 8 por ruta, por provincia» (sin punto medio: contrato de Hojas de ruta). Sin
 * distritos elegidos no hay diseño que resumir: la configuración trae valores por defecto y la n sale de un
 * cálculo sin territorio («6, 6 por ruta» en un estudio recién abierto, revisión del 7 nov 2026).
 */
export function resumenDiseno(config: HojasRutaIntegratedConfig, n: number | null, distritos: number): string {
  if (!distritos) return "Por definir";
  const estrato = (ESTRATOS.find(([m]) => m === estratoDe(config.sample_size))?.[1] ?? "Por distrito").toLowerCase();
  return `${formatoConteo(n ?? config.n_objetivo)}, ${config.entrevistas_por_manzana} por ruta, ${estrato}`;
}

/**
 * Botón «Diseño» de la barra (maqueta aprobada, lámina 0): resume el diseño vigente, avisa los cambios sin
 * aplicar y abre «Ajustes del diseño» (también con el atajo Mod + coma). En barra angosta se compacta a ícono, N y punto.
 */
export function BotonDiseno({ config, n, distritos, compacto }: { config: HojasRutaIntegratedConfig | null; n: number | null; distritos: number; compacto: boolean }) {
  const { abrir, abierto } = useAbrirAjustes();
  const { rangosBorrador, cortesBorrador, muestraBorrador, sorteoBorrador } = useLienzoHojasRuta();
  if (!config) return null;
  const pendientes = cambiosSinAplicar({ rangos: rangosBorrador, cortes: cortesBorrador, muestra: muestraBorrador, sorteo: sorteoBorrador });
  const resumen = resumenDiseno(config, n, distritos);
  const etiqueta = `Abrir ajustes del diseño: ${resumen}${pendientes ? `, ${pendientes} sin aplicar` : ""}`;
  return (
    <button type="button" className="hr-boton-diseno" data-compacto={compacto || undefined} aria-label={etiqueta} aria-pressed={abierto} title={`Ajustes del diseño (${nombreDeAtajo(",")})`} onClick={() => abrir()}>
      <SlidersHorizontal size={16} aria-hidden />
      {compacto ? (
        <>
          <b>{distritos ? formatoConteo(n ?? config.n_objetivo) : "—"}</b>
          {pendientes ? <i className="hr-boton-diseno-punto" aria-hidden="true" /> : null}
        </>
      ) : (
        <>
          <span className="hr-boton-diseno-texto">
            <small>Diseño</small>
            <b>{resumen}</b>
          </span>
          {pendientes ? <span className="hr-boton-diseno-pendientes">{pendientes} sin aplicar</span> : null}
        </>
      )}
    </button>
  );
}
