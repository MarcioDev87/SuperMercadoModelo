# Roteiro de teste real

## Preparação

1. Confirme que o computador e o celular estão na mesma rede Wi-Fi.
2. Inicie o ambiente com `docker compose up -d --build`.
3. Confirme `docker compose ps` e abra `http://IP_DO_COMPUTADOR:3052/health` no celular.
4. Instale o APK debug disponível em `dist/`.

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

Para testes externos à rede local, publique primeiro a aplicação em uma VPS com domínio e HTTPS e gere um novo APK para essa URL.
