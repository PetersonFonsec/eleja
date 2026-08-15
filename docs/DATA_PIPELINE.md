# Data Pipeline

## 1. Objetivo

Extrair dados de fontes públicas, preservar os dados originais,
transformar para o modelo canônico, validar, persistir e publicar
datasets reutilizáveis.

Frequência inicial: uma execução por dia.

Não existe requisito de tempo real.

## 2. Pipeline

``` text
Extract
   |
   v
Raw Storage
   |
   v
Parse
   |
   v
Normalize
   |
   v
Validate
   |
   v
Persist
   |
   v
Export
   |
   v
Publish
```

O fluxo local completo atualmente executável é:

``` text
Datasets oficiais do TSE
        |
        v
      Extract
        |
        v
 RAW local content-addressed
        |
        v
 Parse -> Normalize -> Persist (streaming)
        |
        v
    PostgreSQL
        |
        v
      Export
        |
        v
Dataset CSV local versionado
```

Ele é iniciado manualmente com
`npm run batch:run -- --year=2026 [--version=YYYY-MM-DD]`. A execução local
não agenda jobs e não publica objetos remotos; essas etapas permanecem comandos
independentes.

O histórico geral verificado pode ser executado sequencialmente com
`npm run batch:candidates:history -- --years=2014,2018,2022,2026`. Cada ano
reutiliza a mesma pipeline, mantém RAW, `DatasetVersion` e `BatchRun` próprios e
produz estatísticas cruzadas somente de contagem, sem calcular evolução de
patrimônio.

## 3. Extract

Responsável apenas por obter o conteúdo original.

Exemplos:

-   CSV;
-   ZIP;
-   JSON;
-   documentos.

Regras:

-   não modificar o conteúdo durante a extração;
-   registrar a origem;
-   tratar falhas de rede;
-   preservar nomes/metadados úteis;
-   evitar download duplicado quando a execução for retomada, quando
    possível.

## 4. Raw Storage

O arquivo original deve ser preservado antes da transformação.

Preferência inicial: Cloudflare R2.

Durante o desenvolvimento, a implementação local usa o filesystem por meio da
mesma abstração de Raw Storage. Artefatos de candidatos são identificados pelo
SHA-256 dos bytes recebidos e armazenados sem alteração em:

``` text
tse/<ano>/candidates/<sha256>/<nome-original>
```

Essa chave torna a extração idempotente para um conteúdo inalterado e preserva
uma versão histórica diferente quando a fonte oficial muda.

Em execução persistente, `RAW_STORAGE_DRIVER=r2` usa o Cloudflare R2 pela API
compatível com S3; `filesystem` continua sendo o padrão local. O download
oficial é transmitido para um arquivo temporário enquanto o SHA-256 é
calculado. Depois, esse arquivo é enviado por stream à chave final abaixo e o
temporário é removido. Assim, a chave deriva dos bytes originais sem manter o
ZIP inteiro em memória. Um objeto já existente é reutilizado via HEAD, sem
novo upload.

As chaves lógicas, iguais nos dois backends, são:

``` text
tse/<ano>/candidates/<sha256>/consulta_cand_<ano>.zip
tse/<ano>/assets/<sha256>/bem_candidato_<ano>.zip
```

O mesmo mecanismo atende bens declarados em:

``` text
tse/<ano>/assets/<sha256>/bem_candidato_<ano>.zip
```

Exemplo:

``` text
raw/
  tse/
    2026/
      2026-08-08/
        candidates.zip
        assets.zip
```

Benefícios:

-   reprocessamento;
-   auditoria;
-   debugging;
-   independência temporária da fonte;
-   reprodução de datasets antigos.

## 5. Parse

Converte o formato físico para estruturas manipuláveis pelo pipeline.

Exemplo:

``` text
NM_CANDIDATO
SG_PARTIDO
DS_CARGO
```

ainda permanecem conceitos da fonte nesta etapa.

O parser não deve introduzir interpretação de domínio desnecessária.

O parser de candidatos do TSE mantém a fronteira:

