# Brazilian Electoral Data Platform

Plataforma open data para **informação e transparência eleitoral no
Brasil**.

O projeto coleta dados de fontes públicas e oficiais, normaliza essas
informações em um modelo consistente e as disponibiliza de forma simples
por meio de uma **API REST**, **arquivos CSV públicos** e uma
**interface web**.

O foco inicial são as **Eleições Gerais de 2026**, mas a arquitetura foi
pensada para suportar futuras eleições e, posteriormente, recursos de
acompanhamento de mandatos e promessas.

> Este projeto não recomenda candidatos, partidos ou posições políticas.
> O objetivo é facilitar o acesso a dados públicos, mantendo
> neutralidade, rastreabilidade e transparência sobre as fontes
> utilizadas.

------------------------------------------------------------------------

## Objetivos

-   Centralizar dados eleitorais públicos.
-   Padronizar informações provenientes de fontes oficiais.
-   Facilitar a consulta e comparação de candidatos.
-   Disponibilizar uma API pública de leitura.
-   Publicar datasets normalizados em CSV.
-   Manter rastreabilidade até as fontes originais.
-   Criar uma base reutilizável por eleitores, jornalistas,
    pesquisadores e desenvolvedores.
-   Manter infraestrutura simples e de baixo custo.

------------------------------------------------------------------------

## Arquitetura

A obtenção dos dados é separada da API pública.

``` text
                Fontes oficiais
                      |
                      v
                Daily Batch
                      |
          +-----------+-----------+
          |                       |
          v                       v
     Raw Storage              Normalize
   Cloudflare R2                  |
                                  v
                              Validate
                                  |
                                  v
                             PostgreSQL
                                  |
                       +----------+----------+
                       |                     |
                       v                     v
                    REST API             CSV Export
                       |                     |
                       v                     v
                    Angular             Cloudflare R2
```

A API **não consulta o TSE ou outras fontes externas durante uma
requisição**.

Todos os dados públicos passam previamente pelo pipeline de ingestão e
validação.

------------------------------------------------------------------------

## Pipeline de dados

O processo batch é executado inicialmente **uma vez por dia**.

``` text
Extract
   ↓
Raw Storage
   ↓
Parse
   ↓
Normalize
   ↓
Validate
   ↓
Persist
   ↓
Export
   ↓
Publish
```

### Extract

Obtém os arquivos originais das fontes oficiais.

### Raw Storage

Preserva os arquivos originais para auditoria, debugging e
reprocessamento.

### Parse

Interpreta formatos e campos específicos da fonte.

### Normalize

Transforma os dados para o modelo canônico da plataforma.

### Validate

Verifica integridade e consistência antes da publicação.

### Persist

Salva os dados normalizados no PostgreSQL.

### Export

Gera os datasets públicos em CSV.

### Publish

Publica uma nova versão somente quando todo o processamento foi
concluído com sucesso.

Se a execução diária falhar, a última versão válida continua disponível.

------------------------------------------------------------------------

## Stack

### Backend

-   TypeScript
-   NestJS
-   MikroORM
-   PostgreSQL
-   REST

### Batch

-   TypeScript
-   NestJS / Node.js
-   MikroORM
-   PostgreSQL

### Frontend

-   Angular
-   TypeScript

### Storage

-   Cloudflare R2

### Execução do batch

Inicialmente:

-   GitHub Actions

A lógica do batch deve permanecer independente do executor para permitir
migração futura para:

-   AWS Lambda;
-   serverless containers;
-   cron;
-   outros serviços de jobs.

------------------------------------------------------------------------

## Estrutura do repositório

Estrutura planejada:

``` text
/
├── AGENTS.md
├── README.md
│
├── docs/
│   ├── PRODUCT.md
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── DATA_PIPELINE.md
│   └── ROADMAP.md
│
├── apps/
│   ├── api/
│   ├── batch/
│   └── web/
│
└── packages/
    ├── database/
    ├── domain/
    └── shared/
```

### `apps/api`

API REST pública e predominantemente read-only.

### `apps/batch`

Pipeline diário responsável pela ingestão e publicação dos dados.

### `apps/web`

Aplicação Angular.

### `packages/database`

Configuração do MikroORM, entidades, migrations e infraestrutura
compartilhada de persistência.

### `packages/domain`

Conceitos e regras de domínio compartilhados quando necessário.

### `packages/shared`

Contratos e utilitários técnicos realmente compartilhados entre
aplicações.

------------------------------------------------------------------------

## Modelo de dados

Uma decisão central do domínio é separar **pessoa** de **candidatura**.

``` text
Person
   |
   +--- Candidacy
           |
           +--- Election
           |
           +--- Party
           |
           +--- Office
           |
           +--- CandidateAsset
           |
           +--- CandidateContact
           |
           +--- CandidateSource
```

Uma mesma pessoa pode participar de diferentes eleições, cargos ou
partidos ao longo do tempo.

Por isso:

``` text
Person != Candidacy
```

Consulte [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) para detalhes.

------------------------------------------------------------------------

## API

A API pública deve disponibilizar somente dados previamente processados.

Endpoints iniciais planejados:

``` http
GET /dataset

GET /elections
GET /elections/:id

GET /candidates
GET /candidates/:id
GET /candidates/:id/assets
GET /candidates/:id/contacts
```

A listagem de candidatos deverá suportar filtros como:

``` text
election
year
office
state
party
name
```

Coleções devem possuir paginação.

------------------------------------------------------------------------

## Open Data

Os dados normalizados também serão disponibilizados para download.

Exemplos:

