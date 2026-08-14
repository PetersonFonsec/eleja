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

## Início rápido local

Pré-requisitos: Node.js 22 LTS, npm 10+ e Docker com Docker Compose.

``` bash
npm install
cp .env.example .env
npm run db:up
npm run migration:up
npm run batch:run -- --year=2026
```

O batch baixa os arquivos oficiais do TSE, popula o PostgreSQL e gera os CSVs
locais em `.data/exports/2026/<versão>/`. Depois, mantenha dois terminais
abertos:

``` bash
npm run api # terminal 1 — http://localhost:3000
npm run web # terminal 2 — http://localhost:4200
```

Abra `http://localhost:4200/candidates`. O Docker elimina a necessidade de uma
instalação local do PostgreSQL. `npm run db:down` encerra o banco sem apagar o
volume; a ingestão nunca é executada automaticamente ao iniciar a API ou o web.

Para associar pessoas candidatas a identificadores oficiais de deputados da
Câmara, depois de importar as candidaturas e aplicar as migrações, execute:

``` bash
npm run batch:camara:match-deputies -- --year=2026
```

O comando requer acesso à API oficial de Dados Abertos da Câmara. Por padrão,
consulta exercícios parlamentares desde `1987-02-01`; o intervalo pode ser
ajustado com `CAMARA_DEPUTIES_START_DATE` e `CAMARA_DEPUTIES_END_DATE`. O
matching é conservador e só persiste correspondências de nome civil e data de
nascimento exatos após normalização segura.

Depois que as identidades Câmara estiverem disponíveis, importe os mandatos das
pessoas relacionadas à população eleitoral solicitada:

``` bash
npm run batch:camara:mandates -- --year=2026
```

Esse comando requer PostgreSQL em execução, migrações aplicadas, identidades
`CAMARA` previamente importadas e acesso à API oficial. Ele não executa uma nova
tentativa de correspondência de identidade.

Para importar metadados e autorias de proposições das pessoas vinculadas:

``` bash
npm run batch:camara:proposals -- --year=2026
```

O comando requer PostgreSQL, migrações aplicadas, identidades `CAMARA`
previamente importadas e acesso à API oficial. Mandatos já importados permitem
vincular uma autoria ao mandato exato; quando isso não é inequívoco, a autoria
permanece válida com `mandate = null`.

Para importar votações nominais correspondentes aos períodos de mandato das
pessoas vinculadas:

``` bash
npm run batch:camara:votes -- --year=2026
```

O comando requer PostgreSQL, migrações aplicadas, identidades `CAMARA`, acesso à
API oficial e, preferencialmente, mandatos importados. O ano seleciona a
população Eleja; os períodos consultados vêm dos mandatos conhecidos, não do ano
eleitoral. Sem mandato com data inicial conhecida, nenhuma votação é consultada.

Para importar despesas oficiais da cota parlamentar nos anos cobertos pelos
mandatos conhecidos:

``` bash
npm run batch:camara:expenses -- --year=2026
```

Requer PostgreSQL, migrações aplicadas, identidades `CAMARA`, acesso à internet
e, fortemente recomendado, mandatos da TASK-023. O ano seleciona a população de
candidatos, não o ano da despesa.

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
                Local Batch
                      |
          +-----------+-----------+
          |                       |
          v                       v
     Raw filesystem           Normalize
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
                    Angular              Local CSV
```

A API **não consulta o TSE ou outras fontes externas durante uma
requisição**.

Todos os dados públicos passam previamente pelo pipeline de ingestão e
validação.

------------------------------------------------------------------------

## Pipeline de dados

O processo batch é executado explicitamente por comando no ambiente local. A
execução diária permanece uma decisão futura de scheduling.

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

-   filesystem local para RAW e CSV no fluxo de desenvolvimento;
-   Cloudflare R2 disponível como adaptador de publicação, sem publicação
    automática no fluxo local.

### Execução futura do batch

A lógica permanece independente do executor para permitir scheduling futuro
por:

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

Pipeline explícito responsável pela ingestão e exportação local dos dados. O
scheduling e a publicação remota não fazem parte do fluxo local.

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
GET /candidates/:id/legislative-profile
GET /candidates/:id/mandates
GET /candidates/:id/proposals
GET /candidates/:id/votes
GET /candidates/:id/expenses
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

## Desenvolvimento local

### Pré-requisitos

-   Node.js 22 LTS;
-   npm 10 ou superior;
-   Docker com Docker Compose.

Instale as dependências na raiz do repositório:

``` bash
npm install
cp .env.example .env
```

Os principais comandos são:

``` bash
npm run api        # inicia a API em http://localhost:3000
npm run batch      # executa o processo batch e encerra
npm run batch:candidates -- --year=2026 # extrai o RAW oficial de candidatos
npm run batch:candidates:parse -- --year=2026 # parseia o RAW local
npm run batch:candidates:normalize -- --year=2026 # normaliza sem persistir
npm run batch:candidates:persist -- --year=2026 # persiste candidatos
npm run batch:candidates:history -- --years=2014,2018,2022,2026 # histórico geral completo
npm run batch:assets -- --year=2026 # extrai o RAW oficial de bens
npm run batch:assets:persist -- --year=2026 # persiste bens e proveniência
npm run batch:export -- --year=2026 # gera os CSVs públicos locais
npm run batch:publish -- --year=2026 --version=2026-08-08 # publica no R2
npm run batch:run -- --year=2026 # executa o pipeline local completo
npm run web        # inicia o servidor de desenvolvimento Angular
npm run db:up      # inicia o PostgreSQL pelo Docker
npm run db:down    # encerra o PostgreSQL preservando o volume
npm run migration:up # aplica as migrations pendentes

