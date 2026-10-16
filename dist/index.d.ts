/**
 * Nucleo do SDK: nada aqui importa react-native nem expo-* (roda em Node, na web e nos testes). A montagem para o app
 * Expo fica em `@nossoerp/auth-app/expo`.
 */
export { criarSessaoAuthCentral, CHAVE_SESSAO } from './sessaoAuthCentral';
export type { SessaoAuthCentral, SessaoGuardada, TenantAuth, ModoAuth } from './sessaoAuthCentral';
export { criarPlataformaNativa, CHAVE_PRIVADA } from './plataformaNativa';
export { criarPlataformaWeb } from './plataformaWeb';
export type { PlataformaAuth, ArmazemSegredos } from './plataforma';
export type { ChaveAparelho, JwkPublica } from './tipos';
export { ErroAuthCentral, SessaoEncerrada } from './erros';
export type { CodigoErroAuth } from './erros';
export { montarProvaDpop, thumbprint, hashAccessToken, base64url } from './provaDpop';
