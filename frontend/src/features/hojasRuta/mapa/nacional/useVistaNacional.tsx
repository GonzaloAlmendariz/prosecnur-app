import { useCallback, useMemo, type ReactNode } from "react";
import type { HojasRutaTerritory, SelectedBlock } from "../../../../api/hojasRuta";
import { formatoConteo, formatoDecimal } from "../../../../lib/formatoNumero";
import { useCiudad } from "../../../../lib/navegacion/useCiudad";
import type { ContornoDistrito } from "../lienzo/capas";
import type { EncuadreLienzo, UtilLienzo } from "../lienzo/LienzoMapa";
import type { LimiteNombrado, LimitesPeru } from "../lienzo/limites";
import { unirCajas } from "../lienzo/piezas";
import { nombreDistrito } from "../nombres";
import { useLienzoHojasRuta } from "../store";
import { distritoEnPunto } from "../territorio/puntoEnDistrito";
import { claveNombre } from "../territorio/atlasFoco";
import { ciudadEnPantalla } from "../territorio/atlasCapas";
import { ciudadDeUbigeo, type CiudadAtlas } from "../territorio/ciudades";
import { dibujarDepartamentosDelEstudio, dibujarMarcasNacionales } from "./capasNacional";
import { FichaDistritoNacional } from "./FichaDistritoNacional";
import { MigaNacional } from "./MigaNacional";
import { cajaNacional, ciudadesConDistritos, cifrasPorCiudad, departamentosDelEstudio, esSeccionNacional, nivelDelMapa, type NivelMapa } from "./vistaNacional";
import "./nacional.css";

type Entrada = {
  seccion: string | null | undefined;
  atlas: readonly CiudadAtlas[];
  confirmados: readonly string[];
  /** Los territorios del estudio (sólo los confirmados). */
  territorios: readonly HojasRutaTerritory[];
  contornos: readonly ContornoDistrito[];
  departamentos: readonly LimiteNombrado[];
  objetivoPorUbigeo?: Readonly<Record<string, number>>;
  /** Filas del tamaño vigente: entrevistas y margen por distrito. */
  tamanoFilas?: readonly { ubigeo: string; nUsado: number; margen: number | null }[];
  titulares: readonly SelectedBlock[];
  /** La UMP enfocada en Selección, ya rotulada, para la miga. */
  ump?: string | null;
};

export type VistaNacional = {
  /** `null`: no hay vista nacional y el mapa es el de siempre. */
  nivel: NivelMapa | null;
  encuadre: EncuadreLienzo | null;
  miga: ReactNode | null;
  ficha: ReactNode | null;
  /** Si el distrito se ve en este nivel (rótulos): en una ciudad, sólo los suyos. */
  enVista: (ubigeo: string) => boolean;
  dibujarFondo: (ctx: CanvasRenderingContext2D, u: UtilLienzo) => void;
  dibujarMundo: (ctx: CanvasRenderingContext2D, u: UtilLienzo) => void;
  /** Dibuja las marcas del nivel nacional; `true` si ya no va nada más en pantalla. */
  dibujarPantalla: (ctx: CanvasRenderingContext2D, u: UtilLienzo) => boolean;
  /** Los límites cuyos nombres se rotulan: en el Perú, sin los departamentos del estudio (su ciudad ya los nombra). */
  limitesDeNombres: (l: LimitesPeru) => LimitesPeru;
  /** El clic del nivel, o `undefined` si lo maneja la sección (las manzanas en una ciudad). */
  alClic: ((mundo: [number, number], u: UtilLienzo) => void) | undefined;
};

