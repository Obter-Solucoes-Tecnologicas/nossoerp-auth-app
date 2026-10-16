import type { PlataformaAuth } from './plataforma';
export type ModoAuth = 'novo' | 'legado';
/** O tenant que a central devolve no login (design 2026-09-29 §4.1). */
export interface TenantAuth {
    url_interna_api: string;
    id_empresa_nossoerp: number;
    id_banco_de_dados: number;
    razao: string;
    fantasia: string;
    versao_servidor: string;
    tenant_db_id: string | null;
    v2_dashboard: boolean;
}
export interface SessaoGuardada {
    modo: ModoAuth;
    accessToken: string;
    expiraEmMs: number;
    refreshToken: string | null;
    tenant: TenantAuth;
}
export declare const CHAVE_SESSAO = "authcentral_sessao";
export interface SessaoAuthCentral {
    login(p: {
        cnpj: string;
        usuario: string;
        senha: string;
        idBanco?: number;
        versaoApp: string;
    }): Promise<SessaoGuardada>;
    atual(): Promise<SessaoGuardada | null>;
    /** Cabecalhos para UMA chamada ao servidor do cliente; renova antes se faltar menos de 60 s. Lanca SessaoEncerrada. */
    cabecalhos(metodo: string, url: string): Promise<Record<string, string>>;
    /** Forca a renovacao (depois de um 401). true = renovou. Uma so por vez. */
    renovar(): Promise<boolean>;
    sair(): Promise<void>;
}
/**
 * Sessao do app na central emissora (design 2026-09-29 §4, §6, §10). Modo novo: access token de 10 min preso a
 * chave do aparelho (DPoP) e refresh rotativo. Modo legado: o token do ERP de 1 dia, sem refresh. Nunca loga token,
 * refresh nem prova.
 */
export declare function criarSessaoAuthCentral(d: {
    plataforma: PlataformaAuth;
    fetch: typeof fetch;
    urlCentral: string;
    clientId: string;
    agoraMs?: () => number;
    timeoutMs?: number;
    esperar?: (ms: number) => Promise<void>;
}): SessaoAuthCentral;
