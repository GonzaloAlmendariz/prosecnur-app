// Diseño del orden al azar de las opciones en la pestaña Experimentos (checklist elección por pares C16, 2026-11-07):
// qué preguntas de selección barajan sus opciones. Avisa las que tienen «No sabe» u «Otro», que también se moverían.
// A la derecha, un orden de muestra de la primera elegida.

import { useMemo, useState } from "react";
import { Shuffle } from "../../../vendor/lucide-react";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
import { semillaNueva } from "../shell/simulador/calculosPrueba";
import { stripMarkdown } from "../helpers/markdown";
import { esEscala, opcionesQueSeMueven, validarOrden, type DisenoOrden } from "./modeloOrden";
import "./panelConjoint.css";

export type PreguntaSeleccion = { nombre: string; etiqueta: string; opciones: { codigo: string; etiqueta: string }[] };

/** Baraja con una semilla (para que «Otro sorteo» cambie el orden y el mismo sorteo dé el mismo orden). */
function barajar<T>(xs: readonly T[], semilla: number): T[] {
  const out = [...xs];
  let s = semilla || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function DisenoOrden({ prefijoSugerido, preguntas, existente, onInsertar }: {
  prefijoSugerido: string;
  preguntas: PreguntaSeleccion[];
  existente?: { diseno: DisenoOrden } | null;
  onInsertar: (d: DisenoOrden) => string[];
}) {
  const [d, setD] = useState<DisenoOrden>(() => existente?.diseno ?? { prefijo: prefijoSugerido, preguntas: [] });
  const [semilla, setSemilla] = useState(semillaNueva);
  const [rechazo, setRechazo] = useState<string[]>([]);
  const problemas = useMemo(() => validarOrden(d, preguntas.map((p) => p.nombre)), [d, preguntas]);
  const elegida = preguntas.find((p) => d.preguntas.includes(p.nombre));
  const alternar = (nombre: string, si: boolean) =>
    setD((prev) => ({ ...prev, preguntas: si ? preguntas.map((p) => p.nombre).filter((n) => n === nombre || prev.preguntas.includes(n)) : prev.preguntas.filter((n) => n !== nombre) }));

  return (
    <div className="xfe-conjoint-pagina">
      <div className="xfe-conjoint">
        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-or-preguntas">
          <h3 id="xfe-or-preguntas">Preguntas con las opciones en orden al azar</h3>
          <p className="xfe-conjoint__explica">
            Cada encuestado ve las opciones en otro orden; así ninguna gana por ir primero. El orden que le tocó se puede
            reconstruir con su semilla, que queda en la base. El orden de las preguntas no se puede sortear sin
            duplicarlas.
          </p>
          {preguntas.length ? (
            <ul className="xfe-conjoint__preguntas-orden">
              {preguntas.map((p) => {
                const se = d.preguntas.includes(p.nombre);
                const mueven = se ? opcionesQueSeMueven(p.opciones) : [];
                const escala = se && esEscala(p.opciones);
                return (
                  <li key={p.nombre}>
                    <PulsoSwitch size="sm" label={stripMarkdown(p.etiqueta) || p.nombre} checked={se} onCheckedChange={(v) => alternar(p.nombre, v)} />
                    <span className="xfe-conjoint__detalle">{p.opciones.length} opciones</span>
                    {escala ? <span className="xfe-conjoint__aviso-opciones">Es una escala ordenada: barajarla rompe su orden.</span> : null}
                    {mueven.length ? <span className="xfe-conjoint__aviso-opciones">También se movería: {mueven.join(", ")}</span> : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="xfe-conjoint__vacio">El formulario no tiene preguntas de selección.</p>
          )}
        </section>

        {problemas.length || rechazo.length ? (
          <section className="xfe-conjoint__avisos" role="status">
            <strong>Por corregir</strong>
            <ul>
              {[...problemas, ...rechazo].map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <aside className="xfe-conjoint-lateral" aria-label="Orden de muestra y aplicar">
        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-or-muestra">
          <h3 id="xfe-or-muestra">Un orden de muestra</h3>
          {elegida ? (
            <div className="xfe-conjoint__grupo">
              <strong>{stripMarkdown(elegida.etiqueta) || elegida.nombre}</strong>
              <ul>{barajar(elegida.opciones, semilla).map((o) => <li key={o.codigo}>{o.etiqueta}</li>)}</ul>
            </div>
          ) : (
            <p className="xfe-conjoint__vacio">Elige una pregunta para ver un orden.</p>
          )}
          <button type="button" onClick={() => setSemilla(semillaNueva())} disabled={!elegida}>
            <Shuffle size={13} /> Otro sorteo
          </button>
        </section>
        <div className="xfe-conjoint-lateral__aplicar">
          <span className="xfe-conjoint-lateral__cifras">{problemas.length ? `${problemas.length} por corregir` : `${d.preguntas.length} ${d.preguntas.length === 1 ? "pregunta" : "preguntas"} y 1 cálculo`}</span>
          <button type="button" className="pulso-primary" onClick={() => setRechazo(onInsertar(d))} disabled={problemas.length > 0}>
            {existente ? "Aplicar cambios" : "Aplicar al formulario"}
          </button>
        </div>
      </aside>
    </div>
  );
}
