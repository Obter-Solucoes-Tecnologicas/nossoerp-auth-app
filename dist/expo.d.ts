import type { PlataformaAuth } from './plataforma';
import { type SessaoAuthCentral } from './sessaoAuthCentral';
export * from './index';
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
export declare function plataformaExpo(): PlataformaAuth;
/**
 * A sessao do app na central, uma por processo: a renovacao unica depende disso (duas renovacoes com o mesmo refresh
 * sao lidas pela central como roubo e revogam a sessao). Chamar de novo com outra config e erro de programacao.
 */
export declare function sessaoPadrao(config: ConfigSessao): SessaoAuthCentral;
