import { useEffect, useId, useRef, useState, type FormEvent, type Ref } from "react";
import { AlertTriangle, ArrowRight, Loader2, ScrollText, Upload } from "lucide-react";
import {
  declararOrigenExterno,
  getOrigenExterno,
  subirListaExclusiones,
  type OrigenExterno,
} from "../../api/cargaOrigenExterno";
import { PulsoButton } from "../../components/PulsoButton";
import {
  BORRADOR_VACIO,
  cadenaOrigenEnLlano,
  formatoEntero,
  leerRecibidas,
  motivoNoDeclarable,
  procedenciaScript,
  rotuloEstado,
  tramosOrigen,
  type OrigenExternoBorrador,
} from "./origenExternoModel";
import "./OrigenExternoPanel.css";

// «Depuración hecha fuera» (ADR 0100, P2): la base que llegó recortada por un
// script declara de dónde viene. Sólo se muestra el agregado; los
// identificadores de las encuestas excluidas nunca llegan a esta pantalla.

export type OrigenExternoCarga =
  | { tipo: "leyendo" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; datos: OrigenExterno };

export type OrigenExternoEnvio =
  | { tipo: "quieto" }
  | { tipo: "enviando" }
  | { tipo: "error"; mensaje: string };

type PanelProps = {
  baseNombre?: string | null;
  disabled?: boolean;
};

export function OrigenExternoPanel({ baseNombre, disabled = false }: PanelProps) {
  const [carga, setCarga] = useState<OrigenExternoCarga>({ tipo: "leyendo" });
  const [borrador, setBorrador] = useState<OrigenExternoBorrador>(BORRADOR_VACIO);
  const [envio, setEnvio] = useState<OrigenExternoEnvio>({ tipo: "quieto" });
  const secuencia = useRef(0);
  const archivoRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const id = ++secuencia.current;
    setCarga({ tipo: "leyendo" });
    setBorrador(BORRADOR_VACIO);
    setEnvio({ tipo: "quieto" });
    if (archivoRef.current) archivoRef.current.value = "";
    void getOrigenExterno(baseNombre)
      .then((datos) => {
        if (id === secuencia.current) setCarga({ tipo: "listo", datos });
      })
      .catch((reason: Error) => {
        if (id === secuencia.current) setCarga({ tipo: "error", mensaje: reason.message });
      });
  }, [baseNombre]);

  async function declarar() {
    if (motivoNoDeclarable(borrador) || !borrador.archivo) return;
    const recibidas = leerRecibidas(borrador.recibidas);
    const id = secuencia.current;
    setEnvio({ tipo: "enviando" });
    try {
      const fileId = await subirListaExclusiones(borrador.archivo);
      const datos = await declararOrigenExterno({
        baseNombre,
        fileId,
        nRecibidas: recibidas.ok ? recibidas.valor : null,
        script: borrador.script,
        version: borrador.version,
      });
      if (id !== secuencia.current) return;
      setCarga({ tipo: "listo", datos });
      setBorrador(BORRADOR_VACIO);
      if (archivoRef.current) archivoRef.current.value = "";
      setEnvio({ tipo: "quieto" });
    } catch (reason) {
      if (id === secuencia.current) setEnvio({ tipo: "error", mensaje: (reason as Error).message });
    }
  }

  return (
    <OrigenExternoVista
      carga={carga}
      borrador={borrador}
      envio={envio}
      disabled={disabled}
      archivoRef={archivoRef}
      onBorrador={(patch) => {
        setBorrador((actual) => ({ ...actual, ...patch }));
        setEnvio((actual) => (actual.tipo === "error" ? { tipo: "quieto" } : actual));
      }}
      onDeclarar={() => void declarar()}
    />
  );
}

type VistaProps = {
  carga: OrigenExternoCarga;
  borrador: OrigenExternoBorrador;
  envio: OrigenExternoEnvio;
  disabled?: boolean;
  archivoRef?: Ref<HTMLInputElement>;
  onBorrador: (patch: Partial<OrigenExternoBorrador>) => void;
  onDeclarar: () => void;
};