/** Vista nacional del mapa (ver `vistaNacional.ts`): conecta el param `ciudad` y el distrito enfocado con el lienzo. */
export function useVistaNacional(e: Entrada): VistaNacional {
  const [ciudadParam, setCiudad] = useCiudad();
  const { distritoEnfocado, setDistritoEnfocado } = useLienzoHojasRuta();
  const { seccion, atlas, confirmados, territorios, contornos, departamentos, objetivoPorUbigeo, tamanoFilas, titulares, ump } = e;

  const ciudades = useMemo(() => ciudadesConDistritos(confirmados, atlas), [confirmados, atlas]);
  const nivel = useMemo(() => nivelDelMapa({ seccion, ciudades, ciudad: ciudadParam, distrito: distritoEnfocado, confirmados }), [seccion, ciudades, ciudadParam, distritoEnfocado, confirmados]);
  const ciudadesAtlas = useMemo(() => atlas.filter((c) => ciudades.includes(c.codigo)), [atlas, ciudades]);
  const entrevistas = useMemo(() => (tamanoFilas ? new Map(tamanoFilas.map((f) => [f.ubigeo, f.nUsado])) : undefined), [tamanoFilas]);
  const cifras = useMemo(
    () => (nivel && esSeccionNacional(seccion) ? cifrasPorCiudad(seccion, ciudadesAtlas, { confirmados, territorios, objetivoPorUbigeo, entrevistasPorUbigeo: entrevistas, titulares }) : []),
    [nivel, seccion, ciudadesAtlas, confirmados, territorios, objetivoPorUbigeo, entrevistas, titulares],
  );
  const depsEstudio = useMemo(() => departamentosDelEstudio(atlas, ciudades), [atlas, ciudades]);
  const ciudadVista = nivel && nivel.nivel !== "nacional" ? nivel.ciudad : null;
  const distritoVista = nivel?.nivel === "distrito" ? nivel.distrito : null;
  const contornosCiudad = useMemo(() => (ciudadVista ? contornos.filter((c) => confirmados.includes(c.ubigeo) && ciudadDeUbigeo(c.ubigeo) === ciudadVista) : []), [contornos, confirmados, ciudadVista]);

  const irPeru = useCallback(() => {
    setDistritoEnfocado(null);
    setCiudad(null);
  }, [setCiudad, setDistritoEnfocado]);
  const irCiudad = useCallback((codigo: string) => {
    setDistritoEnfocado(null);
    setCiudad(codigo);
  }, [setCiudad, setDistritoEnfocado]);

  const encuadre = useMemo<EncuadreLienzo | null>(() => {
    if (!nivel) return null;
    if (nivel.nivel === "nacional") {
      const caja = cajaNacional(atlas, departamentos, ciudades);
      return caja ? { caja, pad: 0.1, clave: `nacional:${ciudades.join(",")}`, animar: true } : null;
    }
    if (nivel.nivel === "distrito") {
      const c = contornos.find((x) => x.ubigeo === nivel.distrito);
      if (c) return { caja: c.caja, pad: 0.25, clave: `distrito:${nivel.distrito}`, animar: true };
    }
    // La ciudad: sus distritos del estudio cuando llegan; mientras, la silueta del atlas.
    const caja = unirCajas(contornosCiudad.map((c) => c.caja)) ?? atlas.find((c) => c.codigo === nivel.ciudad)?.caja ?? null;
    return caja ? { caja, pad: 0.08, clave: `ciudad:${nivel.ciudad}:${contornosCiudad.length}`, animar: true } : null;
  }, [nivel, atlas, departamentos, ciudades, contornos, contornosCiudad]);

  const opcionesCiudad = useMemo(() => ciudadesAtlas.map((c) => ({ codigo: c.codigo, nombre: c.nombre })), [ciudadesAtlas]);
  const opcionesDistrito = useMemo(
    () => (ciudadVista ? territorios.filter((t) => ciudadDeUbigeo(t.ubigeo) === ciudadVista).map((t) => ({ codigo: t.ubigeo, nombre: nombreDistrito(t.distrito) })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")) : []),
    [territorios, ciudadVista],
  );
  const miga = nivel ? <MigaNacional nivel={nivel} ciudades={opcionesCiudad} distritos={opcionesDistrito} ump={ump} onPeru={irPeru} onCiudad={irCiudad} onDistrito={setDistritoEnfocado} /> : null;

  const ficha = useMemo(() => {
    if (!distritoVista || !ciudadVista) return null;
    const t = territorios.find((x) => x.ubigeo === distritoVista);
    if (!t) return null;
    let linea: string | null = null;
    if (seccion === "poblacion" && objetivoPorUbigeo?.[t.ubigeo] !== undefined) linea = `${formatoConteo(objetivoPorUbigeo[t.ubigeo])} en la población objetivo`;
    if (seccion === "muestra") {
      const f = tamanoFilas?.find((x) => x.ubigeo === t.ubigeo);
      if (f) linea = `${formatoConteo(f.nUsado)} entrevistas, ±${formatoDecimal((f.margen ?? 0) * 100, 1)} % de margen`;
    }
    if ((seccion === "manzanas" || seccion === "seleccion") && titulares.length) {
      const n = titulares.filter((b) => b.ubigeo === t.ubigeo).length;
      linea = `${formatoConteo(n)} UMP titular${n === 1 ? "" : "es"} sorteada${n === 1 ? "" : "s"}`;
    }
    const nombreCiudad = atlas.find((c) => c.codigo === ciudadVista)?.nombre ?? ciudadVista;
    return <FichaDistritoNacional territorio={t} ciudad={nombreCiudad} linea={linea} onCerrar={() => setDistritoEnfocado(null)} />;
  }, [distritoVista, ciudadVista, territorios, seccion, objetivoPorUbigeo, tamanoFilas, titulares, atlas, setDistritoEnfocado]);

  const enVista = useCallback((ubigeo: string) => !ciudadVista || ciudadDeUbigeo(ubigeo) === ciudadVista, [ciudadVista]);

  const dibujarFondo = useCallback(
    (ctx: CanvasRenderingContext2D, u: UtilLienzo) => {
      if (nivel?.nivel === "nacional") dibujarDepartamentosDelEstudio(ctx, u, departamentos, depsEstudio);
    },
    [nivel, departamentos, depsEstudio],
  );
  const dibujarMundo = useCallback(
    (ctx: CanvasRenderingContext2D, u: UtilLienzo) => {
      const c = distritoVista ? contornos.find((x) => x.ubigeo === distritoVista) : null;
      if (!c) return;
      ctx.strokeStyle = u.colores.acento;
      ctx.lineWidth = 3 * u.px;
      ctx.stroke(u.trazo(c));
    },
    [distritoVista, contornos],
  );
  const dibujarPantalla = useCallback(
    (ctx: CanvasRenderingContext2D, u: UtilLienzo) => {
      if (nivel?.nivel !== "nacional") return false;
      dibujarMarcasNacionales(ctx, u, ciudadesAtlas, cifras);
      return true;
    },
    [nivel, ciudadesAtlas, cifras],
  );

  const limitesDeNombres = useCallback(
    (l: LimitesPeru) => (nivel?.nivel === "nacional" ? { ...l, departamentos: l.departamentos.filter((d) => !depsEstudio.includes(claveNombre(d.nombre))) } : l),
    [nivel, depsEstudio],
  );

  const porDistrito = seccion === "poblacion" || seccion === "muestra";
  const alClic = useMemo(() => {
    if (!nivel) return undefined;
    if (nivel.nivel === "nacional") {
      return ([x, y]: [number, number], u: UtilLienzo) => {
        const [px, py] = u.aPantalla(x, y);
        const c = ciudadEnPantalla(u, ciudadesAtlas, px, py);
        if (c) irCiudad(c.codigo);
      };
    }
    if (!porDistrito) return undefined;
    return ([x, y]: [number, number]) => {
      const d = distritoEnPunto(contornosCiudad, x, y);
      setDistritoEnfocado(d && d.ubigeo !== distritoVista ? d.ubigeo : null);
    };
  }, [nivel, porDistrito, ciudadesAtlas, irCiudad, contornosCiudad, distritoVista, setDistritoEnfocado]);

  return { nivel, encuadre, miga, ficha, enVista, dibujarFondo, dibujarMundo, dibujarPantalla, limitesDeNombres, alClic };
}
