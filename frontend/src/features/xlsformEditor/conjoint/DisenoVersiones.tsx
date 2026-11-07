// Diseño de una pregunta con versiones al azar en la pestaña Experimentos (checklist elección por pares C12,
// 2026-11-07): la pregunta (código, tipo de respuesta y lista) y sus redacciones, con pesos opcionales. A la derecha,
// la versión que le tocaría a un encuestado, y se inserta o, si ya existe, se reemplaza.

import { useMemo, useState } from "react";
import { Plus, Shuffle, Trash2 } from "../../../vendor/lucide-react";
import { PulsoField, PulsoFieldRow } from "../../../components/PulsoField";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
import { renderMarkdownInline } from "../helpers/markdown";
import { calcularValores, semillaNueva } from "../shell/simulador/calculosPrueba";
import type { BuilderNode } from "../types";
import { generarVersiones, nombresVersiones, validarVersiones, versionesIniciales, type DisenoVersiones, type TipoRespuestaVersiones } from "./modeloVersiones";
import "./panelConjoint.css";

const TIPOS: { value: TipoRespuestaVersiones; label: string }[] = [
  { value: "select_one", label: "Selección de una lista" },
  { value: "integer", label: "Número" },
  { value: "text", label: "Texto" },
];

/** Pesos iguales que suman 1 exacto (el último absorbe el redondeo). */
function pesosIguales(n: number): number[] {
  const p = Math.round((1 / n) * 100) / 100;
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? Math.round((1 - p * (n - 1)) * 100) / 100 : p));
}

/** La versión que le tocaría a un encuestado con esta semilla. */
function versionDeMuestra(d: DisenoVersiones, semilla: number): { numero: number; html: string } | null {
  if (validarVersiones(d).length) return null;
  const filas = generarVersiones(d).slice(0, 3);
  const nodos = filas.map((f, i) => ({ ...f, rowIndex: i, kind: "calculate", relevant: "", typeInfo: { raw: f.type, base: f.type, listName: "" } })) as unknown as BuilderNode[];
  const n = nombresVersiones(d.prefijo);
  const valores = calcularValores(nodos, {}, semilla);
  const numero = Number(valores[n.version]);
  return Number.isInteger(numero) ? { numero, html: renderMarkdownInline(valores[n.texto] ?? "") } : null;
}

