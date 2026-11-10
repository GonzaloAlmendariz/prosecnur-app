// La tarjeta «Base final del corte» de Salidas territoriales (ADR 0133, fase
// 5): el universo del paquete y el disparador; el ZIP (data filtrada, XLSForm,
// auditoría y manifest) se entrega por el contenedor del kit en bloque, y la
// data y el XLSForm sueltos van a su pie.

import { useState } from "react";

import type { MonitoreoProcessingHandoffResult, MonitoreoProcessingHandoffUniverse } from "../../../api/monitoreo";
import { Download } from "../../../vendor/lucide-react";
import { ArchivosSueltos } from "../entregas/ArchivosSueltos";
import { EntregaEnBloque } from "../entregas/EntregaEnBloque";
import { useEntrega } from "../entregas/useEntrega";
import { archivosDelPaqueteDeProcesamiento } from "./archivosDeSalidas";

export function TarjetaProcesamiento({ habilitado, detalleDelPaquete, generar }: {
  habilitado: boolean;
  /** Filas y estatus del paquete generado, en una línea. */
  detalleDelPaquete: (result: MonitoreoProcessingHandoffResult) => string;
  generar: (universo: MonitoreoProcessingHandoffUniverse) => Promise<MonitoreoProcessingHandoffResult>;
}) {
  const entrega = useEntrega("Entrega a procesamiento", { formato: "zip", articulo: "la" });
  const [universo, setUniverso] = useState<MonitoreoProcessingHandoffUniverse>("processable");
  const [paquete, setPaquete] = useState<MonitoreoProcessingHandoffResult | null>(null);
  const sueltos = archivosDelPaqueteDeProcesamiento(paquete);
  const detalle = paquete ? detalleDelPaquete(paquete) : "";

  const descargar = () => {
    setPaquete(null);
    void entrega.ejecutar(async () => {
      const result = await generar(universo);
      setPaquete(result);
      return result;
    });
  };

  return (
    <>
      <label className="mon-outputs-field">
        <span>Paquete manual</span>
        <select
          value={universo}
          onChange={(event) => {
            setUniverso(event.target.value as MonitoreoProcessingHandoffUniverse);
            setPaquete(null);
            entrega.cerrar();
          }}
          disabled={entrega.enCurso}
        >
          <option value="processable">Procesable (validada + revisión)</option>
          <option value="strict_validada">Sólo validada</option>
        </select>
        <small>Descarga data filtrada, XLSForm, auditoría y manifest.</small>
      </label>
      <button
        type="button"
        className="mon-outputs-processing-link"
        onClick={descargar}
        disabled={!habilitado || entrega.enCurso}
      >
        <Download size={14} aria-hidden="true" />
        Descargar data + XLSForm
      </button>
      <EntregaEnBloque
        entrega={entrega}
        pie={paquete && entrega.estado.fase === "lista" ? (
          <>
            {detalle ? <span className="mon-entrega-nota">{detalle}</span> : null}
            <ArchivosSueltos archivos={sueltos} etiqueta="Archivos sueltos del paquete para Procesamiento" />
          </>
        ) : undefined}
      />
    </>
  );
}
