# Roadmap

## Princípios

-   entregar valor incremental;
-   manter infraestrutura simples;
-   implementar somente o necessário para o MVP atual;
-   dados oficiais e rastreáveis;
-   nenhuma autenticação no escopo atual;
-   nenhuma persistência de perfil político do visitante.

------------------------------------------------------------------------

# Fase 0 - Fundação

Objetivo: preparar o projeto para desenvolvimento consistente com Codex
e desenvolvimento manual.

## Entregas

-   estrutura do repositório;
-   AGENTS.md;
-   documentação em `/docs`;
-   configuração TypeScript;
-   configuração de testes;
-   lint/format;
-   PostgreSQL local;
-   MikroORM;
-   migrations;
-   configuração das aplicações `api`, `batch` e `web`;
-   CI básica.

## Definition of Done

-   build funciona;
-   testes funcionam;
-   lint funciona;
-   banco local sobe de forma reproduzível;
-   API e batch podem ser executados independentemente.

------------------------------------------------------------------------

# MVP 1 - Dados básicos e comparação

Objetivo: disponibilizar candidatos e dados fundamentais de forma
padronizada.

## Batch

Implementar ingestão de:

-   eleições;
-   partidos;
-   cargos;
-   pessoas;
-   candidaturas;
-   bens declarados;
-   fontes;
-   contatos públicos quando disponíveis.

## API

Endpoints iniciais:

``` text
GET /dataset
GET /elections
GET /elections/:id
GET /candidates
GET /candidates/:id
GET /candidates/:id/assets
GET /candidates/:id/contacts
```

Filtros relevantes:

``` text
election
year
office
state
party
name
```

## CSV

Publicar:

``` text
candidates.csv
assets.csv
contacts.csv
```

e, se útil:

``` text
full-dataset.zip
```

## Frontend

-   Home;
-   listagem de candidatos;
-   filtros;
-   perfil do candidato;
-   patrimônio;
-   contatos oficiais;
-   comparação lado a lado;
-   indicação de fonte e data de atualização.

## Infra

-   batch diário;
-   RAW no R2;
-   datasets públicos no R2;
-   PostgreSQL;
-   API read-only.

------------------------------------------------------------------------

# MVP 2 - Propostas com IA

Objetivo: facilitar a leitura dos planos oficiais.

## Dados

Adicionar:

``` text
ProposalDocument
Proposal
ProposalCategory
```

## Pipeline

-   baixar documentos;
-   preservar documento original;
-   extrair texto;
-   categorizar propostas;
-   produzir resumos;
-   manter evidências e referências.

## Produto

Organizar propostas por temas:

-   economia;
-   saúde;
-   educação;
-   segurança;
-   meio ambiente;
-   infraestrutura;
-   habitação;
-   emprego;
-   tecnologia.

Toda interpretação de IA deve ser identificada.

------------------------------------------------------------------------

# MVP 3 - Match eleitoral

Objetivo: comparar preferências informadas pelo visitante com posições
documentadas dos candidatos.

## Dados persistidos

``` text
PoliticalQuestion
PoliticalQuestionOption
CandidatePosition
```

## Não persistir

``` text
User
UserAnswer
PoliticalProfile
```

## Fluxo

``` text
perguntas
   |
respostas locais
   |
cálculo
   |
compatibilidade
```

As respostas devem permanecer no browser ou existir somente durante o
processamento necessário para calcular o resultado.

O resultado não deve ser apresentado como recomendação absoluta de voto.

------------------------------------------------------------------------

# MVP 4 - Busca semântica

Objetivo: permitir perguntas sobre propostas e documentos.

Exemplos:

``` text
"Quais candidatos falam sobre redução de impostos?"

"O que os candidatos propõem para segurança pública?"
```

## Tecnologia possível

-   embeddings;
-   PostgreSQL + pgvector;
-   LLM para resposta;
-   referências aos documentos originais.

A resposta deve priorizar evidência e rastreabilidade.

------------------------------------------------------------------------

# MVP 5 - Financiamento e gastos de campanha

Objetivo: tornar dados financeiros de campanha fáceis de analisar.

## Dados

``` text
Campaign
CampaignRevenue
CampaignExpense
```

## Produto

-   total arrecadado;
-   total gasto;
-   principais doadores quando publicamente disponíveis;
-   principais fornecedores;
-   categorias de gastos;
-   evolução temporal;
-   comparação financeira entre campanhas.

## CSV

``` text
campaign-revenues.csv
campaign-expenses.csv
```

------------------------------------------------------------------------

# MVP 6 - Acompanhamento pós-eleição

Objetivo: manter o produto relevante depois da eleição.

Possíveis recursos:

-   promessas registradas;
-   status de execução;
-   projetos apresentados;
-   votações;
-   atividade legislativa;
-   indicadores públicos relacionados;
-   comparação entre promessa e execução.

Possíveis novas fontes:

-   Câmara dos Deputados;
-   Senado Federal;
-   portais de transparência;
-   dados abertos governamentais.

------------------------------------------------------------------------

# Backlog técnico

Itens que podem ser introduzidos quando houver necessidade:

-   cache da API;
-   CDN adicional;
-   observabilidade centralizada;
-   alertas de falha do batch;
-   retenção automática de RAW;
-   compactação de datasets;
-   OpenAPI;
-   versionamento formal da REST API;
-   rate limiting;
-   réplica read-only do banco;
-   serverless container para o batch.

Não implementar antecipadamente apenas porque estão no backlog.

------------------------------------------------------------------------

# Primeira sequência sugerida de tasks

``` text
TASK-001 Estrutura inicial do repositório
TASK-002 Configurar PostgreSQL + MikroORM
TASK-003 Implementar DatasetVersion e BatchRun
TASK-004 Modelar Election
TASK-005 Modelar Party e Office
TASK-006 Modelar Person e Candidacy
TASK-007 Criar abstração de RawStorage
TASK-008 Implementar R2 RawStorage
TASK-009 Implementar extractor do dataset de candidatos
TASK-010 Criar fixtures do TSE
TASK-011 Implementar parser
TASK-012 Implementar normalizer
TASK-013 Implementar validator
TASK-014 Persistir candidaturas de forma idempotente
TASK-015 Modelar e importar CandidateAsset
TASK-016 Gerar candidates.csv
TASK-017 Gerar assets.csv
TASK-018 Publicar datasets no R2
TASK-019 Publicar DatasetVersion
TASK-020 Implementar GET /dataset
TASK-021 Implementar GET /candidates
TASK-022 Implementar GET /candidates/:id
TASK-023 Implementar filtros e paginação
TASK-024 Criar listagem Angular
TASK-025 Criar perfil Angular
TASK-026 Criar comparação Angular
TASK-027 Configurar execução diária do batch
```

Essa sequência é orientativa. Dependências reais do código devem ser
respeitadas antes de paralelizar tasks.
