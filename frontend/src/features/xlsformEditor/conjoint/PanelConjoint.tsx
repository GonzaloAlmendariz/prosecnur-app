// Panel «Experimento de elección por pares» (conjoint) (E7b editor-conjoint, 2026-11-06). Se arma el diseño en cuatro bloques, cada uno con
// lo que hace a la vista, se ve un par sorteado tal como lo verá el encuestado y se inserta en el formulario.

import { useMemo, useReducer, useState } from "react";
import { Plus, Shuffle, Trash2 } from "lucide-react";
import { Sideover } from "../../../components/Sideover";
import { PulsoField, PulsoFieldRow } from "../../../components/PulsoField";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
import { renderMarkdownInline } from "../helpers/markdown";
import { conTablasHtml } from "../helpers/markdownTabla";
import "../helpers/markdownTabla.css";
import { calcularValores, semillaNueva } from "../shell/simulador/calculosPrueba";
import type { BuilderNode } from "../types";
import { generarConjoint, validarDiseno, type DisenoConjoint } from "./modeloConjoint";
import { PANEL_EXPERIMENTO_CONJOINT, disenoInicial, reducirConjoint } from "./estadoPanelConjoint";
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

export function PanelConjoint({ prefijoSugerido, onInsertar }: {
  prefijoSugerido: string;
  /** Inserta el diseño; devuelve los motivos si no se pudo. */
  onInsertar: (d: DisenoConjoint) => string[];
}) {
  const [d, despachar] = useReducer(reducirConjoint, prefijoSugerido, disenoInicial);
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
    <Sideover
      panel={PANEL_EXPERIMENTO_CONJOINT}
      title="Experimento de elección por pares"
      subtitle="Pares de perfiles con atributos sorteados, para medir qué pesa en la elección"
      icon={<Shuffle size={16} />}
      footerStatus={cifras ? `${cifras.calculos} cálculos y ${cifras.paginas} páginas` : `${problemas.length} por corregir`}
      footer={
        <button type="button" className="pulso-primary" onClick={insertar} disabled={problemas.length > 0}>
          Insertar en el formulario
        </button>
      }
    >
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
            <PulsoField label="Pregunta de elección">
              <PulsoInput value={d.pregunta} onChange={(e) => despachar({ tipo: "general", cambios: { pregunta: e.target.value } })} />
            </PulsoField>
            <PulsoField label="Introducción" labelDetail="opcional">
              <PulsoInput value={d.intro ?? ""} onChange={(e) => despachar({ tipo: "general", cambios: { intro: e.target.value } })} />
            </PulsoField>
          </PulsoFieldRow>
        </section>

        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-cj-atributos">
          <h3 id="xfe-cj-atributos">2. Atributos</h3>
          <p className="xfe-conjoint__explica">
            Cada perfil sortea un nivel de cada atributo. Sin pesos, todos los niveles salen con la misma probabilidad;
            con pesos, el sorteo los respeta. Un atributo puede depender de otro: si la condición no se cumple, se muestra
            «—» y en la base queda NA.
          </p>
          {d.atributos.map((a, i) => (
            <fieldset key={i} className="xfe-conjoint__atributo">
              <legend className="xfe-conjoint__cabeza">
                <PulsoInput aria-label={`Rótulo del atributo ${i + 1}`} value={a.rotulo} onChange={(e) => despachar({ tipo: "rotuloAtributo", indice: i, rotulo: e.target.value })} />
                <code>{a.clave}</code>
                <button type="button" className="xfe-conjoint__quitar" aria-label={`Quitar ${a.rotulo}`} onClick={() => despachar({ tipo: "quitarAtributo", indice: i })}>
                  <Trash2 size={14} />
                </button>
              </legend>
              <ol className="xfe-conjoint__niveles">
                {a.niveles.map((n, k) => (
                  <li key={k}>
                    <span className="xfe-conjoint__codigo">{n.codigo}</span>
                    <PulsoInput size="sm" aria-label={`Nivel ${k + 1} de ${a.rotulo}`} value={n.texto} onChange={(e) => despachar({ tipo: "textoNivel", atributo: i, nivel: k, texto: e.target.value })} />
                    {n.peso != null ? (
                      <PulsoInput
                        size="sm"
                        numeric
                        className="xfe-conjoint__peso"
                        aria-label={`Peso de ${n.texto}`}
                        type="number"
                        step={0.05}
                        min={0}
                        max={1}
                        value={n.peso}
                        onChange={(e) => despachar({ tipo: "pesoNivel", atributo: i, nivel: k, peso: Number(e.target.value) })}
                      />
                    ) : null}
                    <button type="button" className="xfe-conjoint__quitar" aria-label={`Quitar ${n.texto}`} disabled={a.niveles.length <= 2} onClick={() => despachar({ tipo: "quitarNivel", atributo: i, nivel: k })}>
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ol>
              <div className="xfe-conjoint__acciones">
                <button type="button" onClick={() => despachar({ tipo: "agregarNivel", atributo: i })}>
                  <Plus size={13} /> Nivel
                </button>
                <PulsoSwitch size="sm" label="Con pesos" checked={a.niveles.every((n) => n.peso != null)} onCheckedChange={(v) => despachar({ tipo: "usarPesos", atributo: i, usar: v })} />
                {i > 0 ? (
                  <span className="xfe-conjoint__condicion">
                    Se omite si
                    <PulsoSelect
                      size="sm"
                      ariaLabel={`Condición de ${a.rotulo}`}
                      value={a.soloSi ? `${a.soloSi.atributo}|${a.soloSi.noEs[0]}` : "siempre"}
                      onValueChange={(valor) => {
                        const [atributo, codigo] = valor.split("|");
                        despachar({ tipo: "condicion", atributo: i, soloSi: atributo && codigo ? { atributo, noEs: [codigo] } : undefined });
                      }}
                      options={[
                        { value: "siempre", label: "siempre se muestra" },
                        ...d.atributos.slice(0, i).flatMap((b) => b.niveles.map((n) => ({ value: `${b.clave}|${n.codigo}`, label: `${b.rotulo} es «${n.texto}»` }))),
                      ]}
                    />
                  </span>
                ) : null}
              </div>
            </fieldset>
          ))}
          <button type="button" onClick={() => despachar({ tipo: "agregarAtributo" })}>
            <Plus size={13} /> Atributo
          </button>
        </section>

        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-cj-orden">
          <h3 id="xfe-cj-orden">3. Orden de los atributos</h3>
          <p className="xfe-conjoint__explica">
            Con orden sorteado, cada encuestado ve las filas en un orden propio, igual en todas sus tareas. Evita que el
            primer atributo gane peso sólo por ir arriba.
          </p>
          <PulsoSwitch label="Sortear el orden por encuestado" checked={Boolean(d.ordenAleatorio)} onCheckedChange={(v) => despachar({ tipo: "general", cambios: { ordenAleatorio: v } })} />
        </section>

        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-cj-muestra">
          <h3 id="xfe-cj-muestra">4. Un par de muestra</h3>
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
    </Sideover>
  );
}
