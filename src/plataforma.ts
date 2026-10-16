import type { ChaveAparelho } from './tipos';

export type { ChaveAparelho };

/** Onde a sessao da central fica guardada: SecureStore no mobile, IndexedDB na web. */
export interface ArmazemSegredos {
  ler(chave: string): Promise<string | null>;
  gravar(chave: string, valor: string): Promise<void>;
  apagar(chave: string): Promise<void>;
}

/** O que muda entre mobile e web. O resto do SDK nao sabe em que plataforma roda. */
export interface PlataformaAuth {
  armazem: ArmazemSegredos;
  /** A chave do aparelho: le a guardada ou cria e guarda uma nova. */
  chaveDoAparelho(): Promise<ChaveAparelho>;
  /** Apaga a chave (os refresh presos a ela deixam de valer). */
  esquecerChave(): Promise<void>;
  bytesAleatorios(n: number): Uint8Array;
}