``` text
candidates.csv
assets.csv
contacts.csv
```

Futuramente:

``` text
proposals.csv
campaign-revenues.csv
campaign-expenses.csv
```

Também poderá existir:

``` text
full-dataset.zip
```

Os arquivos devem ser servidos diretamente pelo object storage, sem
utilizar a API NestJS como proxy para downloads grandes.

### Versionamento

A versão mais recente poderá ser acessada por caminhos estáveis:

``` text
datasets/2026/latest/candidates.csv
datasets/2026/latest/assets.csv
```

Snapshots históricos devem permanecer imutáveis:

``` text
datasets/2026/2026-08-08/candidates.csv
datasets/2026/2026-08-08/assets.csv
```

------------------------------------------------------------------------

## Fontes

A prioridade é utilizar **fontes públicas e oficiais**.

A fonte eleitoral primária é o Tribunal Superior Eleitoral (TSE).

Novas fontes poderão ser incorporadas futuramente, como:

-   Câmara dos Deputados;
-   Senado Federal;
-   portais de transparência;
-   outros portais governamentais de dados abertos.

Informações normalizadas devem manter rastreabilidade até sua origem.

------------------------------------------------------------------------

## Privacidade

O produto inicial **não possui autenticação**.

Não serão criados:

``` text
User
Account
Session
Login
Password
FavoriteCandidate
UserPoliticalProfile
UserAnswer
```

A aplicação não deve persistir preferências políticas individuais dos
visitantes.

Quando o futuro recurso de match eleitoral for implementado, as
respostas deverão permanecer no cliente ou existir apenas de forma
transitória durante o cálculo.

------------------------------------------------------------------------

## Roadmap

### MVP 1 --- Candidatos e comparação

-   ingestão dos dados básicos;
-   candidatos;
-   eleições;
-   partidos;
-   cargos;
-   bens declarados;
-   contatos públicos;
-   fontes;
-   API REST;
-   CSV público;
-   listagem;
-   perfil;
-   comparação.

### MVP 2 --- Propostas com IA

-   planos de governo;
-   extração de propostas;
-   categorização;
-   resumos;
-   referências aos documentos originais.

### MVP 3 --- Match eleitoral

Questionário sem identificação do visitante para comparar preferências
informadas com posições documentadas dos candidatos.

### MVP 4 --- Busca semântica

Exemplo:

> Quais candidatos possuem propostas relacionadas à redução de impostos?

As respostas deverão ser fundamentadas nos documentos oficiais.

### MVP 5 --- Financiamento de campanha

-   receitas;
-   despesas;
-   doadores quando publicamente disponíveis;
-   fornecedores;
-   categorias de gastos;
-   comparações.

### MVP 6 --- Pós-eleição

Evolução para acompanhamento de:

-   promessas;
-   projetos;
-   votações;
-   atividade legislativa;
-   execução de políticas públicas.

Veja [`docs/ROADMAP.md`](docs/ROADMAP.md) para o planejamento completo.

------------------------------------------------------------------------

## Princípios de desenvolvimento

### Neutralidade

O sistema não deve favorecer candidatos, partidos ou posições políticas.

### Rastreabilidade

Informações devem permitir chegar até sua fonte original.

### Privacidade

Não criar perfis políticos individuais dos visitantes.

### Simplicidade

Preferir soluções simples que atendam aos requisitos atuais.

### Idempotência

Reprocessar o mesmo dataset não pode duplicar dados.

### Baixo custo

Infraestrutura e decisões técnicas devem considerar o custo operacional
desde o início.

------------------------------------------------------------------------

## Desenvolvimento com Codex

O arquivo [`AGENTS.md`](AGENTS.md) contém as regras arquiteturais e de
desenvolvimento que devem ser consideradas por agentes de código antes
de realizar alterações.

Antes de implementar uma task:

1.  leia `AGENTS.md`;
2.  consulte os documentos relevantes em `/docs`;
3.  inspecione os padrões existentes;
4.  implemente somente o escopo solicitado;
5.  execute testes, lint, typecheck e build aplicáveis;
6.  revise o diff final.

------------------------------------------------------------------------

## Documentação

  ---------------------------------------------------------------------------------
  Documento                                     Conteúdo
  --------------------------------------------- -----------------------------------
  [`PRODUCT.md`](docs/PRODUCT.md)               Visão, problema, usuários e escopo
                                                do produto

  [`ARCHITECTURE.md`](docs/ARCHITECTURE.md)     Arquitetura e decisões técnicas

  [`DATA_MODEL.md`](docs/DATA_MODEL.md)         Modelo canônico de dados

  [`DATA_PIPELINE.md`](docs/DATA_PIPELINE.md)   Pipeline de ingestão, validação e
                                                publicação

  [`ROADMAP.md`](docs/ROADMAP.md)               MVPs e sequência inicial de
                                                desenvolvimento

  [`AGENTS.md`](AGENTS.md)                      Instruções permanentes para agentes
                                                de código
  ---------------------------------------------------------------------------------

------------------------------------------------------------------------

## Status

🚧 **Em desenvolvimento**

O projeto está atualmente na fase de fundação e implementação do
primeiro MVP.

O foco inicial é estabelecer:

``` text
infraestrutura
    ↓
modelo de dados
    ↓
pipeline TSE
    ↓
datasets públicos
    ↓
REST API
    ↓
interface web
```

------------------------------------------------------------------------

## Licença

A licença do código ainda deve ser definida antes da publicação pública
do projeto.

Os dados provenientes de fontes governamentais permanecem sujeitos aos
termos, licenças e condições de suas respectivas fontes.
