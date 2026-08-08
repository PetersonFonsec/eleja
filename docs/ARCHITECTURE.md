# Architecture

## 1. Objetivo

Manter uma arquitetura simples, barata, auditável e predominantemente
read-only.

A complexidade de integração com fontes externas deve ficar concentrada
no processo batch. A API pública apenas disponibiliza dados previamente
processados e publicados.

## 2. Stack

### Backend/API

-   TypeScript
-   NestJS
-   MikroORM
-   PostgreSQL
-   REST

### Batch

-   TypeScript
-   NestJS ou aplicação Node compatível com os módulos compartilhados
-   MikroORM
-   PostgreSQL

### Frontend

-   Angular

### Object Storage

Preferência inicial:

-   Cloudflare R2

Usos:

-   arquivos RAW;
-   datasets CSV;
-   snapshots históricos.

### Execução do batch

O batch deve ser independente do provedor.

Possíveis executores:

-   GitHub Actions inicialmente;
-   AWS Lambda caso o workload seja compatível;
-   container/job serverless caso o processamento fique pesado.

A lógica de domínio não deve depender de APIs específicas do executor.

## 3. Visão geral

``` text
             Fontes oficiais
                   |
                   v
             Daily Batch
                   |
        +----------+----------+
        |                     |
        v                     v
   Raw Storage           Normalize
       R2                    |
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
                Angular                  R2
```

## 4. Componentes

### Batch

Único componente autorizado a acessar fontes eleitorais externas para
ingestão.

Responsabilidades:

1.  extrair;
2.  armazenar RAW;
3.  parsear;
4.  normalizar;
5.  validar;
6.  persistir;
7.  gerar datasets;
8.  publicar.

### PostgreSQL

Armazena o modelo canônico utilizado pela API.

O banco não deve refletir diretamente nomes ou estruturas específicas
dos arquivos do TSE.

### REST API

API simples e predominantemente read-only.

Responsabilidades:

-   consultar PostgreSQL;
-   aplicar paginação e filtros;
-   disponibilizar representações públicas;
-   informar versão/data do dataset quando necessário.

Não é responsabilidade da API:

-   consultar o TSE;
-   executar ETL;
-   gerar datasets sob demanda;
-   autenticar visitantes;
-   persistir preferências políticas.

### Angular

Consome exclusivamente a API pública e, quando necessário, links
públicos dos datasets.

### Cloudflare R2

Armazena objetos que não precisam ficar no banco relacional.

Estrutura conceitual:

``` text
raw/
  tse/
    2026/
      2026-08-08/
      2026-08-09/

datasets/
  2026/
    latest/
    2026-08-08/
    2026-08-09/
```

## 5. Organização sugerida do repositório

``` text
/
├── AGENTS.md
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

A estrutura exata pode ser adaptada ao tooling escolhido, desde que as
fronteiras entre API, batch e domínio permaneçam claras.

## 6. Regras arquiteturais

### AR-001 - API não acessa fontes eleitorais

A API nunca consulta TSE ou outra fonte eleitoral para responder
requests.

### AR-002 - Batch é responsável pela ingestão

Somente o pipeline de dados executa extração, normalização e publicação.

### AR-003 - Atualização diária

O requisito inicial é uma execução do batch por dia.

Dados em tempo real não são requisito.

### AR-004 - Último dataset válido permanece disponível

Uma execução com falha nunca deve remover ou invalidar o último dataset
publicado com sucesso.

### AR-005 - Idempotência

Executar novamente o mesmo processamento sobre a mesma fonte não pode
produzir duplicações.

### AR-006 - Rastreabilidade

Dados normalizados devem manter identificadores e informações
suficientes para apontar para sua origem.

### AR-007 - Sem autenticação

Não implementar autenticação ou identificação de visitantes sem uma nova
decisão arquitetural explícita.

### AR-008 - Sem dados políticos individuais

Não persistir respostas, preferências ou perfis políticos de visitantes.

### AR-009 - Infraestrutura mínima

Não adicionar Kafka, RabbitMQ, streaming, microservices ou mecanismos
similares sem necessidade comprovada.

### AR-010 - Compute desacoplado

O batch deve poder ser chamado por CLI, GitHub Actions, Lambda ou
container sem reescrever sua lógica de negócio.

## 7. Dataset versioning

Cada publicação diária deve ser identificável.

Exemplo:

``` text
2026-08-08
2026-08-09
2026-08-10
```

Estados sugeridos:

``` text
PROCESSING
READY
PUBLISHED
FAILED
```

Somente datasets validados e completamente gerados podem ser publicados.

## 8. Estratégia de custo

Objetivo: manter o custo inicial próximo de zero.

Preferências:

-   batch efêmero;
-   GitHub Actions enquanto adequado;
-   Cloudflare R2 para datasets públicos e RAW;
-   banco PostgreSQL em plano de baixo custo/free tier quando possível;
-   arquivos grandes servidos diretamente pelo object storage, nunca
    pela API NestJS.
