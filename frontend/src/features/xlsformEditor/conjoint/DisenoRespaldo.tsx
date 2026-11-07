// Diseño de un experimento de respaldo en la pestaña Experimentos (checklist elección por pares C15, 2026-11-07): los
// actores, las políticas, las dos frases y la pregunta de apoyo con su escala. A la derecha, lo que lee cada grupo
// para la primera política.

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "../../../vendor/lucide-react";
import { PulsoField, PulsoFieldRow } from "../../../components/PulsoField";
import { PulsoInput } from "../../../components/PulsoInput";
import { fraseDe, generarRespaldo, respaldoInicial, validarRespaldo, type DisenoRespaldo } from "./modeloRespaldo";
import "./panelConjoint.css";

/** Lista de textos editable: uno por fila, con quitar y agregar. */
function ListaDeTextos({ rotulo, valores, minimo, maximo, onCambio }: { rotulo: string; valores: string[]; minimo: number; maximo: number; onCambio: (v: string[]) => void }) {
  return (
    <>
      <ol className="xfe-conjoint__versiones">
        {valores.map((v, i) => (
          <li key={i}>
            <span className="xfe-conjoint__codigo">{rotulo} {i + 1}</span>
            <PulsoInput aria-label={`${rotulo} ${i + 1}`} value={v} onChange={(e) => onCambio(valores.map((x, k) => (k === i ? e.target.value : x)))} />
            <button type="button" className="xfe-conjoint__quitar" aria-label={`Quitar ${rotulo.toLowerCase()} ${i + 1}`} disabled={valores.length <= minimo} onClick={() => onCambio(valores.filter((_, k) => k !== i))}>
              <Trash2 size={13} />
            </button>
          </li>
        ))}
      </ol>
      <div className="xfe-conjoint__acciones">
        <button type="button" onClick={() => onCambio([...valores, ""])} disabled={valores.length >= maximo}>
          <Plus size={13} /> {rotulo}
        </button>
      </div>
    </>
  );
}

