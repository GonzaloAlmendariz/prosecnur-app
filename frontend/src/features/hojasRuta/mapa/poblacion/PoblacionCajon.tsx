import { useState } from "react";
import { apiHojasRutaPopulationExport, type HojasRutaIntegratedConfig } from "../../../../api/hojasRuta";
import { ContenedorEntregable } from "../../../../components/entregables/ContenedorEntregable";
import { archivoCsv } from "../../../../components/entregables/archivoLocal";
import { useGeneracion } from "../../../../components/entregables/useGeneracion";
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import { Panel } from "../../../../components/Panel";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoTable } from "../../../../components/PulsoTable";
import { Download, FileSpreadsheet, X } from "../../../../vendor/lucide-react";
import type { HojasRutaAgeRange } from "../../../../api/hojasRuta";
import { MODULO_HOJAS_RUTA } from "../entregas/modeloEntrega";
import "../entregas/entregas.css";
import { nombreDistrito } from "../nombres";
import { useLienzoHojasRuta } from "../store";
import { MenuDelCajon } from "./MenuDelCajon";
import { csvDeLaMatriz } from "./csvDeLaMatriz";
import { agruparFilas, type AgruparFilas, type FilaMatriz, type GrupoDeZona, type ResumenMatriz } from "./matriz";

import { formatoDecimal } from "../../../../lib/formatoNumero";
/**
 * Cajón inferior de Población (brecha B17/B29): la matriz distrito × rango de
 * edad entera, sobre el mapa, en vez de recortada en el inspector. Dos lecturas
 * —personas y distribución por fila—, el Excel de la matriz del motor (B50, por distrito,
 * como el artefacto) y el CSV de la vista agrupada que se está mirando. La agrupación y las
 * descargas van plegadas en `MenuDelCajon`: los controles caben en un renglón y la tabla respira.
 */

const PESTANAS = [["matriz", "Personas"], ["pct", "Distribución %"]] as const;
const AGRUPAR = [["distrito", "Distrito"], ["ubigeo", "Ubigeo"], ["provincia", "Provincia"], ["zona", "Zona"]] as const;
const ENCABEZADO: Record<AgruparFilas, string> = { distrito: "Distrito", ubigeo: "Ubigeo", provincia: "Provincia", zona: "Zona" };
const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(n));
const pct = (n: number, d: number) => (d ? `${formatoDecimal((n / d) * 100, 1)} %` : "—");
const enRango = (f: FilaMatriz, i: number) => (f.porRango[i] ? f.porRango[i].H + f.porRango[i].M : 0);

type Props = { matriz: ResumenMatriz; rangos: readonly HojasRutaAgeRange[]; sexo: boolean; zonas: readonly GrupoDeZona[]; config: Partial<HojasRutaIntegratedConfig> };

export function PoblacionCajon({ matriz, rangos, sexo, zonas, config }: Props) {
  const { cajonPoblacion: vista, setCajonPoblacion } = useLienzoHojasRuta();
  const [por, setPor] = useState<AgruparFilas>("distrito");
  // Las dos descargas del menú por el kit (ADR 0133, forma anclada bajo el menú): el Excel del motor y el CSV
  // de la vista, que arma el front. Una sola generación: el contenedor es uno y dice cuál salió. La causa legible
  // y su código los separa el kit, sin recortar el mensaje a mano.
  const descarga = useGeneracion({ titulo: "Matriz poblacional", modulo: MODULO_HOJAS_RUTA, articulo: "la" });
  const exportando = descarga.estado.fase === "en_curso";
  const descargarExcel = () => { void descarga.ejecutar(() => apiHojasRutaPopulationExport(config), { formato: "xlsx" }); };
  if (!vista || !matriz.vigente) return null;
  const filas = agruparFilas(matriz.filas, por, zonas);
  const descargarCsvDeLaVista = () => {
    const contenido = csvDeLaMatriz(filas, por, rangos, sexo);
    void descarga.ejecutar(() => Promise.resolve(archivoCsv(contenido, "matriz-poblacional.csv")), { titulo: "Matriz poblacional de esta vista", formato: "csv" });
  };
  const nombre = (f: FilaMatriz) => (por === "distrito" ? nombreDistrito(f.territorio) : por === "ubigeo" ? `${f.ubigeo}, ${nombreDistrito(f.territorio)}` : f.territorio);
  const columnasRango = rangos.flatMap((r, i) =>
    vista === "pct"
      ? [{ id: `r${i}`, encabezado: r.label, ancho: 88, tipo: "cifra" as const, celda: (f: FilaMatriz) => pct(enRango(f, i), f.total), valor: (f: FilaMatriz) => (f.total ? enRango(f, i) / f.total : 0) }]
      : sexo
      ? [
          { id: `r${i}h`, encabezado: `${r.label}, H`, ancho: 92, tipo: "cifra" as const, celda: (f: FilaMatriz) => fmt(f.porRango[i]?.H ?? 0), valor: (f: FilaMatriz) => f.porRango[i]?.H ?? 0 },
          { id: `r${i}m`, encabezado: `${r.label}, M`, ancho: 92, tipo: "cifra" as const, celda: (f: FilaMatriz) => fmt(f.porRango[i]?.M ?? 0), valor: (f: FilaMatriz) => f.porRango[i]?.M ?? 0 },
        ]
      : [{ id: `r${i}`, encabezado: r.label, ancho: 88, tipo: "cifra" as const, celda: (f: FilaMatriz) => fmt(enRango(f, i)), valor: (f: FilaMatriz) => enRango(f, i) }],
  );
  return (
    <Panel
      className="hr-sel-cajon"
      aria-label="Matriz poblacional"
      title="Matriz poblacional"
      actions={
        <>
          <GlidingRadioGroup value={vista} options={PESTANAS} getOptionValue={(o) => o[0]} onValueChange={setCajonPoblacion} className="hr-muestra-opciones hr-cajon-lectura" aria-label="Lectura de la matriz">
            {(o) => <span>{o[1]}</span>}
          </GlidingRadioGroup>
          <MenuDelCajon
            aria="Agrupar filas por"
            rotulo={`Por ${ENCABEZADO[por].toLowerCase()}`}
            opciones={AGRUPAR.map(([id, rotulo]) => ({ id, rotulo, elegida: por === id, alElegir: () => setPor(id) }))}
          />
          <span className="hr-entrega-anclaje">
            <MenuDelCajon
              aria="Descargar la matriz"
              icono={<Download size={14} aria-hidden />}
              rotulo="Descargar"
              opciones={[
                { id: "excel", rotulo: <><FileSpreadsheet size={14} aria-hidden /> Excel, por distrito</>, deshabilitada: exportando, alElegir: descargarExcel },
                { id: "csv", rotulo: <><Download size={14} aria-hidden /> CSV de esta vista</>, deshabilitada: exportando, alElegir: descargarCsvDeLaVista },
              ]}
            />
            <ContenedorEntregable estado={descarga.estado} forma="anclada" onCerrar={descarga.cerrar} />
          </span>
          <PulsoButton variant="icon" size="sm" aria-label="Cerrar la matriz" onClick={() => setCajonPoblacion(null)}>
            <X size={14} aria-hidden />
          </PulsoButton>
        </>
      }
    >
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
    </Panel>
  );
}
