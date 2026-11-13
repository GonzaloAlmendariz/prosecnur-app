/**
 * Acreditación › Marco: la población de cada público sale de su base (el recorrido de cuatro pasos: archivo,
 * columnas, quién se invita y segmentos) o, si todavía no hay base, se escribe a mano. A la izquierda los actores con
 * su marco; a la derecha el del actor en foco (`foco=<id>`).
 */
import { useState, type ReactNode } from "react";
import { FileSpreadsheet, FileUp, Layers, Users } from "lucide-react";

import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import { CabeceraDePestana } from "../../../components/procesamiento/CabeceraDePestana";
import { MesaDePestana } from "../../../components/procesamiento/MesaDePestana";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { safeNumber, type ComponentePatch } from "../sharedCore";
import { actorVisual } from "./catalogos";
import { RecorridoMarco } from "./marcoPublico/RecorridoMarco";
import { useRecorridoMarcoStore } from "./marcoPublico/store";
import { useMuestraGeneralStore } from "./store";
import { useActorEnFoco } from "./useActorEnFoco";
import { useMuestraGeneral } from "./useMuestraGeneral";
import "./marcoPublico/marcoPublico.css";

const cifra = new Intl.NumberFormat("en-US");

export function MarcoAcreditacion({ componentes, onComponente }: {
  componentes: CalcMuestraComponente[];
  onComponente: (id: string, patch: ComponentePatch) => void;
}) {
  const { activo, elegir } = useActorEnFoco(componentes);
  // Los marcos guardados se leen del motor (también con un enlace pegado o al abrir otro proyecto).
  const { cargado } = useMuestraGeneral(activo?.id ?? null);
  const marcos = useMuestraGeneralStore((s) => s.marcos);
  const enCurso = useRecorridoMarcoStore((s) => s.porActor);
  const irAPaso = useRecorridoMarcoStore((s) => s.irAPaso);
  const [cambiando, setCambiando] = useState<Record<string, boolean>>({});

  const lista = (
      <PanelDeMesa zona="marco-actores" titulo="Actores" icono={<Users size={15} aria-hidden="true" />} conteo={componentes.length}>
        <ul className="cmmp-cola" aria-label="Actores del estudio">
          {componentes.map((c) => {
            const v = actorVisual(c);
            const N = safeNumber(c.marco?.marco_validado, 0);
            const conBase = Boolean(marcos[c.id]);
            const borrador = Boolean(enCurso[c.id]?.lectura);
            const elegido = activo?.id === c.id;
            return (
              <li key={c.id} aria-current={elegido ? "true" : undefined}>
                <button type="button" className="cmmp-cola-actor" onClick={() => elegir(c.id)}>
                  <b>{v.label}</b>
                  <span className="cmmp-pastilla" data-tono={conBase ? "ok" : borrador ? "acento" : N > 0 ? undefined : "aviso"}>
                    {conBase ? (marcos[c.id]?.fuente === "conteos" ? "Tabla de conteos" : "Base cargada") : borrador ? "En curso" : N > 0 ? "Escrita a mano" : "Sin marco"}
                  </span>
                </button>
                {/* La población sale del marco: aquí solo se lee. */}
                <span className="cmmp-cola-n"><small>Población</small>{N > 0 ? <strong>{cifra.format(N)}</strong> : <span className="cmmp-suave">Sin marco</span>}</span>
              </li>
            );
          })}
        </ul>
      </PanelDeMesa>
  );
  if (!activo) return null;
  if (!cargado) {
    return (
      <MesaDePestana
        grupo="calc-muestra/marco-publico"
        columnas={3}
        cabecera={<CabeceraDePestana seccion="Marco" titulo={actorVisual(activo).label} icono={FileSpreadsheet} estado={{ tono: "neutro", texto: "Leyendo" }} />}
      >
        {lista}
        <PanelDeMesa zona="marco-leyendo" titulo="Marco guardado" icono={<FileUp size={15} aria-hidden="true" />} ocupado>
          <p className="cmmp-vacio-chico cmmp-pad">Leyendo el marco guardado del proyecto.</p>
        </PanelDeMesa>
        <PanelDeMesa zona="marco-resumen" titulo={actorVisual(activo).label} icono={<Users size={15} aria-hidden="true" />}>
          <p className="cmmp-vacio-chico cmmp-pad">Leyendo el marco guardado del proyecto.</p>
        </PanelDeMesa>
      </MesaDePestana>
    );
  }
  const declarado = Boolean(marcos[activo.id]) && !cambiando[activo.id] && !enCurso[activo.id]?.lectura;
  if (!declarado) {
    return (
      <RecorridoMarco
        key={activo.id}
        componente={activo}
        lateral={lista}
        cancelable={Boolean(marcos[activo.id])}
        onCerrar={() => setCambiando((c) => ({ ...c, [activo.id]: false }))}
        // Escribir la población a mano es la fuente de un actor sin base; con base, la población sale de ella.
        onPoblacionManual={marcos[activo.id] ? undefined : (n) => {
          onComponente(activo.id, { marco: { marco_validado: n, universo_bruto: n, marco_contactable: n } });
          setCambiando((c) => ({ ...c, [activo.id]: false }));
        }}
      />
    );
  }
  return (
    <MarcoDeclarado
      componente={activo}
      lateral={lista}
      onCambiar={() => { irAPaso(activo.id, "archivo"); setCambiando((c) => ({ ...c, [activo.id]: true })); }}
    />
  );
}

