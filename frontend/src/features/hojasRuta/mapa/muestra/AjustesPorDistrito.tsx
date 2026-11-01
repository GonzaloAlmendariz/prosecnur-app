import type { HojasRutaIntegratedConfig } from "../../../../api/hojasRuta";
import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import { nombreDistrito } from "../nombres";
import { useLienzoHojasRuta } from "../store";
import { conAjuste, deffAcotado, margenDesdePct, normalizarAjustes } from "./mapaDeAjustes";
import "./ajustesPorDistrito.css";

type Fila = { ubigeo: string; distrito: string };

/**
 * P3: margen y DEFF ajustados por distrito, para un distrito que necesita menos margen o tiene otro
 * diseño de campo. Van al mismo borrador del inspector de Muestra y se guardan con «Guardar».
 * Vacío = el valor general. Sólo en el modo calculado: con N por distrito no hay margen que imponer.
 */
export function AjustesPorDistrito({ config, filas, bloqueado }: { config: HojasRutaIntegratedConfig; filas: readonly Fila[]; bloqueado: boolean }) {
  const { muestraBorrador, setMuestraBorrador } = useLienzoHojasRuta();
  const s = { ...config.sample_size, ...muestraBorrador?.sample_size };
  const margenes = normalizarAjustes(s.margin_district_overrides);
  const deffs = normalizarAjustes(s.design_effect_overrides);
  const poner = (campo: "margin_district_overrides" | "design_effect_overrides", mapa: Record<string, number>) =>
    setMuestraBorrador({ ...muestraBorrador, sample_size: { ...muestraBorrador?.sample_size, [campo]: mapa } });
  const ajustados = Object.keys(margenes).length + Object.keys(deffs).length;
  const columnas: PulsoTableColumna<Fila>[] = [
    { id: "distrito", encabezado: "Distrito", ancho: 150, celda: (f) => nombreDistrito(f.distrito) },
    {
      id: "margen",
      encabezado: "Margen (±%)",
      ancho: 96,
      tipo: "cifra",
      celda: (f) => (
        <input
          className="hr-muestra-ajuste"
          type="number"
          min={0.1}
          max={80}
          step={0.1}
          placeholder="—"
          disabled={bloqueado}
          aria-label={`Margen ajustado de ${nombreDistrito(f.distrito)}`}
          value={margenes[f.ubigeo] !== undefined ? Number((margenes[f.ubigeo] * 100).toFixed(2)) : ""}
          onChange={(e) => poner("margin_district_overrides", conAjuste(margenes, f.ubigeo, e.target.value === "" ? null : margenDesdePct(Number(e.target.value))))}
        />
      ),
    },
    {
      id: "deff",
      encabezado: "DEFF",
      ancho: 80,
      tipo: "cifra",
      celda: (f) => (
        <input
          className="hr-muestra-ajuste"
          type="number"
          min={0.1}
          max={20}
          step={0.1}
          placeholder="—"
          disabled={bloqueado}
          aria-label={`DEFF ajustado de ${nombreDistrito(f.distrito)}`}
          value={deffs[f.ubigeo] ?? ""}
          onChange={(e) => poner("design_effect_overrides", conAjuste(deffs, f.ubigeo, e.target.value === "" ? null : deffAcotado(Number(e.target.value))))}
        />
      ),
    },
  ];
  if (!filas.length) return null;

  return (
    <details className="hr-muestra-ajustes" open={ajustados > 0 || undefined}>
      <summary>
        Ajustes por distrito{ajustados ? ` · ${ajustados}` : ""} <small>(opcional)</small>
      </summary>
      <p className="hr-mapa-nota">
        Si un distrito necesita menor margen o tiene otro diseño de campo, ajústalo aquí. En blanco vale el general: ±
        {(s.margin_district * 100).toLocaleString("es-PE", { maximumFractionDigits: 1 })} % y DEFF {s.design_effect.toLocaleString("es-PE", { maximumFractionDigits: 2 })}.
      </p>
      <PulsoTable
        columnas={columnas}
        filas={filas}
        idDeFila={(f) => f.ubigeo}
        ariaLabel="Margen y DEFF ajustados por distrito"
        densidad="compacta"
        altoMaximo={100000}
      />
    </details>
  );
}