export function DisenoRespaldo({ prefijoSugerido, existente, onInsertar }: {
  prefijoSugerido: string;
  existente?: { diseno: DisenoRespaldo; fiel: boolean; motivo: string | null } | null;
  onInsertar: (d: DisenoRespaldo) => string[];
}) {
  const [d, setD] = useState<DisenoRespaldo>(() => existente?.diseno ?? respaldoInicial(prefijoSugerido));
  const editando = Boolean(existente);
  const bloqueo = existente && !existente.fiel ? `No se puede editar desde aquí: ${existente.motivo ?? "el experimento no sigue el patrón del editor."}` : null;
  const [rechazo, setRechazo] = useState<string[]>([]);
  const problemas = useMemo(() => validarRespaldo(d), [d]);
  const cambiar = (cambios: Partial<DisenoRespaldo>) => setD((prev) => ({ ...prev, ...cambios }));
  const cifras = useMemo(() => (problemas.length ? null : generarRespaldo(d).survey.filter((f) => f.type === "calculate").length), [d, problemas]);
  const grupos = d.actores.length + 1;
  const pct = Math.round(100 / grupos);
  const politica = d.politicas[0] ?? "";

  return (
    <div className="xfe-conjoint-pagina">
      <div className="xfe-conjoint">
        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-rs-actores">
          <h3 id="xfe-rs-actores">1. Actores</h3>
          <p className="xfe-conjoint__explica">
            A cada encuestado le toca un grupo para todas las políticas: sin respaldo o con el de un actor, con la misma
            probabilidad. La diferencia en el apoyo mide el efecto de cada actor sin preguntar por él.
          </p>
          <ListaDeTextos rotulo="Actor" valores={d.actores} minimo={1} maximo={5} onCambio={(actores) => cambiar({ actores })} />
        </section>

        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-rs-politicas">
          <h3 id="xfe-rs-politicas">2. Políticas</h3>
          <p className="xfe-conjoint__explica">Cada política es una página con su frase y la pregunta de apoyo.</p>
          <ListaDeTextos rotulo="Política" valores={d.politicas} minimo={1} maximo={6} onCambio={(politicas) => cambiar({ politicas })} />
        </section>

        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-rs-frases">
          <h3 id="xfe-rs-frases">3. Frases</h3>
          <p className="xfe-conjoint__explica">{"{politica}"} se reemplaza por cada política y {"{actor}"} por el actor que tocó.</p>
          <PulsoFieldRow geometryGroup="xlsform/respaldo-frases" className="xfe-conjoint__columna">
            <PulsoField label="Sin respaldo">
              <textarea className="pulso-input xfe-conjoint__texto" rows={2} value={d.fraseControl} onChange={(e) => cambiar({ fraseControl: e.target.value })} />
            </PulsoField>
            <PulsoField label="Con respaldo">
              <textarea className="pulso-input xfe-conjoint__texto" rows={2} value={d.fraseRespaldo} onChange={(e) => cambiar({ fraseRespaldo: e.target.value })} />
            </PulsoField>
          </PulsoFieldRow>
        </section>

        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-rs-escala">
          <h3 id="xfe-rs-escala">4. Pregunta y escala</h3>
          <PulsoFieldRow geometryGroup="xlsform/respaldo-pregunta" className="xfe-conjoint__columna">
            <PulsoField label="Pregunta">
              <textarea className="pulso-input xfe-conjoint__texto" rows={2} value={d.pregunta} onChange={(e) => cambiar({ pregunta: e.target.value })} />
            </PulsoField>
          </PulsoFieldRow>
          <PulsoFieldRow geometryGroup="xlsform/respaldo-escala" className="xfe-conjoint__escala">
            <PulsoField label="Desde">
              <PulsoInput numeric type="number" value={d.escala.min} onChange={(e) => cambiar({ escala: { ...d.escala, min: Number(e.target.value) } })} />
            </PulsoField>
            <PulsoField label="Rótulo del mínimo">
              <PulsoInput value={d.escala.etiquetaMin} onChange={(e) => cambiar({ escala: { ...d.escala, etiquetaMin: e.target.value } })} />
            </PulsoField>
            <PulsoField label="Hasta">
              <PulsoInput numeric type="number" value={d.escala.max} onChange={(e) => cambiar({ escala: { ...d.escala, max: Number(e.target.value) } })} />
            </PulsoField>
            <PulsoField label="Rótulo del máximo">
              <PulsoInput value={d.escala.etiquetaMax} onChange={(e) => cambiar({ escala: { ...d.escala, etiquetaMax: e.target.value } })} />
            </PulsoField>
          </PulsoFieldRow>
        </section>

        {problemas.length || rechazo.length || bloqueo ? (
          <section className="xfe-conjoint__avisos" role="status">
            <strong>Por corregir</strong>
            <ul>
              {[...(bloqueo ? [bloqueo] : []), ...problemas, ...rechazo].map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <aside className="xfe-conjoint-lateral" aria-label="Lo que lee cada grupo y aplicar">
        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-rs-muestra">
          <h3 id="xfe-rs-muestra">Lo que lee cada grupo</h3>
          <p className="xfe-conjoint__explica">Primera política; cada grupo es el {pct}% de la muestra.</p>
          {Array.from({ length: grupos }, (_, g) => (
            <div key={g} className="xfe-conjoint__grupo">
              <strong>{g === 0 ? "Sin respaldo" : `Con ${d.actores[g - 1]?.trim() || `el actor ${g}`}`}</strong>
              <p className="xfe-conjoint__frase">{fraseDe(d, g, politica)}</p>
            </div>
          ))}
          <p className="xfe-conjoint__pregunta-muestra">{d.pregunta}</p>
        </section>
        <div className="xfe-conjoint-lateral__aplicar">
          <span className="xfe-conjoint-lateral__cifras">
            {cifras != null ? `${cifras} cálculos y ${d.politicas.length} ${d.politicas.length === 1 ? "página" : "páginas"}` : `${problemas.length} por corregir`}
          </span>
          <button type="button" className="pulso-primary" onClick={() => setRechazo(onInsertar(d))} disabled={problemas.length > 0 || Boolean(bloqueo)}>
            {editando ? "Aplicar cambios" : "Insertar en el formulario"}
          </button>
        </div>
      </aside>
    </div>
  );
}
