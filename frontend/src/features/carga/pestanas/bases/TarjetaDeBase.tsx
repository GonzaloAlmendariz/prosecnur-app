// Una base de la colección (generaliza la tarjeta de "Bases del estudio"): su
// nombre, de dónde viene y cuántas respuestas trae. Lo demás (fuentes,
// formulario, acciones) vive en el inspector, que se abre con `foco=<base>`.

import { EstadoChip } from "../../../../components/EstadoChip";
import { Panel } from "../../../../components/Panel";
import { formatoConteo, formatoConteoDe } from "../../../../lib/formatoNumero";
import {
  Activity,
  Cloud,
  Database,
  FileCheck2,
  FileSpreadsheet,
  FileUp,
  Repeat,
  type LucideIcon,
} from "../../../../vendor/lucide-react";
import { rotuloRespuestas, type BaseDeLaColeccion, type OrigenDeCarga } from "./basesModel";

const ICONO_DE_ORIGEN: Readonly<Record<OrigenDeCarga, LucideIcon>> = {
  Archivos: FileSpreadsheet,
  SurveyMonkey: Cloud,
  KoboToolbox: Cloud,
  "Archivo .sav": FileUp,
  Monitoreo: Activity,
  "Formulario publicado": FileCheck2,
  "Otro origen": Database,
};

export function IconoDeOrigen({ origen, size = 16 }: { origen: OrigenDeCarga; size?: number }) {
  const Icono = ICONO_DE_ORIGEN[origen];
  return <Icono size={size} aria-hidden="true" />;
}

export const ID_INSPECTOR_DE_BASE = "pulso-bases-inspector";

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
  return (
    <Panel
      noPadding
      className="pulso-bases-tarjeta"
      data-qa-geometry-member=""
      data-seleccionada={abierta ? "" : undefined}
      aria-label={base.etiqueta}
    >
      <button
        type="button"
        className="pulso-bases-tarjeta-abrir"
        data-base-abre={base.nombre}
        aria-expanded={abierta}
        aria-controls={abierta ? ID_INSPECTOR_DE_BASE : undefined}
        onClick={() => onEnfocar(base.nombre)}
      >
        <span className="pulso-bases-tesela"><IconoDeOrigen origen={base.origen} /></span>
        <span className="pulso-bases-tarjeta-titulo">
          <span className="pulso-bases-tarjeta-nombre">{base.etiqueta}</span>
          <span className="pulso-bases-tarjeta-origen">{base.origen}</span>
        </span>
      </button>
      <div className="pulso-bases-tarjeta-cuerpo">
        {/* La cifra o lo que falta ocupan la misma fila: la tarjeta no cambia de alto (C2). */}
        <div className="pulso-bases-tarjeta-dato">
          {base.falta ? (
            <EstadoChip
              label={base.falta === "formulario" ? "Falta el formulario" : "Faltan las respuestas"}
              tone="warn"
            />
          ) : base.respuestas !== null ? (
            <p className="pulso-bases-cifra">
              <strong>{formatoConteo(base.respuestas)}</strong>
              <span>{rotuloRespuestas(base.respuestas)}</span>
            </p>
          ) : (
            <p className="pulso-bases-cifra is-sin-dato">Sin conteo de respuestas</p>
          )}
        </div>
        {base.hijas.length ? (
          <ul className="pulso-bases-hijas" aria-label={`Grupos repetidos de ${base.etiqueta}`}>
            {base.hijas.map((hija) => (
              <li key={hija.nombre}>
                <button
                  type="button"
                  className="pulso-bases-hija"
                  data-base-abre={hija.nombre}
                  aria-expanded={enfocada === hija.nombre}
                  aria-controls={enfocada === hija.nombre ? ID_INSPECTOR_DE_BASE : undefined}
                  data-seleccionada={enfocada === hija.nombre ? "" : undefined}
                  onClick={() => onEnfocar(hija.nombre)}
                >
                  <Repeat size={13} aria-hidden="true" />
                  <span className="pulso-bases-hija-nombre">{hija.etiqueta}</span>
                  <span className="pulso-bases-hija-dato">
                    {hija.filas !== null ? formatoConteoDe(hija.filas, "fila") : "Grupo repetido"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Panel>
  );
}