``` text
RAW ZIP
   |
   v
TSE Candidate Parser
   |
   +-- TseCandidateRecord
   +-- TseCandidateParseIssue
```

Ele seleciona explicitamente o CSV consolidado
`consulta_cand_<ano>_BRASIL.csv`, decodifica o conteúdo ISO-8859-1 e processa
as linhas incrementalmente com delimitador `;`. Nomes de colunas como
`SQ_CANDIDATO` e `NM_CANDIDATO` permanecem restritos à camada source/parser e
não são introduzidos no modelo canônico.

Em 14 de agosto de 2026 foram inspecionados os ZIPs oficiais nacionais de 2014,
2018, 2022 e 2026. As versões então publicadas usam o mesmo layout consolidado,
ISO-8859-1 e incluem `NR_CPF_CANDIDATO`, `NR_TITULO_ELEITORAL_CANDIDATO`,
`SG_UF_NASCIMENTO`, `DT_NASCIMENTO`, `CD_GENERO`, nomes e `SQ_CANDIDATO`.
`NM_MUNICIPIO_NASCIMENTO` não está presente. Os quatro ZIPs de bens usam também
o mesmo layout. Em 2014 foram observados 28 registros sem CPF utilizável; nos
outros três anos da amostra o campo estava preenchido.

Na comparação oficial, milhares de CPFs reaparecem entre pleitos, enquanto
nenhum `SQ_CANDIDATO` compartilhado manteve o mesmo valor entre 2014–2018,
2018–2022 ou 2022–2026. Portanto, `SQ_CANDIDATO` é usado exclusivamente como
identidade da candidatura/inscrição e para relacionar bens.

O pipeline de bens usa o ZIP oficial `bem_candidato_<ano>.zip`, seleciona
explicitamente `bem_candidato_<ano>_BRASIL.csv`, decodifica ISO-8859-1 e lê CSV
incremental com delimitador `;`. `SQ_CANDIDATO` relaciona cada linha à
candidatura e `NR_ORDEM_BEM_CANDIDATO` identifica o bem dentro dela.
Essas características foram verificadas em 8 de agosto de 2026 no recurso
"Bens de candidatos" do conjunto oficial "Candidatos - 2026" do Portal de
Dados Abertos do TSE.

## 6. Normalize

Transforma o vocabulário da fonte para o modelo canônico.

Exemplo:

``` text
DS_CARGO = "PRESIDENTE"
```

vira:

``` text
office.code = "PRESIDENT"
```

Quando a transformação puder perder contexto, manter o valor original.

Exemplo:

``` text
normalizedCategory = ADVERTISING
sourceCategory = "Publicidade por materiais impressos"
```

Para candidatos do TSE, a fronteira implementada é:

``` text
TseCandidateRecord
   |
   v
TSE Candidate Normalizer
   |
   +-- NormalizedCandidateData
   +-- CandidateNormalizationIssue
```

O normalizador produz estruturas canônicas para eleição, partido, cargo,
pessoa e candidatura, mas não cria entidades nem acessa o PostgreSQL. O
vocabulário específico da fonte termina nessa fronteira: dados canônicos da
Eleja não expõem nomes de colunas do TSE.

## 7. Validate

Nenhum dataset deve ser publicado sem validação.

Validações possíveis:

-   campos obrigatórios;
-   IDs duplicados;
-   valores monetários inválidos;
-   referências inexistentes;
-   quantidade inesperadamente baixa de registros;
-   campos fora dos domínios conhecidos;
-   inconsistência entre relações.

As validações devem diferenciar:

### Erro fatal

Impede publicação.

### Registro rejeitado

Um registro específico não pode ser importado, mas o dataset ainda pode
ser válido dependendo da regra.

### Warning

Situação inesperada que deve ser registrada, mas não necessariamente
bloqueia publicação.

## 8. Persist

Persistência no PostgreSQL utilizando MikroORM.

Requisitos:

-   idempotência;
-   transações quando apropriado;
-   constraints no banco;
-   uso de identificadores externos estáveis;
-   evitar duplicação em reprocessamento.

Rodar o mesmo dataset novamente não deve criar uma segunda cópia dos
mesmos registros.

