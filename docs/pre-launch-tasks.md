# Pré-lançamento

## Concluído neste ciclo

- Autenticação, autorização, limitação de requisições e validação de entrada reforçadas.
- Preço, frete, estoque, cancelamento e idempotência calculados e controlados no servidor.
- Renderização de dados dinâmicos protegida contra injeção de HTML.
- Catálogo inicial separado dos dados de usuários e pedidos.
- Imagem Docker executada como usuário sem privilégios, com sistema de arquivos somente leitura e volume persistente.
- APKs de teste distintos para Cliente e Gestor, com IDs Android instaláveis em paralelo e apontando para HTTPS.
- Venda piloto registrada e preservada após reinício do contêiner.
- Testes automatizados, verificação de sintaxe e auditoria das dependências de produção aprovados.
- Aplicação publicada em `https://modelo.flawlessdev.com.br` por Cloudflare Tunnel.
- Porta interna do Node restrita à rede Docker e banco preservado com backup anterior à implantação.
- Login real de Cliente e Gestor, catálogo, painel e downloads dos APKs validados no domínio público.

## Antes da distribuição definitiva

- Preencher telefone, endereço e demais dados definitivos da loja.
- Assinar uma versão Android release com chave de produção protegida.
- Testar instalação e fluxo completo em um aparelho físico; nenhum dispositivo ADB estava conectado nesta validação.
- Configurar backups automáticos do volume SQLite, monitoramento e restauração ensaiada.
- Configurar e validar a integração real do WhatsApp antes de habilitar notificações.
- Integrar um provedor de pagamento caso a loja precise confirmar PIX automaticamente.
- Migrar os scripts e eventos inline para arquivos JavaScript antes de remover `unsafe-inline` da CSP.
- Acompanhar as três vulnerabilidades moderadas transitivas do Capacitor CLI, presentes apenas nas dependências de desenvolvimento; a auditoria de produção está limpa.

## Limites do teste atual

- Os APKs públicos são versões debug destinadas aos testes operacionais atuais.
- Os pedidos existentes na VPS devem ser tratados como dados de homologação até a confirmação da loja.
