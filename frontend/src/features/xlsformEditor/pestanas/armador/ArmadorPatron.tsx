import { useEffect, useId, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronRight, Plus, X } from "../../../../vendor/lucide-react";
import { ArmadorBloque } from "./ArmadorBloque";
import { PruebaValor } from "./PruebaValor";
import {
  FORMATOS,
  MENU_AGREGAR,
  constraintDe,
  cuerpoRegex,
  ejemploValido,
  estadoInicial,
  lecturaDe,
  nuevoBloque,
  probar,
  reducirArmador,
  rotuloCorto,
} from "./armadorModelo";
import "./armador.css";

// Armador de patrones (G2): arma una regla regex de pregunta de texto por partes y la escribe al aplicar.
// Nada se toca hasta «Aplicar»: cancelar deja la constraint como estaba.

type Props = {
  constraint: string;
  onAplicar: (constraint: string) => void;
  onCancelar: () => void;
};

export function ArmadorPatron({ constraint, onAplicar, onCancelar }: Props) {
  const [estado, despachar] = useReducer(reducirArmador, constraint, estadoInicial);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [entrada, setEntrada] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const agregarRef = useRef<HTMLButtonElement>(null);
  const ids = useId();

  const { bloques, formato } = estado;
  const cuerpo = cuerpoRegex(bloques);
  const lectura = lecturaDe(bloques);
  const ejemplo = ejemploValido(bloques, formato);
  const codigo = cuerpo ? constraintDe(cuerpo) : "";

  useEffect(() => {
    if (!menuAbierto) return;
    menuRef.current?.querySelector("button")?.focus();
    const fuera = (e: MouseEvent) => {
      if (!(e.target instanceof Node) || !menuRef.current?.parentElement?.contains(e.target)) setMenuAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [menuAbierto]);

  const teclaMenu = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(menuRef.current?.querySelectorAll("button") ?? [])];
    const k = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = items.length;
      items[(k + (e.key === "ArrowDown" ? 1 : -1) + n) % n]?.focus();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setMenuAbierto(false);
      agregarRef.current?.focus();
    }
  };

  return (
    <section className="xfa" aria-label="Armador de patrones" data-qa-geometry-group="armador-patron" data-qa-geometry-contract="intrinsic">
      <header className="xfa-respuesta" aria-live="polite" data-qa-geometry-member="">
        <p className="xfa-rotulo">Acepta</p>
        {lectura ? (
          <p className="xfa-frase">
            {lectura.map((p, i) => {
              const txt = p.tipo === "texto" || p.tipo === "valor" ? p.texto : p.etiqueta;
              const sep = i === 0 || txt === "," ? "" : " ";
              return (
                <span key={i}>
                  {sep}
                  {p.tipo === "valor" ? <strong>{txt}</strong> : txt}
                </span>
              );
            })}
          </p>
        ) : (
          <p className="xfa-frase xfa-frase--nula">{cuerpo ? "Sin resumen: pruébalo con ejemplos" : "Sin partes"}</p>
        )}
        {ejemplo && (
          <div className="xfa-ejemplo-caja">
            <p className="xfa-rotulo">Ejemplo</p>
            <div className="xfa-ejemplo">
              {ejemplo.map((p) => (
                <div key={p.i} className={`xfa-seg xfa-tono-${(p.i % 5) + 1}`}>
                  <span className="xfa-seg__txt">{p.texto}</span>
                  <span className="xfa-seg__rot">{rotuloCorto(bloques[p.i]!, p.i, bloques.length)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {estado.reemplaza && <p className="xfa-aviso">La regla actual se reemplaza al aplicar.</p>}
      </header>

      <section className="xfa-paso" aria-labelledby={`${ids}-formato`} data-qa-geometry-member="">
        <h3 id={`${ids}-formato`} className="xfa-paso__titulo">
          Formato
        </h3>
        <div className="xfa-galeria" role="group" aria-labelledby={`${ids}-formato`} data-qa-geometry-group="armador-galeria" data-qa-geometry-contract="equal">
          {FORMATOS.map((f) => (
            <button key={f.id} type="button" className="xfa-formato" aria-pressed={formato === f.id} onClick={() => despachar({ tipo: "formato", id: f.id })}>
              <b>{f.nombre}</b>
              <span>{f.ej}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="xfa-paso" aria-labelledby={`${ids}-partes`} data-qa-geometry-member="">
        <h3 id={`${ids}-partes`} className="xfa-paso__titulo">
          Partes
        </h3>
        {bloques.length ? (
          <ol className="xfa-bloques" data-qa-geometry-group="armador-partes" data-qa-geometry-contract="equal">
            {bloques.map((b, i) => (
              <ArmadorBloque
                key={b.id}
                bloque={b}
                indice={i}
                total={bloques.length}
                onCambiar={(cambios) => despachar({ tipo: "editar", id: b.id, cambios })}
                onMover={(delta) => despachar({ tipo: "mover", id: b.id, delta })}
                onQuitar={() => {
                  despachar({ tipo: "quitar", id: b.id });
                  agregarRef.current?.focus();
                }}
              />
            ))}
          </ol>
        ) : (
          <p className="xfa-vacio">Sin partes</p>
        )}
        <div className="xfa-agregar">
          <button
            ref={agregarRef}
            type="button"
            className="xfa-btn"
            aria-expanded={menuAbierto}
            aria-controls={`${ids}-menu`}
            aria-haspopup="menu"
            onClick={() => setMenuAbierto((v) => !v)}
          >
            <Plus aria-hidden="true" /> Agregar
          </button>
          {menuAbierto && (
            <div ref={menuRef} id={`${ids}-menu`} className="xfa-menu" role="menu" aria-label="Agregar parte" onKeyDown={teclaMenu}>
              {MENU_AGREGAR.map((m) => (
                <button
                  key={m.tipo}
                  type="button"
                  role="menuitem"
                  className="xfa-menu__item"
                  onClick={() => {
                    despachar({ tipo: "agregar", bloque: nuevoBloque(m.tipo) });
                    setMenuAbierto(false);
                    agregarRef.current?.focus();
                  }}
                >
                  <span>{m.nombre}</span>
                  <code>{m.ejemplo}</code>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="xfa-paso" aria-labelledby={`${ids}-probar`} data-qa-geometry-member="">
        <h3 id={`${ids}-probar`} className="xfa-paso__titulo">
          Probar
        </h3>
        <form
          className="xfa-prueba"
          onSubmit={(e) => {
            e.preventDefault();
            despachar({ tipo: "probar", texto: entrada });
            setEntrada("");
          }}
        >
          <input
            className="xfa-prueba__input"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-label="Respuesta de prueba"
          />
          <button type="submit" className="xfa-btn">
            Probar
          </button>
        </form>
        {estado.ejemplos.length > 0 && (
          <ul className="xfa-casos" aria-live="polite">
            {estado.ejemplos.map((e, i) => {
              const r = probar(bloques, e);
              return (
                <li key={`${i}-${e}`} className={`xfa-caso ${r.ok ? "xfa-caso--ok" : "xfa-caso--no"}`}>
                  <span className="xfa-caso__estado" aria-label={r.ok ? "Pasa" : "No pasa"}>
                    {r.ok ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
                  </span>
                  <div className="xfa-caso__cuerpo">
                    <PruebaValor texto={e} prueba={r} />
                    {!r.ok && <span className="xfa-caso__motivo">{r.motivo}</span>}
                  </div>
                  <button type="button" className="xfa-ico" aria-label={`Quitar ${e}`} onClick={() => despachar({ tipo: "quitarEjemplo", indice: i })}>
                    <X aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {codigo && (
        <details className="xfa-codigo">
          <summary>
            <ChevronRight aria-hidden="true" /> Ver código
          </summary>
          <pre>{codigo}</pre>
        </details>
      )}

      <div className="xfa-acciones">
        <button type="button" className="xfa-btn" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className="xfa-btn xfa-btn--primario" disabled={!cuerpo} onClick={() => onAplicar(codigo)}>
          Aplicar
        </button>
      </div>
    </section>
  );
}
