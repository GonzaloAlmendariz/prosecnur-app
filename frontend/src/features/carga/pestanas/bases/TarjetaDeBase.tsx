// Una base de la colección (Carga › Bases, prototipo "carga-bases"): una fila a
// todo el ancho con el nombre de la base y de dónde sale su formulario, sus
// fuentes con su origen, el total de respuestas y su estado de Carga. Las hijas
// de grupo repetido van dentro, bajo su madre. Pulsar la fila la lleva al
// inspector (`foco=<base>`), que está siempre a la vista.

import { EstadoChip } from "../../../../components/EstadoChip";
import { Panel } from "../../../../components/Panel";
import { formatoConteo, formatoConteoDe } from "../../../../lib/formatoNumero";
import {
  Activity,
  CloudDownload,
  Database,
  FileCheck2,
  FileSpreadsheet,
  FileUp,
  Repeat,
  type LucideIcon,
} from "../../../../vendor/lucide-react";
import { rotuloRespuestas, type BaseDeLaColeccion, type EstadoDeCarga, type OrigenDeCarga } from "./basesModel";

const ICONO_DE_ORIGEN: Readonly<Record<OrigenDeCarga, LucideIcon>> = {
  Archivos: FileSpreadsheet,
  SurveyMonkey: CloudDownload,
  KoboToolbox: CloudDownload,
  "Archivo .sav": FileUp,
  Monitoreo: Activity,
  "Formulario publicado": FileCheck2,
  "Otro origen": Database,
};

export function IconoDeOrigen({ origen, size = 16 }: { origen: OrigenDeCarga; size?: number }) {
  const Icono = ICONO_DE_ORIGEN[origen];
  return <Icono size={size} aria-hidden="true" />;
}

/** El origen como pastilla: ícono y nombre ("SurveyMonkey"). */
export function OrigenEnPastilla({ origen }: { origen: OrigenDeCarga }) {
  return (
    <span className="pulso-bases-origen-pastilla">
      <IconoDeOrigen origen={origen} size={12} />
      {origen}
    </span>
  );
}

export const ID_INSPECTOR_DE_BASE = "pulso-bases-inspector";

/** El estado de Carga con las palabras de Estado del estudio; lo que falta, en su detalle. */
export function EstadoDeLaBase({ estado, falta }: { estado: EstadoDeCarga | null; falta: BaseDeLaColeccion["falta"] }) {
  const queFalta = falta === "formulario" ? "Falta el formulario." : falta === "respuestas" ? "Faltan las respuestas." : null;
  if (estado) return <EstadoChip label={estado.estado} tone={estado.tono} detail={queFalta ?? estado.detalle} />;
  if (queFalta) return <EstadoChip label={falta === "formulario" ? "Falta el formulario" : "Faltan las respuestas"} tone="warn" />;
  return null;
}

export function TarjetaDeBase({
  base,
  enfocada,
  onEnfocar,
}: {
  base: BaseDeLaColeccion;
  /** Nombre de la base o de la hija que el inspector muestra. */
  enfocada: string | null;
  onEnfocar: (nombre: string) => void;
}) {
  const abierta = enfocada === base.nombre;
  // Con una sola fuente su cifra es la de la base: va una vez, en el total (una cifra por pantalla).
  const variasFuentes = base.fuentes.length > 1;
  return (
    <Panel
      noPadding
      className="pulso-bases-fila"
      data-qa-geometry-member=""
      data-seleccionada={abierta ? "" : undefined}
      aria-label={base.etiqueta}
    >
      <div className="pulso-bases-fila-cuerpo">
        <button
          type="button"
          className="pulso-bases-fila-abrir"
          data-base-abre={base.nombre}
          aria-current={abierta ? "true" : undefined}
          aria-controls={ID_INSPECTOR_DE_BASE}
          title={base.etiqueta === base.nombre ? undefined : base.nombre}
          onClick={() => onEnfocar(base.nombre)}
        >
          <span className="pulso-bases-fila-nombre">{base.etiqueta}</span>
          <span className="pulso-bases-fila-formulario">{base.formularioDe}</span>
        </button>

        {base.fuentes.length ? (
          <ul className="pulso-bases-fila-fuentes" aria-label={`Fuentes de ${base.etiqueta}`}>
            {base.fuentes.map((fuente) => (
              <li key={fuente.clave}>
                <OrigenEnPastilla origen={fuente.origen} />
                {/* Si la base ya se llama como su encuesta, el título no se repite en la misma fila. */}
                {fuente.titulo !== base.etiqueta ? (
                  <span className="pulso-bases-fila-fuente" title={fuente.titulo}>{fuente.titulo}</span>
                ) : null}
                {variasFuentes && fuente.respuestas !== null ? (
                  <span className="pulso-bases-fila-fuente-n">{formatoConteo(fuente.respuestas)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="pulso-bases-fila-fuentes is-sin-dato">
            <OrigenEnPastilla origen={base.origen} />
            <span>Sin fuente registrada</span>
          </p>
        )}

        <p className="pulso-bases-fila-cifra">
          {base.respuestas !== null && base.falta !== "respuestas" ? (
            <>
              <strong>{formatoConteo(base.respuestas)}</strong>
              <small>{rotuloRespuestas(base.respuestas)}</small>
            </>
          ) : (
            <small className="is-sin-dato">{base.falta === "respuestas" ? "Sin respuestas" : "Sin conteo"}</small>
          )}
        </p>

        <div className="pulso-bases-fila-estado">
          <EstadoDeLaBase estado={base.estado} falta={base.falta} />
        </div>
      </div>

      {base.hijas.length ? (
        <ul className="pulso-bases-hijas" aria-label={`Grupos repetidos de ${base.etiqueta}`}>
          {base.hijas.map((hija) => (
            <li key={hija.nombre}>
              <button
                type="button"
                className="pulso-bases-hija"
                data-base-abre={hija.nombre}
                aria-current={enfocada === hija.nombre ? "true" : undefined}
                aria-controls={ID_INSPECTOR_DE_BASE}
                data-seleccionada={enfocada === hija.nombre ? "" : undefined}
                title={hija.etiqueta === hija.nombre ? undefined : hija.nombre}
                onClick={() => onEnfocar(hija.nombre)}
              >
                <Repeat size={13} aria-hidden="true" />
                <span className="pulso-bases-hija-nombre">{hija.etiqueta}</span>
                <span className="pulso-bases-hija-dato">Grupo repetido</span>
                <span className="pulso-bases-hija-cifra">
                  {hija.filas !== null ? formatoConteoDe(hija.filas, "fila") : null}
                </span>
                <span className="pulso-bases-fila-estado">
                  <EstadoDeLaBase estado={hija.estado} falta={null} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