Para candidatos, `CandidatePersistenceService` consome somente
`NormalizedCandidateData`. Ele resolve eleição por `(year, type, round)`,
partido pelo snapshot oficial exato de nome/sigla/número,
cargo pelo código canônico e candidatura por `sourceCandidateId`.

`NR_CPF_CANDIDATO` é convertido imediatamente em um fingerprint SHA-256 com
separação de domínio; o valor bruto não sai da camada source. A resolução segue:

``` text
PersonExternalIdentity(TSE, cpf-sha256)
        ↓ ausente
nome NFKC/caixa/espaços exato + nascimento + UF de nascimento + gênero
        ↓ zero candidatos             ↓ múltiplos candidatos
nova Person                           AMBIGUOUS / REJECTED
```

Nome sozinho, nome de urna, partido, cargo e UF eleitoral nunca provam
identidade. Acentos não são removidos e não há fuzzy matching. Quando um banco
legado contém duas pessoas e o identificador estável prova a duplicidade, a
consolidação move candidaturas, identidades externas e todas as relações
legislativas na mesma transação. Qualquer conflito de unicidade cancela a
operação; não existe merge amplo ou probabilístico.

O índice `(birthDate, birthState, gender)` limita a busca composta. A identidade
TSE exata usa o índice único existente em `(source, externalId)`.

``` text
NormalizedCandidateData
   |
   v
resolve Election / Party / Office / Person
   |
   v
insert or update Candidacy
   +-- canonical domain data
   +-- CandidateSource provenance
   |
   v
PostgreSQL
```

O contexto da importação transporta a URL oficial, a chave relativa do artefato
RAW, seu checksum SHA-256 e o instante da importação até a persistência, sem
adicionar esses campos ao modelo canônico normalizado. Registros canônicos e
evidências de origem são armazenados separadamente, mas na mesma transação.

``` text
Official TSE asset ZIP
   |
   v
RAW -> Parse -> Normalize
   |
   v
resolve Candidacy by SQ_CANDIDATO
   |
   v
CandidateAsset + CandidateAssetSource
```

`VR_BEM_CANDIDATO` é convertido explicitamente do formato brasileiro para uma
string decimal e persistido como `numeric(24,2)`. O bem canônico é reutilizado
por `(candidacyId, sourceSequence)`; alterações atualizam o registro, enquanto
checksums RAW diferentes criam novas observações de proveniência.

## 8.1 Correspondência de identidades da Câmara

O comando manual
`npm run batch:camara:match-deputies -- --year=2026` associa pessoas já
importadas a identificadores oficiais da Câmara dos Deputados:

``` text
Câmara Dados Abertos
       ↓
Deputy Source Adapter
       ↓
Identity Matcher
       ↓
PersonExternalIdentity(CAMARA)
       ↓
Person
```

Foram verificados em 10 de agosto de 2026 os contratos oficiais
`GET /api/v2/deputados` e `GET /api/v2/deputados/{id}`. A listagem aceita
intervalo temporal, usa páginas de no máximo 100 itens e indica a próxima página
em `links[rel=next]`. Como ela pode repetir um parlamentar após mudanças de
partido ou situação, os IDs são deduplicados antes de buscar cada cadastro
detalhado. O detalhe fornece `nomeCivil`, `dataNascimento` e o último status com
nome parlamentar, UF, partido e foto. O identificador e a URI oficiais da
listagem são preservados na identidade externa.

O matching de identidade é conservador e prioriza precisão sobre recall. Uma
correspondência exige simultaneamente nome civil exato após normalização Unicode,
de caixa e espaços, e data de nascimento exata. Nome sozinho nunca basta. UF,
nome parlamentar e partido são somente evidências auxiliares; partido divergente
não rejeita uma identidade, pois filiações mudam. Mais de um resultado forte é
`AMBIGUOUS`, ausência de resultado é `NOT_FOUND`, e nenhum dos dois é persistido.

