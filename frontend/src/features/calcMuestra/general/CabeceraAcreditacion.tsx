/**
 * Cabecera de Acreditación con la pieza de Procesamiento (`CabeceraDePestana`, ADR 0142): la tesela con el ícono de
 * la sección, el tipo como antetítulo, la sección como título, el estado en palabra, tres cifras con su base y el
 * enlace a donde se sigue. Reemplaza la línea de encabezado y la banda "Diseño vigente" (cinco tarjetas y una ficha
 * por actor con franja lateral), que repetían las tablas de abajo con geometrías distintas. Pedido de Gonzalo
 * (2026-11-12): "¿por qué hay contenedores con geometrías diferentes?".
 */
import { ArrowRight, BarChart3, ClipboardList, Grid3X3, NotepadText } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import type { CalcMuestraGeneralCorrida, CalcMuestraGeneralMarco } from "../../../api/calcMuestraGeneral";
import { CabeceraDePestana, type TonoDeEstadoDePestana } from "../../../components/procesamiento/CabeceraDePestana";
import type { CifraDePestana } from "../../../components/procesamiento/CifrasDePestana";
import { fmtInt, safeNumber } from "../sharedCore";
import { conteoSorteosAcreditacion, type EstadoMesa, type TonoEstadoMesa } from "./bandaDisenoModelo";
import { enlaceSiguiente, searchConSeccionYPestana } from "./modeloPestanas";
import { encabezadoDeSeccion, MODO_ETIQUETA } from "./secciones";

const ICONO = { actores: ClipboardList, contexto: NotepadText, seleccion: Grid3X3, resultados: BarChart3 } as const;

const TONO: Record<TonoEstadoMesa, TonoDeEstadoDePestana> = { ok: "listo", alerta: "atencion", pendiente: "parcial" };

const cifra = new Intl.NumberFormat("en-US");

/** Las tres cifras del estudio: población, encuestas y actores con su selección (u orden de contacto). */
export function cifrasCabeceraAcreditacion(args: {
  componentes: readonly CalcMuestraComponente[];
  corridas: Readonly<Record<string, CalcMuestraGeneralCorrida>>;
  marcos?: Readonly<Record<string, CalcMuestraGeneralMarco>>;
  hrefSeleccion: string;
}): CifraDePestana[] {
  const conN = args.componentes.filter((c) => safeNumber(c.marco?.marco_validado, 0) > 0);
  const calculados = conN.filter((c) => safeNumber(c.resultado?.n_objetivo, 0) > 0);
  const sorteos = conteoSorteosAcreditacion(args);
  const cifras: CifraDePestana[] = [
    {
      clave: "poblacion",
      valor: conN.length ? cifra.format(conN.reduce((s, c) => s + safeNumber(c.marco?.marco_validado, 0), 0)) : "Sin N",
      rotulo: "población",
      titulo: `Suma de los marcos de ${fmtInt(conN.length)} ${conN.length === 1 ? "actor" : "actores"}.`,
      rango: 1,
    },
    {
      clave: "encuestas",
      valor: calculados.length ? cifra.format(calculados.reduce((s, c) => s + safeNumber(c.resultado?.n_objetivo, 0), 0)) : "Sin calcular",
      rotulo: "encuestas",
      titulo: "Suma de las metas de los actores calculados.",
      rango: 1,
    },
  ];
  if (sorteos.sorteables > 0) {
    cifras.push({
      clave: "seleccion",
      valor: cifra.format(sorteos.vigentes),
      base: cifra.format(sorteos.sorteables),
      rotulo: "actores con selección",
      tono: sorteos.vigentes < sorteos.sorteables ? "alerta" : "ok",
      enlace: args.hrefSeleccion,
      rango: 2,
    });
  }
  return cifras;
}

export function CabeceraAcreditacion({ seccion, pestana, estado, componentes, corridas, marcos }: {
  seccion: string;
  pestana: string | null;
  estado: EstadoMesa;
  componentes: readonly CalcMuestraComponente[];
  corridas: Readonly<Record<string, CalcMuestraGeneralCorrida>>;
  marcos?: Readonly<Record<string, CalcMuestraGeneralMarco>>;
}) {
  const location = useLocation();
  const { titulo } = encabezadoDeSeccion("acreditacion", seccion);
  const enlace = enlaceSiguiente("acreditacion", estado.accion, { seccion, pestana });
  const href = (s: string, p: string | null) => `${location.pathname}${searchConSeccionYPestana(location.search, s, p)}`;
  return (
    <CabeceraDePestana
      seccion={MODO_ETIQUETA.acreditacion}
      titulo={titulo}
      icono={ICONO[seccion as keyof typeof ICONO] ?? ClipboardList}
      estado={estado.clave === "leyendo" ? null : { tono: TONO[estado.tono], texto: estado.etiqueta }}
      cifras={cifrasCabeceraAcreditacion({ componentes, corridas, marcos, hrefSeleccion: href("seleccion", "seleccion-sorteo") })}
      acciones={enlace ? (
        <Link className="pulso-button pulso-button--secondary pulso-button--sm" to={href(enlace.seccion, enlace.pestana)} title={estado.siguiente ?? undefined}>
          {enlace.etiqueta}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      ) : undefined}
    />
  );
}
