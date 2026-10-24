import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Plus, X } from "../../../../../vendor/lucide-react";
import { apiSupervisionNuevaRonda, type RondaDeSupervisionApi } from "../../../../../api/monitoreoTelefonico";
import type { MonitoreoState } from "../../../../../api/client";
import { NotaDelModo } from "../../../core/NotaDelModo";
import { useDialogoDeRonda } from "./useDialogoDeRonda";
import "../insumos/insumosTelefonico.css";
import "./supervision.css";
import { mensajeDeError, repartoPrevio, type CasoDeLaBase } from "./rondasModel";

function n(valor: number) {
  return valor.toLocaleString("es-PE");
}

/**
 * Diálogo «Nueva ronda»: cuántas efectivas nuevas hay desde la última ronda,
 * el porcentaje con el reparto por enumerador calculado en vivo, y casos
 * agregados a mano desde la base (los que ya salieron, deshabilitados).
 */
export function DialogoNuevaRonda({
  numero,
  base,
  nuevas,
  porcentajeInicial,
  onCerrar,
  onHecha,
}: {
  /** Número que tendrá la ronda. */
  numero: number;
  base: readonly CasoDeLaBase[];
  /** Efectivas nuevas desde la última ronda, según el motor. */
  nuevas: number | null;
  porcentajeInicial: number;
  onCerrar: () => void;
  onHecha: (rondas: RondaDeSupervisionApi[], state: MonitoreoState) => void;
}) {
  const [porcentaje, setPorcentaje] = useState(porcentajeInicial);
  const [busqueda, setBusqueda] = useState("");
  const [agregados, setAgregados] = useState<string[]>([]);
  const [envio, setEnvio] = useState<{ guardando: boolean; error: string }>({ guardando: false, error: "" });

  const disponibles = useMemo(() => base.filter((caso) => caso.ronda == null), [base]);
  const porEnumerador = useMemo(() => {
    const mapa = new Map<string, number>();
    disponibles.forEach((caso) => mapa.set(caso.enumerador, (mapa.get(caso.enumerador) ?? 0) + 1));
    return mapa;
  }, [disponibles]);
  const previa = repartoPrevio(porEnumerador, porcentaje);
  const exacta = nuevas == null || nuevas === disponibles.length;
  const encontrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return [];
    return base.filter((caso) => [caso.codigo, caso.progres, caso.enumerador].some((valor) => valor.toLowerCase().includes(termino))).slice(0, 12);
  }, [base, busqueda]);

  const generar = async () => {
    setEnvio({ guardando: true, error: "" });
    try {
      const resultado = await apiSupervisionNuevaRonda({ porcentaje, agregados });
      onHecha(resultado.rondas, resultado.state);
    } catch (error) {
      setEnvio({ guardando: false, error: mensajeDeError(error) });
    }
  };

  const raiz = useDialogoDeRonda<HTMLElement>(onCerrar);

  return createPortal((
    <div className="mon-sup-dialogo-fondo" onMouseDown={(event) => { if (event.target === event.currentTarget) onCerrar(); }}>
      <section ref={raiz} tabIndex={-1} className="mon-sup-dialogo" role="dialog" aria-modal="true" aria-labelledby="mon-sup-nueva-titulo">
        <header>
          <h2 id="mon-sup-nueva-titulo">Nueva ronda: Ronda {n(numero)}</h2>
          <button type="button" className="mon-sup-cerrar" aria-label="Cerrar" onClick={onCerrar}><X size={16} /></button>
        </header>
        <div className="mon-sup-dialogo-cuerpo">
          <p className="mon-sup-dialogo-dato">
            <strong className="is-num">{n(nuevas ?? disponibles.length)}</strong> efectivas nuevas desde la última ronda.
          </p>
          <label className="mon-sup-porcentaje">
            <span>Porcentaje a supervisar</span>
            <input
              type="number"
              min={1}
              max={100}
              value={porcentaje}
              onChange={(event) => setPorcentaje(Number(event.currentTarget.value) || 0)}
            />
            <em>%</em>
          </label>
          <p className="mon-sup-dialogo-dato">
            Salen <strong className="is-num">{n(previa.casos + agregados.length)}</strong> casos
            {agregados.length ? ` (${n(previa.casos)} del sorteo y ${n(agregados.length)} agregados)` : ""}, al menos uno por enumerador.
          </p>
          {exacta ? null : (
            <NotaDelModo tono="neutro">Reparto aproximado: se calcula sobre las efectivas que nunca salieron; el motor lo fija al generar.</NotaDelModo>
          )}
          <ul className="mon-sup-dialogo-reparto" aria-label="Reparto por enumerador">
            {previa.filas.map((fila) => (
              <li key={fila.enumerador}>
                <span>{fila.enumerador}{fila.minimo ? <em className="mon-sup-minimo">mínimo</em> : null}</span>
                <span className="is-num">{n(fila.efectivas)} efectivas</span>
                <strong className="is-num">{n(fila.casos)}</strong>
              </li>
            ))}
          </ul>
          <label className="mon-sup-buscar">
            <span>Agregar casos a mano</span>
            <input value={busqueda} onChange={(event) => setBusqueda(event.currentTarget.value)} placeholder="Buscar por CodPulso, proGres o enumerador" />
          </label>
          {encontrados.length ? (
            <ul className="mon-sup-dialogo-encontrados">
              {encontrados.map((caso) => {
                const elegido = agregados.includes(caso.codigo);
                return (
                  <li key={caso.codigo}>
                    <span><b>{caso.codigo}</b>{caso.progres ? ` · ${caso.progres}` : ""} · {caso.enumerador}</span>
                    {caso.ronda != null ? (
                      <em>ya salió en la Ronda {n(caso.ronda)}</em>
                    ) : (
                      <button type="button" className="mon-insumos-boton" disabled={elegido} onClick={() => setAgregados((actual) => [...actual, caso.codigo])}>
                        <Plus size={13} /> {elegido ? "Agregado" : "Agregar"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {agregados.length ? (
            <p className="mon-sup-dialogo-dato">
              Agregados: {agregados.join(", ")}{" "}
              <button type="button" className="mon-sup-enlace" onClick={() => setAgregados([])}>quitar</button>
            </p>
          ) : null}
          {envio.error ? <NotaDelModo tono="error" estado>{envio.error}</NotaDelModo> : null}
        </div>
        <footer>
          <button type="button" className="mon-insumos-boton" onClick={onCerrar}>Cancelar</button>
          <button
            type="button"
            className="mon-insumos-boton is-primario"
            disabled={envio.guardando || porcentaje < 1 || porcentaje > 100}
            onClick={() => { void generar(); }}
          >
            {envio.guardando ? <Loader2 size={14} className="pulso-spin" /> : null}
            <span>{envio.guardando ? "Generando…" : `Generar la Ronda ${n(numero)}`}</span>
          </button>
        </footer>
      </section>
    </div>
  ), document.body);
}
