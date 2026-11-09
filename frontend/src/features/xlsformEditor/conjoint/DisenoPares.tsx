// Diseño de un experimento de elección por pares (conjoint), en la pestaña Experimentos (checklist elección por
// pares C8, 2026-11-07; antes era un panel lateral, E7b). Se arma en tres bloques, a la derecha se ve un par sorteado
// tal como lo verá el encuestado, y se inserta en el formulario o, si ya existe, se reemplaza con sus mismos nombres.

import { useMemo, useReducer, useState } from "react";
import { Shuffle } from "../../../vendor/lucide-react";
import { PulsoField, PulsoFieldRow } from "../../../components/PulsoField";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
import { renderMarkdownInline } from "../helpers/markdown";
import { conTablasHtml } from "../helpers/markdownTabla";
import "../helpers/markdownTabla.css";
import { calcularValores, semillaNueva } from "../shell/simulador/calculosPrueba";
import type { BuilderNode } from "../types";
import { generarConjoint, validarDiseno, type DisenoConjoint } from "./modeloConjoint";
import { disenoInicial, reducirConjoint } from "./estadoPanelConjoint";
import { EditorAtributos } from "./EditorAtributos";
import "./panelConjoint.css";

/** Un par sorteado del diseño, como lo verá el encuestado (tabla con los textos ya puestos). */
function parDeMuestra(d: DisenoConjoint, semilla: number): string | null {
  if (validarDiseno(d).length) return null;
  const { survey } = generarConjoint({ ...d, tareas: 1 });
  const nodos = survey.map((f, i) => ({
    ...f,
    rowIndex: i,
    kind: f.type === "calculate" ? "calculate" : "note",
    relevant: "",
    typeInfo: { raw: f.type, base: f.type.split(" ")[0], listName: "" },
  })) as unknown as BuilderNode[];
  const valores = calcularValores(nodos, {}, semilla);
  const tabla = survey.find((f) => f.name.endsWith("_tabla"))?.label ?? "";
  return conTablasHtml(tabla.replace(/\$\{([^}]+)\}/g, (_m, n: string) => valores[n] ?? ""), renderMarkdownInline);
}

