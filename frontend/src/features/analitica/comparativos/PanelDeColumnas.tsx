// "Columnas del comparativo" (prototipo, columna derecha): una fila por base en
// el orden de la serie, con el título que lleva en el Excel y cómo pondera; y
// debajo los ajustes de los archivos: letras de diferencias, variables por las
// que se abre el comparativo de cruces y notas al pie. El orden de la serie se
// declara en Equivalencias.

import { useNavigate } from "react-router-dom";

import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoInput } from "../../../components/PulsoInput";
import { enumerar } from "../../../lib/enumerar";
import { formatoConteo } from "../../../lib/formatoNumero";
import { AlertTriangle, Columns3, Scale } from "../../../vendor/lucide-react";
import { mayuscula, rotuloPorDefecto } from "../../carga/nombreDeSerie";
import { InterruptorOpcion } from "../InterruptorOpcion";
import { DIRECCION_PONDERACION_SERIE, clasePonderacion, explicacionPonderacion, textoPonderacion } from "../ponderacionSerieModel";
import { rotulosPorDefecto, rotulosRepetidos } from "../panes/comparativosModel";
import type { LecturaPonderacionSerie } from "../usePonderacionDeLaSerie";

export function PanelDeColumnas({
  periodos, rotulos, ponderacion, conLetras, cruces, notas, onRotulo, onLetras, onCruces, onNotas,
}: {
  periodos: readonly string[];
  rotulos: Record<string, string>;
  ponderacion: LecturaPonderacionSerie;
  /** Letras de diferencias significativas: la regla de Cruces, que el comparativo de cruces también lee. */
  conLetras: boolean;
  /** Las variables de cruce elegidas, con su etiqueta. */
  cruces: readonly string[];
  /** Cuántas notas al pie hay escritas, por pregunta y generales. */
  notas: number;
  onRotulo: (base: string, valor: string) => void;
  onLetras: () => void;
  onCruces: () => void;
  onNotas: () => void;
}) {
  const navegar = useNavigate();
  const porDefecto = rotulosPorDefecto([...periodos]);
  const repetidos = rotulosRepetidos(rotulos, periodos);
  const pesoDe = new Map(ponderacion.tipo === "listo" ? ponderacion.serie.map((s) => [s.base, s.ponderacion]) : []);
  return (
    <PanelDeMesa
      zona="columnas"
      titulo="Columnas del comparativo"
      icono={<Columns3 size={16} aria-hidden="true" />}
      acciones={(
        <PulsoButton
          variant="icon"
          size="sm"
          onClick={() => navegar(DIRECCION_PONDERACION_SERIE)}
          aria-label="Ir a la pestaña Ponderación"
          title="Ir a la pestaña Ponderación"
        >
          <Scale size={14} aria-hidden="true" />
        </PulsoButton>
      )}
    >
      <ol
        className="comparativos-columnas"
        aria-label="Columnas del comparativo, en el orden de la serie"
        data-qa-geometry-group="analitica/comparativos-columnas"
        data-qa-geometry-contract="intrinsic"
      >
        {periodos.map((base, i) => {
          const peso = pesoDe.get(base);
          return (
            <li key={base} className="comparativos-columna" data-qa-geometry-member>
              <span className="comparativos-columna-pos" aria-hidden="true">{formatoConteo(i + 1)}</span>
              <span className="comparativos-columna-base">
                <b title={base}>{base}</b>
                <span className={`comparativos-columna-peso ${peso ? clasePonderacion(peso) : "is-sin-leer"}`} title={peso ? explicacionPonderacion(peso) : undefined}>
                  {peso ? mayuscula(textoPonderacion(peso)) : "Leyendo la ponderación"}
                </span>
              </span>
              <PulsoInput
                size="sm"
                className="comparativos-columna-titulo"
                value={rotulos[base] ?? ""}
                placeholder={porDefecto[base] ?? rotuloPorDefecto(base)}
                onChange={(e) => onRotulo(base, e.target.value)}
                aria-label={`Título de la columna ${i + 1} en el Excel, base ${base}`}
              />
            </li>
          );
        })}
      </ol>
      {repetidos.length ? (
        <p className="comparativos-aviso" role="status">
          <AlertTriangle size={13} aria-hidden="true" />
          {repetidos.length === 1
            ? `"${repetidos[0]}" titula a más de una columna. Cambia uno de los títulos para que las columnas se distingan.`
            : `${repetidos.map((r) => `"${r}"`).join(", ")} titulan a más de una columna. Cambia los títulos para que las columnas se distingan.`}
        </p>
      ) : null}

      <ul
        className="comparativos-ajustes"
        aria-label="Ajustes de los archivos"
        data-qa-geometry-group="analitica/comparativos-ajustes"
        data-qa-geometry-contract="intrinsic"
      >
        <li className="comparativos-ajuste">
          <InterruptorOpcion
            variante="linea"
            checked={conLetras}
            onToggle={onLetras}
            titulo="Marcar diferencias significativas"
            descripcion="En el comparativo de cruces, con la regla de Cruces"
          />
        </li>
        <li className="comparativos-ajuste">
          <span className="comparativos-ajuste-texto">
            <b>Abrir por</b>
            <span title={cruces.length ? enumerar([...cruces]) : undefined}>
              {cruces.length === 0
                ? "Ninguna variable de cruce"
                : cruces.length === 1 ? cruces[0] : `${formatoConteo(cruces.length)} variables de cruce`}
            </span>
          </span>
          <PulsoButton variant="secondary" size="sm" onClick={onCruces} aria-label="Elegir las variables de cruce">Elegir</PulsoButton>
        </li>
        <li className="comparativos-ajuste">
          <span className="comparativos-ajuste-texto">
            <b>Notas al pie</b>
            <span>{notas ? `${formatoConteo(notas)} ${notas === 1 ? "nota" : "notas"}` : "Sin notas"}</span>
          </span>
          <PulsoButton variant="secondary" size="sm" onClick={onNotas} aria-label="Editar las notas al pie">Editar</PulsoButton>
        </li>
      </ul>
    </PanelDeMesa>
  );
}
