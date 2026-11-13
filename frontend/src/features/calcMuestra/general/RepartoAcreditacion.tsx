/**
 * Acreditación › Meta › reparto de la meta de un actor por sus segmentos (D8). Solo para un actor con base cargada en
 * Marco: las filas son sus segmentos y, si se elige, las columnas son otra variable de la base marcada "Para cuotas".
 * La cuota puede ser por celda, por segmento con la otra variable como control, o por celda con un mínimo de 10 que
 * se suma sobre la meta.
 */
import { useEffect, useMemo, useState } from "react";
import { Grid3X3 } from "lucide-react";

import type { CalcMuestraComponente, CalcMuestraWorkspace } from "../../../api/calcMuestra";
import { apiMarcoPublicoCuotas, type CuotasDelActor, type ModoDeCuota } from "../../../api/calcMuestraMarcoPublico";
import { Alert } from "../../../components/Alert";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { fmtInt, safeNumber } from "../sharedCore";
import { actorVisual } from "./catalogos";
import { errorLegible } from "./marcoPublico/piezas";
import { metaCuotaFijada, sugerenciaCuota } from "../criterioSalida";
import { propuestaVigente } from "./modeloPropuesta";
import { useMuestraGeneralStore } from "./store";
import { useActorEnFoco } from "./useActorEnFoco";
import "./marcoPublico/marcoPublico.css";

const SIN_CRUCE = "__sin_cruce__";
const MODOS: ReadonlyArray<{ id: ModoDeCuota; rotulo: string }> = [
  { id: "celda", rotulo: "Por celda" },
  { id: "control", rotulo: "Con control" },
  { id: "minimo", rotulo: "Mínimo 10" },
];

type FilaReparto = { fila: string; i: number };