/** El marco ya guardado de un actor: sus segmentos al centro y, a la derecha, cuántos se invitan y de qué archivo. */
function MarcoDeclarado({ componente, lateral, onCambiar }: { componente: CalcMuestraComponente; lateral: ReactNode; onCambiar: () => void }) {
  const marco = useMuestraGeneralStore((s) => s.marcos[componente.id]);
  const v = actorVisual(componente);
  const estratos = componente.marco.estratos ?? [];
  const tope = Math.max(1, ...estratos.map((e) => safeNumber(e.N, 0)));
  return (
    <MesaDePestana
      grupo="calc-muestra/marco-publico"
      columnas={3}
      cabecera={(
        <CabeceraDePestana
          seccion="Marco"
          titulo={v.label}
          icono={FileSpreadsheet}
          estado={{ tono: "listo", texto: "Guardado" }}
          acciones={(
            <PulsoButton variant="secondary" size="sm" onClick={onCambiar}>
              <FileUp size={14} aria-hidden="true" /> Cambiar la base
            </PulsoButton>
          )}
        />
      )}
    >
      {lateral}
      <PanelDeMesa zona="marco-segmentos" titulo={marco?.columnas.estrato || "Segmentos"} icono={<Layers size={15} aria-hidden="true" />} conteo={estratos.length || undefined}>
        {estratos.length ? (
          <ul className="cmmp-hbarras cmmp-hbarras--ancho">
            {estratos.map((e) => (
              <li key={e.id ?? e.label}>
                <span title={e.label}>{e.label}</span>
                <i><b style={{ width: `${(safeNumber(e.N, 0) / tope) * 100}%` }} /></i>
                <em>{cifra.format(safeNumber(e.N, 0))}</em>
              </li>
            ))}
          </ul>
        ) : <p className="cmmp-vacio-chico cmmp-pad">Sin segmentos: la meta del público no se reparte.</p>}
      </PanelDeMesa>
      <PanelDeMesa zona="marco-resumen" titulo={`${v.label}, guardado`} icono={<Users size={15} aria-hidden="true" />}>
        <div className="cmmp-cifras">
          <div><strong>{cifra.format(safeNumber(componente.marco.marco_validado, 0))}</strong><small>se invitan</small></div>
          <div><strong>{estratos.length || "Sin"}</strong><small>{estratos.length === 1 ? "segmento" : "segmentos"}</small></div>
        </div>
        {marco ? (
          <section className="cmmp-sec" aria-label="Archivo">
            <h4>Archivo</h4>
            <dl className="cmmp-roles">
              <div><dt>Fuente</dt><dd>{marco.fuente === "conteos" ? "Tabla de conteos" : "Base con una fila por persona"}</dd></div>
              <div><dt>Hoja</dt><dd>{marco.hoja || "Única"}</dd></div>
              <div><dt>{marco.fuente === "conteos" ? "Categorías" : "Identificador"}</dt><dd>{marco.columnas.id}</dd></div>
            </dl>
          </section>
        ) : null}
      </PanelDeMesa>
    </MesaDePestana>
  );
}
