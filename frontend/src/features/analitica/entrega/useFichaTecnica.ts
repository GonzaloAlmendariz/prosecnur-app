// La lectura de la ficha técnica para Entrega: sus campos con la sugerencia que
// arma el motor desde la evidencia del proyecto, cuántos están completos y las
// fuentes e indicadores que la alimentan. Vive en la pestaña y no en el panel
// porque la lista de entregables dice cuántos campos faltan.

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  apiAnaliticaFichaTecnicaInfo,
  type AnaliticaFichaTecnicaField,
  type AnaliticaFichaTecnicaInfo,
} from "../../../api/client";
import { type FichaTecnicaConfig, useAnaliticaStore } from "../store";

export type FichaLayout = NonNullable<FichaTecnicaConfig["layout"]>;

export function valorDelCampo(ficha: FichaTecnicaConfig, campo: AnaliticaFichaTecnicaField): string {
  const valor = (ficha as Record<string, unknown>)[campo.key];
  return typeof valor === "string" ? valor : campo.value ?? "";
}

export type FichaTecnica = {
  info: AnaliticaFichaTecnicaInfo | null;
  leyendo: boolean;
  error: string;
  campos: AnaliticaFichaTecnicaField[];
  completos: number;
  sugerenciasPendientes: number;
  releer: () => Promise<void>;
};

export function useFichaTecnica(): FichaTecnica {
  const ficha = useAnaliticaStore((s) => s.config.ficha_tecnica);
  const setFichaTecnica = useAnaliticaStore((s) => s.setFichaTecnica);
  const [info, setInfo] = useState<AnaliticaFichaTecnicaInfo | null>(null);
  const [leyendo, setLeyendo] = useState(true);
  const [error, setError] = useState("");

  const releer = useCallback(async () => {
    setLeyendo(true);
    setError("");
    try {
      const out = await apiAnaliticaFichaTecnicaInfo();
      setInfo(out);
      const actual = useAnaliticaStore.getState().config.ficha_tecnica;
      if (!actual.layout && out.layout) setFichaTecnica({ layout: out.layout as FichaLayout });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLeyendo(false);
    }
  }, [setFichaTecnica]);

  useEffect(() => { void releer(); }, [releer]);

  const campos = useMemo(() => info?.fields ?? [], [info]);
  const completos = campos.filter((c) => valorDelCampo(ficha, c).trim()).length;
  const sugerenciasPendientes = campos.filter((c) => {
    const sugerida = (c.suggested ?? "").trim();
    return sugerida !== "" && sugerida !== valorDelCampo(ficha, c).trim();
  }).length;
  return { info, leyendo, error, campos, completos, sugerenciasPendientes, releer };
}
