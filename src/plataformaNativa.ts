import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { base64url } from './base64url';
import type { ArmazemSegredos, PlataformaAuth } from './plataforma';
import type { ChaveAparelho } from './tipos';

export const CHAVE_PRIVADA = 'authcentral_chave_aparelho';

function chaveDe(privada: Uint8Array): ChaveAparelho {
  const publica = p256.getPublicKey(privada, false);
  return {
    jwk: { kty: 'EC', crv: 'P-256', x: base64url(publica.slice(1, 33)), y: base64url(publica.slice(33, 65)) },
    // Assinatura deterministica (RFC 6979): nao precisa de aleatorio, so a geracao da chave precisa.
    assinar: async (dados) => p256.sign(sha256(dados), privada).toCompactRawBytes(),
  };
}

/**
 * Mobile: P-256 em JS puro (@noble/curves), privada no SecureStore (Keystore/Keychain cifram em repouso). Design
 * 2026-09-29 §10; plano da fase 3, ruling 3.
 */
export function criarPlataformaNativa(armazem: ArmazemSegredos, aleatorio: (n: number) => Uint8Array): PlataformaAuth {
  let emMemoria: ChaveAparelho | null = null;
  return {
    armazem,
    bytesAleatorios: aleatorio,
    async chaveDoAparelho() {
      if (emMemoria) return emMemoria;
      const guardada = await armazem.ler(CHAVE_PRIVADA);
      if (guardada) return (emMemoria = chaveDe(hexToBytes(guardada)));
      let privada = aleatorio(32);
      while (!p256.utils.isValidPrivateKey(privada)) privada = aleatorio(32);
      await armazem.gravar(CHAVE_PRIVADA, bytesToHex(privada));
      return (emMemoria = chaveDe(privada));
    },
    async esquecerChave() {
      emMemoria = null;
      await armazem.apagar(CHAVE_PRIVADA);
    },
  };
}
