# Homologação em 16/09/2026

Ambiente: `https://modelo.flawlessdev.com.br`, aplicação Docker na VPS e navegadores de teste em largura móvel de 390 px.

## Resultados confirmados

- Loja, logins, carrinho, checkout, painel do gestor, pedidos, catálogo, estoque, configurações, WhatsApp e arquivos APK responderam no domínio público.
- Login do gestor foi repetido após expiração da sessão. O painel redireciona ao login, em vez de exibir indicadores zerados.
- Loja e páginas do gestor foram verificadas em largura móvel, sem rolagem horizontal da página. O cabeçalho da loja mantém os quatro atalhos visíveis.
- Um pedido de teste foi criado pela API pública autenticada (`MOD-8BE2E2C146`), apareceu para o gestor e teve preço, frete e total coerentes: R$ 28,49 + R$ 5,00 = R$ 33,49.
- Reenvio com a mesma chave de idempotência não criou outro pedido. O estoque passou de 10 para 9; o cancelamento restaurou 10, sem duplicar a devolução em novo cancelamento.
- O painel registrou 8 pedidos, faturamento de R$ 433,86 sem cancelados e 3 produtos com estoque baixo após a correção dos indicadores.
- Cadastro e edição de um produto temporário foram realizados pelo painel. O produto foi desativado ao fim do teste; o catálogo voltou a 63 produtos.
- Checkout móvel exibiu itens, frete e total corretamente. A confirmação pública mostrou número do pedido e link manual do WhatsApp.
- A cópia do PIX foi ajustada: a aplicação registra a opção de pagamento, mas não gera cobrança nem confirma liquidação automaticamente.

## Limites da homologação

- A finalização pelo formulário visual do checkout não foi concluída na automação de navegador; a venda de teste foi feita pela API autenticada. Repetir o fluxo completo com toque real no aparelho antes da apresentação.
- Nenhum dispositivo Android apareceu em `adb devices`. Os APKs públicos foram disponibilizados, mas instalação, permissões, retorno do app e compra em aparelho físico seguem sem verificação.
- A integração automática do WhatsApp está desconectada. O link manual exibido ao cliente funciona como contato, não como notificação automática.
- PIX depende de instrução e confirmação manual da loja; cartão na entrega depende da operação e maquininha da loja.
- Os APKs atuais são assinados em modo debug e destinados à homologação, não à distribuição definitiva.

## Verificações técnicas

- `npm run build:css`, `npm run check` e `npm test` executados após as correções de interface; 10 testes automatizados aprovados.
- Contêiner na VPS saudável e sem erros recentes nos logs no momento da inspeção.
- Banco local `data/modelo.db` já estava modificado antes desta rodada e não foi incluído nos commits.
