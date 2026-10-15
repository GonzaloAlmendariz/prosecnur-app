import { AlertTriangle, Info } from "../../../vendor/lucide-react";

/** Una sola línea sobre el editor: cuántos avisos hay y un botón al panel donde se leen enteros. */
export function ResumenAvisosExportacion({ motor, previos, onVer }: { motor: number; previos: number; onVer: () => void }) {
  if (!motor && !previos) return null;
  const partes = [
    previos ? (previos === 1 ? "1 aviso antes de exportar" : `${previos} avisos antes de exportar`) : "",
    motor ? (motor === 1 ? "la última exportación dejó 1 aviso" : `la última exportación dejó ${motor} avisos`) : "",
  ].filter(Boolean);
  const texto = partes.join(" · ");
  const Icono = previos ? AlertTriangle : Info;
  return (
    <div className={`pulso-avexp-resumen${previos ? " is-warn" : ""}`} role="status">
      <Icono size={14} aria-hidden="true" />
      <span>{texto.charAt(0).toUpperCase() + texto.slice(1)}</span>
      <button type="button" className="pulso-avexp-resumen-ver" onClick={onVer}>Ver avisos</button>
    </div>
  );
}
