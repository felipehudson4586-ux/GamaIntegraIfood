# 🍕 iFood Partner Dashboard

Sistema integrador centralizado com a API do iFood para gestão de pedidos de restaurantes, mercados e estabelecimentos parceiros.

## 📋 Visão Geral

Este é um **aplicativo centralizado** que integra com a API do iFood usando o fluxo `client_credentials`. Permite gerenciar:

- ✅ **Pedidos** - Receber, confirmar, preparar e despachar
- ✅ **Loja (Merchant)** - Status, horários, interrupções
- ✅ **Catálogo** - Itens e produtos
- ✅ **Promoções** - Descontos e ofertas
- ✅ **Separação (Picking)** - Para mercados/groceries
- ✅ **Notificações** - Som para novos pedidos

## 🚀 Quick Start

### Pré-requisitos

- Node.js 18+
- Python 3.11+
- MongoDB
- Credenciais iFood (Portal do Parceiro)

### Instalação

```bash
# Clone o repositório
git clone <seu-repositorio>
cd ifood-partner-dashboard

# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edite .env com suas credenciais iFood

# Frontend
cd ../frontend
yarn install
```

### Configuração do .env (Backend)

```env
# MongoDB
MONGO_URL="mongodb://localhost:27017"
DB_NAME="ifood_dashboard"

# CORS
CORS_ORIGINS="*"

# iFood Credentials (Obter no Portal do Parceiro)
IFOOD_CLIENT_ID="seu-client-id"
IFOOD_CLIENT_SECRET="seu-client-secret"
IFOOD_MERCHANT_ID="seu-merchant-id"
```

### Executar

```bash
# Backend (porta 8001)
cd backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend (porta 3000)
cd frontend
yarn start
```

## 🏗️ Arquitetura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  React Frontend │────▶│  FastAPI        │────▶│  iFood API      │
│  (Port 3000)    │     │  (Port 8001)    │     │  merchant-api   │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │                 │
                        │    MongoDB      │
                        │  (Port 27017)   │
                        │                 │
                        └─────────────────┘
```

## 📁 Estrutura do Projeto

```
/app
├── backend/
│   ├── server.py           # FastAPI principal
│   ├── ifood_client.py     # Cliente API iFood
│   ├── models.py           # Modelos Pydantic
│   ├── requirements.txt    # Dependências Python
│   └── .env               # Variáveis de ambiente
│
├── frontend/
│   ├── src/
│   │   ├── components/    # Componentes React
│   │   ├── pages/         # Páginas da aplicação
│   │   │   ├── Dashboard.js
│   │   │   ├── Orders.js
│   │   │   ├── OrderDetail.js
│   │   │   ├── Items.js
│   │   │   ├── Promotions.js
│   │   │   ├── Picking.js
│   │   │   ├── Merchant.js
│   │   │   └── Settings.js
│   │   ├── hooks/
│   │   │   └── useNotificationSound.js
│   │   └── lib/
│   │       └── api.js
│   ├── package.json
│   └── .env
│
├── memory/
│   └── PRD.md             # Documentação do produto
│
├── docs/
│   └── IFOOD_API.md       # Documentação da API iFood
│
└── README.md
```

## 🔐 Autenticação iFood (App Centralizado)

Este sistema usa o fluxo **client_credentials** para apps centralizados:

```
POST https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token
Content-Type: application/x-www-form-urlencoded

grantType=client_credentials
clientId=YOUR_CLIENT_ID
clientSecret=YOUR_CLIENT_SECRET
```

### Características:
- ✅ Token expira em **3 horas** (usar `expiresIn` da resposta)
- ✅ **Não** recebe refresh_token
- ✅ Renovação automática baseada em `expiresIn`
- ✅ Tratamento de erro 401 (token expirado)
- ✅ Margem de segurança de 5 minutos

### Obter Credenciais:
1. Acesse o [Portal do Parceiro iFood](https://portal.ifood.com.br)
2. Navegue até **Meus Apps > Credenciais**
3. Copie `clientId` e `clientSecret`

## 📡 API Endpoints

### Autenticação
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/auth/token` | Obtém token iFood |
| GET | `/api/auth/status` | Status da autenticação |