export function RepartoAcreditacion({ componentes, workspace }: { componentes: CalcMuestraComponente[]; workspace: CalcMuestraWorkspace }) {
  const marcos = useMuestraGeneralStore((s) => s.marcos);
  // Solo los actores con base cargada y segmentos: sin ellos la meta no se reparte.
  const conBase = componentes.filter((c) => marcos[c.id] && (c.marco.estratos ?? []).length > 0);
  const { activo } = useActorEnFoco(componentes);
  const [elegido, setElegido] = useState<string>("");
  const actor = conBase.find((c) => c.id === elegido) ?? conBase.find((c) => c.id === activo?.id) ?? conBase[0] ?? null;

  const propuestas = useMemo(() => propuestaVigente(workspace.propuesta ?? null, componentes).escenarios, [workspace.propuesta, componentes]);
  const [fuente, setFuente] = useState<number>(-1);
  const [modo, setModo] = useState<ModoDeCuota>("celda");
  const [columna, setColumna] = useState<string>("");

  // Una propuesta que ya no existe vuelve a la meta del actor (y el selector también).
  const fuenteValida = fuente >= 0 && fuente < propuestas.length ? fuente : -1;
  const metaActor = actor ? safeNumber(metaCuotaFijada(actor) ?? sugerenciaCuota(actor), 0) : 0;
  const meta = actor ? (fuenteValida < 0 ? metaActor : safeNumber(propuestas[fuenteValida]?.metas[actor.id], metaActor)) : 0;

  const clave = actor ? JSON.stringify([actor.id, meta, modo, columna, marcos[actor.id]?.marco_hash]) : "";
  const [res, setRes] = useState<{ clave: string; datos: CuotasDelActor | null; error: string | null }>({ clave: "", datos: null, error: null });
  useEffect(() => {
    if (!actor || !(meta > 0)) return undefined;
    let vivo = true;
    apiMarcoPublicoCuotas({ componenteId: actor.id, meta, modo, columna })
      .then((datos) => { if (vivo) setRes({ clave, datos, error: null }); })
      .catch((e: unknown) => { if (vivo) setRes({ clave, datos: null, error: errorLegible(e) }); });
    return () => { vivo = false; };
    // La clave resume las dependencias que cambian el reparto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const datos = res.clave === clave ? res.datos : null;
  // Las columnas que se pueden cruzar son las del actor elegido: mientras carga otro, no se ofrecen las del anterior.
  const [columnasDe, setColumnasDe] = useState<{ actor: string; columnas: string[] }>({ actor: "", columnas: [] });
  const actorId = actor?.id ?? "";
  useEffect(() => {
    if (datos && actorId) setColumnasDe({ actor: actorId, columnas: datos.columnasCuota });
  }, [datos, actorId]);

  if (!conBase.length) return null;
  const leyendo = res.clave !== clave && meta > 0;
  const columnasCuota = actor && columnasDe.actor === actor.id ? columnasDe.columnas : [];

  const control = datos?.modo === "control";
  const columnas: PulsoTableColumna<FilaReparto>[] = datos ? [
    { id: "seg", encabezado: actor ? (marcos[actor.id]?.columnas.estrato || "Segmento") : "Segmento", ancho: 240, celda: (f) => <strong>{f.fila}</strong> },
    ...datos.cruce.columnas.map((c, j): PulsoTableColumna<FilaReparto> => ({
      id: `c-${j}`,
      encabezado: datos.cruce.columnaVariable ? c : control ? "Esperadas" : "Cuota",
      ancho: 132,
      tipo: "cifra",
      celda: (f) => {
        const N = datos.cruce.conteos[f.i]?.[j] ?? 0;
        if (!N) return <span className="cmmp-suave">Sin personas</span>;
        const n = control ? datos.esperadas?.[f.i]?.[j] ?? 0 : datos.cuotas?.[f.i]?.[j] ?? 0;
        const chica = !control && n < datos.umbral;
        return (
          <span className="cmmp-cuota" data-chica={chica ? "true" : undefined} data-esperada={control ? "true" : undefined}>
            <b>{control ? `~${fmtInt(Math.round(n))}` : fmtInt(n)}</b><small>de {fmtInt(N)}</small>
          </span>
        );
      },
    })),
    ...(datos.cruce.columnaVariable ? [{
      id: "total", encabezado: control ? "Meta" : "Cuota", ancho: 112, tipo: "cifra" as const, celda: (f: FilaReparto) => {
        const fila = datos.porFila[f.i];
        const chica = control && (fila?.n ?? 0) < datos.umbral;
        return <span className="cmmp-cuota" data-chica={chica ? "true" : undefined}><b>{fmtInt(fila?.n ?? 0)}</b><small>de {fmtInt(fila?.N ?? 0)}</small></span>;
      },
    }] : []),
  ] : [];

  const menor = datos?.porFila.reduce((m, f) => (f.n < m.n ? f : m), datos.porFila[0]);
  return (
    <PanelDeMesa
      zona="reparto"
      titulo={actor ? `Reparto de ${actorVisual(actor).label}` : "Reparto"}
      icono={<Grid3X3 size={15} aria-hidden="true" />}
      ocupado={leyendo}
    >
      <div className="cmmp-formula">
        {conBase.length > 1 ? (
          <label className="cmmp-ctl">
            <small>Actor</small>
            <PulsoSelect size="sm" value={actor?.id ?? ""} ariaLabel="Actor del reparto" options={conBase.map((c) => ({ value: c.id, label: actorVisual(c).label }))} onValueChange={(id) => { setElegido(id); setColumna(""); }} />
          </label>
        ) : null}
        <label className="cmmp-ctl">
          <small>Meta</small>
          <PulsoSelect
            size="sm"
            value={String(fuenteValida)}
            ariaLabel="Meta que se reparte"
            options={[{ value: "-1", label: `Meta del actor (${fmtInt(metaActor)})` }, ...propuestas.map((p, i) => ({ value: String(i), label: `${p.nombre} (${fmtInt(safeNumber(actor ? p.metas[actor.id] : 0, 0))})` }))]}
            onValueChange={(v) => setFuente(Number(v))}
          />
        </label>
        <label className="cmmp-ctl">
          <small>Cruzar con</small>
          <PulsoSelect
            size="sm"
            value={columna || SIN_CRUCE}
            ariaLabel="Segunda variable del reparto"
            options={[{ value: SIN_CRUCE, label: "Sin cruce" }, ...columnasCuota.map((c) => ({ value: c, label: c }))]}
            onValueChange={(v) => setColumna(v === SIN_CRUCE ? "" : v)}
          />
        </label>
        <div className="cmmp-ctl">
          <small>Cómo se reparte</small>
          <GlidingRadioGroup value={modo} options={MODOS} getOptionValue={(o) => o.id} onValueChange={setModo} className="cmg-segmentado" aria-label="Cómo se reparte la meta">
            {(o) => <span>{o.rotulo}</span>}
          </GlidingRadioGroup>
        </div>
      </div>
      {!(meta > 0) ? <p className="cmmp-vacio-chico cmmp-pad">Este actor todavía no tiene meta: escríbela arriba o en una propuesta.</p> : null}
      {res.clave === clave && res.error ? <div className="cmmp-pad"><Alert kind="error">{res.error}</Alert></div> : null}
      {datos ? (
        <>
          <div className="cmmp-cifras cmmp-cifras--4">
            <div><strong>{fmtInt(datos.total)}</strong><small>{datos.extra > 0 ? `encuestas, ${fmtInt(datos.extra)} por el mínimo` : "encuestas"}</small></div>
            <div data-tono={datos.chicas.length ? "aviso" : undefined}><strong>{fmtInt(datos.chicas.length)}<span className="cmmp-de">/{fmtInt(datos.celdas)}</span></strong><small>{control ? "segmentos" : "celdas"} con menos de {fmtInt(datos.umbral)}</small></div>
            <div><strong>{fmtInt(menor?.n ?? 0)}</strong><small>segmento más chico, {menor?.categoria ?? ""}</small></div>
            <div><strong>{menor?.margen == null ? "Sin margen" : `± ${(menor.margen * 100).toFixed(1)} %`}</strong><small>margen de ese segmento</small></div>
          </div>
          <PulsoTable
            columnas={columnas}
            filas={datos.cruce.filas.map((fila, i) => ({ fila, i }))}
            idDeFila={(f) => f.fila}
            ariaLabel={`Cuotas de ${actor ? actorVisual(actor).label : "el actor"}`}
            densidad="compacta"
            altoMaximo={2000}
          />
        </>
      ) : null}
    </PanelDeMesa>
  );
}
