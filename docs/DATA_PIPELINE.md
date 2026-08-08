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

## 9. Export

Após persistência e validação, gerar datasets públicos.

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
