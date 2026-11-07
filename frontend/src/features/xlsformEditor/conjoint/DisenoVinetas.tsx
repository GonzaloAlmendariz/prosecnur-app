// Diseño de un experimento de viñetas en la pestaña Experimentos (checklist elección por pares C10, 2026-11-07): el
// texto con sus huecos, los atributos que los llenan, la pregunta y su escala. A la derecha, una viñeta sorteada tal
// como la verá el encuestado, y se inserta o, si ya existe, se reemplaza con sus mismos nombres.

import { useMemo, useReducer, useRef, useState } from "react";
import { Shuffle } from "../../../vendor/lucide-react";
import { PulsoField, PulsoFieldRow } from "../../../components/PulsoField";
import { PulsoInput } from "../../../components/PulsoInput";
import { renderMarkdownInline } from "../helpers/markdown";
import { calcularValores, semillaNueva } from "../shell/simulador/calculosPrueba";
import type { BuilderNode } from "../types";
import { reducirVinetas } from "./estadoPanelConjoint";
import { EditorAtributos } from "./EditorAtributos";
import { generarVinetas, validarVinetas, vinetasIniciales, type DisenoVinetas } from "./modeloVinetas";
import "./panelConjoint.css";

/** Una viñeta sorteada del diseño, con los huecos ya llenos. */
function vinetaDeMuestra(d: DisenoVinetas, semilla: number): string | null {
  if (validarVinetas(d).length) return null;
  const { survey } = generarVinetas({ ...d, vinetas: 1 });
  const nodos = survey.map((f, i) => ({
    ...f,
    rowIndex: i,
    kind: f.type === "calculate" ? "calculate" : "note",
    relevant: "",
    typeInfo: { raw: f.type, base: f.type.split(" ")[0], listName: "" },
  })) as unknown as BuilderNode[];
  const valores = calcularValores(nodos, {}, semilla);
  const texto = survey.find((f) => f.name.endsWith("_texto"))?.label ?? "";
  return renderMarkdownInline(texto.replace(/\$\{([^}]+)\}/g, (_m, n: string) => valores[n] ?? ""));
}

