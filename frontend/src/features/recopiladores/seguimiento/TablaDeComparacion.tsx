// Comparación A contra B por público, más el total: la tasa de cada brazo en
// grande con "x de n" subordinado, la diferencia en puntos con su intervalo
// dibujado (barra con el cero marcado y un punto del color del brazo que gana) y
// el veredicto como chip. La usan la prueba de horarios (grupo A contra grupo B)
// y el correo personal (correo personal contra control).

import type { CSSProperties } from "react";

import type { FilaDeComparacion } from "../../../api/mailSeguimiento";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { formatoConteo } from "../../../lib/formatoNumero";
import { diferenciaConIntervalo, formatoPct, formatoPuntos, tasaConBase, textoDeVeredicto } from "./modeloSeguimiento";
import { escalaDeIntervalos, posicionEnEscala } from "./modeloTablero";

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

function Tasa({ x, n, pct, brazo }: { x: number; n: number; pct: number | null; brazo: "a" | "b" }) {
  return (
    <span className={`rec-seg-tasa is-${brazo}`}>
      <b>{formatoPct(pct ?? (n > 0 ? (100 * x) / n : null))}</b>
      <small>{formatoConteo(x)} de {formatoConteo(n)}</small>
    </span>
  );
}

/** El intervalo de la diferencia en una escala simétrica: el cero al medio. */
export function IntervaloDibujado({ fila, escala }: { fila: Pick<FilaDeComparacion, "dif_pp" | "dif_li" | "dif_ls" | "veredicto">; escala: number }) {
  if (fila.dif_pp == null) return null;
  const li = posicionEnEscala(fila.dif_li ?? fila.dif_pp, escala);
  const ls = posicionEnEscala(fila.dif_ls ?? fila.dif_pp, escala);
  const punto = posicionEnEscala(fila.dif_pp, escala);
  const ganador = fila.veredicto === "A" ? "a" : fila.veredicto === "B" ? "b" : "neutro";
  return (
    <span className="rec-seg-intervalo" role="img" aria-label={`Diferencia ${diferenciaConIntervalo(fila)}`}>
      <span className="rec-seg-intervalo-cero" />
      <span className="rec-seg-intervalo-tramo" style={{ left: `${li}%`, width: `${Math.max(ls - li, 0.5)}%` } as CSSProperties} />
      <span className={`rec-seg-intervalo-punto is-${ganador}`} style={{ left: `${punto}%` } as CSSProperties} />
    </span>
  );
}

export function TablaDeComparacion({ filas, total, nombreA, nombreB, ariaLabel, rotuloDiferencia, conHoras = false }: Props) {
  const todas: Fila[] = [
    ...filas.map((f) => ({ ...f, esTotal: false })),
    ...(total && filas.length > 1 ? [{ ...total, publico: "Total", esTotal: true }] : []),
  ];
  const escala = escalaDeIntervalos(todas);
  const columnas: PulsoTableColumna<Fila>[] = [
    { id: "publico", encabezado: "Público", ancho: 185, celda: (f) => (f.esTotal ? <b>{f.publico}</b> : f.publico) },
    ...(conHoras ? [{
      id: "horas", encabezado: "Horas (A y B)", ancho: 190,
      celda: (f: Fila) => (f.horaA && f.horaB ? `${f.horaA} y ${f.horaB}` : ""),
    }] : []),
    { id: "a", encabezado: nombreA, ancho: 160, tipo: "cifra", celda: (f) => <Tasa x={f.xA} n={f.nA} pct={f.pctA} brazo="a" />, valor: (f) => tasaConBase(f.xA, f.nA, f.pctA) },
    { id: "b", encabezado: nombreB, ancho: 160, tipo: "cifra", celda: (f) => <Tasa x={f.xB} n={f.nB} pct={f.pctB} brazo="b" />, valor: (f) => tasaConBase(f.xB, f.nB, f.pctB) },
    {
      id: "dif", encabezado: rotuloDiferencia, ancho: 290,
      celda: (f) => (
        <span className="rec-seg-dif" title={diferenciaConIntervalo(f)}>
          <IntervaloDibujado fila={f} escala={escala} />
          <span className="rec-seg-dif-texto">
            <b>{formatoPuntos(f.dif_pp)}</b>
            {f.dif_li != null && f.dif_ls != null ? <small>{formatoPuntos(f.dif_li).replace(" pp", "")} a {formatoPuntos(f.dif_ls)}</small> : null}
          </span>
        </span>
      ),
    },
    {
      id: "veredicto", encabezado: "Veredicto", ancho: 200,
      celda: (f) => {
        const texto = textoDeVeredicto(
          f.veredicto,
          conHoras ? (f.horaA || "el grupo A") : `el ${nombreA.toLocaleLowerCase("es-PE")}`,
          conHoras ? (f.horaB || "el grupo B") : `el ${nombreB.toLocaleLowerCase("es-PE")}`,
          f.pocos_casos,
        );
        const tono = f.veredicto === "A" || f.veredicto === "B" ? (f.pocos_casos ? "tendencia" : "gana") : "neutro";
        return <span className={`rec-seg-veredicto is-${tono}`}>{texto}</span>;
      },
    },
  ];
  return (
    <PulsoTable
      ariaLabel={ariaLabel}
      columnas={columnas}
      filas={todas}
      idDeFila={(f) => (f.esTotal ? "__total__" : f.publico)}
      vacio="Sin públicos que comparar."
    />
  );
}
