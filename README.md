# Super Mercado Modelo — E-Commerce & Gestão Operacional

Produto de e-commerce e gestão operacional desenvolvido com exclusividade para o **Super Mercado Modelo** (Cascavel - CE).

---

## 🎨 Identidade Visual & Design
- **Paleta de Cores Oficial**:
  - **Verde Floresta (Primary)**: `#15803d` / `#166534`
  - **Laranja Acolhedor (Secondary)**: `#ea580c` / `#c2410c`
  - **Amarelo Sol (Accent / Destaques)**: `#f59e0b`
  - **Vermelho Frescor (Alertas / Promoções)**: `#dc2626`
  - **Dark Canvas (Fundo Principal)**: `#0b1320` / `#111c2e`
- **Logo Oficial**: Embutida e referenciada a partir de `assets/logo-modelo.png`.

---

## 🚀 Arquitetura & Características Exclusivas
1. **Single-Tenant / Uso Exclusivo**:
   - Não há seleção de supermercados para os clientes. Ao entrar no app ou na loja virtual (`index.html`), o usuário já está no Super Mercado Modelo.
   - Acesso do gestor (`login_gestor.html`) simplificado: requer apenas **Usuário/E-mail e Senha**, sem contadores de teste (trial SaaS) ou telas de onboarding genérico.
2. **Catálogo Integrado**:
   - 63 produtos reais e higienizados (Hortifruti, Açougue, Mercearia, Frios, Bebidas, Limpeza, Padaria).
3. **Checkout Completo**:
   - Sacola de compras interativa (`meu_carrinho.html`), cálculo de taxa para bairros de Cascavel, opções de pagamento (PIX, Cartão na Entrega, Dinheiro) e tela de confirmação (`pedido_confirmado.html`).
4. **Painel do Gestor**:
   - Monitoramento de pedidos em tempo real (`lista_de_pedidos.html`), controle de catálogo (`admin_produtos.html`), ajuste rápido de estoque (`gestao_de_estoque.html`) e integração WhatsApp (`admin_whatsapp.html`).

---

## 💻 Como Rodar o Projeto

```bash
# 1. Instalar dependências
npm install

# 2. Executar suíte de testes
npm test

# 3. Iniciar servidor local
npm start
```

O servidor iniciará em `http://localhost:3051`.
- **Vitrine do Cliente**: `http://localhost:3051/`
- **Painel do Gestor**: `http://localhost:3051/login_gestor.html`
  - **E-mail padrão**: `admin@supermercadomodelo.com.br`
  - **Senha padrão**: `admin123`
