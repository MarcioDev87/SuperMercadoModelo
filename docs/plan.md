# Plano — versão piloto para venda real

## Arquitetura

- Manter Express e SQLite, endurecendo validação, autenticação e transações.
- Servir apenas páginas e ativos permitidos explicitamente.
- Criar o banco de cada ambiente a partir de um catálogo sanitizado em JSON.
- Empacotar o serviço em uma imagem Node.js com volume persistente.
- Gerar aplicativo Android com Capacitor apontando para a URL informada no build.

## Etapas

1. Corrigir autenticação, autorização, rate limiting e exposição estática.
2. Corrigir valores, estoque, idempotência, cancelamento e validações de produto.
3. Ajustar o frontend para os novos contratos e escapar conteúdo dinâmico.
4. Criar catálogo de inicialização sem clientes ou pedidos.
5. Criar e validar Dockerfile, Compose, health check e rollback.
6. Criar e compilar o projeto Android.
7. Executar testes automatizados e uma venda piloto isolada.
8. Revisar segurança, performance e qualidade; registrar pendências.

## Migração e compatibilidade

`initDB` adicionará colunas e índices ausentes sem apagar registros. O banco original não será usado pelos testes nem incluído no contêiner.

## Rollback

- Aplicação: voltar à imagem Docker anterior.
- Dados: parar o serviço e restaurar uma cópia do arquivo SQLite do volume.
- Android: reinstalar o APK anterior.

## Estratégia de testes

- Testes HTTP em banco temporário para autenticação, autorização, validação, idempotência, estoque e cancelamento.
- Análise sintática e auditoria de dependências.
- Build e health check do contêiner.
- Build Gradle do APK e inspeção do artefato.
- Venda piloto isolada com cliente e produto controlados.
