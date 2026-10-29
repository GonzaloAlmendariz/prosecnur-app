import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import type { HojasRutaAgeRange, HojasRutaIntegratedConfig } from "../../../../api/hojasRuta";
import { nombreDistrito } from "../nombres";
import { useLienzoHojasRuta } from "../store";
import type { ResumenMatriz } from "./matriz";
import { agregarRango, editarRango, firmaRangos, PRESETS_EDAD, problemasDeRangos } from "./rangos";

/**
 * Población en la página del lienzo (U6). La estructura edita los rangos de
 * edad y muestra cuánto pesa cada uno en la población objetivo; el inspector
 * agrupa, divide por sexo y calcula la matriz. Calcular la matriz borra en el
 * backend el tamaño, las cuotas y la muestra: se dice antes de hacerlo.
 */

const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(n));
const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toLocaleString("es-PE", { maximumFractionDigits: 1 })} %` : "—");

type EstructuraProps = { rangosConfig: readonly HojasRutaAgeRange[]; matriz: ResumenMatriz; bloqueado: boolean };

export function PoblacionEstructura({ rangosConfig, matriz, bloqueado }: EstructuraProps) {
  const { rangosBorrador, setRangosBorrador } = useLienzoHojasRuta();
  const rangos = rangosBorrador ?? [...rangosConfig];
  const problemas = problemasDeRangos(rangos);
  const editar = (i: number, campo: "min" | "max", texto: string) => {
    const n = Number(texto);
    if (texto === "" || !Number.isFinite(n)) return;
    setRangosBorrador(editarRango(rangos, i, campo, Math.max(0, Math.min(110, Math.round(n)))));
  };

  return (
    <>
      <div className="hr-mapa-cab hr-mapa-cab--pila">
        <div className="hr-mapa-cab-titulo">
          <h2>Rangos de edad</h2>
          <small>{rangos.length} rangos</small>
        </div>
        {matriz.vigente ? (
          <div className="hr-edad-regla" role="img" aria-label="Peso de cada rango en la población objetivo">
            {rangos.map((r, i) => (
              <span key={r.id} style={{ flexGrow: Math.max(matriz.pesoPorRango[i], matriz.total * 0.04) }} data-tono={Math.min(5, Math.round((i / Math.max(1, rangos.length - 1)) * 5))}>
                <b>{r.label}</b>
                <small>{pct(matriz.pesoPorRango[i], matriz.total)}</small>
              </span>
            ))}
          </div>
        ) : (
          <p className="hr-mapa-nota">Sin calcular con estos rangos: el peso de cada uno aparece al calcular la matriz.</p>
        )}
      </div>
      <div className="hr-mapa-ins-cuerpo">
        {problemas.map((p) => (
          <p key={p.texto} className="hr-mapa-aviso">{p.texto}</p>
        ))}
        <ul className="hr-edad-lista">
          {rangos.map((r, i) => (
            <li key={`${i}-${r.id}`}>
              <i data-tono={Math.min(5, Math.round((i / Math.max(1, rangos.length - 1)) * 5))} />
              <span className="hr-edad-campos">
                <input type="number" min={0} max={110} aria-label={`Desde, rango ${i + 1}`} value={r.min} disabled={bloqueado} onChange={(e) => editar(i, "min", e.target.value)} />
                <span>a</span>
                {r.max == null ? (
                  <button type="button" className="hr-edad-abierto" disabled={bloqueado} title="Ponerle un tope" onClick={() => setRangosBorrador(editarRango(rangos, i, "max", r.min + 9))}>
                    y más
                  </button>
                ) : (
                  <input type="number" min={r.min} max={110} aria-label={`Hasta, rango ${i + 1}`} value={r.max} disabled={bloqueado} onChange={(e) => editar(i, "max", e.target.value)} />
                )}
              </span>
              <span className="hr-edad-peso">
                {matriz.vigente ? (
                  <>
                    <b>{fmt(matriz.pesoPorRango[i])}</b>
                    <small>{pct(matriz.pesoPorRango[i], matriz.total)}</small>
                  </>
                ) : (
                  <small>—</small>
                )}
              </span>
              <PulsoButton variant="icon" intent="remove" size="sm" aria-label={`Quitar el rango ${r.label}`} disabled={bloqueado || rangos.length <= 1} onClick={() => setRangosBorrador(rangos.filter((_, k) => k !== i))}>
                ×
              </PulsoButton>
            </li>
          ))}
        </ul>
        <div className="hr-mapa-acciones">
          <PulsoButton variant="secondary" size="sm" disabled={bloqueado} onClick={() => setRangosBorrador(agregarRango(rangos))}>
            Agregar rango
          </PulsoButton>
          {rangos[rangos.length - 1]?.max != null ? (
            <PulsoButton variant="secondary" size="sm" disabled={bloqueado} onClick={() => setRangosBorrador(editarRango(rangos, rangos.length - 1, "max", null))}>
              Abrir el último
            </PulsoButton>
          ) : null}
        </div>
        <section className="hr-mapa-presets" aria-label="Empezar desde">
          <h3>Empezar desde</h3>
          <div className="hr-mapa-chips">
            {PRESETS_EDAD.map((p) => (
              <button key={p.id} type="button" className="hr-mapa-zona" data-estado={firmaRangos(p.rangos) === firmaRangos(rangos) ? "todo" : undefined} disabled={bloqueado} onClick={() => setRangosBorrador(p.rangos.map((r) => ({ ...r })))}>
                <span>{p.etiqueta}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

type InspectorProps = {
  config: HojasRutaIntegratedConfig;
  matriz: ResumenMatriz;
  poblacionDistritos: number;
  bloqueado: boolean;
  guardando: boolean;
  hayMuestra: boolean;
  onGuardarYCalcular: (cambios: Partial<HojasRutaIntegratedConfig>) => void;
};

export function PoblacionInspector({ config, matriz, poblacionDistritos, bloqueado, guardando, hayMuestra, onGuardarYCalcular }: InspectorProps) {
  const { rangosBorrador, setRangosBorrador } = useLienzoHojasRuta();
  const rangos = rangosBorrador ?? config.age_ranges;
  const cambiaron = firmaRangos(rangos) !== firmaRangos(config.age_ranges);
  const conProblemas = problemasDeRangos(rangos).length > 0;
  const sexo = config.subquota_var !== "ninguna";

  return (
    <>
      <header className="hr-mapa-cab">
        <h2>Población objetivo</h2>
      </header>
      <div className="hr-mapa-ins-cuerpo">
        <div className="hr-mapa-cifras">
          <div><small>Objetivo</small><strong>{matriz.vigente ? `${(matriz.total / 1e6).toLocaleString("es-PE", { maximumFractionDigits: 2 })} M` : "—"}</strong></div>
          <div><small>De la población</small><strong>{matriz.vigente ? pct(matriz.total, poblacionDistritos) : "—"}</strong></div>
          <div><small>Celdas</small><strong>{config.territorios.length * rangos.length * (sexo ? 2 : 1)}</strong></div>
        </div>
        <p className="hr-mapa-nota">Edad simple oficial INEI 2017 (C5P41 × sexo) por distrito.</p>
        <PulsoSwitch label="Dividir por sexo" size="sm" checked={sexo} disabled={bloqueado || guardando} onCheckedChange={(v) => onGuardarYCalcular({ subquota_var: v ? "sexo" : "ninguna" })} />
        {matriz.vigente ? (
          <div className="hr-mapa-tabla-caja" tabIndex={0} aria-label="Matriz poblacional">
          <table className="hr-mapa-tabla">
            <thead>
              <tr>
                <th>Distrito</th>
                {rangos.map((r) => <th key={r.id}>{r.label}</th>)}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {matriz.filas.map((f) => (
                <tr key={f.ubigeo}>
                  <th>{nombreDistrito(f.territorio)}</th>
                  {f.porRango.map((c, i) => <td key={i}>{fmt(c.H + c.M)}</td>)}
                  <td><b>{fmt(f.total)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : null}
        {cambiaron || !matriz.vigente ? (
          hayMuestra ? <p className="hr-mapa-aviso">Calcular con estos rangos recalcula la población y descarta el tamaño, las cuotas y el sorteo actual.</p> : null
        ) : null}
      </div>
      <footer className="hr-mapa-pie">
        <PulsoButton variant="secondary" disabled={!cambiaron || guardando} onClick={() => setRangosBorrador(null)}>
          Deshacer
        </PulsoButton>
        <PulsoButton variant="primary" disabled={bloqueado || guardando || conProblemas || (!cambiaron && matriz.vigente)} onClick={() => onGuardarYCalcular({ age_ranges: rangos, age_range_mode: "manual" })}>
          {guardando ? "Calculando…" : "Calcular la matriz"}
        </PulsoButton>
      </footer>
    </>
  );
}
