// Acciones del estudio de varias bases (Carga › Bases, R2), en el panel de la
// relación entre las bases: el nombre del estudio y la salida del modo de
// varias bases. Son las de la cabecera de `BasesPanel`, con las mismas llamadas.
//
// La salida depende de cuántas entradas tiene el estudio, contadas como las
// cuenta el motor (`length(s$estudio$bases)`, router_estudio.R): cada hija de
// grupo repetido es una entrada más. Lo que pasa con los datos es distinto y
// así lo dice cada rótulo:
//  - con una entrada o ninguna, "Volver a una base" (`downgrade-to-single`): la
//    base queda como la carga simple, con su formulario y sus respuestas;
//  - con dos o más (madre e hija incluidas), el motor rechaza esa vuelta
//    (E_MULTIPLE_BASES) y la única salida es "Quitar todas las bases": se
//    quitan una por una y sus respuestas dejan de estar en el proyecto.

import { useId, useState } from "react";
import {
  apiEstudioDowngradeToSingle,
  apiEstudioRemoveBase,
  apiEstudioSetNombre,
  type EstudioPayload,
} from "../../../../api/estudio";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoField } from "../../../../components/PulsoField";
import { PulsoInput } from "../../../../components/PulsoInput";
import { ErrorBlock } from "../../../../components/States";
import { Database, Trash2 } from "../../../../vendor/lucide-react";

export type SalidaDelEstudio = "volver-a-una" | "quitar-todas";

/**
 * La salida que el motor acepta: volver a una base solo con una entrada o
 * ninguna en el estudio. `entradas` cuenta todas, hijas de grupo repetido incluidas.
 */
export function salidaDelEstudio(entradas: number): SalidaDelEstudio {
  return entradas <= 1 ? "volver-a-una" : "quitar-todas";
}

/** Lo que dice la confirmación de "Quitar todas las bases", con el grupo repetido si lo hay. */
export function avisoDeQuitarTodas(nBases: number, nGruposRepetidos: number): string {
  const bases = nBases === 1 ? "Se quita la base" : `Se quitan las ${nBases} bases`;
  const grupos = nGruposRepetidos === 0
    ? ""
    : nGruposRepetidos === 1
      ? (nBases === 1 ? " y su grupo repetido" : " y el grupo repetido")
      : ` y los ${nGruposRepetidos} grupos repetidos`;
  return `${bases}${grupos}; sus respuestas dejan de estar en el proyecto. No se puede deshacer.`;
}

export type EstudioDeVariasBases = {
  nombre: string;
  /** Todas las entradas del estudio, hijas de grupo repetido incluidas: es lo que cuenta el motor. */
  bases: readonly string[];
  /** Cuántas de esas entradas son hijas de grupo repetido. */
  nGruposRepetidos: number;
};

export function AccionesDelEstudio({
  estudio,
  ocupado,
  onCambio,
  onSinVariasBases,
}: {
  estudio: EstudioDeVariasBases;
  ocupado: boolean;
  onCambio: (payload: EstudioPayload) => Promise<void>;
  /** El estudio dejó de ser de varias bases: la página vuelve a la carga simple. */
  onSinVariasBases: () => Promise<void>;
}) {
  const idNombre = useId();
  const [borrador, setBorrador] = useState(estudio.nombre);
  const [confirmando, setConfirmando] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<{ titulo: string; detalle: string } | null>(null);
  const salida = salidaDelEstudio(estudio.bases.length);
  const quieto = ocupado || trabajando;

  const correr = async (titulo: string, accion: () => Promise<void>) => {
    setTrabajando(true);
    setError(null);
    try {
      await accion();
    } catch (e) {
      setError({ titulo, detalle: e instanceof Error ? e.message : "No se pudo completar." });
    } finally {
      setTrabajando(false);
      setConfirmando(false);
    }
  };

  const volverAUna = () => correr("No se pudo volver a una base", async () => {
    await apiEstudioDowngradeToSingle();
    await onSinVariasBases();
  });

  const guardarNombre = () => {
    const nuevo = borrador.trim();
    if (!nuevo || nuevo === estudio.nombre) return;
    void correr("No se pudo cambiar el nombre", async () => onCambio(await apiEstudioSetNombre(nuevo)));
  };

  return (
    <section className="pulso-bases-estudio" aria-label="Acciones del estudio">
      <form
        className="pulso-bases-estudio-nombre"
        onSubmit={(e) => {
          e.preventDefault();
          guardarNombre();
        }}
      >
        <PulsoField label="Nombre del estudio" id={idNombre}>
          <PulsoInput size="sm" value={borrador} onChange={(e) => setBorrador(e.target.value)} placeholder="Sin nombre" />
        </PulsoField>
        <PulsoButton type="submit" variant="secondary" size="sm" disabled={quieto || !borrador.trim() || borrador.trim() === estudio.nombre}>
          Guardar
        </PulsoButton>
      </form>

      {confirmando ? (
        <div className="pulso-bases-confirmar" role="alert">
          <span>
            {salida === "volver-a-una"
              ? "El estudio deja de ser de varias bases. El formulario y las respuestas quedan como una base."
              : avisoDeQuitarTodas(estudio.bases.length - estudio.nGruposRepetidos, estudio.nGruposRepetidos)}
          </span>
          <PulsoButton
            variant={salida === "volver-a-una" ? "primary" : "danger"}
            size="sm"
            disabled={quieto}
            onClick={() => void (salida === "volver-a-una"
              ? volverAUna()
              : correr("No se pudieron quitar las bases", async () => {
                  for (const nombre of estudio.bases) await apiEstudioRemoveBase(nombre);
                  await onSinVariasBases();
                }))}
          >
            {salida === "volver-a-una" ? "Volver a una base" : "Quitar todas las bases"}
          </PulsoButton>
          <PulsoButton variant="ghost" size="sm" onClick={() => setConfirmando(false)}>Cancelar</PulsoButton>
        </div>
      ) : (
        <div className="pulso-bases-acciones">
          {/* Sin bases no hay formulario ni respuestas que conservar: vuelve sin pedir confirmación, como antes de R2. */}
          <PulsoButton
            variant="secondary"
            size="sm"
            disabled={quieto}
            onClick={() => (estudio.bases.length === 0 ? void volverAUna() : setConfirmando(true))}
          >
            {salida === "volver-a-una"
              ? <><Database size={13} aria-hidden="true" />Volver a una base</>
              : <><Trash2 size={13} aria-hidden="true" />Quitar todas las bases</>}
          </PulsoButton>
        </div>
      )}
      {error ? <ErrorBlock label={error.titulo} detail={error.detalle} queda="El estudio sigue como estaba." /> : null}
    </section>
  );
}