O adaptador percorre a fonte uma vez por execução, monta um índice em memória e
não consulta a Câmara para cada pessoa Eleja. O recorte padrão começa em
`1987-02-01`, cobrindo as legislaturas do período constitucional contemporâneo;
as variáveis `CAMARA_DEPUTIES_START_DATE` e `CAMARA_DEPUTIES_END_DATE` permitem
ampliá-lo sem alterar código. A integração não cria mandatos: esse estágio se
encerra em `PersonExternalIdentity`.

## 8.2 Importação de mandatos da Câmara

O comando `npm run batch:camara:mandates -- --year=2026` atualiza o histórico
de mandatos somente para pessoas da população eleitoral solicitada que já têm
uma `PersonExternalIdentity(CAMARA)`:

``` text
PersonExternalIdentity(CAMARA)
        ↓
Câmara Mandate Source
        ↓
CamaraMandateNormalizer
        ↓
LegislativeMandate
```

Foram verificados em 10 de agosto de 2026 os endpoints oficiais
`GET /api/v2/deputados/{id}/historico` e `GET /api/v2/legislaturas/{id}`. O
primeiro retorna mudanças de situação com legislatura, UF, partido, instante e
vocabulário oficial; o segundo fornece os limites de calendário da legislatura.
A fonte não fornece um identificador estável separado para o mandato, portanto
`externalMandateId` permanece nulo.

A identidade lógica e idempotente é
`(person, body, legislatureNumber)`, protegida por constraint no PostgreSQL.
Uma correção da fonte atualiza a mesma linha; legislaturas diferentes permanecem
separadas. O início é a primeira entrada oficial em `Exercício`. O fim vem de um
evento terminal/interrupção ou do encerramento oficial de uma legislatura já
concluída. Inconsistências temporais e UFs inválidas são rejeitadas.

O status usa mapeamento explícito das situações oficiais. `Exercício` é ativo;
`Fim de Mandato` e `Vacância` são concluídos; afastamento, convocação, licença,
suplência e suspensão são interrupções. Valores novos permanecem preservados em
`sourceStatus` e são normalizados como `UNKNOWN`.

Uma linha canônica representa a participação na legislatura. Caso existam
múltiplas mudanças partidárias, `partyAcronym` guarda a sigla mais recente como
snapshot, sem implicar filiação durante todo o período. Intervalos detalhados de
filiação ou afastamento permanecem uma evolução futura. A fonte mantém cache em
memória das legislaturas e cada deputado vinculado é consultado uma vez por
execução.

## 8.3 Importação de proposições da Câmara

O comando `npm run batch:camara:proposals -- --year=2026` importa proposições
associadas às pessoas da população eleitoral que já possuem identidade Câmara:

``` text
PersonExternalIdentity(CAMARA)
        ↓
Câmara Proposal Source
        ↓
CamaraProposalNormalizer
        ↓
LegislativeProposal
        ↓
LegislativeProposalAuthor
```

Foram verificados em 10 de agosto de 2026 os endpoints oficiais
`GET /api/v2/proposicoes?idDeputadoAutor=...`,
`GET /api/v2/proposicoes/{id}` e
`GET /api/v2/proposicoes/{id}/autores`. A listagem é percorrida pelos links
`next` com páginas de até 100 itens. Detalhes e autores são armazenados em cache
durante a execução para que uma proposição compartilhada por várias pessoas seja
consultada uma só vez.

A identidade canônica da proposição é `(source, externalId)`. A ementa oficial
é armazenada em `summary`; nenhum título é fabricado. O estado processual
permanece em `sourceStatus`, sem uma normalização prematura. Tipo, número, ano,
data de apresentação e URL oficial são validados deterministicamente.

Autores são resolvidos exclusivamente pelo ID presente na URI oficial de
deputado e por `PersonExternalIdentity(CAMARA)`. Nomes nunca participam dessa
resolução e autores não mapeados não criam pessoas. Todos os signatários
resolvidos usam papel `AUTHOR`; `proponente = 1` define `isPrimaryAuthor`, e
`ordemAssinatura` é preservada como ordem da fonte.

A autoria é única por `(proposal, person)`. Quando a data oficial de apresentação
está contida em exatamente um mandato da mesma pessoa na Câmara, esse mandato é
associado. Nenhum vínculo é criado quando zero ou vários mandatos satisfazem o
intervalo.

