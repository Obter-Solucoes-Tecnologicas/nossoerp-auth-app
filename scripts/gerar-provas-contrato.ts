/**
 * Gera as provas fixas do teste de contrato do monorepo NossoERP (ContratoProvaSdkTests, na central e no Servidor.Web):
 * provas DPoP feitas por ESTE codigo, que o ValidadorDpop C# tem de aceitar. A chave e descartavel e publica de
 * proposito (derivada de um texto fixo): so serve para o contrato, e com ela as provas saem sempre iguais (assinatura
 * deterministica, RFC 6979). Mudou o formato da prova? Rode `npm run contrato` e cole a saida nas duas classes.
 */
import { sha256 } from '@noble/hashes/sha256';
import { criarPlataformaNativa } from '../src/plataformaNativa';
import { montarProvaDpop, thumbprint } from '../src/provaDpop';

const PRIVADA_DE_CONTRATO = sha256(new TextEncoder().encode('nossoerp-auth-app/contrato-dpop/v1'));
const IAT = 1760443200;

async function main() {
  const dados = new Map<string, string>([['authcentral_chave_aparelho', Buffer.from(PRIVADA_DE_CONTRATO).toString('hex')]]);
  const plataforma = criarPlataformaNativa(
    { ler: async (k) => dados.get(k) ?? null, gravar: async (k, v) => void dados.set(k, v), apagar: async (k) => void dados.delete(k) },
    () => {
      throw new Error('a chave de contrato e fixa');
    },
  );
  const chave = await plataforma.chaveDoAparelho();
  const login = await montarProvaDpop({ chave, metodo: 'POST', url: 'https://nossoservidor.nossoerp.com/auth/v1/login', agoraSeg: IAT, jti: 'jti-contrato-ts-1' });
  const erp = await montarProvaDpop({
    chave,
    metodo: 'GET',
    url: 'https://cliente.teste/nossoerp/api/v2/fotos-sync/produtos/manifesto?x=1',
    accessToken: 'AT.de.teste',
    agoraSeg: IAT,
    jti: 'jti-contrato-ts-2',
  });
  console.log(`ProvaLogin = "${login}";`);
  console.log(`ProvaErp = "${erp}";`);
  console.log(`JktDoSdk = "${thumbprint(chave.jwk)}";`);
}

main();
