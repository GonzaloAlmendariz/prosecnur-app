import { useState } from "react";
import { Loader2, Plus, RefreshCw, Save, Upload } from "../../../../../vendor/lucide-react";
import { apiSupervisionLeerResultados, apiSupervisionNuevaRonda, type RondaDeSupervisionApi } from "../../../../../api/monitoreoTelefonico";
import type { MonitoreoState } from "../../../../../api/client";
import type { PanelDeclarado } from "../../../../../lib/navegacion/paneles";
import { NotaDelModo } from "../../../core/NotaDelModo";
import { pctConEspacio } from "../../../core/formatoComun";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import { mensajeDeError, type FilaDeRonda } from "./rondasModel";

export const PANEL_NUEVA_RONDA: PanelDeclarado = { id: "nueva-ronda", label: "Nueva ronda", clase: "dialogo" };
export const PANEL_PUBLICAR_RONDA: PanelDeclarado = { id: "publicar-ronda", label: "Publicar ronda", clase: "dialogo" };

function n(valor: number) {
  return valor.toLocaleString("es-PE");
}

function fecha(iso: string) {
  if (!iso) return "";
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? iso : t.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Las rondas de supervisión, numeradas, con su estado (guardada, publicada y
 * en qué pestaña). La elegida filtra el reparto y los casos. «Nueva ronda» y
 * «Publicar en el Sheets» abren sus diálogos; la Ronda 1 de un proyecto
 * anterior a las rondas se ofrece guardar tal cual.
 */
export function RondasDeSupervision({
  rondas,
  actual,
  proxima,
  nuevas,
  onElegir,
  onNueva,
  onPublicar,
  onGuardada,
  hojaConectada = false,
  avisos = [],
}: {
  rondas: readonly FilaDeRonda[];
  actual: number | null;
  proxima: number;
  nuevas: number | null;
  onElegir: (numero: number) => void;
  onNueva: () => void;
  onPublicar: (numero: number) => void;
  onGuardada: (rondas: RondaDeSupervisionApi[], state: MonitoreoState) => void;
  /** Hay hoja de supervisión conectada: se pueden leer los resultados de sus pestañas. */
  hojaConectada?: boolean;
  /** Avisos de la hoja (una ronda publicada cuya pestaña se borró). */
  avisos?: readonly string[];
}) {
  const [envio, setEnvio] = useState<{ guardando: boolean; error: string }>({ guardando: false, error: "" });
  const [lectura, setLectura] = useState<{ leyendo: boolean; recibo: string; avisos: readonly string[] | null }>({ leyendo: false, recibo: "", avisos: null });
  const sinGuardar = rondas.find((ronda) => !ronda.guardada) ?? null;
  const publicadas = rondas.filter((ronda) => ronda.publicadaEn).length;
  const avisosVisibles = lectura.avisos ?? avisos;

  const leerResultados = async () => {
    setLectura({ leyendo: true, recibo: "", avisos: lectura.avisos });
    setEnvio({ guardando: false, error: "" });
    try {
      const resultado = await apiSupervisionLeerResultados();
      onGuardada(resultado.rondas, resultado.state);
      setLectura({
        leyendo: false,
        recibo: resultado.leidas === 1 ? "Se leyó 1 pestaña." : `Se leyeron ${n(resultado.leidas)} pestañas.`,
        avisos: resultado.avisos,
      });
    } catch (error) {
      setLectura({ leyendo: false, recibo: "", avisos: lectura.avisos });
      setEnvio({ guardando: false, error: mensajeDeError(error) });
    }
  };

  const guardarTalCual = async () => {
    setEnvio({ guardando: true, error: "" });
    try {
      const resultado = await apiSupervisionNuevaRonda({});
      onGuardada(resultado.rondas, resultado.state);
      setEnvio({ guardando: false, error: "" });
    } catch (error) {
      setEnvio({ guardando: false, error: mensajeDeError(error) });
    }
  };

  return (
    <section className="mon-ctl-panel mon-sup-rondas" aria-label="Rondas de supervisión">
      {/* §2a-bis: el rótulo de la pestaña encabeza la primera tarjeta, con las acciones a la derecha. */}
      <header className="mon-ctl-panel-cabecera mon-sup-rondas-cabecera">
        <RotuloDePestana />
        <span className="mon-sup-rondas-titulo">
          <b>Rondas</b>
          <span>{nuevas != null ? `${n(nuevas)} efectivas nuevas desde la última` : ""}</span>
        </span>
        <span className="mon-sup-rondas-acciones">
          {hojaConectada && publicadas ? (
            <button type="button" className="mon-insumos-boton" disabled={lectura.leyendo} onClick={() => { void leerResultados(); }} title="Lee las pestañas «Ronda N» de la hoja de supervisión, sin escribir nada">
              {lectura.leyendo ? <Loader2 size={14} className="pulso-spin" /> : <RefreshCw size={14} />}
              <span>{lectura.leyendo ? "Leyendo…" : "Leer resultados"}</span>
            </button>
          ) : null}
          <button type="button" className="mon-insumos-boton is-primario" onClick={onNueva} disabled={Boolean(sinGuardar)}>
            <Plus size={14} /> Nueva ronda
          </button>
        </span>
      </header>
      {sinGuardar ? (
        <div className="mon-sup-migracion">
          <NotaDelModo tono="aviso">
            La Ronda {n(sinGuardar.numero)} todavía no está guardada: es el sorteo de antes, sobre todas las efectivas. Guárdala tal cual para numerar las siguientes.
          </NotaDelModo>
          <button type="button" className="mon-insumos-boton" disabled={envio.guardando} onClick={() => { void guardarTalCual(); }}>
            {envio.guardando ? <Loader2 size={14} className="pulso-spin" /> : <Save size={14} />}
            <span>Guardar la Ronda {n(sinGuardar.numero)} tal cual</span>
          </button>
        </div>
      ) : null}
      {envio.error ? <NotaDelModo tono="error" estado className="mon-sup-migracion">{envio.error}</NotaDelModo> : null}
      {lectura.recibo ? <NotaDelModo tono="info" estado className="mon-sup-migracion">{lectura.recibo}</NotaDelModo> : null}
      {avisosVisibles.map((aviso) => <NotaDelModo key={aviso} tono="aviso" className="mon-sup-migracion">{aviso}</NotaDelModo>)}
      {rondas.length ? (
        <ul className="mon-sup-lista-rondas">
          {rondas.map((ronda) => (
            <li key={ronda.numero} className={ronda.numero === actual ? "is-activa" : undefined}>
              <button type="button" className="mon-sup-ronda" aria-pressed={ronda.numero === actual} onClick={() => onElegir(ronda.numero)}>
                <strong>Ronda {n(ronda.numero)}{ronda.guardada ? "" : " sin guardar"}</strong>
                <small>
                  {n(ronda.casos)} casos
                  {ronda.agregados ? ` (${n(ronda.agregados)} a mano)` : ""}
                  {ronda.porcentaje != null ? ` · ${pctConEspacio(ronda.porcentaje)} de ${n(ronda.universo)} efectivas` : ` · de ${n(ronda.universo)} efectivas`}
                  {ronda.generadaEl ? ` · ${fecha(ronda.generadaEl)}` : ""}
                  {ronda.semilla != null ? ` · semilla ${ronda.semilla}` : ""}
                </small>
                <em className={ronda.lectura === "pestana_borrada" ? "is-borrada" : ronda.publicadaEn ? "is-publicada" : ronda.guardada ? "is-guardada" : "is-pendiente"}>
                  {ronda.lectura === "pestana_borrada"
                    ? `La pestaña «${ronda.publicadaEn}» ya no está`
                    : ronda.publicadaEn ? `Publicada en «${ronda.publicadaEn}»` : ronda.guardada ? "Guardada" : "Sin guardar"}
                </em>
                {ronda.lectura === "leida" && ronda.leidaEl ? <small className="mon-sup-ronda-lectura">Resultados leídos el {fecha(ronda.leidaEl)}</small> : null}
              </button>
              {ronda.guardada && !ronda.publicadaEn ? (
                <button type="button" className="mon-insumos-boton" onClick={() => onPublicar(ronda.numero)}>
                  <Upload size={13} /> Publicar en el Sheets
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mon-sup-rondas-vacio">Todavía no hay rondas. La primera sale de todas las efectivas; la Ronda {n(proxima)} se genera con «Nueva ronda».</p>
      )}
    </section>
  );
}