## 8.4 Importação de votações da Câmara

O comando `npm run batch:camara:votes -- --year=2026` usa o ano apenas para
selecionar pessoas candidatas já ligadas à Câmara:

``` text
PersonExternalIdentity(CAMARA)
        ↓
LegislativeMandate
        ↓
Câmara Voting Source
        ↓
CamaraVotingNormalizer
        ↓
LegislativeVoting
        ↓
resolução exclusiva por ID CAMARA
        ↓
LegislativeVote
```

Foram verificados em 10 de agosto de 2026 os endpoints oficiais
`GET /api/v2/votacoes?dataInicio=...&dataFim=...`,
`GET /api/v2/votacoes/{id}` e `GET /api/v2/votacoes/{id}/votos`. A listagem
aceita intervalos dentro do mesmo ano, pagina em até 100 itens e não oferece
filtro por deputado ou legislatura. Por isso, os intervalos conhecidos dos
mandatos são unidos por ano, cada evento é buscado uma vez e seus votos são
filtrados localmente pelas identidades Eleja. Requisições de votos têm cache na
execução e não há concorrência ilimitada.

O contrato verificado fornece `id`, `uri`, `dataHoraRegistro`, `descricao`,
`aprovacao` e, quando inequívoca, `uriProposicaoObjeto`. Votos fornecem
`deputado_.id`, `tipoVoto` e `dataRegistroVoto`; ausentes não são listados. A
amostra nominal verificada retornou um registro por deputado, e a documentação
não define registros históricos de alterações. Defensivamente, se houver mais
de um registro para o mesmo ID, o importador seleciona o de maior
`dataRegistroVoto` como estado final e persiste uma linha por `(voting, person)`.
Não infere ausência e não cria pessoas para IDs não mapeados. Referências
ambíguas de `objetosPossiveis` não são convertidas em um vínculo de proposta.

## 8.5 Importação de despesas parlamentares da Câmara

``` text
PersonExternalIdentity(CAMARA)
        ↓
LegislativeMandate
        ↓
Câmara Expense Source
        ↓
CamaraParliamentaryExpenseNormalizer
        ↓
ParliamentaryExpense
```

O comando `npm run batch:camara:expenses -- --year=2026` consulta
`GET /api/v2/deputados/{id}/despesas`, paginado em até 100 itens, uma vez por
combinação distinta de deputado, legislatura e ano coberto por mandato. Foram
verificados os filtros `idLegislatura` e `ano` e os campos `codDocumento`,
`codLote`, `numRessarcimento`, `parcela`, categoria, fornecedor, documento,
data, valores bruto/glosa/líquido e URL oficial.

A Câmara documenta que `codDocumento` pode agrupar múltiplos lançamentos. A
chave canônica combina deputado, documento, lote, ressarcimento e parcela. Os
valores monetários são capturados do JSON como lexemas decimais, normalizados
sem aritmética binária e persistidos como `numeric(24,2)`. Pessoa é resolvida
exclusivamente por identidade `CAMARA`; o mandato é opcional e nunca inferido
por nome.

## 9. Export

Após persistência e validação, o exportador lê exclusivamente o modelo
canônico no PostgreSQL e gera datasets públicos. Ele não consulta arquivos RAW
nem fontes externas.

O comando inicial é:

``` bash
npm run batch:export -- --year=2026
```

e produz localmente:

``` text
candidates.csv
candidate-assets.csv
metadata.json
```

Na orquestração completa, esses arquivos ficam em
`.data/exports/<ano>/<versão>/` e o manifesto inclui `version` e
`status: READY`. O export isolado mantém `.data/exports/<ano>/` para
compatibilidade.

As consultas usam lotes limitados e ordenação explícita. Cada CSV é escrito em
arquivo temporário e renomeado somente depois da conclusão, evitando que um
arquivo parcial pareça completo. O resultado inclui quantidade de registros,
tamanho e checksum SHA-256. Repetir o export sobre o mesmo estado canônico
produz os mesmos bytes e checksums dos CSVs.

