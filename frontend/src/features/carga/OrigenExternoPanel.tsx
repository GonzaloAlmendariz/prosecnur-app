import { useEffect, useId, useRef, useState, type FormEvent, type Ref } from "react";
import { AlertTriangle, ArrowRight, Loader2, ScrollText, Upload } from "lucide-react";
import {
  declararOrigenExterno,
  getOrigenExterno,
  MOTIVOS_VARIABLE,
  subirListaExclusiones,
  type OrigenExterno,
  type OrigenExternoMotivoVariable,
} from "../../api/cargaOrigenExterno";
import { PulsoButton } from "../../components/PulsoButton";
import {
  BORRADOR_VACIO,
  borradorDesde,
  cadenaOrigenEnLlano,
  desgloseVariables,
  formatoEntero,
  fraseVariablesRetiradas,
  leerRecibidas,
  motivoNoDeclarable,
  motivosElegidos,
  muestraCadenaCasos,
  procedenciaScript,
  ROTULO_MOTIVO,
  rotuloEstado,
  totalVariablesRetiradas,
  tramosOrigen,
  type OrigenExternoBorrador,
} from "./origenExternoModel";
import "./OrigenExternoPanel.css";

// «Base preparada fuera de la plataforma» (ADR 0100, P2 y Enmienda 1 / P2b): la
// base que llegó con menos casos o menos variables que el instrumento declara
// qué se retiró y por qué. De los casos sólo se muestra el agregado; los
// identificadores de las encuestas retiradas nunca llegan a esta pantalla.

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
        if (id !== secuencia.current) return;
        setCarga({ tipo: "listo", datos });
        setBorrador(borradorDesde(datos));
      })
      .catch((reason: Error) => {
        if (id === secuencia.current) setCarga({ tipo: "error", mensaje: reason.message });
      });
  }, [baseNombre]);

  async function declarar() {
    if (motivoNoDeclarable(borrador)) return;
    const recibidas = leerRecibidas(borrador.recibidas);
    const id = secuencia.current;
    setEnvio({ tipo: "enviando" });
    try {
      const fileId = borrador.archivo ? await subirListaExclusiones(borrador.archivo) : null;
      const datos = await declararOrigenExterno({
        baseNombre,
        fileId,
        nRecibidas: fileId && recibidas.ok ? recibidas.valor : null,
        script: borrador.script,
        version: borrador.version,
        variablesMotivo: motivosElegidos(borrador.motivos),
      });
      if (id !== secuencia.current) return;
      setCarga({ tipo: "listo", datos });
      setBorrador(borradorDesde(datos));
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
          <strong id={`${id}-titulo`}>Base preparada fuera de la plataforma <span>(opcional)</span></strong>
          <small>Si la base llega con menos casos o menos variables que el instrumento, declara qué se retiró y por qué.</small>
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
              <strong>Esta base no declara una preparación externa.</strong>
              <span>
                Si la recibiste con menos casos o menos variables, declara qué se retiró: así la ficha explica
                el paso de la base recibida a la cargada. Si se depuró solo en la app, no hace falta.
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
            {datos?.bloque ? "Actualizar la declaración" : "Declarar lo retirado"}
          </span>
          <div
            className="pulso-origen-externo-partes"
            data-qa-geometry-group="carga-origen-externo-partes"
            data-qa-geometry-contract="intrinsic"
          >
            <fieldset className="pulso-origen-externo-parte is-casos" disabled={bloqueado} data-qa-geometry-member="">
              <legend>Casos retirados <span>(opcional)</span></legend>
              <div className="pulso-origen-externo-campos">
                <label className="pulso-origen-externo-campo is-archivo">
                  <span>Lista de casos retirados</span>
                  <input
                    ref={archivoRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    aria-describedby={`${id}-formato`}
                    onChange={(event) => onBorrador({ archivo: event.target.files?.[0] ?? null })}
                  />
                  <small id={`${id}-formato`}>
                    xlsx o csv con <code>_uuid</code>, <code>motivo</code> (texto libre) y, si quieres, <code>categoria</code>.
                  </small>
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
              </div>
            </fieldset>

            <fieldset className="pulso-origen-externo-parte is-variables" disabled={bloqueado} data-qa-geometry-member="">
              <legend>Variables retiradas</legend>
              <VariablesFaltantes
                carga={carga}
                motivos={borrador.motivos}
                onMotivo={(variable, motivo) => onBorrador({ motivos: { ...borrador.motivos, [variable]: motivo } })}
              />
            </fieldset>
          </div>
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
              {enviando ? "Declarando…" : "Declarar"}
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

type VariablesFaltantesProps = {
  carga: OrigenExternoCarga;
  motivos: OrigenExternoBorrador["motivos"];
  onMotivo: (variable: string, motivo: OrigenExternoMotivoVariable | "") => void;
};

function VariablesFaltantes({ carga, motivos, onMotivo }: VariablesFaltantesProps) {
  if (carga.tipo === "leyendo") {
    return <p className="pulso-origen-externo-nota">Leyendo las variables del instrumento…</p>;
  }
  if (carga.tipo === "error") {
    return <p className="pulso-origen-externo-nota">No se pudo comparar la base con el instrumento.</p>;
  }
  const faltantes = carga.datos.variables_faltantes;
  if (!faltantes.length) {
    return (
      <p className="pulso-origen-externo-completa" data-qa-geometry-capacity="owned">
        La base trae todas las variables del instrumento.
      </p>
    );
  }
  return (
    <>
      <p className="pulso-origen-externo-explica">
        {faltantes.length === 1
          ? "Falta 1 variable del instrumento en la base."
          : `Faltan ${formatoEntero(faltantes.length)} variables del instrumento en la base.`}{" "}
        Las que marques como Metadato o No va al cliente se excluyen de los entregables
        (Analítica › Variables excluidas).
      </p>
      <ul
        className="pulso-origen-externo-variables"
        aria-label="Variables del instrumento que no están en la base"
        data-qa-geometry-group="carga-origen-externo-variables"
        data-qa-geometry-contract="equal"
      >
        {faltantes.map((faltante) => (
          <li key={faltante.variable} data-qa-geometry-member="">
            <span className="pulso-origen-externo-variable">
              <code title={faltante.variable}>{faltante.variable}</code>
              {faltante.tipo && <small>{faltante.tipo}</small>}
            </span>
            <select
              aria-label={`Motivo de ${faltante.variable}`}
              value={motivos[faltante.variable] ?? ""}
              onChange={(event) => {
                const valor = event.target.value;
                const motivo = (MOTIVOS_VARIABLE as readonly string[]).includes(valor)
                  ? (valor as OrigenExternoMotivoVariable)
                  : "";
                onMotivo(faltante.variable, motivo);
              }}
            >
              <option value="">Sin elegir</option>
              {MOTIVOS_VARIABLE.map((motivo) => (
                <option key={motivo} value={motivo}>{ROTULO_MOTIVO[motivo]}</option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </>
  );
}

function OrigenExternoResultado({ datos }: { datos: OrigenExterno }) {
  const tramos = tramosOrigen(datos);
  const procedencia = procedenciaScript(datos);
  const categorias = datos.resumen?.por_categoria ?? [];
  const nVariables = totalVariablesRetiradas(datos);
  const desglose = desgloseVariables(datos);
  const excluidas = datos.variables_excluidas_agregadas;
  return (
    <div className="pulso-origen-externo-declarada">
      {datos.estado === "otra_base" && (
        <p className="pulso-origen-externo-otra-base" role="note">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>La declaración habla de una base anterior; vuelve a declararla para esta base.</span>
        </p>
      )}
      {muestraCadenaCasos(datos) && (
        <>
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
        </>
      )}
      {nVariables > 0 && (
        <div className="pulso-origen-externo-vars-resultado">
          <strong className="pulso-origen-externo-vars-total">{fraseVariablesRetiradas(nVariables)}</strong>
          {desglose.length > 0 && (
            <dl className="pulso-origen-externo-categorias" aria-label="Variables retiradas por motivo">
              {desglose.map((fila) => (
                <div key={fila.motivo}>
                  <dt>{fila.rotulo}</dt>
                  <dd>{fila.valor}</dd>
                </div>
              ))}
            </dl>
          )}
          {excluidas.length > 0 && (
            <p className="pulso-origen-externo-excluidas">
              Se excluyeron de los entregables: {excluidas.join(", ")}.
            </p>
          )}
        </div>
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
