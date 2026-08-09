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
partido pelo identificador de fonte com fallback exato para número/sigla,
cargo pelo código canônico e candidatura por `sourceCandidateId`.

Como o TSE não fornece no arquivo atual um identificador estável de pessoa
separado da candidatura, pessoas só são reutilizadas entre candidaturas quando
nome canônico e data de nascimento coincidem exatamente, o gênero não é
conflitante e não existe outra candidatura dessa pessoa na mesma eleição. Nome
sozinho nunca é usado. Sem data de nascimento, ou quando já existe uma
candidatura no mesmo pleito, uma nova pessoa é criada; uma reexecução da mesma
candidatura reutiliza a pessoa já relacionada. Essa escolha prioriza evitar
falsos merges e foi confirmada por uma colisão real de nome e nascimento no
dataset de 2026.

O banco mantém apenas um índice não exclusivo em `(name, birthDate)` para
acelerar essa busca; não existe constraint de unicidade sobre identidade
composta.

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
      assets.csv
      full-dataset.zip

    2026-08-08/
      candidates.csv
      assets.csv
      full-dataset.zip
```

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