O contrato de colunas, formatos, relacionamentos e proteção contra fórmulas de
planilha está documentado em [DATASETS.md](DATASETS.md).

Futuramente:

``` text
proposals.csv
campaign-revenues.csv
campaign-expenses.csv
```

Pode existir:

``` text
full-dataset.zip
```

## 10. Publish

A publicação é a última etapa.

``` text
PostgreSQL
    |
    v
CSV Export local
    |
    v
Objetos versionados no R2
    |
    v
Alias latest
    |
    v
Internet pública
```

O dataset somente se torna o `latest` depois que:

-   extração terminou;
-   normalização terminou;
-   validação passou;
-   persistência terminou;
-   CSVs foram gerados;
-   arquivos foram enviados com sucesso.

Fluxo:

``` text
Dataset 2026-08-09
PROCESSING
    |
    v
READY
    |
    v
PUBLISHED
```

Se ocorrer erro:

``` text
Dataset 2026-08-09
FAILED

Dataset 2026-08-08
continua PUBLISHED
```

## 11. Publicação no R2

Estrutura sugerida:

``` text
datasets/
  2026/
    latest/
      candidates.csv
      candidate-assets.csv
      metadata.json

    2026-08-08/
      candidates.csv
      candidate-assets.csv
      metadata.json
```

Caminhos versionados são imutáveis. Uma reexecução aceita objetos com a mesma
identidade de release, mas rejeita checksums diferentes para a mesma versão.
Todos os objetos históricos são enviados e verificados antes de qualquer
alteração em `latest`. Em seguida, os CSVs de `latest` são atualizados e seu
`metadata.json` é gravado por último como marcador da release completa.

Objetos versionados usam cache anual com `immutable`; objetos de `latest` usam
cache público de cinco minutos. CSVs são publicados como
`text/csv; charset=utf-8` e download por attachment; manifests usam
`application/json; charset=utf-8`.

Somente após a publicação completa o `DatasetVersion` em estado `READY` muda
para `PUBLISHED` e recebe `publishedAt`. Releases históricas continuam
`PUBLISHED`; o caminho `latest` representa qual delas está ativa.

Downloads devem ser servidos diretamente pelo object storage/CDN, não
pela API NestJS.

## 12. BatchRun

Cada execução deve produzir observabilidade mínima.

Registrar:

``` text
source
start
finish
status
recordsRead
recordsInserted
recordsUpdated
recordsRejected
error
```

Isso evita falhas silenciosas.

## 13. Scheduling

Inicialmente executar uma vez por dia.

O scheduler é infraestrutura, não domínio.

O batch deve poder ser iniciado por:

``` text
npm run batch
```

ou comando equivalente.

Isso permite utilizar:

-   GitHub Actions;
-   Lambda;
-   container job;
-   cron tradicional.

## 14. Estratégia inicial de execução

Preferência:

``` text
GitHub Actions
      |
      v
Daily Batch
      |
 +----+----+
 |         |
 v         v
Postgres   R2
```

Se limites ou duração deixarem de ser adequados:

``` text
GitHub Actions
      |
      v
Lambda / Serverless Container
```

sem reescrever o pipeline.

## 15. Tratamento de falhas

O batch deve:

-   falhar explicitamente;
-   registrar o estágio que falhou;
-   nunca apagar o dataset publicado antes de terminar o próximo;
-   permitir reexecução;
-   evitar duplicações;
-   não publicar resultados parciais como `latest`.

## 16. Testes

Manter fixtures reais e pequenas das fontes.

Exemplo:

``` text
fixtures/
  tse/
    candidates-sample.csv
    assets-sample.csv
```

Testar isoladamente:

-   parser;
-   normalizer;
-   validator;
-   persistence;
-   exporter.

Evitar testes que dependam do TSE estar disponível em tempo real.

## 17. Rastreabilidade

Um dado público deve permitir responder:

``` text
Qual fonte originou este dado?
Qual versão do dataset o publicou?
Quando ele foi processado?
Qual era o valor original quando houve normalização?
```

Essa é uma propriedade central do pipeline, não uma funcionalidade
opcional.
