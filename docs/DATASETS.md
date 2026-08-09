# Public Datasets

## Geração local

``` bash
npm run batch:export -- --year=2026
```

Os arquivos são gerados em `.data/exports/<ano>/`. A exportação consulta
somente o modelo canônico persistido no PostgreSQL.

O pipeline completo gera snapshots versionados em
`.data/exports/<ano>/<versão>/`. Nesse fluxo, `metadata.json` inclui a versão e
`status: READY`; o arquivo só é escrito após os CSVs e suas contagens terem
sido validados contra o PostgreSQL.

## Formato comum

- codificação UTF-8;
- delimitador vírgula;
- primeira linha com cabeçalho;
- fim de linha LF;
- campos com vírgula, aspas ou quebras de linha seguem o escaping CSV;
- valores nulos são representados por campo vazio;
- datas usam `YYYY-MM-DD`;
- valores monetários são strings decimais exatas, sem conversão para ponto
  flutuante.

Campos textuais iniciados por `=`, `+`, `-` ou `@` recebem um apóstrofo antes
do valor. Essa proteção evita que programas de planilha interpretem dados
públicos como fórmulas.

## `candidates.csv`

Uma linha por candidatura da eleição selecionada, com ordenação determinística
por ano, código do cargo, UF, número de urna e identificador da candidatura.

| Coluna | Descrição |
| --- | --- |
| `candidate_id` | UUID canônico da candidatura |
| `source_candidate_id` | Identificador da candidatura na fonte oficial |
| `election_year` | Ano da eleição |
| `election_type` | Tipo canônico da eleição |
| `election_round` | Turno da eleição |
| `name` | Nome civil da pessoa |
| `ballot_name` | Nome usado na urna |
| `ballot_number` | Número usado na urna |
| `status` | Situação canônica da candidatura |
| `source_status` | Situação original informada pela fonte |
| `state` | Unidade federativa eleitoral |
| `city` | Município eleitoral, quando aplicável |
| `party_name` | Nome do partido |
| `party_acronym` | Sigla do partido |
| `party_number` | Número do partido |
| `office_code` | Código canônico do cargo |
| `office_name` | Nome do cargo |
| `office_scope` | Abrangência canônica do cargo |
| `birth_date` | Data de nascimento |
| `gender` | Gênero informado pela fonte |
| `education` | Escolaridade informada pela fonte |
| `occupation` | Ocupação informada pela fonte |
| `photo_url` | URL pública da foto, quando disponível |

## `candidate-assets.csv`

Uma linha por bem declarado por uma candidatura da eleição selecionada. A
ordenação é por candidatura, sequência do bem na fonte e identificador do bem.

| Coluna | Descrição |
| --- | --- |
| `asset_id` | UUID canônico do bem |
| `candidate_id` | UUID da candidatura em `candidates.csv` |
| `source_sequence` | Sequência do bem na fonte oficial |
| `asset_type_code` | Código do tipo informado pela fonte |
| `asset_type` | Tipo do bem informado pela fonte |
| `description` | Descrição pública do bem |
| `declared_value` | Valor declarado como decimal exato |

`candidate_id` é a chave de relacionamento entre os dois arquivos.

## `metadata.json`

Registra o ano, instante de geração e, para cada CSV, nome lógico, nome do
arquivo, quantidade de linhas de dados, tamanho em bytes e checksum SHA-256.
Caminhos absolutos locais não são incluídos.

Na publicação, o manifesto também recebe `version` e `publishedAt`. Esses
campos são adicionados ao objeto publicado sem inserir caminhos locais.

## Caminhos públicos

O domínio é definido por `R2_PUBLIC_BASE_URL`. Os caminhos estáveis da versão
atual são:

``` text
/datasets/2026/latest/candidates.csv
/datasets/2026/latest/candidate-assets.csv
/datasets/2026/latest/metadata.json
```

Cada release também permanece disponível em um caminho histórico imutável:

``` text
/datasets/2026/<version>/candidates.csv
/datasets/2026/<version>/candidate-assets.csv
/datasets/2026/<version>/metadata.json
```

`latest/metadata.json` é o marcador da release atual e só é atualizado após a
publicação completa dos objetos versionados e dos CSVs em `latest`.