npm run build      # compila todas as aplicações e pacotes
npm run test       # executa os testes
npm run test:integration # executa testes PostgreSQL com o banco local ativo
npm run lint       # executa o ESLint
npm run typecheck  # verifica os tipos TypeScript
npm run format     # formata os arquivos com Prettier
```

Com a API em execução, o endpoint de saúde está disponível em
`GET http://localhost:3000/health`.

### Frontend de candidatos

Com PostgreSQL populado e a API em execução, inicie o Angular:

``` bash
npm run web
```

A listagem fica em `http://localhost:4200/candidates`; os cards abrem o perfil
em `/candidates/:id`, incluindo informações eleitorais, pessoais públicas,
bens declarados e histórico parlamentar disponível na Câmara dos Deputados.
O resumo legislativo é carregado separadamente e as listas paginadas são
carregadas sob demanda ao abrir cada seção. A seleção "Comparar" abre até três
candidaturas em
`/compare?candidates=<uuid-1>,<uuid-2>`. A URL é o único estado persistente da
comparação e pode ser recarregada ou compartilhada. Em desenvolvimento, o
Angular encaminha `/api` para `http://localhost:3000` usando
`apps/web/proxy.conf.json`. O serviço lê a base da API em
`apps/web/src/environments/environment.ts`; nenhuma URL de servidor é
embutida nos componentes.

### Candidate API

Os primeiros endpoints públicos e somente leitura consultam exclusivamente o
PostgreSQL:

``` http
GET /candidates
GET /candidates/:id
GET /candidates/:id/assets
```

A listagem aceita `page`, `limit`, `year`, `office`, `state`, `party` e `name`.
Os filtros são combinados com semântica AND, `limit` possui máximo de 100 e a
ordenação padrão é `ballotName`, seguida pelo UUID da candidatura.

Exemplos:

``` http
GET /candidates?year=2026&limit=10
GET /candidates?year=2026&state=SP&office=FEDERAL_DEPUTY
GET /candidates?party=PT&name=joao
```

O endpoint de bens retorna todos os bens da candidatura, ordenados por valor
decrescente, e calcula a quantidade e soma diretamente no PostgreSQL:

``` json
{
  "candidateId": "uuid",
  "summary": {
    "totalAssets": 2,
    "totalDeclaredValue": "550000.30"
  },
  "data": [
    {
      "id": "uuid",
      "typeCode": "21",
      "type": "Veículo automotor",
      "description": "Automóvel declarado",
      "value": "550000.20"
    }
  ]
}
```

Os endpoints legislativos resolvem `Candidacy → Person` e leem somente o modelo
canônico no PostgreSQL. Propostas aceitam `page`, `limit`, `type`, `year` e
`primaryAuthor`; votos aceitam `page`, `limit`, `year`, `position` e
`proposalId`; despesas aceitam `page`, `limit`, `year`, `month` e `category`.
O limite padrão é 20 e o máximo é 100. O resumo de despesas respeita os filtros
e mantém `totalNetValue` como string decimal exata.

### Extração RAW de candidatos

Para baixar o ZIP oficial de candidatos do TSE sem extrair ou transformar
seu conteúdo:

``` bash
npm run batch:candidates -- --year=2026
```

Os artefatos locais são gravados em `.data/raw/tse/<ano>/candidates/<sha256>/`
e ignorados pelo Git. `RAW_STORAGE_ROOT` altera a raiz local e
`TSE_DOWNLOAD_TIMEOUT_MS` configura o timeout HTTP.

Para parsear o artefato RAW local sem persistir ou normalizar registros:

``` bash
npm run batch:candidates:parse -- --year=2026
```

Quando houver mais de um checksum local para o ano, selecione o artefato de
forma explícita com `--checksum=<sha256>`. Se houver somente um, ele será usado
automaticamente.

Para executar parsing e normalização canônica sem persistência:

``` bash
npm run batch:candidates:normalize -- --year=2026
```

O comando usa a mesma seleção determinística de checksum do parser e informa
contagens separadas para rejeições de parsing e normalização.

Para executar o pipeline até a persistência no PostgreSQL:

``` bash
npm run batch:candidates:persist -- --year=2026
```

