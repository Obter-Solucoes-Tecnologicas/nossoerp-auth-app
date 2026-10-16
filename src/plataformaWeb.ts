import type { ArmazemSegredos, PlataformaAuth } from './plataforma';
import type { ChaveAparelho } from './tipos';

const BANCO = 'authcentral';
const LOJA = 'segredos';
const CHAVE_PAR = 'chave_aparelho';

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, erro) => {
    const pedido = indexedDB.open(BANCO, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA);
    pedido.onsuccess = () => ok(pedido.result);
    pedido.onerror = () => erro(pedido.error);
  });
}

async function operar<T>(modo: IDBTransactionMode, acao: (loja: IDBObjectStore) => IDBRequest): Promise<T> {
  const banco = await abrir();
  return new Promise<T>((ok, erro) => {
    const pedido = acao(banco.transaction(LOJA, modo).objectStore(LOJA));
    pedido.onsuccess = () => ok(pedido.result as T);
    pedido.onerror = () => erro(pedido.error);
  });
}

const armazemWeb: ArmazemSegredos = {
  ler: async (k) => (await operar<string | undefined>('readonly', (l) => l.get(k))) ?? null,
  gravar: async (k, v) => {
    await operar('readwrite', (l) => l.put(v, k));
  },
  apagar: async (k) => {
    await operar('readwrite', (l) => l.delete(k));
  },
};

async function chaveDoPar(par: CryptoKeyPair): Promise<ChaveAparelho> {
  const jwk = await crypto.subtle.exportKey('jwk', par.publicKey);
  return {
    jwk: { kty: 'EC', crv: 'P-256', x: jwk.x as string, y: jwk.y as string },
    // WebCrypto ECDSA ja devolve r||s cru (IEEE P1363), 64 bytes em P-256.
    assinar: async (dados) =>
      new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, par.privateKey, dados as BufferSource)),
  };
}

/** Web: chave ES256 NAO exportavel (design 2026-09-29 §10), guardada no IndexedDB por structured clone. */
export function criarPlataformaWeb(): PlataformaAuth {
  let emMemoria: ChaveAparelho | null = null;
  return {
    armazem: armazemWeb,
    bytesAleatorios: (n) => crypto.getRandomValues(new Uint8Array(n)),
    async chaveDoAparelho() {
      if (emMemoria) return emMemoria;
      const guardado = await operar<CryptoKeyPair | undefined>('readonly', (l) => l.get(CHAVE_PAR));
      if (guardado) return (emMemoria = await chaveDoPar(guardado));
      // A publica continua exportavel com extractable=false; a privada nunca sai do navegador.
      const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
      await operar('readwrite', (l) => l.put(par, CHAVE_PAR));
      return (emMemoria = await chaveDoPar(par));
    },
    async esquecerChave() {
      emMemoria = null;
      await operar('readwrite', (l) => l.delete(CHAVE_PAR));
    },
  };
}
