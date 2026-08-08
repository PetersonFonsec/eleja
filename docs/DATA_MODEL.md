# Data Model

## 1. Objetivo

Definir o modelo canônico da plataforma.

O modelo não deve ser uma cópia direta do schema do TSE. Dados de
diferentes fontes devem ser transformados para um vocabulário interno
consistente.

ORM escolhido: MikroORM.

Banco principal: PostgreSQL.

## 2. Conceito fundamental: pessoa != candidatura

Uma pessoa pode participar de diversas eleições, para cargos diferentes
e até por partidos diferentes.

Portanto:

``` text
Person
  |
  +-- Candidacy 2022
  |
  +-- Candidacy 2024
  |
  +-- Candidacy 2026
```

Não modelar a pessoa diretamente como "Candidate".

## 3. Modelo inicial

``` text
Election
    |
Candidacy ----- Person
    |
    +---------- Party
    |
    +---------- Office
    |
    +---------- CandidateAsset
    |
    +---------- CandidateContact
    |
    +---------- CandidateSource
```

## 4. Election

Representa um processo eleitoral.

Campos conceituais:

``` text
id
year
type
round
startDate
createdAt
updatedAt
```

Exemplos de tipo:

``` text
GENERAL
MUNICIPAL
```

## 5. Person

Representa uma pessoa física independentemente de uma candidatura
específica.

Campos iniciais:

``` text
id
name
birthDate
gender
education
occupation
createdAt
updatedAt
```

Campos devem ser adicionados apenas quando existirem fontes confiáveis e
necessidade de produto.

## 6. Candidacy

Representa a participação de uma pessoa em uma eleição.

Campos conceituais:

``` text
id
sourceCandidateId
ballotName
ballotNumber
state
city
photoUrl
status
sourceStatus

personId
partyId
officeId
electionId

createdAt
updatedAt
```

`sourceCandidateId` representa o identificador estável fornecido pela
fonte principal, quando disponível.

`status` representa o estado canônico mínimo da candidatura (`ACTIVE`,
`INACTIVE` ou `UNKNOWN`). `sourceStatus` preserva a descrição original da
fonte para evitar perda de informação durante a futura normalização.

Deve haver constraints suficientes para evitar duplicação durante
reprocessamentos.

## 7. Party

``` text
id
sourcePartyId
name
acronym
number
createdAt
updatedAt
```

## 8. Office

Não utilizar enum para cargos se uma tabela permitir evolução mais
simples.

``` text
id
sourceCode
code
name
scope
createdAt
updatedAt
```

Exemplos:

``` text
PRESIDENT
GOVERNOR
SENATOR
FEDERAL_DEPUTY
STATE_DEPUTY
MAYOR
CITY_COUNCILOR
```

## 9. CandidateAsset

Representa um bem declarado em uma candidatura específica.

``` text
id
candidacyId
sourceSequence
typeCode
type
description
value
createdAt
updatedAt
```

O valor total do patrimônio deve preferencialmente ser calculado, não
duplicado.

`value` utiliza `numeric(24,2)` no PostgreSQL e string decimal canônica no
TypeScript, evitando conversão por ponto flutuante. A identidade canônica é
`(candidacyId, sourceSequence)`, baseada em `NR_ORDEM_BEM_CANDIDATO` do TSE.

Cada bem possui observações `CandidateAssetSource` com URL oficial, chave RAW,
checksum SHA-256, identificador `<SQ_CANDIDATO>:<sequência>` e timestamps. A
combinação `(candidateAssetId, rawChecksum, sourceIdentifier)` evita duplicação
do mesmo snapshot e preserva evidência de snapshots oficiais diferentes.

## 10. CandidateContact

Somente contatos públicos/profissionais.

``` text
id
candidacyId
type
value
sourceUrl
verifiedAt
createdAt
updatedAt
```

Tipos possíveis:

``` text
EMAIL
WEBSITE
INSTAGRAM
FACEBOOK
X
YOUTUBE
WHATSAPP
OTHER
```

Não coletar deliberadamente telefones privados, e-mails pessoais não
publicados como contato público ou outros dados de contato não
destinados à comunicação pública.

## 11. CandidateSource

Representa a procedência de informações relacionadas à candidatura.

``` text
id
candidacyId
type
name
sourceIdentifier
sourceUrl
rawStorageKey
rawChecksum
importedAt
lastCheckedAt
createdAt
updatedAt
```

Tipos possíveis:

``` text
TSE
GOVERNMENT
PARTY
CANDIDATE_WEBSITE
SOCIAL_NETWORK
OTHER
```

Cada candidatura pode ter várias observações de origem. A combinação
`(candidacyId, type, rawChecksum, sourceIdentifier)` é única: reprocessar o
mesmo snapshot reutiliza a evidência existente, enquanto um novo checksum cria
um registro histórico. `rawStorageKey` é sempre uma chave relativa de storage.

Registros canônicos e evidências de origem são armazenados separadamente. A
persistência de ambos ocorre na mesma transação para impedir candidaturas sem a
proveniência correspondente.

## 12. DatasetVersion

Controla publicações do pipeline.

``` text
id
version
status
startedAt
finishedAt
publishedAt
sourceUpdatedAt
createdAt
```

Exemplo de `version`:

``` text
2026-08-08
```

Status:

``` text
PROCESSING
READY
PUBLISHED
FAILED
```

Pode conter contadores:

``` text
recordsRead
recordsInserted
recordsUpdated
recordsRejected
```

ou esses contadores podem ficar em `BatchRun`, caso seja necessária
granularidade por execução/fonte.

## 13. BatchRun

Registra a execução técnica de um job.

``` text
id
datasetVersionId
source
status
startedAt
finishedAt

recordsRead
recordsInserted
recordsUpdated
recordsRejected

errorMessage
createdAt
```

Status sugeridos:

``` text
RUNNING
SUCCESS
PARTIAL
FAILED
```

## 14. Entidades futuras

Não precisam ser implementadas no primeiro momento, mas o domínio deve
permitir evolução para:

``` text
ProposalDocument
Proposal
ProposalCategory

Campaign
CampaignRevenue
CampaignExpense

PoliticalQuestion
CandidatePosition
```

## 15. Propostas

Modelo conceitual futuro:

``` text
Candidacy
   |
ProposalDocument
   |
Proposal
   |
ProposalCategory
```

Cada proposta extraída por IA deve manter:

-   documento de origem;
-   página ou localização quando disponível;
-   trecho de evidência;
-   indicação de conteúdo gerado/interpretado por IA.

## 16. Campanha financeira

Modelo conceitual futuro:

``` text
Candidacy
   |
Campaign
   |
   +-- CampaignRevenue
   |
   +-- CampaignExpense
```

Valores monetários devem utilizar tipos decimais adequados no
PostgreSQL.

## 17. Match eleitoral

Não criar `UserAnswer`.

As perguntas e posições dos candidatos podem ser persistidas:

``` text
PoliticalQuestion
PoliticalQuestionOption
CandidatePosition
```

As respostas do visitante devem permanecer no cliente ou somente durante
o processamento da requisição.

## 18. Entidades proibidas no escopo atual

Não criar:

``` text
User
Account
Session
Password
UserPreference
UserPoliticalProfile
UserAnswer
FavoriteCandidate
```

Qualquer mudança dessa regra exige decisão explícita de produto e
arquitetura.
