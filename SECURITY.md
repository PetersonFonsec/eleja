# Security Policy

## Versões suportadas

O Eleja está em desenvolvimento inicial e ainda não possui releases estáveis. Enquanto estivermos nessa fase, correções de segurança serão aplicadas à branch principal e às versões ainda mantidas ativamente.

## Reportando uma vulnerabilidade

Não abra uma issue pública com detalhes de uma vulnerabilidade ainda não corrigida.

A forma preferencial é utilizar o **Private Vulnerability Reporting do GitHub**, quando habilitado neste repositório:

1. abra a aba **Security**;
2. acesse **Advisories**;
3. selecione **Report a vulnerability**;
4. envie os detalhes necessários para reprodução e análise.

Se o recurso ainda não estiver habilitado, abra uma issue sem detalhes técnicos sensíveis solicitando um canal privado de contato.

## Inclua, quando possível

- componente afetado;
- impacto potencial;
- passos para reprodução;
- versão, branch ou commit afetado;
- proof of concept segura;
- sugestão de correção, se houver.

Não inclua credenciais, segredos ou dados pessoais reais.

## Integridade dos dados

Neste projeto, segurança também inclui a integridade do pipeline. Considere relevantes vulnerabilidades que permitam alterar silenciosamente:

- dados normalizados;
- fontes;
- versões de dataset;
- CSVs publicados;
- informações entregues pela API;
- o marcador de dataset `latest`.

## Exemplos de problemas relevantes

- exposição de secrets;
- execução de código não autorizada;
- acesso indevido ao banco;
- SQL injection;
- SSRF;
- path traversal;
- publicação de dataset não validado;
- comprometimento da cadeia de publicação;
- exposição de dados não destinados à publicação.

## Privacidade

O projeto não possui autenticação de visitantes e não deve armazenar preferências políticas individuais.
