// «Saludo según la persona» en el inspector del bloque Saludo (C8).
//
// Igual para todos, o según el sexo: la columna sale de la lista cargada en
// Personas (sin lista, se pide cargarla), las tres palabras se editan, y el
// resultado se dice en una línea con sus cifras y con cómo se leyó «M».
//
// C1: `material-campo/correo/trato-palabras` (equal), una palabra por miembro.

import { useId } from "react";

import type { MailGreetingBlock, MailPlatform, MailProblem, MailRecipients } from "../../../api/materialMail";
import { Segmented } from "../../xlsformEditor/kit";
import {
  LARGO_PALABRA_TRATO,
  conTrato,
  lecturaEnPalabras,
  lineaDelTrato,
  respaldoEnElSaludo,
  rotuloDeProblemaDelTrato,
  tratoDelSaludo,
  type CambioDeTrato,
} from "./modeloTrato";
import "./correosTrato.css";

type Props = {
  block: MailGreetingBlock;
  destinatarios: MailRecipients | null;
  plataforma: MailPlatform;
  problemas: readonly MailProblem[];
  onEditar: (update: (b: MailGreetingBlock) => MailGreetingBlock, grupo?: string) => void;
  onIrAPersonas: () => void;
};

const MODOS = [
  { value: "fijo" as const, label: "Igual para todos" },
  { value: "por_sexo" as const, label: "Según el sexo" },
];

const PALABRAS = [
  { clave: "masculino" as const, rotulo: "Hombre" },
  { clave: "femenino" as const, rotulo: "Mujer" },
  { clave: "respaldo" as const, rotulo: "Sin dato" },
];

export function SaludoSegunLaPersona({ block, destinatarios, plataforma, problemas, onEditar, onIrAPersonas }: Props) {
  const ids = useId();
  const trato = tratoDelSaludo(block);
  const cambiar = (cambio: CambioDeTrato, grupo?: string) => onEditar((b) => conTrato(b, cambio), grupo);
  const lista = destinatarios?.loaded ? destinatarios : null;
  const resuelto = lista?.trato ?? null;
  const columnas = lista?.columns ?? [];
  const fueraDeLista = Boolean(trato.columna && lista && !columnas.includes(trato.columna));
  const linea = resuelto ? lineaDelTrato(resuelto, trato) : null;
  const lectura = resuelto?.presente ? lecturaEnPalabras(resuelto.lectura, trato) : null;

  return (
    <section className="rec-trato" aria-labelledby={`${ids}-titulo`} data-qa-geometry-capacity="owned">
      <h4 id={`${ids}-titulo`} className="rec-trato-titulo">Saludo según la persona</h4>
      <Segmented
        aria-label="Cómo cambia el saludo"
        value={trato.modo}
        options={MODOS}
        onChange={(modo) => cambiar({ modo })}
      />

      {trato.modo === "por_sexo" ? (
        <>
          {lista ? (
            <label className="rec-trato-campo">
              <span>Columna de sexo de la lista</span>
              <select
                className="rec-mail-input"
                value={trato.columna ?? ""}
                aria-invalid={fueraDeLista ? true : undefined}
                onChange={(e) => cambiar({ columna: e.target.value || null })}
              >
                <option value="">Elige la columna…</option>
                {fueraDeLista ? <option value={trato.columna}>{trato.columna} (no está en esta lista)</option> : null}
                {columnas.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          ) : (
            <p className="rec-trato-sin-lista">
              {trato.columna ? <>Columna elegida: <b>{trato.columna}</b>. </> : null}
              Carga la lista en Personas para elegir la columna.
              <button type="button" className="rec-mail-link" onClick={onIrAPersonas}>Ir a Personas</button>
            </p>
          )}

          <div
            className="rec-trato-palabras"
            data-qa-geometry-group="material-campo/correo/trato-palabras"
            data-qa-geometry-contract="equal"
          >
            {PALABRAS.map((p) => (
              <label key={p.clave} className="rec-trato-campo" data-qa-geometry-member>
                <span>{p.rotulo}</span>
                <input
                  className="rec-mail-input"
                  value={trato[p.clave]}
                  maxLength={LARGO_PALABRA_TRATO}
                  onChange={(e) => cambiar({ palabra: p.clave, valor: e.target.value }, `${block.block_id}.trato.${p.clave}`)}
                />
              </label>
            ))}
          </div>

          {linea ? <p className="rec-trato-resultado" role="status">{linea}</p> : null}
          {lectura ? <p className="rec-trato-lectura">{lectura}</p> : null}
          {resuelto && !resuelto.presente && trato.columna ? (
            <p className="rec-trato-aviso" role="alert">La columna «{trato.columna}» no está en la lista cargada: elige la columna de sexo de esta lista.</p>
          ) : null}
          {resuelto?.no_reconocidos.length ? (
            <p className="rec-trato-lectura">No se reconocen: {resuelto.no_reconocidos.map((v) => `«${v}»`).join(", ")}.</p>
          ) : null}
          {plataforma === "surveymonkey" && trato.columna ? (
            <p className="rec-trato-lectura">En SurveyMonkey la palabra va en [{trato.sm ?? "CustomData"}]: el archivo de contactos la trae escrita.</p>
          ) : null}
        </>
      ) : null}

      {!respaldoEnElSaludo(block) ? (
        <p className="rec-trato-aviso" role="status">
          El saludo no contiene «{trato.respaldo}»: escríbela en el texto para que cambie según la persona.
        </p>
      ) : null}
      {problemas.length ? (
        <ul className="rec-mail-problemas">
          {problemas.map((p, i) => <li key={`${p.path}-${i}`}>{rotuloDeProblemaDelTrato(p)}</li>)}
        </ul>
      ) : null}
    </section>
  );
}
