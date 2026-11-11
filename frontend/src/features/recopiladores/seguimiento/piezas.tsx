// Piezas comunes de las tres pestañas de Seguimiento: el estado de las
// conexiones, la confirmación de volver a asignar al azar y la línea de resultado.

import type { ReactNode } from "react";

import { PulsoButton } from "../../../components/PulsoButton";
import { Loader2 } from "../../../vendor/lucide-react";
import { useSeguimientoStore } from "./store";

/** ¿Mailchimp y SurveyMonkey están listos? `null` mientras se leen. */
export function useConexiones(): { mailchimp: boolean; surveymonkey: boolean; leidas: boolean } {
  const opciones = useSeguimientoStore((s) => s.opciones);
  return {
    mailchimp: Boolean(opciones?.mailchimp.connected && !opciones.mailchimp.error),
    surveymonkey: Boolean(opciones?.surveymonkey.connected && !opciones.surveymonkey.error),
    leidas: opciones !== null,
  };
}

/** Lo que falta conectar, dicho con dónde se arregla; nada si está todo. */
export function AvisoDeConexiones({ necesita }: { necesita: readonly ("mailchimp" | "surveymonkey")[] }) {
  const opciones = useSeguimientoStore((s) => s.opciones);
  const error = useSeguimientoStore((s) => s.errorOpciones);
  if (error) return <p className="rec-seg-error" role="alert">{error}</p>;
  if (!opciones) {
    return <p className="rec-sync-estado"><Loader2 size={14} className="pulso-spin" aria-hidden /> Revisando las conexiones</p>;
  }
  const faltan: string[] = [];
  if (necesita.includes("mailchimp")) {
    if (opciones.mailchimp.error) faltan.push('No se pudo leer Mailchimp con la clave guardada: revísala con "Verificar".');
    else if (!opciones.mailchimp.connected) faltan.push("Falta conectar Mailchimp.");
  }
  if (necesita.includes("surveymonkey") && !opciones.surveymonkey.connected) faltan.push("Falta conectar SurveyMonkey.");
  if (!faltan.length) return null;
  return (
    <p className="rec-seg-error" role="status">
      {faltan.join(" ")} Se arregla en Configuración › Conexiones.
    </p>
  );
}

/** Pide confirmar algo que no se deshace (volver a asignar al azar). */
export function Confirmar({ texto, accion, ocupado, onConfirmar, onCancelar }: {
  texto: ReactNode;
  accion: string;
  ocupado: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="rec-seg-confirmar" role="group" aria-label={accion}>
      <p>{texto}</p>
      <span className="rec-seg-acciones">
        <PulsoButton variant="secondary" size="sm" onClick={onCancelar} disabled={ocupado}>Cancelar</PulsoButton>
        <PulsoButton variant="danger" size="sm" onClick={onConfirmar} disabled={ocupado}>{accion}</PulsoButton>
      </span>
    </div>
  );
}

export function Resultado({ titulo, lineas }: { titulo: string; lineas: readonly { texto: string; error?: boolean; id?: string }[] }) {
  return (
    <div className="rec-seg-resultado" role="status">
      <b>{titulo}</b>
      {lineas.length ? (
        <ul>
          {lineas.map((l, i) => <li key={l.id ?? `${i}-${l.texto}`} className={l.error ? "is-error" : undefined}>{l.texto}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

/** Estado de un paso o etiqueta corta en una píldora. */
export function Chip({ tono, children }: { tono?: "hecho" | "sigue" | "aviso"; children: ReactNode }) {
  return <span className={`rec-seg-chip${tono ? ` is-${tono}` : ""}`}>{children}</span>;
}
