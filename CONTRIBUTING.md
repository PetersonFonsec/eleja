# Contribuindo com o Eleja

Obrigado por considerar contribuir com o Eleja.

O projeto é uma plataforma open source de informação e transparência eleitoral no Brasil. Toda contribuição deve respeitar neutralidade política, rastreabilidade até as fontes, privacidade por design, simplicidade arquitetural, baixo custo operacional e idempotência no pipeline.

Antes de contribuir, leia `README.md`, `AGENTS.md` e os documentos em `/docs`.

## Como contribuir

Você pode contribuir corrigindo bugs, melhorando documentação e testes, evoluindo parsers e normalizadores, adicionando suporte a novas fontes oficiais, melhorando a API ou contribuindo com o frontend.

Para mudanças grandes de arquitetura, modelo de dados ou escopo de produto, prefira abrir uma issue antes da implementação. Mudanças pequenas podem ir diretamente para pull request.

## Regras técnicas

A API pública não deve consultar TSE ou outras fontes externas durante requisições.

O pipeline deve continuar seguindo:

```text
Extract → Raw Storage → Parse → Normalize → Validate → Persist → Export → Publish
```

Não introduza autenticação, persistência de preferências políticas de visitantes, filas, microservices ou infraestrutura distribuída sem necessidade explícita.

Use MikroORM como ORM e PostgreSQL como banco principal.

## Dados e fontes

Ao adicionar ou alterar uma integração:

1. prefira fontes públicas e oficiais;
2. preserve identificadores da fonte;
3. mantenha rastreabilidade;
4. preserve valores originais quando a normalização perder informação;
5. inclua fixtures pequenas para testes;
6. não dependa da fonte externa em tempo real nos testes.

## Testes

Priorize testes para parsers, normalizadores, validadores, idempotência, publicação de datasets, filtros e regras de domínio.

Uma correção de bug deve, sempre que possível, incluir um teste que reproduza o problema.

## Pull Requests

Explique:

- o que foi alterado;
- por que a mudança é necessária;
- como validar;
- testes executados;
- impacto arquitetural, se houver.

Checklist sugerido:

- [ ] Li o `AGENTS.md`.
- [ ] Mantive o escopo pequeno.
- [ ] Adicionei ou atualizei testes quando necessário.
- [ ] Executei testes, lint, typecheck e build aplicáveis.
- [ ] Mantive rastreabilidade dos dados.
- [ ] Não introduzi tracking de preferências políticas.
- [ ] Atualizei a documentação quando necessário.
- [ ] Revisei meu próprio diff.

## Segurança

Não publique vulnerabilidades sensíveis em issues públicas. Siga `SECURITY.md`.

## Código de Conduta

Ao participar do projeto, você concorda em seguir `CODE_OF_CONDUCT.md`.

## Licença

Ao contribuir, você concorda que sua contribuição será disponibilizada sob a Apache License 2.0, conforme o arquivo `LICENSE`.