export function DisenoVersiones({ prefijoSugerido, listas, existente, onInsertar }: {
  prefijoSugerido: string;
  /** Listas de opciones del formulario. */
  listas: string[];
  existente?: { diseno: DisenoVersiones; fiel: boolean; motivo: string | null } | null;
  onInsertar: (d: DisenoVersiones) => string[];
}) {
  const [d, setD] = useState<DisenoVersiones>(() => existente?.diseno ?? versionesIniciales(prefijoSugerido, listas[0] ?? ""));
  const editando = Boolean(existente);
  const bloqueo = existente && !existente.fiel ? `No se puede editar desde aquí: ${existente.motivo ?? "el experimento no sigue el patrón del editor."}` : null;
  const [semilla, setSemilla] = useState(semillaNueva);
  const [rechazo, setRechazo] = useState<string[]>([]);
  const problemas = useMemo(() => validarVersiones(d, listas), [d, listas]);
  const muestra = useMemo(() => versionDeMuestra(d, semilla), [d, semilla]);
  const conPesos = d.versiones.every((v) => v.peso != null);

  const cambiar = (cambios: Partial<DisenoVersiones>) => setD((prev) => ({ ...prev, ...cambios }));
  const cambiarVersion = (i: number, cambios: Partial<DisenoVersiones["versiones"][number]>) =>
    setD((prev) => ({ ...prev, versiones: prev.versiones.map((v, k) => (k === i ? { ...v, ...cambios } : v)) }));
  const conVersiones = (versiones: DisenoVersiones["versiones"]) => {
    const pesos = conPesos ? pesosIguales(versiones.length) : null;
    setD((prev) => ({ ...prev, versiones: versiones.map((v, k) => (pesos ? { ...v, peso: pesos[k] } : { texto: v.texto })) }));
  };

  return (
    <div className="xfe-conjoint-pagina">
      <div className="xfe-conjoint">
        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-vs-pregunta">
          <h3 id="xfe-vs-pregunta">1. Pregunta</h3>
          <p className="xfe-conjoint__explica">
            Cada encuestado ve una sola versión. La respuesta queda en una variable y la versión que le tocó, en otra.
          </p>
          <PulsoFieldRow geometryGroup="xlsform/versiones-pregunta" className="xfe-conjoint__trio">
            <PulsoField label="Código en la base">
              <PulsoInput value={d.pregunta} onChange={(e) => cambiar({ pregunta: e.target.value })} />
            </PulsoField>
            <PulsoField label="Respuesta">
              <PulsoSelect ariaLabel="Tipo de respuesta" value={d.tipo} onValueChange={(v) => cambiar({ tipo: v as TipoRespuestaVersiones })} options={TIPOS} />
            </PulsoField>
            {d.tipo === "select_one" ? (
              <PulsoField label="Lista de opciones">
                <PulsoSelect ariaLabel="Lista de opciones" value={d.lista} onValueChange={(v) => cambiar({ lista: v })} options={listas.map((l) => ({ value: l, label: l }))} />
              </PulsoField>
            ) : null}
          </PulsoFieldRow>
          <PulsoSwitch label="Obligatoria" checked={d.obligatoria} onCheckedChange={(v) => cambiar({ obligatoria: v })} />
        </section>

        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-vs-versiones">
          <h3 id="xfe-vs-versiones">2. Versiones</h3>
          <p className="xfe-conjoint__explica">Sin pesos, todas salen con la misma probabilidad; con pesos, el sorteo los respeta.</p>
          <ol className="xfe-conjoint__versiones">
            {d.versiones.map((v, i) => (
              <li key={i}>
                <span className="xfe-conjoint__codigo">Versión {i + 1}</span>
                <textarea className="pulso-input xfe-conjoint__texto" rows={2} aria-label={`Texto de la versión ${i + 1}`} value={v.texto} onChange={(e) => cambiarVersion(i, { texto: e.target.value })} />
                {conPesos ? (
                  <PulsoInput size="sm" numeric className="xfe-conjoint__peso" aria-label={`Peso de la versión ${i + 1}`} type="number" step={0.05} min={0} max={1} value={v.peso ?? 0} onChange={(e) => cambiarVersion(i, { peso: Number(e.target.value) })} />
                ) : null}
                <button type="button" className="xfe-conjoint__quitar" aria-label={`Quitar la versión ${i + 1}`} disabled={d.versiones.length <= 2} onClick={() => conVersiones(d.versiones.filter((_, k) => k !== i))}>
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ol>
          <div className="xfe-conjoint__acciones">
            <button type="button" onClick={() => conVersiones([...d.versiones, { texto: "" }])} disabled={d.versiones.length >= 10}>
              <Plus size={13} /> Versión
            </button>
            <PulsoSwitch size="sm" label="Con pesos" checked={conPesos} onCheckedChange={(usar) => {
              const pesos = pesosIguales(d.versiones.length);
              setD((prev) => ({ ...prev, versiones: prev.versiones.map((v, k) => (usar ? { ...v, peso: pesos[k] } : { texto: v.texto })) }));
            }} />
          </div>
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
      <aside className="xfe-conjoint-lateral" aria-label="Versión de muestra y aplicar">
        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-vs-muestra">
          <h3 id="xfe-vs-muestra">Lo que le tocaría a un encuestado</h3>
          {muestra ? (
            <>
              <span className="xfe-conjoint__codigo is-version">Versión {muestra.numero}</span>
              <p className="xfe-conjoint__escenario" dangerouslySetInnerHTML={{ __html: muestra.html }} />
            </>
          ) : (
            <p className="xfe-conjoint__vacio">La versión aparece cuando el diseño no tiene nada por corregir.</p>
          )}
          <button type="button" onClick={() => setSemilla(semillaNueva())} disabled={!muestra}>
            <Shuffle size={13} /> Otro sorteo
          </button>
        </section>
        <div className="xfe-conjoint-lateral__aplicar">
          <span className="xfe-conjoint-lateral__cifras">{problemas.length ? `${problemas.length} por corregir` : `3 cálculos y ${d.versiones.length} versiones`}</span>
          <button type="button" className="pulso-primary" onClick={() => setRechazo(onInsertar(d))} disabled={problemas.length > 0 || Boolean(bloqueo)}>
            {editando ? "Aplicar cambios" : "Insertar en el formulario"}
          </button>
        </div>
      </aside>
    </div>
  );
}
