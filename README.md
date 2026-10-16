# @nossoerp/auth-app

SDK de login dos apps do NossoERP na **central emissora de token** (auth central). O app entra pela central
(`POST /auth/v1/login`) com CNPJ, usuário e senha; a central confere a senha no servidor do cliente e devolve o tenant
(`url_interna_api`, empresa, banco, versão do servidor) e o token. Nenhum app guarda chave de API nem usuário de serviço.

Design: `docs/superpowers/specs/2026-09-29-autenticacao-central-emissora-design.md` (monorepo NossoERP), §4, §6 e §10.

## Instalação

```json
"@nossoerp/auth-app": "github:Obter-Solucoes-Tecnologicas/nossoerp-auth-app#v1.0.0"
```

No Expo, também `expo-secure-store` e `expo-crypto` (peers opcionais: só o ponto de entrada `/expo` usa).

## Dois pontos de entrada

| Import | O que traz | Usa módulo nativo? |
|---|---|---|
| `@nossoerp/auth-app` | `criarSessaoAuthCentral`, plataformas nativa e web, erros, `montarProvaDpop` | não |
| `@nossoerp/auth-app/expo` | `sessaoPadrao({ urlCentral, clientId })` e `plataformaExpo()` — uma instância por processo | sim, carregado só ao chamar |

```ts
import { sessaoPadrao, ErroAuthCentral, SessaoEncerrada } from '@nossoerp/auth-app/expo';

const sessao = () => sessaoPadrao({ urlCentral: 'https://nossoservidor.nossoerp.com', clientId: 'dashboard' });

await sessao().login({ cnpj, usuario, senha, versaoApp });           // 409 -> ErroAuthCentral 'varios_bancos' com .bancos
const h = await sessao().cabecalhos('GET', urlCompleta);              // por chamada; renova sozinho
// 401 do servidor do cliente -> await sessao().renovar() (true = repita a chamada; false = volte ao login)
await sessao().sair();
```

## Dois modos, decididos pela central (por cliente)

| | Modo novo | Modo legado |
|---|---|---|
| Quando | ERP do cliente ≥ 1.7.0 e o interruptor da central ligado | o resto |
| Token | JWT de 10 min preso à chave do aparelho (DPoP) | o token do ERP, 1 dia |
| Chamadas | `Authorization: DPoP <token>` + header `DPoP` com uma prova por pedido | `Authorization: Bearer <token>` |
| Venceu | renova pelo refresh (`/auth/v1/token`), sem senha | o app refaz o login (com a senha salva, se o app guarda) |

## Regras

- A URL da central tem de ser a **pública**: a prova é conferida contra ela.
- Uma sessão por processo (`sessaoPadrao`): duas renovações com o mesmo refresh são lidas como roubo e revogam a sessão.
- Uma prova por chamada (o `jti` não repete): conexão que reconecta sozinha (SSE) tem de pedir `cabecalhos` de novo.
- Nunca logar senha, token, refresh nem prova.
- Relógio do aparelho a mais de 120 s da central: a prova é recusada e o erro vem com código `relogio`.
- Toda recusa traz a referência do evento (`ErroAuthCentral.referencia`, já na mensagem como "(ref. L-…)").

## Contrato com o servidor

O monorepo tem `ContratoProvaSdkTests` (central e Servidor.Web) com provas geradas por este pacote. Mudou o formato
da prova? `npm run contrato` e cole a saída nas duas classes.

## Lançar versão

```bash
npm test && npm run build      # dist/ é versionado: os apps instalam direto do git, sem passo de build
git add -A && git commit -m "..." && git tag vX.Y.Z && git push origin main --tags
```

O CI recusa commit com `dist/` diferente do fonte.
