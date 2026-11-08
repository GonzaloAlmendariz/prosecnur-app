// «Elegir cifra» de una fila del cierre con hallazgos: un solo control para la lámina de origen y su cifra, que antes eran
// dos desplegables en cascada. Se abre en el inspector, debajo del disparador, con alto acotado y scroll propio (nunca un
// panel flotante que tape la pantalla). El buscador es el combobox; la lista es un listbox agrupado por lámina, con una
// fila por pregunta y una opción por medida (modeloElegirCifra.ts). Flechas recorren (arriba y abajo entre filas,
// izquierda y derecha entre medidas cuando la fila tiene varias), Enter elige y Escape cierra y devuelve el foco.

import { useEffect, useId, useRef, type FocusEvent, type KeyboardEvent } from "react";
import { ChevronDown } from "../../../../vendor/lucide-react";
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import { PulsoInput } from "../../../../components/PulsoInput";
import { formatoConteoDe } from "../../../../lib/formatoNumero";
import type { CifraClave } from "../../../../api/graficosCifras";
import { useElegirCifraUi } from "./elegirCifraStore";
import { cifraConUnidad, type OrigenCifras } from "./modeloCierre";
import {
  agruparCifras, buscarCifras, celdaDe, cifrasVisibles, encabezadoMedida, filaConVarias, idCelda, moverActiva, ordenarCifras,
  ORDENES_CIFRAS, rejillaDeOpciones, type CeldaCifra, type CifrasLeidas, type Movimiento,
} from "./modeloElegirCifra";

type Props = {
  /** Clave estable de la fila del cierre. */
  fila: string;
  /** «hallazgo 2», para los nombres accesibles. */
  nombre: string;
  origenes: readonly OrigenCifras[];
  cifrasPorOrigen: Readonly<Record<string, CifrasLeidas>>;
  /** Lo elegido hoy: lámina y clave (pueden no existir ya). */
  lamina: string;
  clave: string;
  /** La cifra elegida, leída en vivo de su lámina; `null` si todavía no llegó o ya no está. */
  elegida: CifraClave | null;
  describedBy?: string;
  invalid?: boolean;
  onElegir: (lamina: string, cifra: CifraClave) => void;
};

const TECLAS: Partial<Record<string, Movimiento>> = {
  ArrowDown: "abajo", ArrowUp: "arriba", ArrowLeft: "izquierda", ArrowRight: "derecha", Home: "inicio", End: "fin",
};

