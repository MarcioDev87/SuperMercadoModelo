# Pré-lançamento

## Concluído neste ciclo

- Autenticação, autorização, limitação de requisições e validação de entrada reforçadas.
- Preço, frete, estoque, cancelamento e idempotência calculados e controlados no servidor.
- Renderização de dados dinâmicos protegida contra injeção de HTML.
- Catálogo inicial separado dos dados de usuários e pedidos.
- Imagem Docker executada como usuário sem privilégios, com sistema de arquivos somente leitura e volume persistente.
- APK debug gerado com o ícone fornecido e apontando para o servidor local.
- Venda piloto registrada e preservada após reinício do contêiner.
- Testes automatizados, verificação de sintaxe e auditoria das dependências de produção aprovados.

## Antes de publicar na Internet

- Definir domínio e HTTPS no proxy reverso da VPS; não publicar a porta interna do Node diretamente.
- Preencher telefone, endereço, senha administrativa forte e segredos exclusivos no `.env` da VPS.
- Gerar outro APK apontando para a URL HTTPS pública e assinar uma versão Android release.
- Testar instalação e fluxo completo em um aparelho físico; nenhum dispositivo ADB estava conectado nesta validação.
- Configurar backups automáticos do volume SQLite, monitoramento e restauração ensaiada.
- Configurar e validar a integração real do WhatsApp antes de habilitar notificações.
- Integrar um provedor de pagamento caso a loja precise confirmar PIX automaticamente.
- Migrar os scripts e eventos inline para arquivos JavaScript antes de remover `unsafe-inline` da CSP.
- Acompanhar as três vulnerabilidades moderadas transitivas do Capacitor CLI, presentes apenas nas dependências de desenvolvimento; a auditoria de produção está limpa.

## Limites do teste atual

- O contêiner foi validado nesta máquina e está preparado para VPS, mas o envio remoto depende do endereço e do acesso à VPS.
- A venda `MOD-78253F74DF` é um pedido piloto marcado para não separação nem entrega.
