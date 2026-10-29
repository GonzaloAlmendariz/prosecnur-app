import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoTable } from "../../../../components/PulsoTable";
import { Download, X } from "../../../../vendor/lucide-react";
import type { HojasRutaAgeRange } from "../../../../api/hojasRuta";
import { nombreDistrito } from "../nombres";
import { useLienzoHojasRuta } from "../store";
import type { FilaMatriz, ResumenMatriz } from "./matriz";

/**
 * Cajón inferior de Población (brecha B17/B29): la matriz distrito × rango de
 * edad entera, sobre el mapa, en vez de recortada en el inspector. Dos lecturas
 * —personas y distribución por fila— y la descarga en CSV.
 */

const PESTANAS = [["matriz", "Personas"], ["pct", "Distribución %"]] as const;
const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(n));
const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toLocaleString("es-PE", { maximumFractionDigits: 1 })} %` : "—");
const enRango = (f: FilaMatriz, i: number) => (f.porRango[i] ? f.porRango[i].H + f.porRango[i].M : 0);

function descargarCsv(matriz: ResumenMatriz, rangos: readonly HojasRutaAgeRange[], sexo: boolean) {
  const cab = ["Distrito", "Ubigeo", ...rangos.flatMap((r) => (sexo ? [`${r.label} H`, `${r.label} M`] : [r.label])), "Total"];
  const filas = matriz.filas.map((f) => [
    nombreDistrito(f.territorio),
    f.ubigeo,
    ...rangos.flatMap((_, i) => (sexo ? [f.porRango[i]?.H ?? 0, f.porRango[i]?.M ?? 0] : [enRango(f, i)])).map((n) => Math.round(n)),
    Math.round(f.total),
  ]);
  const celda = (v: string | number) => (typeof v === "string" && /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v));
  const texto = [cab, ...filas].map((fila) => fila.map(celda).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([`﻿${texto}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "matriz-poblacional.csv";
  a.click();
  URL.revokeObjectURL(url);
}

type Props = { matriz: ResumenMatriz; rangos: readonly HojasRutaAgeRange[]; sexo: boolean };

export function PoblacionCajon({ matriz, rangos, sexo }: Props) {
  const { cajonPoblacion: vista, setCajonPoblacion } = useLienzoHojasRuta();
  if (!vista || !matriz.vigente) return null;
  const columnasRango = rangos.flatMap((r, i) =>
    vista === "pct"
      ? [{ id: `r${i}`, encabezado: r.label, ancho: 88, tipo: "cifra" as const, celda: (f: FilaMatriz) => pct(enRango(f, i), f.total), valor: (f: FilaMatriz) => (f.total ? enRango(f, i) / f.total : 0) }]
      : sexo
      ? [
          { id: `r${i}h`, encabezado: `${r.label} · H`, ancho: 92, tipo: "cifra" as const, celda: (f: FilaMatriz) => fmt(f.porRango[i]?.H ?? 0), valor: (f: FilaMatriz) => f.porRango[i]?.H ?? 0 },
          { id: `r${i}m`, encabezado: `${r.label} · M`, ancho: 92, tipo: "cifra" as const, celda: (f: FilaMatriz) => fmt(f.porRango[i]?.M ?? 0), valor: (f: FilaMatriz) => f.porRango[i]?.M ?? 0 },
        ]
      : [{ id: `r${i}`, encabezado: r.label, ancho: 88, tipo: "cifra" as const, celda: (f: FilaMatriz) => fmt(enRango(f, i)), valor: (f: FilaMatriz) => enRango(f, i) }],
  );
  return (
    <section className="hr-sel-cajon" aria-label="Matriz poblacional">
      <header>
        <GlidingRadioGroup value={vista} options={PESTANAS} getOptionValue={(o) => o[0]} onValueChange={setCajonPoblacion} className="hr-muestra-opciones" aria-label="Lectura de la matriz">
          {(o) => <span>{o[1]}</span>}
        </GlidingRadioGroup>
        <span className="hr-sel-cajon-acciones">
          <PulsoButton variant="secondary" size="sm" onClick={() => descargarCsv(matriz, rangos, sexo)}>
            <Download size={14} aria-hidden /> CSV
          </PulsoButton>
          <PulsoButton variant="icon" size="sm" aria-label="Cerrar la matriz" onClick={() => setCajonPoblacion(null)}>
            <X size={14} aria-hidden />
          </PulsoButton>
        </span>
      </header>
      <PulsoTable
        ariaLabel={vista === "pct" ? "Distribución por edad de cada distrito" : "Personas por distrito y rango de edad"}
        densidad="compacta"
        altoMaximo={280}
        columnas={[
          { id: "distrito", encabezado: "Distrito", ancho: 160, celda: (f: FilaMatriz) => nombreDistrito(f.territorio), valor: (f: FilaMatriz) => f.territorio },
          ...columnasRango,
          { id: "total", encabezado: vista === "pct" ? "Peso" : "Total", ancho: 96, tipo: "cifra" as const, celda: (f: FilaMatriz) => <b>{vista === "pct" ? pct(f.total, matriz.total) : fmt(f.total)}</b>, valor: (f: FilaMatriz) => f.total },
        ]}
        filas={matriz.filas}
        idDeFila={(f) => f.ubigeo}
      />
    </section>
  );
}
