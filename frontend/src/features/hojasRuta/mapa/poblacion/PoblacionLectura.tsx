import type { HojasRutaAgeRange } from "../../../../api/hojasRuta";
import { formatoDecimal } from "../../../../lib/formatoNumero";
import { AccesoAjustes } from "../ajustes/AccesoAjustes";
import { resumenGrupo } from "../ajustes/gruposAjustes";
import type { HojasRutaIntegratedConfig } from "../../../../api/hojasRuta";
import type { ResumenMatriz } from "./matriz";

const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(n));

/**
 * La columna de Población después de mudar la edición a «Ajustes del diseño» (M4, lámina 2 de la maqueta):
 * los rangos como lectura, cada uno con su peso en la población objetivo, y el acceso «Editar ›».
 */
export function PoblacionLectura({ rangos, config, matriz }: { rangos: readonly HojasRutaAgeRange[]; config: HojasRutaIntegratedConfig; matriz: ResumenMatriz }) {
  const mayor = Math.max(1, ...(matriz.vigente ? matriz.pesoPorRango : [1]));
  return (
    <>
      <div className="hr-mapa-cab hr-mapa-cab--pila">
        <div className="hr-mapa-cab-titulo">
          <h2>Rangos de edad</h2>
          <small>{rangos.length} rangos{matriz.vigente ? `, ${fmt(matriz.total)} personas` : ""}</small>
        </div>
      </div>
      <div className="hr-mapa-ins-cuerpo">
        <ul className="hr-edad-lectura" aria-label="Rangos de edad y su peso en la población objetivo">
          {rangos.map((r, i) => {
            const peso = matriz.vigente ? matriz.pesoPorRango[i] : null;
            return (
              <li key={`${i}-${r.id}`} data-tono={Math.min(5, Math.round((i / Math.max(1, rangos.length - 1)) * 5))}>
                <b>{r.label}</b>
                <i aria-hidden="true"><i style={{ width: peso != null ? `${Math.min(100, (100 * peso) / mayor)}%` : 0 }} /></i>
                <small>{peso != null && matriz.total ? `${formatoDecimal((peso / matriz.total) * 100, 1)} %` : "sin calcular"}</small>
              </li>
            );
          })}
        </ul>
        <AccesoAjustes grupo="cuotas" titulo="Cuotas y edades" valor={resumenGrupo("cuotas", config)} />
      </div>
    </>
  );
}
