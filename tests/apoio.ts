import { randomBytes } from 'crypto';
import type { ArmazemSegredos } from '../src/plataforma';

export function armazemEmMemoria(): ArmazemSegredos & { dados: Map<string, string> } {
  const dados = new Map<string, string>();
  return {
    dados,
    ler: async (k) => dados.get(k) ?? null,
    gravar: async (k, v) => {
      dados.set(k, v);
    },
    apagar: async (k) => {
      dados.delete(k);
    },
  };
}

export const aleatorioDeTeste = (n: number) => new Uint8Array(randomBytes(n));
