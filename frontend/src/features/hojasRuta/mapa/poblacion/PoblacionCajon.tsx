import { useState } from "react";
import { downloadUrl } from "../../../../api/core";
import { apiHojasRutaPopulationExport, type HojasRutaIntegratedConfig } from "../../../../api/hojasRuta";
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoTable } from "../../../../components/PulsoTable";
import { Download, FileSpreadsheet, X } from "../../../../vendor/lucide-react";
import type { HojasRutaAgeRange } from "../../../../api/hojasRuta";
import { nombreDistrito } from "../nombres";
import { useLienzoHojasRuta } from "../store";
import { agruparFilas, type AgruparFilas, type FilaMatriz, type GrupoDeZona, type ResumenMatriz } from "./matriz";

/**
 * Cajón inferior de Población (brecha B17/B29): la matriz distrito × rango de
 * edad entera, sobre el mapa, en vez de recortada en el inspector. Dos lecturas
 * —personas y distribución por fila—, el Excel de la matriz del motor (B50, por distrito,
 * como el artefacto) y el CSV de la vista agrupada que se está mirando.
 */

const PESTANAS = [["matriz", "Personas"], ["pct", "Distribución %"]] as const;
const AGRUPAR = [["distrito", "Distrito"], ["provincia", "Provincia"], ["zona", "Zona"]] as const;
const ENCABEZADO: Record<AgruparFilas, string> = { distrito: "Distrito", provincia: "Provincia", zona: "Zona" };
const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(n));
const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toLocaleString("es-PE", { maximumFractionDigits: 1 })} %` : "—");
const enRango = (f: FilaMatriz, i: number) => (f.porRango[i] ? f.porRango[i].H + f.porRango[i].M : 0);

function descargarCsv(filasCsv: readonly FilaMatriz[], por: AgruparFilas, rangos: readonly HojasRutaAgeRange[], sexo: boolean) {
  const distrito = por === "distrito";
  const cab = [ENCABEZADO[por], ...(distrito ? ["Ubigeo"] : []), ...rangos.flatMap((r) => (sexo ? [`${r.label} H`, `${r.label} M`] : [r.label])), "Total"];
  const filas = filasCsv.map((f) => [
    distrito ? nombreDistrito(f.territorio) : f.territorio,
    ...(distrito ? [f.ubigeo] : []),
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

type Props = { matriz: ResumenMatriz; rangos: readonly HojasRutaAgeRange[]; sexo: boolean; zonas: readonly GrupoDeZona[]; config: Partial<HojasRutaIntegratedConfig> };

export function PoblacionCajon({ matriz, rangos, sexo, zonas, config }: Props) {
  const { cajonPoblacion: vista, setCajonPoblacion } = useLienzoHojasRuta();
  const [por, setPor] = useState<AgruparFilas>("distrito");
  const [exportando, setExportando] = useState(false);
  const [errorExcel, setErrorExcel] = useState("");
  const descargarExcel = () => {
    setExportando(true);
    setErrorExcel("");
    apiHojasRutaPopulationExport(config)
      .then((r) => window.open(downloadUrl(r.file_id), "_blank", "noopener,noreferrer"))
      .catch((e: unknown) => setErrorExcel(e instanceof Error ? e.message.replace(/ · E_[A-Z_]+$/, "") : "No se pudo armar el Excel."))
      .finally(() => setExportando(false));
  };
  if (!vista || !matriz.vigente) return null;
  const filas = agruparFilas(matriz.filas, por, zonas);
  const nombre = (f: FilaMatriz) => (por === "distrito" ? nombreDistrito(f.territorio) : f.territorio);
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
          <GlidingRadioGroup value={por} options={AGRUPAR} getOptionValue={(o) => o[0]} onValueChange={setPor} className="hr-muestra-opciones hr-cajon-agrupar" aria-label="Agrupar filas por">
            {(o) => <span>{o[1]}</span>}
          </GlidingRadioGroup>
          <PulsoButton variant="secondary" size="sm" disabled={exportando} onClick={descargarExcel}>
            <FileSpreadsheet size={14} aria-hidden /> {exportando ? "Armando…" : "Excel"}
          </PulsoButton>
          <PulsoButton variant="secondary" size="sm" onClick={() => descargarCsv(filas, por, rangos, sexo)} title="La vista agrupada que estás mirando">
            <Download size={14} aria-hidden /> CSV
          </PulsoButton>
          <PulsoButton variant="icon" size="sm" aria-label="Cerrar la matriz" onClick={() => setCajonPoblacion(null)}>
            <X size={14} aria-hidden />
          </PulsoButton>
        </span>
      </header>
      {errorExcel ? <p className="hr-mapa-aviso" role="alert">{errorExcel}</p> : null}
      <PulsoTable
        ariaLabel={vista === "pct" ? "Distribución por edad de cada distrito" : "Personas por distrito y rango de edad"}
        densidad="compacta"
        altoMaximo={280}
        columnas={[
          { id: "distrito", encabezado: ENCABEZADO[por], ancho: 160, celda: nombre, valor: (f: FilaMatriz) => f.territorio },
          ...columnasRango,
          { id: "total", encabezado: vista === "pct" ? "Peso" : "Total", ancho: 96, tipo: "cifra" as const, celda: (f: FilaMatriz) => <b>{vista === "pct" ? pct(f.total, matriz.total) : fmt(f.total)}</b>, valor: (f: FilaMatriz) => f.total },
        ]}
        filas={filas}
        idDeFila={(f) => f.ubigeo}
      />
    </section>
  );
}