`CANDIDATE_PERSIST_BATCH_SIZE` limita o buffer de registros normalizados. Cada
candidato é persistido atomicamente e o EntityManager é descartado entre
transações, enquanto caches pequenos reutilizam eleições, partidos e cargos.

Para baixar e persistir os bens declarados oficiais do TSE:

``` bash
npm run batch:assets -- --year=2026
npm run batch:assets:persist -- --year=2026
```

O RAW é preservado em `.data/raw/tse/<ano>/assets/<sha256>/`. A persistência
resolve a candidatura exclusivamente por `SQ_CANDIDATO`, mantém valores como
decimais exatos e grava a evidência do artefato na mesma transação do bem.
Quando houver mais de um snapshot RAW, informe explicitamente
`--checksum=<sha256>` no comando de persistência; o pipeline completo usa o
artefato que acabou de extrair.

### Exportação dos datasets públicos

Para gerar os CSVs a partir do modelo canônico persistido no PostgreSQL:

``` bash
npm run batch:export -- --year=2026
```

O comando grava `candidates.csv`, `candidate-assets.csv` e `metadata.json` em
`.data/exports/<ano>/`. Os CSVs usam UTF-8, vírgula, cabeçalho e fim de linha
LF; valores nulos ficam vazios. O metadata registra contagem de linhas,
tamanho e checksum SHA-256. Consulte [docs/DATASETS.md](docs/DATASETS.md) para
o contrato completo das colunas e formatos.

### Pipeline eleitoral local completo

Com as dependências instaladas, prepare o banco e execute o pipeline manual:

``` bash
npm run db:up
npm run migration:up
npm run batch:run -- --year=2026
npm run api
```

Por padrão, a versão usa a data local atual. Para uma versão reprodutível,
informe-a explicitamente:

``` bash
npm run batch:run -- --year=2026 --version=2026-08-08
```

O comando baixa e preserva os RAWs oficiais, processa candidatos antes de
bens, persiste o modelo canônico e gera o snapshot em
`.data/exports/<ano>/<versão>/`. Cada tentativa cria um `BatchRun`. Uma versão
com falha pode ser repetida, mantendo o histórico; uma versão `READY` é
imutável e não é reconstruída silenciosamente. A orquestração termina em
`READY` e não publica no R2 automaticamente.

Para construir a base histórica de eleições gerais com a mesma pipeline:

``` bash
npm run batch:candidates:history -- --years=2014,2018,2022,2026
```

Também é possível executar as etapas anuais existentes com `--year=2014`,
`2018`, `2022` ou `2026`. A identidade entre eleições usa um fingerprint
interno do identificador oficial TSE e, quando ele não existe, um composto
conservador completo; o CPF bruto não é persistido nem exposto. Os bens sempre
permanecem ligados à candidatura específica pelo `SQ_CANDIDATO`.

### Publicação dos datasets

O bucket R2, suas credenciais e o domínio público devem ser provisionados pelo
operador. A aplicação não cria bucket, configura DNS ou altera a exposição
pública. Configure:

``` env
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_BASE_URL=https://data.example.com
```

`R2_ENDPOINT` pode substituir o endpoint derivado de `R2_ACCOUNT_ID`. Para
publicar artefatos já gerados, deve existir um `DatasetVersion` com a mesma
versão em estado `READY` (ou `PUBLISHED` em uma reexecução idempotente):

``` bash
npm run batch:publish -- --year=2026 --version=2026-08-08
```

Primeiro são gravados os objetos históricos imutáveis em
`datasets/<ano>/<versão>/`. Somente depois são atualizados os objetos em
`datasets/<ano>/latest/`, com `metadata.json` por último como marcador da
release. A credencial precisa apenas de leitura e escrita de objetos no bucket
configurado; permissões administrativas da conta Cloudflare não são
necessárias.

### Banco de dados local

O PostgreSQL não precisa estar instalado localmente. O desenvolvimento
local utiliza exclusivamente o container PostgreSQL definido no Docker
Compose.

``` bash
npm run db:up       # inicia o PostgreSQL e aguarda o healthcheck
npm run db:logs     # acompanha os logs do PostgreSQL
npm run db:down     # encerra o container
```

Copie `.env.example` para `.env` se precisar alterar a URL de conexão
padrão. As credenciais documentadas são exclusivas para desenvolvimento
local. Se a porta 5432 já estiver ocupada, ajuste `POSTGRES_PORT` e a
porta correspondente em `DATABASE_URL`.

As alterações de schema são realizadas por migrations versionadas:

``` bash
npm run migration:create
npm run migration:up
npm run migration:down
```

O fluxo local recomendado é:

``` bash
npm install
npm run db:up
npm run migration:up
npm run api
```

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

O recorte local de candidatos, bens e comparação do primeiro MVP está
implementado. Publicação pública, deployment, scheduling e os demais domínios
do roadmap continuam em desenvolvimento.

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

O código é distribuído sob a Apache License 2.0. Consulte [`LICENSE`](LICENSE).

Os dados provenientes de fontes governamentais permanecem sujeitos aos
termos, licenças e condições de suas respectivas fontes.
