# Product

## 1. Visão do produto

Plataforma brasileira de informação e transparência eleitoral que
transforma dados públicos e oficiais em informações simples de
consultar, comparar e reutilizar.

O produto começa focado nas eleições brasileiras de 2026, mas deve ser
projetado para continuar útil depois do período eleitoral, evoluindo
para acompanhamento de mandatos, propostas e promessas.

A plataforma não deve recomendar em quem o usuário deve votar nem
favorecer candidato, partido, federação ou posição política.

## 2. Problema

Dados eleitorais públicos existem, mas normalmente estão:

-   distribuídos entre diferentes fontes;
-   publicados em formatos pouco amigáveis;
-   difíceis de comparar;
-   acompanhados de documentos extensos;
-   pouco acessíveis para pessoas sem conhecimento técnico;
-   trabalhosos para jornalistas, pesquisadores e desenvolvedores
    reutilizarem.

## 3. Proposta de valor

Transformar dados eleitorais oficiais em uma camada pública,
padronizada, rastreável e simples de consumir.

A plataforma deve permitir que uma pessoa:

-   encontre candidatos;
-   consulte informações de uma candidatura;
-   compare candidatos;
-   consulte bens declarados;
-   entenda propostas;
-   acompanhe receitas e despesas de campanha;
-   acesse os documentos e fontes originais;
-   baixe os dados padronizados em CSV.

No futuro, a plataforma também poderá permitir:

-   comparação temática de propostas;
-   busca semântica sobre planos de governo;
-   match eleitoral sem identificação do visitante;
-   acompanhamento de promessas após a eleição.

## 4. Princípios

### Neutralidade

A plataforma não determina qual candidato é melhor e não deve utilizar
linguagem que favoreça ou prejudique candidaturas.

### Fonte antes da interpretação

Toda informação derivada de uma fonte externa deve manter
rastreabilidade até a origem.

Quando houver conteúdo produzido ou resumido por IA, isso deve estar
claramente identificado e, quando possível, acompanhado do
trecho/documento oficial que fundamenta a informação.

### Privacidade por design

Não haverá autenticação no produto inicial.

O sistema não deve criar perfis políticos individuais nem persistir
respostas de visitantes a questionários políticos.

Não criar:

-   User;
-   Account;
-   Session;
-   Login;
-   Password;
-   UserPoliticalProfile;
-   UserAnswer;
-   FavoriteCandidate;
-   histórico individual de buscas ou preferências políticas.

### Dados abertos

Além da interface e da API REST, os dados normalizados devem ser
disponibilizados publicamente em arquivos CSV.

### Simplicidade

A arquitetura deve favorecer componentes pequenos e responsabilidades
claras.

Não adicionar infraestrutura distribuída, filas, streaming ou abstrações
para necessidades hipotéticas sem uma necessidade concreta.

## 5. Usuários

### Eleitor

Quer entender quem são os candidatos e comparar informações de maneira
simples.

### Jornalista

Quer consultar e reutilizar dados eleitorais padronizados.

### Pesquisador

Quer obter datasets reproduzíveis e rastreáveis.

### Desenvolvedor

Quer consumir uma API REST ou baixar CSVs sem precisar implementar
diretamente toda a integração com as fontes eleitorais.

## 6. Escopo inicial

O primeiro produto público deve contemplar principalmente:

-   eleições;
-   pessoas;
-   candidaturas;
-   partidos;
-   cargos;
-   bens declarados;
-   fontes dos dados;
-   contatos públicos/oficiais quando disponíveis;
-   API REST de leitura;
-   exportação dos dados normalizados em CSV.

O Panorama Eleitoral reúne, sobre os dados canônicos já importados:

-   resumo da população selecionada;
-   rankings financeiros factuais;
-   evolução nominal do patrimônio declarado ao TSE;
-   agregados do histórico legislativo disponível na Câmara dos Deputados;
-   cobertura por métrica e transparência das fontes oficiais.

Os filtros selecionam candidaturas da eleição atual. Indicadores legislativos
podem refletir registros históricos das mesmas pessoas e não constituem uma
avaliação de desempenho.

## 7. Fora do escopo inicial

-   autenticação;
-   contas de usuário;
-   favoritos;
-   comentários;
-   fóruns;
-   mensagens entre usuários;
-   painel administrativo complexo;
-   atualização em tempo real;
-   recomendação automática de candidato;
-   persistência de preferências políticas de visitantes.

## 8. Evolução esperada

### Antes da eleição

"Quem são os candidatos e o que eles propõem?"

### Durante a campanha

"Como as campanhas arrecadam e gastam dinheiro?"

### Depois da eleição

"O que os eleitos prometeram e o que efetivamente fizeram?"

A visão de longo prazo é transformar o projeto em uma plataforma
permanente de dados políticos e transparência pública.
