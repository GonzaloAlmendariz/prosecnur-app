// Comparación A contra B por público, más el total: la tasa de cada brazo con
// su numerador y su base, la diferencia en puntos con su intervalo y el
// veredicto. La usan la prueba de horarios (grupo A contra grupo B) y el correo
// personal (correo personal contra control).

import type { FilaDeComparacion } from "../../../api/mailSeguimiento";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { diferenciaConIntervalo, tasaConBase, textoDeVeredicto } from "./modeloSeguimiento";

type Props = {
  filas: readonly FilaDeComparacion[];
  total: FilaDeComparacion | null;
  nombreA: string;
  nombreB: string;
  ariaLabel: string;
  /** Rótulo de la columna de la diferencia, que nombra el orden de la resta. */
  rotuloDiferencia: string;
  /** Prueba de horarios: la hora de cada grupo en ese público (los de oficina tienen otra). */
  conHoras?: boolean;
};

type Fila = FilaDeComparacion & { esTotal: boolean };

export function TablaDeComparacion({ filas, total, nombreA, nombreB, ariaLabel, rotuloDiferencia, conHoras = false }: Props) {
  const todas: Fila[] = [
    ...filas.map((f) => ({ ...f, esTotal: false })),
    ...(total && filas.length > 1 ? [{ ...total, publico: "Total", esTotal: true }] : []),
  ];
  const columnas: PulsoTableColumna<Fila>[] = [
    { id: "publico", encabezado: "Público", ancho: 160, celda: (f) => (f.esTotal ? <b>{f.publico}</b> : f.publico) },
    ...(conHoras ? [{
      id: "horas", encabezado: "Horas (A y B)", ancho: 180,
      celda: (f: Fila) => (f.horaA && f.horaB ? `${f.horaA} y ${f.horaB}` : ""),
    }] : []),
    { id: "a", encabezado: nombreA, ancho: 180, tipo: "cifra", celda: (f) => tasaConBase(f.xA, f.nA, f.pctA) },
    { id: "b", encabezado: nombreB, ancho: 180, tipo: "cifra", celda: (f) => tasaConBase(f.xB, f.nB, f.pctB) },
    { id: "dif", encabezado: rotuloDiferencia, ancho: 250, tipo: "cifra", celda: (f) => diferenciaConIntervalo(f) },
    {
      id: "veredicto", encabezado: "Veredicto", ancho: 240,
      celda: (f) => textoDeVeredicto(
        f.veredicto,
        conHoras ? `el grupo A${f.horaA ? ` (${f.horaA})` : ""}` : `el ${nombreA.toLocaleLowerCase("es-PE")}`,
        conHoras ? `el grupo B${f.horaB ? ` (${f.horaB})` : ""}` : `el ${nombreB.toLocaleLowerCase("es-PE")}`,
        f.pocos_casos,
      ),
    },
  ];
  return (
    <PulsoTable
      ariaLabel={ariaLabel}
      columnas={columnas}
      filas={todas}
      idDeFila={(f) => (f.esTotal ? "__total__" : f.publico)}
      densidad="compacta"
      vacio="Sin públicos que comparar."
    />
  );
}