export function DisenoVinetas({ prefijoSugerido, existente, onInsertar }: {
  prefijoSugerido: string;
  /** El experimento que ya tiene el formulario: se edita en vez de crear uno. */
  existente?: { diseno: DisenoVinetas; fiel: boolean; motivo: string | null } | null;
  /** Inserta (o, con `existente`, reemplaza) el diseño; devuelve los motivos si no se pudo. */
  onInsertar: (d: DisenoVinetas) => string[];
}) {
  const [d, despachar] = useReducer(reducirVinetas, null, () => existente?.diseno ?? vinetasIniciales(prefijoSugerido));
  const editando = Boolean(existente);
  const bloqueo = existente && !existente.fiel ? `No se puede editar desde aquí: ${existente.motivo ?? "el experimento no sigue el patrón del editor."}` : null;
  const [semilla, setSemilla] = useState(semillaNueva);
  const [rechazo, setRechazo] = useState<string[]>([]);
  const textoRef = useRef<HTMLTextAreaElement | null>(null);
  const problemas = useMemo(() => validarVinetas(d), [d]);
  const muestra = useMemo(() => vinetaDeMuestra(d, semilla), [d, semilla]);
  const cifras = useMemo(() => {
    if (problemas.length) return null;
    const { survey } = generarVinetas(d);
    return { calculos: survey.filter((f) => f.type === "calculate").length, paginas: d.vinetas };
  }, [d, problemas]);
  const puntos = useMemo(() => {
    const { min, max } = d.escala;
    return Number.isInteger(min) && Number.isInteger(max) && max > min && max - min <= 10 ? Array.from({ length: max - min + 1 }, (_, k) => min + k) : [];
  }, [d.escala]);

  /** Pone `{clave}` donde está el cursor del texto (o al final). */
  const insertarHueco = (clave: string) => {
    const el = textoRef.current;
    const hueco = `{${clave}}`;
    const desde = el?.selectionStart ?? d.texto.length;
    const hasta = el?.selectionEnd ?? d.texto.length;
    despachar({ tipo: "general", cambios: { texto: d.texto.slice(0, desde) + hueco + d.texto.slice(hasta) } });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(desde + hueco.length, desde + hueco.length);
    });
  };
  const insertar = () => setRechazo(onInsertar({ ...d, intro: d.intro?.trim() || undefined }));

  return (
    <div className="xfe-conjoint-pagina">
      <div className="xfe-conjoint">
        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-vi-vinetas">
          <h3 id="xfe-vi-vinetas">1. Viñetas</h3>
          <p className="xfe-conjoint__explica">
            Cada viñeta es una página con un escenario y una pregunta para calificarlo. Cada encuestado ve varias, con
            los atributos sorteados en cada una.
          </p>
          <PulsoFieldRow geometryGroup="xlsform/vinetas-numero" className="xfe-conjoint__numero">
            <PulsoField label="Viñetas por persona">
              <PulsoInput numeric type="number" min={1} max={20} value={d.vinetas} onChange={(e) => despachar({ tipo: "general", cambios: { vinetas: Number(e.target.value) } })} />
            </PulsoField>
          </PulsoFieldRow>
          <PulsoFieldRow geometryGroup="xlsform/vinetas-intro" className="xfe-conjoint__columna">
            <PulsoField label="Introducción" labelDetail="opcional">
              <textarea className="pulso-input xfe-conjoint__texto" rows={3} value={d.intro ?? ""} onChange={(e) => despachar({ tipo: "general", cambios: { intro: e.target.value } })} />
            </PulsoField>
          </PulsoFieldRow>
        </section>

        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-vi-texto">
          <h3 id="xfe-vi-texto">2. Texto de la viñeta</h3>
          <p className="xfe-conjoint__explica">Cada hueco entre llaves se llena con el nivel sorteado de su atributo.</p>
          <PulsoFieldRow geometryGroup="xlsform/vinetas-texto" className="xfe-conjoint__columna">
            <PulsoField label="Escenario">
              <textarea ref={textoRef} className="pulso-input xfe-conjoint__texto" rows={4} value={d.texto} onChange={(e) => despachar({ tipo: "general", cambios: { texto: e.target.value } })} />
            </PulsoField>
          </PulsoFieldRow>
          <div className="xfe-conjoint__huecos" role="group" aria-label="Insertar un atributo en el texto">
            <span>Insertar</span>
            {d.atributos.map((a) => (
              <button key={a.clave} type="button" className="xfe-conjoint__hueco" onClick={() => insertarHueco(a.clave)}>
                {a.rotulo}
              </button>
            ))}
          </div>
        </section>

        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-vi-atributos">
          <h3 id="xfe-vi-atributos">3. Atributos</h3>
          <p className="xfe-conjoint__explica">
            Cada viñeta sortea un nivel de cada atributo. Sin pesos, todos los niveles salen con la misma probabilidad;
            con pesos, el sorteo los respeta.
          </p>
          <EditorAtributos atributos={d.atributos} despachar={despachar} />
        </section>

        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-vi-escala">
          <h3 id="xfe-vi-escala">4. Pregunta y escala</h3>
          <PulsoFieldRow geometryGroup="xlsform/vinetas-pregunta" className="xfe-conjoint__columna">
            <PulsoField label="Pregunta">
              <textarea className="pulso-input xfe-conjoint__texto" rows={2} value={d.pregunta} onChange={(e) => despachar({ tipo: "general", cambios: { pregunta: e.target.value } })} />
            </PulsoField>
          </PulsoFieldRow>
          <PulsoFieldRow geometryGroup="xlsform/vinetas-escala" className="xfe-conjoint__escala">
            <PulsoField label="Desde">
              <PulsoInput numeric type="number" value={d.escala.min} onChange={(e) => despachar({ tipo: "escala", cambios: { min: Number(e.target.value) } })} />
            </PulsoField>
            <PulsoField label="Rótulo del mínimo">
              <PulsoInput value={d.escala.etiquetaMin} onChange={(e) => despachar({ tipo: "escala", cambios: { etiquetaMin: e.target.value } })} />
            </PulsoField>
            <PulsoField label="Hasta">
              <PulsoInput numeric type="number" value={d.escala.max} onChange={(e) => despachar({ tipo: "escala", cambios: { max: Number(e.target.value) } })} />
            </PulsoField>
            <PulsoField label="Rótulo del máximo">
              <PulsoInput value={d.escala.etiquetaMax} onChange={(e) => despachar({ tipo: "escala", cambios: { etiquetaMax: e.target.value } })} />
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
      <aside className="xfe-conjoint-lateral" aria-label="Viñeta de muestra y aplicar">
        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-vi-muestra">
          <h3 id="xfe-vi-muestra">Una viñeta de muestra</h3>
          <p className="xfe-conjoint__explica">Así la verá el encuestado. Cada sorteo es otra entrevista.</p>
          {muestra ? (
            <>
              <p className="xfe-conjoint__escenario" dangerouslySetInnerHTML={{ __html: muestra }} />
              <p className="xfe-conjoint__pregunta-muestra">{d.pregunta}</p>
              <ol className="xfe-conjoint__puntos" aria-label="Escala">
                {puntos.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ol>
              <div className="xfe-conjoint__extremos">
                <span>{d.escala.etiquetaMin}</span>
                <span>{d.escala.etiquetaMax}</span>
              </div>
            </>
          ) : (
            <p className="xfe-conjoint__vacio">La viñeta aparece cuando el diseño no tiene nada por corregir.</p>
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
