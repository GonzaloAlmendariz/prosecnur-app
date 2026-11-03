import { PulsoButton } from "../../../../components/PulsoButton";
import { PiramidePoblacion } from "./PiramidePoblacion";
import { Info, Table2, Users } from "../../../../vendor/lucide-react";
import { InspectorCabecera } from "../InspectorCabecera";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import type { HojasRutaAgeRange, HojasRutaAgeRangeMode, HojasRutaAgeRangeScope, HojasRutaAlert, HojasRutaIntegratedConfig } from "../../../../api/hojasRuta";
import { AvisosDelMotor } from "../AvisosDelMotor";
import { useLienzoHojasRuta } from "../store";
import type { ResumenMatriz } from "./matriz";

import { agregarRango, CORTES, editarRango, firmaRangos, PRESETS_EDAD, problemasDeRangos, rangosLimpios } from "./rangos";
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";

/**
 * Población en la página del lienzo (U6). La estructura edita los rangos de
 * edad y muestra cuánto pesa cada uno en la población objetivo; el inspector
 * agrupa, divide por sexo y calcula la matriz. Calcular la matriz borra en el
 * backend el tamaño, las cuotas y la muestra: se dice antes de hacerlo.
 */

const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(n));
const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toLocaleString("es-PE", { maximumFractionDigits: 1 })} %` : "—");

type EstructuraProps = { rangosConfig: readonly HojasRutaAgeRange[]; config: HojasRutaIntegratedConfig; matriz: ResumenMatriz; bloqueado: boolean };

const MODOS = [["manual", "Manual"], ["cortes", "Por cortes"]] as const;
const BASES = [["selected", "Distritos elegidos"], ["frame", "Todo el marco"]] as const;

/** Modo y base en vista: el borrador si lo hay, si no lo guardado (B28). */
export function useModoRangos(config: HojasRutaIntegratedConfig) {
  const { cortesBorrador, setCortesBorrador } = useLienzoHojasRuta();
  const modoGuardado = config.age_range_mode ?? "manual";
  const baseGuardada = config.age_range_scope ?? "selected";
  const modo = cortesBorrador?.modo ?? modoGuardado;
  const base = cortesBorrador?.base ?? baseGuardada;
  const fijar = (m: HojasRutaAgeRangeMode, b: HojasRutaAgeRangeScope) => setCortesBorrador(m === modoGuardado && b === baseGuardada ? null : { modo: m, base: b });
  return { modo, base, fijar, pendiente: modo !== modoGuardado || base !== baseGuardada, deshacer: () => setCortesBorrador(null) };
}

export function PoblacionEstructura({ rangosConfig, config, matriz, bloqueado }: EstructuraProps) {
  const { rangosBorrador, setRangosBorrador } = useLienzoHojasRuta();
  const { modo, base, fijar, pendiente } = useModoRangos(config);
  const enCortes = modo !== "manual";
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
          <small>{rangos.length} rangos{matriz.vigente ? `, ${fmt(matriz.total)} personas` : ""}</small>
        </div>
        <GlidingRadioGroup
          value={enCortes ? "cortes" : "manual"}
          options={MODOS}
          getOptionValue={(o) => o[0]}
          onValueChange={(v) => {
            if (v === "manual") {
              fijar("manual", base);
              if (enCortes) setRangosBorrador(rangosLimpios(rangos));
            } else {
              fijar("cuartiles", base);
              setRangosBorrador(null);
            }
          }}
          className="hr-muestra-opciones"
          aria-label="Cómo se arman los rangos"
          getOptionProps={() => ({ disabled: bloqueado })}
        >
          {(o) => <span>{o[1]}</span>}
        </GlidingRadioGroup>
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
      {enCortes ? (
        <div className="hr-mapa-ins-cuerpo">
          <div className="hr-muestra-grupo">
            <small>Cortes</small>
            <div className="hr-mapa-chips" role="group" aria-label="Cortes">
              {CORTES.map(([id, etiqueta]) => (
                <button key={id} type="button" className="hr-mapa-zona" aria-pressed={modo === id} data-estado={modo === id ? "todo" : undefined} disabled={bloqueado} onClick={() => fijar(id, base)}>
                  <span>{etiqueta}</span>
                </button>
              ))}
            </div>
            <small>Base de los cortes</small>
            <GlidingRadioGroup value={base} options={BASES} getOptionValue={(o) => o[0]} onValueChange={(b) => fijar(modo, b)} className="hr-muestra-opciones" aria-label="Base de los cortes" getOptionProps={() => ({ disabled: bloqueado })}>
              {(o) => <span>{o[1]}</span>}
            </GlidingRadioGroup>
            <p className="hr-mapa-nota">Cada rango reúne la misma parte de la población de 18 años o más; el motor pone los cortes con la edad simple del censo.</p>
          </div>
          {pendiente || !matriz.vigente ? (
            <p className="hr-mapa-nota">Los cortes aparecen al calcular la matriz.</p>
          ) : (
            <ul className="hr-edad-lista">
              {rangos.map((r, i) => (
                <li key={`${i}-${r.id}`} className="is-fija">
                  <i data-tono={Math.min(5, Math.round((i / Math.max(1, rangos.length - 1)) * 5))} />
                  <b>{r.label}</b>
                  <span className="hr-edad-peso">
                    <b>{fmt(matriz.pesoPorRango[i])}</b>
                    <small>{pct(matriz.pesoPorRango[i], matriz.total)}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {!pendiente && matriz.vigente ? (
            <div className="hr-mapa-acciones">
              <PulsoButton
                variant="secondary"
                size="sm"
                disabled={bloqueado}
                onClick={() => {
                  fijar("manual", base);
                  setRangosBorrador(rangosLimpios(rangos));
                }}
              >
                Editar estos rangos a mano
              </PulsoButton>
            </div>
          ) : null}
        </div>
      ) : (
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
      )}
    </>
  );
}

type InspectorProps = {
  config: HojasRutaIntegratedConfig;
  rangosConfig: readonly HojasRutaAgeRange[];
  matriz: ResumenMatriz;
  poblacionDistritos: number;
  bloqueado: boolean;
  guardando: boolean;
  hayMuestra: boolean;
  onGuardarYCalcular: (cambios: Partial<HojasRutaIntegratedConfig>) => void;
  /** P5: los avisos que devolvió el cálculo de la matriz (`population.alerts`). */
  avisos?: readonly HojasRutaAlert[];
};

export function PoblacionInspector({ config, rangosConfig, matriz, poblacionDistritos, bloqueado, guardando, hayMuestra, avisos, onGuardarYCalcular }: InspectorProps) {
  const { rangosBorrador, setRangosBorrador, cajonPoblacion, setCajonPoblacion } = useLienzoHojasRuta();
  const { modo, base, pendiente, deshacer } = useModoRangos(config);
  const rangos = rangosBorrador ?? rangosConfig;
  const cambiaron = pendiente || firmaRangos(rangos) !== firmaRangos(rangosConfig);
  const conProblemas = modo === "manual" && problemasDeRangos(rangos).length > 0;
  const sexo = config.subquota_var !== "ninguna";

  return (
    <>
      <InspectorCabecera icono={Users} sobre="Población" titulo="Población objetivo" />
      <div className="hr-mapa-ins-cuerpo">
        <h3 className="hr-mapa-subtitulo">Resultado</h3>
        <div className="hr-mapa-cifras">
          <div><small>Objetivo</small><strong>{matriz.vigente ? `${(matriz.total / 1e6).toLocaleString("es-PE", { maximumFractionDigits: 2 })} M` : "—"}</strong></div>
          <div title="Parte de la población de los distritos elegidos que entra en los rangos de edad"><small>Del total</small><strong>{matriz.vigente ? pct(matriz.total, poblacionDistritos) : "—"}</strong></div>
          <div><small>Celdas</small><strong>{config.territorios.length * rangos.length * (sexo ? 2 : 1)}</strong></div>
        </div>
        <p className="hr-mapa-fuente">
          <Info size={14} aria-hidden />
          <span>Edad simple oficial INEI 2017 (C5P41 × sexo) por distrito.</span>
        </p>
        {matriz.vigente ? <AvisosDelMotor avisos={avisos} /> : null}
        <h3 className="hr-mapa-subtitulo">Matriz</h3>
        <PulsoSwitch label="Dividir por sexo" size="sm" checked={sexo} disabled={bloqueado || guardando} onCheckedChange={(v) => onGuardarYCalcular({ subquota_var: v ? "sexo" : "ninguna" })} />
        {matriz.vigente ? (
          <PulsoButton variant="secondary" onClick={() => setCajonPoblacion(cajonPoblacion ? null : "matriz")} aria-pressed={Boolean(cajonPoblacion)}>
            <Table2 size={14} aria-hidden /> {cajonPoblacion ? "Ocultar la matriz" : `Ver la matriz, ${matriz.filas.length} distritos`}
          </PulsoButton>
        ) : null}
        {matriz.vigente && sexo && !cambiaron ? <PiramidePoblacion filas={matriz.filas} rangos={rangosConfig} /> : null}
        {cambiaron || !matriz.vigente ? (
          hayMuestra ? <p className="hr-mapa-aviso">Calcular con estos rangos recalcula la población y descarta el tamaño, las cuotas y el sorteo actual.</p> : null
        ) : null}
      </div>
      <footer className="hr-mapa-pie">
        <PulsoButton variant="secondary" disabled={!cambiaron || guardando} onClick={() => { setRangosBorrador(null); deshacer(); }}>
          Deshacer
        </PulsoButton>
        <PulsoButton variant="primary" disabled={bloqueado || guardando || conProblemas || (!cambiaron && matriz.vigente)} onClick={() => onGuardarYCalcular(modo === "manual" ? { age_ranges: [...rangos], age_range_mode: "manual", age_range_scope: base } : { age_range_mode: modo, age_range_scope: base })}>
          {guardando ? "Calculando…" : "Calcular la matriz"}
        </PulsoButton>
      </footer>
    </>
  );
}