export function ElegirCifra({ fila, nombre, origenes, cifrasPorOrigen, lamina, clave, elegida, describedBy, invalid, onElegir }: Props) {
  const id = useId();
  const abierta = useElegirCifraUi((s) => s.abierta === fila);
  const busqueda = useElegirCifraUi((s) => s.busqueda);
  const orden = useElegirCifraUi((s) => s.orden);
  const activa = useElegirCifraUi((s) => s.activa);
  const { abrir, cerrar, buscar, ordenar, activar } = useElegirCifraUi.getState();
  const disparador = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  const origen = origenes.find((o) => o.id === lamina) ?? null;
  const grupos = abierta
    ? ordenarCifras(buscarCifras(origenes.map((o) => agruparCifras(o, cifrasPorOrigen[o.id])), busqueda), orden)
    : [];
  const rejilla = rejillaDeOpciones(grupos);
  const ids = new Map(rejilla.flat().filter((x): x is string => x !== null).map((x, i) => [x, `${id}-op-${i}`]));
  const activaVisible = activa !== null && ids.has(activa) ? activa : null;
  const cargando = grupos.filter((g) => g.estado === "cargando").length;
  const visibles = cifrasVisibles(grupos);
  const elegidaId = lamina && clave ? idCelda(lamina, clave) : null;

  useEffect(() => {
    if (!activaVisible) return;
    const el = lista.current?.querySelector<HTMLElement>(`[data-opcion="${CSS.escape(activaVisible)}"]`);
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest" });
  }, [activaVisible]);

  const cerrarYVolver = () => {
    cerrar();
    disparador.current?.focus();
  };

  const elegir = (c: CeldaCifra) => {
    onElegir(c.lamina, c.cifra);
    cerrarYVolver();
  };

  const alTeclear = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cerrarYVolver();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const destino = activaVisible ?? rejilla.flat().find((x): x is string => x !== null) ?? null;
      const celda = destino ? celdaDe(grupos, destino) : null;
      if (celda) elegir(celda);
      return;
    }
    const mov = TECLAS[e.key];
    if (!mov) return;
    // Izquierda, derecha, Inicio y Fin mueven el cursor del buscador mientras no se recorra una fila con varias medidas.
    if ((mov === "izquierda" || mov === "derecha") && !filaConVarias(rejilla, activaVisible)) return;
    if ((mov === "inicio" || mov === "fin") && activaVisible === null) return;
    e.preventDefault();
    activar(moverActiva(rejilla, activaVisible, mov));
  };

  const alSalir = (e: FocusEvent<HTMLDivElement>) => {
    if (!abierta) return;
    const hacia = e.relatedTarget as Node | null;
    if (hacia && e.currentTarget.contains(hacia)) return;
    cerrar();
  };

  return (
    <div className="pulso-f6-elegir-cifra" onBlur={alSalir}>
      <button ref={disparador} type="button" className="pulso-select-trigger pulso-select-trigger--sm pulso-f6-elegir-cifra-disparador"
        data-state={abierta ? "open" : "closed"} data-placeholder={elegida ? undefined : ""} aria-expanded={abierta}
        aria-controls={abierta ? `${id}-panel` : undefined} aria-label={`Cifra del ${nombre}`} aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onClick={() => (abierta ? cerrar() : abrir(fila, elegidaId))}>
        <span className="pulso-f6-elegir-cifra-valor">
          {elegida ? (
            <>
              <strong className="pulso-f6-cierre-cifra">{cifraConUnidad(elegida)}</strong>
              <span>{elegida.rotulo}</span>
            </>
          ) : lamina && clave && origen && !cifrasPorOrigen[lamina]?.cifras ? "Leyendo la cifra" : "Elegir cifra"}
        </span>
        <ChevronDown size={14} aria-hidden="true" className="pulso-select-icon" />
      </button>
      {origen && <span className="pulso-f6-elegir-cifra-origen">{origen.nombre}</span>}

      {abierta && (
        <div id={`${id}-panel`} className="pulso-f6-elegir-cifra-panel"
          data-qa-geometry-group="graficos/f6-elegir-cifra" data-qa-geometry-contract="intrinsic">
          <div className="pulso-f6-elegir-cifra-barra" data-qa-geometry-member>
            <PulsoInput size="sm" type="search" role="combobox" autoFocus value={busqueda} aria-label={`Buscar cifra del ${nombre}`}
              aria-expanded="true" aria-controls={`${id}-lista`} aria-autocomplete="list"
              aria-activedescendant={activaVisible ? ids.get(activaVisible) : undefined}
              onChange={(e) => buscar(e.target.value)} onKeyDown={alTeclear} />
            <GlidingRadioGroup value={orden} options={ORDENES_CIFRAS} getOptionValue={(o) => o.valor} onValueChange={ordenar}
              className="pulso-f6-modo pulso-f6-elegir-cifra-orden" aria-label="Ordenar cifras">
              {(o) => <span>{o.rotulo}</span>}
            </GlidingRadioGroup>
          </div>

          <div ref={lista} id={`${id}-lista`} role="listbox" aria-label={`Cifras para el ${nombre}`} className="pulso-f6-elegir-cifra-lista"
            data-qa-geometry-member data-qa-geometry-capacity="owned" onMouseDown={(e) => e.preventDefault()}>
            {grupos.map((g) => {
              const columnas = g.medidas.length;
              const plantilla = { gridTemplateColumns: `minmax(0, 1fr) repeat(${columnas}, max-content)` };
              return (
                <div key={g.lamina} role="group" aria-label={g.nombre} className="pulso-f6-elegir-cifra-grupo" data-lamina={g.lamina}>
                  <div className="pulso-f6-elegir-cifra-grupo-cabeza" style={columnas > 1 ? plantilla : undefined} aria-hidden="true">
                    <span className="pulso-f6-elegir-cifra-grupo-nombre">{g.nombre}</span>
                    {columnas > 1 && g.medidas.map((m) => <span key={m} className="pulso-f6-elegir-cifra-columna">{encabezadoMedida(m)}</span>)}
                  </div>
                  {g.estado === "cargando" && <span className="pulso-f6-elegir-cifra-estado" aria-hidden="true">Leyendo las cifras</span>}
                  {g.estado === "sin-cifras" && <span className="pulso-f6-elegir-cifra-estado" aria-hidden="true">Esta lámina no dibujó cifras</span>}
                  {g.estado === "error" && <span className="pulso-f6-elegir-cifra-estado is-aviso" aria-hidden="true">{g.error}</span>}
                  {g.filas.map((f) => (
                    <div key={f.entidad} className="pulso-f6-elegir-cifra-fila" style={plantilla} role="presentation">
                      <span className="pulso-f6-elegir-cifra-entidad" aria-hidden="true">{f.entidad}</span>
                      {f.celdas.map((c, k) => (c ? (
                        <div key={c.id} id={ids.get(c.id)} role="option" data-opcion={c.id} aria-selected={c.id === elegidaId}
                          aria-label={`${f.entidad}${c.medida ? `, ${c.medida}` : ""}: ${cifraConUnidad(c.cifra)}`}
                          className={`pulso-f6-elegir-cifra-opcion${c.id === activaVisible ? " is-activa" : ""}`}
                          onMouseEnter={() => activar(c.id)} onClick={() => elegir(c)}>
                          {cifraConUnidad(c.cifra)}
                        </div>
                      ) : <span key={`vacia-${k}`} aria-hidden="true" />))}
                    </div>
                  ))}
                </div>
              );
            })}
            {grupos.length === 0 && (
              <span className="pulso-f6-elegir-cifra-estado" aria-hidden="true">
                {origenes.length === 0 ? "El informe no tiene láminas de resumen" : `Ninguna cifra coincide con "${busqueda.trim()}"`}
              </span>
            )}
          </div>
          <span className="pulso-sr-only" role="status">
            {cargando > 0 ? "Leyendo las cifras" : formatoConteoDe(visibles, "cifra")}
          </span>
        </div>
      )}
    </div>
  );
}