export function OrigenExternoVista({
  carga,
  borrador,
  envio,
  disabled = false,
  archivoRef,
  onBorrador,
  onDeclarar,
}: VistaProps) {
  const id = useId();
  const datos = carga.tipo === "listo" ? carga.datos : null;
  const estado = datos?.estado ?? "";
  const enviando = envio.tipo === "enviando";
  const pendiente = motivoNoDeclarable(borrador);
  const bloqueado = disabled || enviando || carga.tipo === "leyendo";

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendiente && !bloqueado) onDeclarar();
  }

  return (
    <section
      className={`pulso-origen-externo${estado ? ` is-${estado}` : ""}`}
      aria-labelledby={`${id}-titulo`}
      data-origen-externo-estado={estado || "sin-declarar"}
    >
      <header className="pulso-origen-externo-head">
        <span className="pulso-origen-externo-icono" aria-hidden="true"><ScrollText size={16} /></span>
        <div className="pulso-origen-externo-titulo">
          <strong id={`${id}-titulo`}>Depuración hecha fuera <span>(opcional)</span></strong>
          <small>Si un script quitó encuestas antes de cargar la base, declara cuáles y por qué.</small>
        </div>
        {carga.tipo === "listo" && (
          <span className={`pulso-origen-externo-estado${estado ? ` is-${estado}` : ""}`}>
            {rotuloEstado(estado)}
          </span>
        )}
      </header>

      <div className="pulso-origen-externo-cuerpo">
        <div className="pulso-origen-externo-resultado" data-qa-geometry-capacity="owned">
          {carga.tipo === "leyendo" ? (
            <p className="pulso-origen-externo-nota" role="status">
              <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> Leyendo la declaración de la base…
            </p>
          ) : carga.tipo === "error" ? (
            <p className="pulso-origen-externo-error" role="alert">{carga.mensaje}</p>
          ) : !datos?.bloque ? (
            <div className="pulso-origen-externo-vacio">
              <strong>Esta base no declara una depuración externa.</strong>
              <span>
                Si la recibiste ya recortada, sube la lista de exclusiones del script: así la ficha
                explica el paso de las encuestas recibidas a las cargadas. Si se depuró solo en la app,
                no hace falta.
              </span>
            </div>
          ) : (
            <OrigenExternoResultado datos={datos} />
          )}
        </div>

        {datos && datos.avisos.length > 0 && (
          <ul className="pulso-origen-externo-avisos" aria-label="Avisos de la declaración">
            {datos.avisos.map((aviso, index) => (
              <li key={`${aviso.codigo}-${index}`} data-aviso={aviso.codigo}>
                <AlertTriangle size={14} aria-hidden="true" />
                <span>{aviso.mensaje}</span>
              </li>
            ))}
          </ul>
        )}

        <form className="pulso-origen-externo-form" onSubmit={enviar} aria-labelledby={`${id}-form`}>
          <span id={`${id}-form`} className="pulso-origen-externo-form-titulo">
            {datos?.bloque ? "Reemplazar la declaración" : "Declarar la depuración"}
          </span>
          <fieldset disabled={bloqueado}>
            <label className="pulso-origen-externo-campo is-archivo">
              <span>Lista de exclusiones</span>
              <input
                ref={archivoRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                aria-describedby={`${id}-formato`}
                onChange={(event) => onBorrador({ archivo: event.target.files?.[0] ?? null })}
              />
              <small id={`${id}-formato`}>xlsx o csv con <code>_uuid</code>, <code>motivo</code> y, si quieres, <code>categoria</code>.</small>
            </label>
            <label className="pulso-origen-externo-campo">
              <span>Recibidas antes del script</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Se deduce si la dejas vacía"
                value={borrador.recibidas}
                aria-invalid={!leerRecibidas(borrador.recibidas).ok}
                onChange={(event) => onBorrador({ recibidas: event.target.value })}
              />
            </label>
            <label className="pulso-origen-externo-campo">
              <span>Script</span>
              <input
                type="text"
                autoComplete="off"
                placeholder="limpieza.R"
                value={borrador.script}
                onChange={(event) => onBorrador({ script: event.target.value })}
              />
            </label>
            <label className="pulso-origen-externo-campo">
              <span>Versión</span>
              <input
                type="text"
                autoComplete="off"
                placeholder="v3 o el hash del commit"
                value={borrador.version}
                onChange={(event) => onBorrador({ version: event.target.value })}
              />
            </label>
          </fieldset>
          <div className="pulso-origen-externo-acciones">
            <small id={`${id}-pendiente`} className="pulso-origen-externo-pendiente" aria-live="polite">
              {pendiente}
            </small>
            <PulsoButton
              type="submit"
              variant="primary"
              size="sm"
              disabled={bloqueado || !!pendiente}
              aria-describedby={pendiente ? `${id}-pendiente` : undefined}
            >
              {enviando
                ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" />
                : <Upload size={14} aria-hidden="true" />}
              {enviando ? "Declarando…" : datos?.bloque ? "Volver a declarar" : "Declarar"}
            </PulsoButton>
          </div>
          {envio.tipo === "error" && (
            <p className="pulso-origen-externo-error" role="alert">{envio.mensaje}</p>
          )}
        </form>
      </div>
    </section>
  );
}

function OrigenExternoResultado({ datos }: { datos: OrigenExterno }) {
  const tramos = tramosOrigen(datos);
  const procedencia = procedenciaScript(datos);
  const categorias = datos.resumen?.por_categoria ?? [];
  return (
    <div className="pulso-origen-externo-declarada">
      {datos.estado === "otra_base" && (
        <p className="pulso-origen-externo-otra-base" role="note">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>La declaración habla de una base anterior; vuelve a declararla para esta base.</span>
        </p>
      )}
      <ol
        className="pulso-origen-externo-tramos"
        aria-label={cadenaOrigenEnLlano(datos)}
        data-qa-geometry-group="carga-origen-externo-tramos"
        data-qa-geometry-contract="equal"
      >
        {tramos.map((tramo, index) => (
          <li key={tramo.clave} className={`is-${tramo.clave}`} data-qa-geometry-member="">
            {index > 0 && <ArrowRight size={14} className="pulso-origen-externo-flecha" aria-hidden="true" />}
            <span className="pulso-origen-externo-rotulo">{tramo.rotulo}</span>
            <strong className="pulso-origen-externo-valor">{tramo.valor}</strong>
            {tramo.nota && <small>{tramo.nota}</small>}
          </li>
        ))}
      </ol>
      {categorias.length > 0 && (
        <dl className="pulso-origen-externo-categorias" aria-label="Retiradas por categoría">
          {categorias.map((fila) => (
            <div key={fila.categoria}>
              <dt>{fila.categoria}</dt>
              <dd>{formatoEntero(fila.n)}</dd>
            </div>
          ))}
        </dl>
      )}
      {(procedencia || datos.bloque?.declarado_at) && (
        <p className="pulso-origen-externo-procedencia">
          {procedencia || "Script sin nombre declarado"}
          {datos.bloque?.declarado_at ? ` · declarada el ${datos.bloque.declarado_at.slice(0, 10)}` : ""}
        </p>
      )}
    </div>
  );
}
