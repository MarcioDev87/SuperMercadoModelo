# Roteiro de teste real

## Preparação

1. No celular, abra `https://modelo.flawlessdev.com.br/health` e confirme a resposta `ok`.
2. Instale o [APK Cliente](https://modelo.flawlessdev.com.br/downloads/SuperMercadoModelo-Cliente.apk).
3. Instale o [APK Gestor](https://modelo.flawlessdev.com.br/downloads/SuperMercadoModelo-Gestor.apk) se for testar os dois perfis. Eles podem coexistir no mesmo aparelho.
4. Use dados de teste controlados pela equipe e identifique o pedido como teste antes de avançar pelo fluxo operacional.

## Cliente final

1. Abra o aplicativo e confirme o carregamento do catálogo.
2. Crie um cliente de teste com telefone e endereço controlados pela equipe.
3. Adicione um produto disponível ao carrinho.
4. Avance ao pagamento e confirme frete, pedido mínimo e total.
5. Finalize somente um pedido e anote o número e o código de retirada.
6. Reabra a confirmação e confirme que o pedido não foi duplicado.

## Gestor

1. Entre em `/login_gestor.html` com a conta definida no `.env`.
2. Confirme que o pedido aparece no painel e na gestão de pedidos.
3. Compare cliente, itens, quantidades, pagamento, entrega e total com o aplicativo.
4. Avance o pedido pelas etapas operacionais permitidas.
5. Ajuste um produto de teste e confirme a atualização na loja.
6. Cancele apenas pedidos marcados como teste e confirme a devolução do estoque uma única vez.

## Aprovação

- Não houve pedido duplicado após reenvio ou atualização da tela.
- Cliente não conseguiu abrir pedidos de outro cliente.
- Gestor conseguiu consultar e operar o pedido.
- Valores exibidos no cliente e no gestor são iguais aos calculados pela API.
- Estoque foi baixado na venda e restaurado uma vez no cancelamento.
- Nenhum erro apareceu no navegador, nos logs do contêiner ou na tela do aplicativo.

Os APKs acima apontam para o servidor público e são versões debug para homologação. Para testes locais sem a VPS, gere outros APKs com a URL da rede local conforme o `README.md`.
