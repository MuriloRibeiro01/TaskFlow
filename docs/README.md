# TaskFlow · Documentação

## Integrantes

Em ordem alfabética.

| Nome completo | Matrícula |
|---|---|
| Micael Martins de Moura | UC23101275 |
| Murilo Ribeiro da Silveira | UC23102602 |
| Paulo Henrique Costa Alves | UC23101336 |
| Pedro Henrique Borges Carvalho Braga | UC23102093 |
| Pedro Rodrigues Teixeira | UC23102185 |
| Vinícius de Oliveira | UC23101429 |
| Vinicius Ryosuke Otsuka | UC23101612 |

## Vídeo de apresentação

**YouTube (não listado):** PREENCHER_LINK

## Documentos (versão atual)

Verificados contra o código em 24/11/2026.

| Documento | Arquivo |
|---|---|
| Documento de Visão v3.0 | [`TaskFlow_DocumentoDeVisao.docx`](TaskFlow_DocumentoDeVisao.docx) |
| Documento de Requisitos v3.0 | [`TaskFlow_DocumentoDeRequisitos.docx`](TaskFlow_DocumentoDeRequisitos.docx) |
| Documento de Arquitetura v3.0 | [`TaskFlow_DocumentoDeArquitetura.docx`](TaskFlow_DocumentoDeArquitetura.docx) |
| Modelo de dados: ER da API e do app, dicionário e sincronização | [`DADOS.pdf`](DADOS.pdf) |
| Business Model Canvas | [`BMC.pdf`](BMC.pdf) |
| Diagramas: arquitetura, componentes, casos de uso, navegação e fluxo do usuário | [`diagramas/`](diagramas/) (fontes editáveis em `diagramas/fonte/`) |
| Design System v1.0 | [`design/TaskFlow_DesignSystem_v1.0.pdf`](design/TaskFlow_DesignSystem_v1.0.pdf) |
| Protótipos de alta fidelidade (setembro) | [`design/prototipos/`](design/prototipos/) |

## Histórico

A pasta [`historico/`](historico/README.md) guarda as versões anteriores dos documentos (v1.0 e v2.1), os diagramas da v1.0, as análises técnicas e o registro datado de cada etapa. Esses arquivos são retratos da época em que foram escritos e citam tecnologias que não fazem mais parte do projeto (Supabase, NestJS, login com Google).

## Como regerar

- **Diagramas:** `dot -Tpng -Gdpi=170 diagramas/fonte/<nome>.dot -o diagramas/<nome>.png` (Graphviz).
- **Documentos:** ao mudar o código, atualize o documento correspondente e a data de verificação acima.

Instruções de instalação e execução: [README da raiz](../README.md), [`api/`](../api/README.md), [`app/`](../app/README.md) e [`ml/`](../ml/README.md).
