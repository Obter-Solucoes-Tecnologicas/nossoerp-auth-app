import type { PlataformaAuth } from './plataforma';
import { criarPlataformaNativa } from './plataformaNativa';
import { criarPlataformaWeb } from './plataformaWeb';
import { criarSessaoAuthCentral, type SessaoAuthCentral } from './sessaoAuthCentral';

export * from './index';

/* O require do Metro/CommonJS (o pacote nao depende de @types/node no build). */
declare const require: (modulo: string) => unknown;

/* Os tipos minimos dos modulos nativos usados aqui: o pacote nao depende dos @types deles (sao peers opcionais). */
type ReactNative = { Platform: { OS: string } };
type SecureStoreExpo = {
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: unknown;
  getItemAsync(k: string): Promise<string | null>;
  setItemAsync(k: string, v: string, o: { keychainAccessible: unknown }): Promise<void>;
  deleteItemAsync(k: string): Promise<void>;
};
type CryptoExpo = { getRandomBytes(n: number): Uint8Array };

let plataforma: PlataformaAuth | null = null;
let sessao: { config: ConfigSessao; instancia: SessaoAuthCentral } | null = null;

export interface ConfigSessao {
  /** URL PUBLICA da central (a prova DPoP e conferida contra ela). */
  urlCentral: string;
  /** O client_id do app no catalogo da central (auth_cliente_app). */
  clientId: string;
}

/**
 * A plataforma do aparelho (uma por processo). Os modulos nativos sao carregados so aqui, por require: importar o
 * pacote nao pode puxar expo-secure-store/expo-crypto (quebra na web e nos testes que mocam o react-native).
 */
export function plataformaExpo(): PlataformaAuth {
  if (plataforma) return plataforma;
  /* eslint-disable @typescript-eslint/no-var-requires */
  const { Platform } = require('react-native') as ReactNative;
  if (Platform.OS === 'web') {
    plataforma = criarPlataformaWeb();
    return plataforma;
  }
  const SecureStore = require('expo-secure-store') as SecureStoreExpo;
  const Crypto = require('expo-crypto') as CryptoExpo;
  /* eslint-enable @typescript-eslint/no-var-requires */
  plataforma = criarPlataformaNativa(
    {
      ler: (k) => SecureStore.getItemAsync(k),
      gravar: (k, v) => SecureStore.setItemAsync(k, v, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }),
      apagar: (k) => SecureStore.deleteItemAsync(k),
    },
    (n) => Crypto.getRandomBytes(n),
  );
  return plataforma;
}

/**
 * A sessao do app na central, uma por processo: a renovacao unica depende disso (duas renovacoes com o mesmo refresh
 * sao lidas pela central como roubo e revogam a sessao). Chamar de novo com outra config e erro de programacao.
 */
export function sessaoPadrao(config: ConfigSessao): SessaoAuthCentral {
  if (sessao) {
    if (sessao.config.clientId !== config.clientId || sessao.config.urlCentral !== config.urlCentral)
      throw new Error('sessaoPadrao já configurada com outro clientId/urlCentral');
    return sessao.instancia;
  }
  const instancia = criarSessaoAuthCentral({
    plataforma: plataformaExpo(),
    fetch: (...a) => fetch(...a),
    urlCentral: config.urlCentral,
    clientId: config.clientId,
  });
  sessao = { config: { ...config }, instancia };
  return instancia;
}