### Merchant (Loja)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/merchant/list` | Lista lojas vinculadas |
| GET | `/api/merchant/details/{id}` | Detalhes da loja |
| GET | `/api/merchant/status/{id}` | Status (OK/WARNING/CLOSED/ERROR) |
| GET | `/api/merchant/interruptions/{id}` | Lista interrupções |
| POST | `/api/merchant/interruptions/{id}` | Criar interrupção |
| DELETE | `/api/merchant/interruptions/{id}` | Remover interrupção |
| GET | `/api/merchant/opening-hours/{id}` | Horários de funcionamento |
| PUT | `/api/merchant/opening-hours/{id}` | Configurar horários |
| POST | `/api/merchant/checkin-qrcode` | Gerar QR Code (PDF) |

### Pedidos
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/orders` | Lista pedidos |
| GET | `/api/orders/today` | Pedidos de hoje |
| GET | `/api/orders/{id}` | Detalhes do pedido |
| POST | `/api/orders/{id}/confirm` | Confirmar pedido |
| POST | `/api/orders/{id}/start-preparation` | Iniciar preparo |
| POST | `/api/orders/{id}/ready` | Pronto para retirada |
| POST | `/api/orders/{id}/dispatch` | Despachar |
| POST | `/api/orders/{id}/cancel` | Cancelar |

### Polling
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/polling/status` | Status do polling |
| POST | `/api/polling/start` | Iniciar polling |
| POST | `/api/polling/stop` | Parar polling |
| POST | `/api/polling/force` | Forçar polling agora |

### Catálogo
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/items` | Lista itens |
| POST | `/api/items` | Criar item |
| PUT | `/api/items/{id}` | Atualizar item |
| DELETE | `/api/items/{id}` | Remover item |

### Promoções
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/promotions` | Lista promoções |
| POST | `/api/promotions` | Criar promoção |
| DELETE | `/api/promotions/{id}` | Remover promoção |

### Picking (Separação)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/picking/{id}/start` | Iniciar separação |
| POST | `/api/picking/{id}/end` | Finalizar separação |
| POST | `/api/picking/{id}/items` | Adicionar item |
| PATCH | `/api/picking/{id}/items/{uid}` | Modificar item |
| DELETE | `/api/picking/{id}/items/{uid}` | Remover item |

## 🔔 Notificações Sonoras

O sistema inclui notificação sonora para novos pedidos usando Web Audio API:

- Som toca automaticamente quando há novos pedidos
- Botão ON/OFF no Dashboard e página de Pedidos
- Configuração salva no localStorage
- Vibração em dispositivos móveis (se suportado)

## ⚙️ Configurações Importantes

### Polling (Manter Loja Online)
- O iFood requer polling a cada **30 segundos**
- Sem polling, a loja fica **offline**
- O sistema inicia polling automaticamente

### Horários de Funcionamento
- Configure via API ou página "Minha Loja"
- Botão **24/7** para lojas de teste
- Formato: `{ dayOfWeek, start, duration }`

### Status da Loja
| Estado | Cor | Descrição |
|--------|-----|-----------|
| OK | 🟢 Verde | Loja online |
| WARNING | 🟡 Amarela | Online com restrições |
| CLOSED | ⚫ Cinza | Fechada (esperado) |
| ERROR | 🔴 Vermelha | Fechada (problema) |

## 🧪 Ambiente de Teste

Para lojas de teste no iFood:

1. Credenciais de teste no Portal do Parceiro
2. Configure horários **24/7**
3. Mantenha **polling ativo**
4. Use app iFood com conta de teste

## 📚 Documentação Adicional

- [Documentação API iFood](./docs/IFOOD_API.md)
- [PRD - Product Requirements](./memory/PRD.md)

## 🛠️ Tecnologias

### Backend
- Python 3.11+
- FastAPI
- Motor (MongoDB async)
- httpx (HTTP client com HTTP/2)
- Pydantic

### Frontend
- React 18
- Tailwind CSS
- shadcn/ui
- Lucide Icons
- Sonner (Toasts)

## 📄 Licença

Projeto privado - Todos os direitos reservados.

---

**Desenvolvido para integração com iFood Partner API** 🍕
