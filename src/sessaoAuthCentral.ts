import { base64url } from './base64url';
import { montarProvaDpop } from './provaDpop';
import type { PlataformaAuth } from './plataforma';
import { ErroAuthCentral, SessaoEncerrada } from './erros';

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

export const CHAVE_SESSAO = 'authcentral_sessao';

const MARGEM_RENOVACAO_MS = 60_000;
/** Sem limite, o fetch do Android espera para sempre numa conexao meio aberta — e a renovacao unica penduraria tudo. */
const TIMEOUT_PADRAO_MS = 15_000;
/**
 * Esperas entre as tentativas de renovar depois de erro de rede. A central aceita o MESMO refresh de novo por 60 s
 * (ServicoSessoesApp.GracaDeReenvio: a resposta se perdeu); depois disso o reenvio e lido como roubo e revoga a
 * sessao. 3 tentativas x 15 s + 2 s + 5 s ficam dentro dos 60 s.
 */
const ESPERAS_RENOVACAO_MS = [2_000, 5_000];
/** A mesma tolerancia de relogio da central (ValidadorDpop.Tolerancia). */
const TOLERANCIA_RELOGIO_MS = 120_000;

export interface SessaoAuthCentral {
  login(p: { cnpj: string; usuario: string; senha: string; idBanco?: number; versaoApp: string }): Promise<SessaoGuardada>;
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
export function criarSessaoAuthCentral(d: {
  plataforma: PlataformaAuth;
  fetch: typeof fetch;
  urlCentral: string;
  clientId: string;
  agoraMs?: () => number;
  timeoutMs?: number;
  esperar?: (ms: number) => Promise<void>;
}): SessaoAuthCentral {
  const agora = d.agoraMs ?? (() => Date.now());
  const timeoutMs = d.timeoutMs ?? TIMEOUT_PADRAO_MS;
  const esperar = d.esperar ?? ((ms: number) => new Promise<void>((ok) => setTimeout(ok, ms)));
  const base = d.urlCentral.replace(/\/+$/, '');
  let emMemoria: SessaoGuardada | null | undefined;
  let renovando: Promise<boolean> | null = null;
  /** Muda a cada login/saida: uma renovacao que comecou noutra geracao nao grava por cima. */
  let geracao = 0;

  async function prova(metodo: string, url: string, accessToken?: string) {
    return montarProvaDpop({
      chave: await d.plataforma.chaveDoAparelho(),
      metodo,
      url,
      accessToken,
      agoraSeg: Math.floor(agora() / 1000),
      jti: base64url(d.plataforma.bytesAleatorios(16)),
    });
  }

  async function guardar(s: SessaoGuardada | null) {
    emMemoria = s;
    if (s) await d.plataforma.armazem.gravar(CHAVE_SESSAO, JSON.stringify(s));
    else await d.plataforma.armazem.apagar(CHAVE_SESSAO);
  }

  async function atual(): Promise<SessaoGuardada | null> {
    if (emMemoria !== undefined) return emMemoria;
    const texto = await d.plataforma.armazem.ler(CHAVE_SESSAO);
    emMemoria = texto ? (JSON.parse(texto) as SessaoGuardada) : null;
    return emMemoria;
  }

  async function postar(caminho: string, corpo: unknown, extras: Record<string, string> = {}): Promise<Response> {
    const url = base + caminho;
    const cabecalhos: Record<string, string> = { 'Content-Type': 'application/json', ...extras };
    if (!cabecalhos['DPoP']) cabecalhos['DPoP'] = await prova('POST', url);
    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), timeoutMs);
    try {
      return await d.fetch(url, {
        method: 'POST',
        headers: cabecalhos,
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        signal: controle.signal,
      });
    } catch {
      throw new ErroAuthCentral('rede', 'Sem conexão com o servidor. Verifique a internet e tente de novo.');
    } finally {
      clearTimeout(relogio);
    }
  }

  async function erroDa(resposta: Response): Promise<ErroAuthCentral> {
    const corpo = (await resposta.json().catch(() => ({}))) as { mensagem?: string; bancos?: number[]; referencia?: string };
    const mensagem = corpo.mensagem || 'Não foi possível autenticar.';
    // Toda recusa da central traz a referencia do evento: o vendedor a passa ao suporte, que ve o motivo real.
    const ref = typeof corpo.referencia === 'string' && corpo.referencia.length <= 20 ? corpo.referencia : null;
    if (resposta.status === 401) {
      // A central recusa prova com iat a mais de 120 s: com o relogio errado, "usuario ou senha" mandaria o
      // vendedor trocar a senha a toa.
      const data = Date.parse(resposta.headers.get('date') ?? '');
      if (!Number.isNaN(data) && Math.abs(agora() - data) > TOLERANCIA_RELOGIO_MS)
        return new ErroAuthCentral('relogio', 'Verifique a data e hora do aparelho.', [], ref);
      return new ErroAuthCentral('nao_autenticado', mensagem, [], ref);
    }
    if (resposta.status === 403) return new ErroAuthCentral('acesso_negado', mensagem, [], ref);
    if (resposta.status === 409) return new ErroAuthCentral('varios_bancos', mensagem, corpo.bancos ?? [], ref);
    return new ErroAuthCentral('indisponivel', mensagem, [], ref);
  }

  /** Pede a renovacao; erro de rede repete com o MESMO refresh dentro da graca de reenvio da central. */
  async function postarRenovacao(refreshToken: string): Promise<Response> {
    const corpo = { grant_type: 'refresh_token', client_id: d.clientId, refresh_token: refreshToken };
    for (let tentativa = 0; ; tentativa++) {
      try {
        return await postar('/auth/v1/token', corpo);
      } catch (err) {
        const espera = ESPERAS_RENOVACAO_MS[tentativa];
        if (!(err instanceof ErroAuthCentral) || err.codigo !== 'rede' || espera === undefined) throw err;
        await esperar(espera);
      }
    }
  }

  async function renovarAgora(): Promise<boolean> {
    const s = await atual();
    if (!s || s.modo !== 'novo' || !s.refreshToken) return false;
    const minhaGeracao = geracao;
    const resposta = await postarRenovacao(s.refreshToken);
    // Saiu ou entrou outro usuario enquanto a renovacao voava: o resultado nao e mais desta sessao.
    if (minhaGeracao !== geracao) return (await atual()) !== null;
    if (resposta.status === 401 || resposta.status === 403) {
      await guardar(null);
      return false;
    }
    if (!resposta.ok) throw await erroDa(resposta);
    const r = (await resposta.json()) as { access_token: string; expires_in: number; refresh_token: string };
    if (minhaGeracao !== geracao) return (await atual()) !== null;
    await guardar({ ...s, accessToken: r.access_token, expiraEmMs: agora() + r.expires_in * 1000, refreshToken: r.refresh_token });
    return true;
  }

  function renovar(): Promise<boolean> {
    // Uma renovacao por vez: duas com o mesmo refresh = reuso, e a central revoga a sessao inteira (sinal de roubo).
    if (!renovando) renovando = renovarAgora().finally(() => (renovando = null));
    return renovando;
  }

  return {
    atual,
    renovar,
    async login(p) {
      const resposta = await postar('/auth/v1/login', {
        client_id: d.clientId,
        cnpj: p.cnpj,
        usuario: p.usuario,
        senha: p.senha,
        id_banco: p.idBanco ?? null,
        versao_app: p.versaoApp,
      });
      if (!resposta.ok) throw await erroDa(resposta);
      const r = (await resposta.json()) as {
        modo: ModoAuth;
        access_token: string;
        expires_in: number;
        refresh_token?: string | null;
        tenant: TenantAuth;
      };
      geracao++;
      const sessao: SessaoGuardada = {
        modo: r.modo,
        accessToken: r.access_token,
        expiraEmMs: agora() + r.expires_in * 1000,
        refreshToken: r.refresh_token ?? null,
        tenant: r.tenant,
      };
      await guardar(sessao);
      return sessao;
    },
    async cabecalhos(metodo, url): Promise<Record<string, string>> {
      let s = await atual();
      if (!s) throw new SessaoEncerrada();
      if (s.modo === 'legado') {
        // Mesmo vencido: o servidor responde 401 e o reauth com a senha salva refaz o login, como antes. Derrubar a
        // sessao aqui deslogaria (e apagaria o cache offline) todo dia.
        return { Authorization: `Bearer ${s.accessToken}` };
      }
      if (s.expiraEmMs - agora() < MARGEM_RENOVACAO_MS) {
        if (!(await renovar())) throw new SessaoEncerrada();
        s = await atual();
        if (!s) throw new SessaoEncerrada();
      }
      return { Authorization: `DPoP ${s.accessToken}`, DPoP: await prova(metodo, url, s.accessToken) };
    },
    async sair() {
      let s = await atual();
      try {
        // A central so revoga com um access token valido: vencido, renova antes (melhor esforco).
        if (s?.modo === 'novo' && s.expiraEmMs - agora() < MARGEM_RENOVACAO_MS) {
          s = (await renovar().catch(() => false)) ? await atual() : null;
        }
        if (s?.modo === 'novo') {
          const url = base + '/auth/v1/sair';
          await postar('/auth/v1/sair', undefined, { Authorization: `DPoP ${s.accessToken}`, DPoP: await prova('POST', url, s.accessToken) });
        }
      } catch {
        /* sair e melhor esforco: a sessao local sai de qualquer jeito */
      }
      geracao++;
      await guardar(null);
    },
  };
}
