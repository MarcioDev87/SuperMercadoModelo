# Especificação — versão piloto para venda real

## Problema

O protótipo permite manipulação de valores e estoque, expõe arquivos internos e dados de pedidos, usa credenciais previsíveis e não possui empacotamento Android ou implantação reproduzível.

## Objetivo

Entregar uma versão piloto capaz de registrar uma venda real com segurança básica, executável em Docker e acessível por um APK Android.

## Usuários e permissões

- Cliente autenticado: consulta catálogo, cria pedidos e consulta apenas os próprios pedidos.
- Gestor autenticado: administra catálogo, estoque, configurações e todos os pedidos.
- Visitante: consulta catálogo e dados públicos da loja; precisa se cadastrar ou entrar antes de finalizar uma compra.

## Regras de negócio

- Preço, frete e total são calculados no servidor.
- Quantidades devem ser positivas, finitas e compatíveis com a precisão da unidade.
- O pedido falha por completo quando qualquer item não tem estoque suficiente.
- Toda criação de pedido exige uma chave de idempotência.
- Cancelamento devolve estoque uma única vez.
- Valores negativos, métodos de pagamento desconhecidos e dados inválidos são rejeitados.
- PIX permanece como pagamento combinado com a loja; esta entrega não inclui adquirente ou confirmação automática.

## Persistência e integrações

- SQLite persistido em volume Docker.
- O banco inicial recebe somente loja e catálogo; usuários e pedidos existentes não entram na imagem.
- O APK é um invólucro Android da aplicação web e recebe a URL do servidor durante o build.
- WhatsApp abre uma conversa com mensagem preenchida. Envio automático via Evolution API permanece fora desta entrega.

## Limites e fora de escopo

- Publicação remota depende do endereço e acesso à VPS.
- Pagamento online, emissão fiscal e integração logística não fazem parte deste piloto.
- O APK de depuração serve para teste interno; distribuição pública exige assinatura de produção e política de privacidade.

## Critérios de aceite

- Arquivos do servidor e banco não são servidos pela web.
- Autenticação inválida não encerra o processo.
- Cliente não acessa pedido de outra conta.
- Pedido rejeita quantidade/frete manipulados e falta de estoque.
- Reenvio com a mesma chave não duplica pedido nem baixa estoque outra vez.
- Cancelamento restaura estoque uma vez.
- Imagem Docker inicia com banco limpo e health check saudável.
- APK debug é gerado e aponta para um servidor configurável.
- Uma venda piloto completa é exercitada sem tocar nos dados originais.
