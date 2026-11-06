import { pctConEspacio } from "../../../core/formatoComun";
import { formatoConteo } from "../../../../../lib/formatoNumero";
import { HojaDelCliente, RitmoDeLaHoja, type TablaDelCliente } from "../../../salidas/estandar/HojaDelCliente";
import { SalidasDeMonitoreo } from "../../../salidas/estandar/SalidasDeMonitoreo";
import type { MonitoreoOutputsWorkbenchProps } from "../../../salidas/MonitoreoOutputsWorkbench";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import { rotuloDelSegmento } from "../segmentoDeCuotas";
import type { CuotasFaltante } from "./cuotasFaltanteModel";

function n(valor: number | null | undefined) {
  return valor == null ? "—" : formatoConteo(valor);
}

/** La tabla de la hoja del cliente: el avance por la variable de cuotas, como la lleva su PDF. */
export function tablaTelefonicaDelCliente(modelo: CuotasFaltante | null): TablaDelCliente | null {
  if (!modelo || !modelo.filas.length) return null;
  const segmento = rotuloDelSegmento(modelo.segmento ?? "") || "Categoría";
  return {
    cabecera: [segmento, "Meta", "Efectivas", "Faltan", "Avance"],
    numericas: [false, true, true, true, true],
    filas: modelo.filas.map((fila) => ({
      clave: fila.clave,
      celdas: [fila.nombre, n(fila.meta), <b key="e">{n(fila.efectivas)}</b>, n(fila.faltan), pctConEspacio(fila.pct)],
    })),
    total: ["Total", n(modelo.total.meta), n(modelo.total.efectivasDeMetas), n(modelo.total.faltan), pctConEspacio(modelo.total.pct)],
  };
}

/**
 * Avance › Entregas del telefónico sobre el estándar de Salidas: la lista de salidas y la hoja del cliente
 * (el avance por cuota y el ritmo diario, como los lleva su PDF). El motor completo, en «PDF y cliente».
 */
export function SalidasTelefonicas({ motor, modelo, corte, dias, nota = "" }: {
  motor: MonitoreoOutputsWorkbenchProps;
  modelo: CuotasFaltante | null;
  /** «27/07/2026 09:04», o vacío sin corte. */
  corte: string;
  /** Efectivas de Kobo por día, ISO. */
  dias: ReadonlyArray<{ fecha: string; casos: number }>;
  nota?: string;
}) {
  const segmento = rotuloDelSegmento(modelo?.segmento ?? "") || "Categoría";
  return (
    <SalidasDeMonitoreo
      {...motor}
      rotulo={<RotuloDePestana />}
      vistaPrevia={(
        <HojaDelCliente
          encabezado="Monitoreo telefónico"
          corte={corte}
          titulo={`Avance por ${segmento.toLocaleLowerCase("es")}`}
          tabla={tablaTelefonicaDelCliente(modelo)}
          vacio="El corte no trae cuotas para mostrar."
        >
          <RitmoDeLaHoja dias={dias} nota={nota} />
        </HojaDelCliente>
      )}
    />
  );
}