export function DisenoPares({ prefijoSugerido, existente, onInsertar }: {
  prefijoSugerido: string;
  /** El experimento que ya tiene el formulario (C5): se edita en vez de crear uno. */
  existente?: { diseno: DisenoConjoint; fiel: boolean; motivo: string | null } | null;
  /** Inserta (o, con `existente`, reemplaza) el diseño; devuelve los motivos si no se pudo. */
  onInsertar: (d: DisenoConjoint) => string[];
}) {
  const [d, despachar] = useReducer(reducirConjoint, null, () => existente?.diseno ?? disenoInicial(prefijoSugerido));
  const editando = Boolean(existente);
  const bloqueo = existente && !existente.fiel ? `No se puede editar desde aquí: ${existente.motivo ?? "el experimento no sigue el patrón del editor."}` : null;
  const [semilla, setSemilla] = useState(semillaNueva);
  const [rechazo, setRechazo] = useState<string[]>([]);
  const problemas = useMemo(() => validarDiseno(d), [d]);
  const muestra = useMemo(() => parDeMuestra(d, semilla), [d, semilla]);
  const cifras = useMemo(() => {
    if (problemas.length) return null;
    const { survey } = generarConjoint(d);
    return { calculos: survey.filter((f) => f.type === "calculate").length, paginas: d.tareas };
  }, [d, problemas]);

  const insertar = () => setRechazo(onInsertar({ ...d, intro: d.intro?.trim() || undefined }));

  return (
    <div className="xfe-conjoint-pagina">
      <div className="xfe-conjoint">
        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-cj-tareas">
          <h3 id="xfe-cj-tareas">1. Pares</h3>
          <p className="xfe-conjoint__explica">
            Cada par es una página con dos perfiles lado a lado y una pregunta de elección. Con más pares por persona
            se obtienen más comparaciones con la misma muestra; lo usual va de 5 a 10.
          </p>
          <PulsoFieldRow geometryGroup="xlsform/conjoint-tareas" className="xfe-conjoint__fila">
            <PulsoField label="Pares por persona">
              <PulsoInput numeric type="number" min={1} max={30} value={d.tareas} onChange={(e) => despachar({ tipo: "general", cambios: { tareas: Number(e.target.value) } })} />
            </PulsoField>
            <PulsoField label="Perfil izquierdo">
              <PulsoInput value={d.rotulosPerfil[0]} onChange={(e) => despachar({ tipo: "rotuloPerfil", indice: 0, texto: e.target.value })} />
            </PulsoField>
            <PulsoField label="Perfil derecho">
              <PulsoInput value={d.rotulosPerfil[1]} onChange={(e) => despachar({ tipo: "rotuloPerfil", indice: 1, texto: e.target.value })} />
            </PulsoField>
          </PulsoFieldRow>
          <PulsoFieldRow geometryGroup="xlsform/conjoint-textos" className="xfe-conjoint__columna">
            {/* Textos largos (la pregunta y la introducción del v5 pasan de una línea): área de texto, no input. */}
            <PulsoField label="Pregunta de elección">
              <textarea className="pulso-input xfe-conjoint__texto" rows={2} value={d.pregunta} onChange={(e) => despachar({ tipo: "general", cambios: { pregunta: e.target.value } })} />
            </PulsoField>
            <PulsoField label="Introducción" labelDetail="opcional">
              <textarea className="pulso-input xfe-conjoint__texto" rows={4} value={d.intro ?? ""} onChange={(e) => despachar({ tipo: "general", cambios: { intro: e.target.value } })} />
            </PulsoField>
          </PulsoFieldRow>
        </section>

        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-cj-atributos">
          <h3 id="xfe-cj-atributos">2. Atributos</h3>
          <p className="xfe-conjoint__explica">
            Cada perfil sortea un nivel de cada atributo. Sin pesos, todos los niveles salen con la misma probabilidad;
            con pesos, el sorteo los respeta. Un atributo puede depender de otro: si la condición no se cumple, se muestra
            "—" y en la base queda NA.
          </p>
          <EditorAtributos atributos={d.atributos} despachar={despachar} />
        </section>

        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-cj-orden">
          <h3 id="xfe-cj-orden">3. Orden de los atributos</h3>
          <p className="xfe-conjoint__explica">
            Con orden sorteado, cada encuestado ve las filas en un orden propio, igual en todas sus tareas. Evita que el
            primer atributo gane peso sólo por ir arriba.
          </p>
          <PulsoSwitch label="Sortear el orden por encuestado" checked={Boolean(d.ordenAleatorio)} onCheckedChange={(v) => despachar({ tipo: "general", cambios: { ordenAleatorio: v } })} />
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
      <aside className="xfe-conjoint-lateral" aria-label="Par de muestra y aplicar">
        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-cj-muestra">
          <h3 id="xfe-cj-muestra">Un par de muestra</h3>
          <p className="xfe-conjoint__explica">Así verá el encuestado un par. Cada sorteo es otra entrevista.</p>
          {muestra ? (
            <div className="xfe-conjoint__muestra" dangerouslySetInnerHTML={{ __html: muestra }} />
          ) : (
            <p className="xfe-conjoint__vacio">El par aparece cuando el diseño no tiene nada por corregir.</p>
          )}
          <button type="button" onClick={() => setSemilla(semillaNueva())} disabled={!muestra}>
            <Shuffle size={13} /> Otro sorteo
          </button>
        </section>
        <div className="xfe-conjoint-lateral__aplicar">
          <span className="xfe-conjoint-lateral__cifras">
            {cifras ? `${cifras.calculos} cálculos y ${cifras.paginas} ${cifras.paginas === 1 ? "página" : "páginas"}` : `${problemas.length} por corregir`}
          </span>
          <button type="button" className="pulso-primary" onClick={insertar} disabled={problemas.length > 0 || Boolean(bloqueo)}>
            {editando ? "Aplicar cambios" : "Insertar en el formulario"}
          </button>
        </div>
      </aside>
    </div>
  );
}
