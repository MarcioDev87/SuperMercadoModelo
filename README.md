# Super Mercado Modelo

Loja virtual e painel operacional para catálogo, estoque e pedidos do Super Mercado Modelo.

## Produção

- Loja: `https://modelo.flawlessdev.com.br/`
- Login do cliente: `https://modelo.flawlessdev.com.br/login_cliente.html`
- Login do gestor: `https://modelo.flawlessdev.com.br/login_gestor.html`
- APK Cliente: `https://modelo.flawlessdev.com.br/downloads/SuperMercadoModelo-Cliente.apk`
- APK Gestor: `https://modelo.flawlessdev.com.br/downloads/SuperMercadoModelo-Gestor.apk`

## Requisitos

- Node.js 22 para desenvolvimento local.
- Docker Desktop ou Docker Engine com Compose para implantação.
- JDK 21 e Android SDK 36 para gerar o APK.

## Desenvolvimento local

```powershell
npm install
npm run build:css
$env:JWT_SECRET = 'um-segredo-local-com-mais-de-32-caracteres'
npm start
```

A loja fica em `http://localhost:3051` e o painel em `http://localhost:3051/login_gestor.html`.

O sistema não cria senha administrativa padrão. Em um banco novo, defina `ADMIN_EMAIL` e uma `ADMIN_PASSWORD` com pelo menos 12 caracteres antes do primeiro início.

## Testes

```powershell
npm run check
npm test
npm audit --omit=dev
```

Os testes usam um banco temporário e não alteram `data/modelo.db`.

## Docker e VPS

1. Copie `.env.example` para `.env`.
2. Troque o segredo JWT, a senha do gestor, o telefone, o endereço e os demais dados da loja.
3. Inicie o serviço:

```bash
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:${APP_PORT:-3051}/health
```

O banco fica no volume `modelo_data`. Faça backup antes de atualizar:

```bash
docker compose stop
docker run --rm -v super-mercado-modelo_modelo_data:/data -v "$PWD/backups:/backup" alpine \
  sh -c 'cp /data/modelo.db /backup/modelo-$(date +%Y%m%d-%H%M%S).db'
docker compose start
```

Na VPS, exponha o serviço por um proxy reverso com HTTPS. Mantenha a porta da aplicação fechada para acesso público direto. Depois de verificar a nova imagem, o rollback consiste em subir a tag anterior e restaurar o arquivo SQLite do backup quando houver migração incompatível.

## APK Android

O APK é um aplicativo Capacitor que abre o mesmo servidor web. Gere uma versão apontando para a VPS ou para um computador na mesma rede:

```powershell
.\scripts\build-android.ps1 -ServerUrl 'https://mercado.seu-dominio.com.br'
```

Para teste por Wi-Fi, use o IP local do computador, por exemplo `http://192.168.1.72:3052`. O APK fica em `android/app/build/outputs/apk/debug/app-debug.apk`.

Instalação por cabo USB, com depuração USB habilitada:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r .\android\app\build\outputs\apk\debug\app-debug.apk
```

A versão debug aceita HTTP para testes locais. Para distribuição, gere uma versão release assinada que aponte para HTTPS.

Para gerar os dois aplicativos de teste da publicação:

```powershell
.\scripts\build-android.ps1 -ServerUrl 'https://modelo.flawlessdev.com.br' -AppId 'br.com.supermercadomodelo.cliente' -AppName 'Super Mercado Modelo' -OutputPath 'downloads\SuperMercadoModelo-Cliente.apk'
.\scripts\build-android.ps1 -ServerUrl 'https://modelo.flawlessdev.com.br/login_gestor.html' -AppId 'br.com.supermercadomodelo.gestor' -AppName 'Super Mercado Modelo Gestor' -OutputPath 'downloads\SuperMercadoModelo-Gestor.apk'
```

## Regras do pedido

- O cliente precisa entrar antes de finalizar.
- O servidor calcula preço, frete e total.
- Falta de estoque cancela a operação inteira.
- Reenvios usam `Idempotency-Key` e não duplicam a venda.
- Cancelamento devolve estoque uma única vez.
- PIX nesta versão é combinado com a loja; não há confirmação bancária automática.

Consulte [a especificação](docs/spec.md), [o plano](docs/plan.md), [o histórico desta atualização](docs/changes-2026-09-15.md), [o roteiro de teste real](docs/real-test-guide.md) e [as pendências de lançamento](docs/pre-launch-tasks.md).
