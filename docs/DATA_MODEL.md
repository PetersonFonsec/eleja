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
  +-- Candidacy 2014 -- CandidateAsset[]
  |
  +-- Candidacy 2018 -- CandidateAsset[]
  |
  +-- Candidacy 2022 -- CandidateAsset[]
  |
  +-- Candidacy 2026 -- CandidateAsset[]
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
birthState
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

`sourceCandidateId` representa a identidade da inscrição/candidatura na fonte.
No TSE ele recebe `SQ_CANDIDATO`: esse valor liga a candidatura aos seus bens,
mas não identifica a mesma pessoa entre eleições. A identidade de `Person` e a
identidade de `Candidacy` são deliberadamente separadas.

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

Partidos são snapshots da combinação oficial `(name, acronym, number)` usada
na candidatura. Número e identificador da fonte não são globalmente únicos ao
longo da história; siglas renomeadas ou números reutilizados não sobrescrevem a
filiação registrada em outro pleito. Genealogia partidária não é inferida.

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

## 19. Histórico legislativo

A atividade legislativa pertence à `Person`, não à `Candidacy`. Uma
candidatura registra a participação em uma eleição; um mandato registra a
atuação posterior da pessoa em uma casa legislativa.

``` text
Person
 ├── Candidacy
 ├── PersonExternalIdentity
 └── LegislativeMandate

LegislativeProposal
 └── LegislativeProposalAuthor
      ├── Person
      └── LegislativeMandate?

LegislativeProposal?
 ↑
LegislativeVoting
 └── LegislativeVote
      ├── Person
      └── LegislativeMandate?
```

### PersonExternalIdentity

Associa a pessoa canônica a identificadores de sistemas públicos. A identidade
é única por `(source, externalId)`, permitindo que o mesmo valor textual exista
em fontes diferentes e que uma pessoa tenha identidades TSE, Câmara e Senado.
`verifiedAt` é opcional e não implica um workflow de verificação.

IDs de provedores não são armazenados diretamente em `Person`.

Para o TSE, `externalId` armazena somente
`cpf-sha256:<fingerprint>`, derivado com SHA-256 e separação de domínio. O CPF
bruto existe apenas no registro transitório do parser, não é persistido, não é
logado e não é exposto pela API. `SQ_CANDIDATO` não entra nessa entidade porque
identifica a candidatura do pleito, não a pessoa.

### LegislativeMandate

Representa um mandato federal na Câmara dos Deputados ou no Senado. Mantém a
pessoa, casa, legislatura, UF, fotografia da sigla partidária, período e status.
`externalMandateId` e campos ainda desconhecidos pela fonte podem permanecer
nulos. O status canônico é pequeno (`ACTIVE`, `COMPLETED`, `INTERRUPTED`,
`UNKNOWN`) e `sourceStatus` preserva o vocabulário oficial.

A sigla partidária é uma fotografia do mandato, não uma relação que implique
filiação constante durante todo o período.

Para mandatos da Câmara, que não expõe um ID estável separado do mandato, a
identidade lógica é `(person, body, legislatureNumber)`. Essa combinação é
única no banco e permite atualizar datas, situação e fotografia partidária sem
duplicar a legislatura. `externalMandateId` permanece nulo.

### LegislativeProposal e autoria

A proposta é identificada de modo idempotente por `(source, externalId)`; tipo,
número e ano servem para apresentação e busca, não como identidade global. O
tipo permanece string para acomodar vocabulários oficiais sem um enum
prematuro. `status` é nullable e flexível até que integrações reais justifiquem
um vocabulário canônico; `sourceStatus` preserva o valor oficial.

`LegislativeProposalAuthor` materializa a relação muitos-para-muitos entre
pessoas e propostas. O mandato é opcional porque a pessoa pode ser resolvida
antes do contexto exato do mandato. A relação preserva papel, indicação de
autor principal e ordem oficial quando disponíveis, e impede duplicação de uma
mesma pessoa na mesma proposta.

Na integração Câmara, propostas são identificadas por `(source, externalId)` e
autorias por `(proposal, person)`. Autores são resolvidos somente por identidade
externa oficial, nunca por nome. `proponente` determina o autor principal e a
ordem de assinatura oficial é preservada. O vínculo ao mandato é opcional e só
ocorre quando a data de apresentação pertence inequivocamente a um único
mandato da pessoa.

### LegislativeVoting e LegislativeVote

`LegislativeVoting` representa o evento oficial e é único por
`(source, externalId)`. Preserva data/hora, descrição, resultado canônico
mínimo, representação oficial e URL de origem. A referência a
`LegislativeProposal` é opcional e só é preenchida por identificador oficial
inequívoco; descrições nunca são usadas para casar propostas.

A Câmara fornece `dataHoraRegistro` sem offset. O banco usa `timestamp without
time zone` para preservar exatamente o horário civil informado, sem interpretá-lo
na timezone do processo.

`LegislativeVote` registra a posição final oficial de uma pessoa em um evento e
é único por `(voting, person)`. Posição canônica e valor oficial são preservados;
valores não reconhecidos permanecem como `OTHER`, sem conversão forçada para
sim/não. A pessoa é resolvida exclusivamente por
`PersonExternalIdentity(CAMARA)`. O mandato só é associado quando exatamente um
intervalo da Câmara contém a data da votação, e a entidade protege que mandato e
voto pertençam à mesma pessoa.

### ParliamentaryExpense

Representa um lançamento oficial da Cota para Exercício da Atividade
Parlamentar. Pertence à `Person` resolvida por identidade Câmara e pode apontar
para um `LegislativeMandate` quando exatamente um intervalo contém a data do
documento. O vínculo permanece nulo quando ausente ou ambíguo.

``` text
Person
 └── LegislativeMandate?
      └── ParliamentaryExpense
```

Valores bruto, líquido e de glosa são preservados separadamente como
`numeric(24,2)`. A identidade é única por `(source, externalId)`; para a API da
Câmara, `externalId` combina deputado, código do documento, lote, ressarcimento
e parcela, pois o código do documento pode agrupar múltiplos lançamentos.
