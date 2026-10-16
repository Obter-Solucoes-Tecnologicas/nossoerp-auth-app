import type { ArmazemSegredos, PlataformaAuth } from './plataforma';
export declare const CHAVE_PRIVADA = "authcentral_chave_aparelho";
/**
 * Mobile: P-256 em JS puro (@noble/curves), privada no SecureStore (Keystore/Keychain cifram em repouso). Design
 * 2026-09-29 §10; plano da fase 3, ruling 3.
 */
export declare function criarPlataformaNativa(armazem: ArmazemSegredos, aleatorio: (n: number) => Uint8Array): PlataformaAuth;
