// Atributos de un experimento y sus niveles, con pesos y la condición «se omite si» (checklist elección por pares
// C10, 2026-11-07: sale del diseño de pares para que lo usen también las viñetas). Código, texto y quitar van en
// columnas fijas para que todo arranque en el mismo punto.

import { Plus, Trash2 } from "../../../vendor/lucide-react";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
import type { AccionAtributo } from "./estadoPanelConjoint";
import type { AtributoConjoint } from "./modeloConjoint";

export function EditorAtributos({ atributos, despachar }: { atributos: AtributoConjoint[]; despachar: (accion: AccionAtributo) => void }) {
  return (
    <>
      {atributos.map((a, i) => (
        <section key={i} className="xfe-conjoint__atributo" aria-label={`Atributo ${i + 1}: ${a.rotulo}`}>
          <div className="xfe-conjoint__cabeza">
            <PulsoInput aria-label={`Rótulo del atributo ${i + 1}`} value={a.rotulo} onChange={(e) => despachar({ tipo: "rotuloAtributo", indice: i, rotulo: e.target.value })} />
            <code>{a.clave}</code>
            <button type="button" className="xfe-conjoint__quitar" aria-label={`Quitar ${a.rotulo}`} onClick={() => despachar({ tipo: "quitarAtributo", indice: i })}>
              <Trash2 size={14} />
            </button>
          </div>
          <ol className="xfe-conjoint__niveles">
            {a.niveles.map((n, k) => (
              <li key={k}>
                <span className="xfe-conjoint__codigo" title={n.codigo}>{n.codigo}</span>
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
          </div>
          {i > 0 ? (
            <div className="xfe-conjoint__condicion">
              <span>Se omite si</span>
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
                  ...atributos.slice(0, i).flatMap((b) => b.niveles.map((n) => ({ value: `${b.clave}|${n.codigo}`, label: `${b.rotulo} es "${n.texto}"` }))),
                ]}
              />
            </div>
          ) : null}
        </section>
      ))}
      <button type="button" onClick={() => despachar({ tipo: "agregarAtributo" })}>
        <Plus size={13} /> Atributo
      </button>
    </>
  );
}
