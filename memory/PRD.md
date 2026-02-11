# 📋 PRD - iFood Partner Dashboard

## Visão Geral do Produto

**Nome:** iFood Partner Dashboard  
**Tipo:** Sistema Integrador Centralizado  
**Versão:** 1.0.0  
**Data:** Fevereiro 2026

### Descrição
Sistema web para gestão de pedidos de estabelecimentos parceiros do iFood. Integra com a API do iFood usando o modelo de aplicativo centralizado (client_credentials).

### Objetivo
Permitir que estabelecimentos (restaurantes, mercados, farmácias, etc.) gerenciem seus pedidos do iFood através de uma interface web moderna e intuitiva.

---

## Arquitetura

### Tipo de Aplicativo: Centralizado

**Vantagens:**
- Autenticação simplificada (client_credentials)
- Não precisa de refresh token
- Uma credencial atende todos os merchants

**Desvantagens:**
- Processo manual de autorização de merchants
- Requer cuidado com segregação de dados

### Stack Tecnológico

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 18, Tailwind CSS, shadcn/ui |
| Backend | Python 3.11, FastAPI, Motor |
| Database | MongoDB |
| API Client | httpx (HTTP/2) |

### Diagrama de Arquitetura

```
┌────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │Dashboard │ │ Orders   │ │ Merchant │ │ Settings │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└────────────────────────────┬───────────────────────────────────┘
                             │ HTTP (axios)
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                       BACKEND (FastAPI)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │   Auth   │ │  Orders  │ │ Merchant │ │ Polling  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                      │                                         │
│              ┌───────┴───────┐                                 │
│              ▼               ▼                                 │
│        ┌──────────┐   ┌──────────────┐                        │
│        │ MongoDB  │   │ iFood Client │                        │
│        └──────────┘   └──────┬───────┘                        │
└──────────────────────────────┼─────────────────────────────────┘
                               │ HTTPS (httpx)
                               ▼
                    ┌──────────────────────┐
                    │   iFood Merchant API │
                    │  merchant-api.ifood  │
                    └──────────────────────┘
```

---

## Módulos Implementados

### 1. Autenticação (Authentication)
- [x] OAuth 2.0 client_credentials
- [x] Renovação automática de token
- [x] Tratamento de erro 401
- [x] Margem de segurança (5 min)
- [x] Status de autenticação

### 2. Merchant (Loja)
- [x] Listar lojas vinculadas
- [x] Detalhes da loja
- [x] Status da loja (OK/WARNING/CLOSED/ERROR)
- [x] Criar/listar/remover interrupções
- [x] Configurar horários de funcionamento
- [x] Botão 24/7 para testes
- [x] Gerar QR Code check-in

### 3. Orders (Pedidos)
- [x] Polling de eventos (30s)
- [x] Acknowledgment de eventos
- [x] Listar pedidos
- [x] Detalhes do pedido
- [x] Confirmar pedido
- [x] Iniciar preparo
- [x] Marcar pronto
- [x] Despachar
- [x] Cancelar
- [x] Rastreamento

### 4. Item (Catálogo)
- [x] Listar catálogos
- [x] CRUD de produtos
- [x] Interface de gestão

### 5. Promotion (Promoções)
- [x] Criar promoções
- [x] Remover promoções
- [x] Tipos: PERCENTAGE, LXPY, PERCENTAGE_PER_X_UNITS

### 6. Picking (Separação)
- [x] Iniciar/finalizar separação
- [x] Adicionar item
- [x] Modificar quantidade
- [x] Substituir item
- [x] Remover item (ruptura)

### 7. Funcionalidades Extras
- [x] Notificação sonora (Web Audio API)
- [x] Polling automático ao iniciar
- [x] Dashboard com métricas
- [x] Interface responsiva

---

## Fluxos Principais

### Fluxo de Pedido

```
1. Polling detecta novo evento (PLACED)
2. Som de notificação toca
3. Pedido aparece no Dashboard
4. Operador confirma pedido (< 8 min)
5. Inicia preparo
6. Marca como pronto
7. Despacha para entrega
8. Pedido concluído
```

### Fluxo de Autenticação

```
1. App inicia
2. Verifica se há token válido
3. Se não, solicita novo token (client_credentials)
4. Armazena token e expiresIn
5. Usa token nas requisições
6. Se 401, renova token automaticamente
```

### Fluxo de Polling

```
1. App inicia → Polling automático
2. A cada 30s: GET /events:polling
3. Se há eventos:
   a. Processa eventos
   b. Salva no MongoDB
   c. Envia ACK
4. Se 204: Sem novos eventos
5. Repete loop
```

---

## Variáveis de Ambiente

### Backend (.env)

```env
# MongoDB
MONGO_URL="mongodb://localhost:27017"
DB_NAME="ifood_dashboard"

# CORS
CORS_ORIGINS="*"

# iFood API Credentials
IFOOD_CLIENT_ID="seu-client-id"
IFOOD_CLIENT_SECRET="seu-client-secret"
IFOOD_MERCHANT_ID="seu-merchant-id"
```

### Frontend (.env)

```env
REACT_APP_BACKEND_URL="http://localhost:8001/api"
```

---

## Requisitos para Homologação

Conforme documentação iFood, para homologar o app é necessário:

1. ✅ GET /merchants
2. ✅ GET /merchants/{merchantId}
3. ✅ GET /merchants/{merchantId}/status
4. ✅ POST /merchants/{merchantId}/interruptions
5. ✅ GET /merchants/{merchantId}/interruptions
6. ✅ DELETE /merchants/{merchantId}/interruptions/{interruptionId}
7. ✅ GET /merchants/{merchantId}/opening-hours
8. ✅ PUT /merchants/{merchantId}/opening-hours

---

## Requisitos para Produção

### Obrigatórios
- [x] Polling a cada 30 segundos
- [x] Confirmação de pedidos em até 8 minutos
- [x] Tratamento de erro 401 com renovação
- [x] ACK de eventos recebidos
- [x] HTTPS (TLS 1.2+)

### Recomendados
- [x] Notificação sonora
- [x] Dashboard com métricas
- [x] Histórico de pedidos
- [x] Filtros e busca

---

## Estrutura de Arquivos

```
/app
├── backend/
│   ├── server.py           # API FastAPI (1200+ linhas)
│   ├── ifood_client.py     # Cliente iFood (900+ linhas)
│   ├── models.py           # Modelos Pydantic
│   ├── requirements.txt    # Dependências
│   └── .env               # Configurações
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.js    # Métricas e pedidos recentes
│   │   │   ├── Orders.js       # Lista de pedidos
│   │   │   ├── OrderDetail.js  # Detalhes e ações
│   │   │   ├── Items.js        # Catálogo
│   │   │   ├── Promotions.js   # Promoções
│   │   │   ├── Picking.js      # Separação
│   │   │   ├── Merchant.js     # Gestão da loja
│   │   │   └── Settings.js     # Configurações
│   │   ├── components/
│   │   │   ├── Layout.js       # Layout principal
│   │   │   └── ui/             # shadcn/ui
│   │   ├── hooks/
│   │   │   └── useNotificationSound.js
│   │   └── lib/
│   │       └── api.js          # Axios config
│   └── package.json
│
├── docs/
│   └── IFOOD_API.md        # Documentação API
│
├── memory/
│   └── PRD.md              # Este documento
│
└── README.md               # Guia de instalação
```

---

## Changelog

### v1.0.0 (Fevereiro 2026)
- Implementação inicial
- 6 módulos iFood completos
- Autenticação centralizada
- Notificações sonoras
- Interface React com Tailwind

---

## Próximas Features (Backlog)

- [ ] Impressão de comandas
- [ ] Relatórios avançados (gráficos)
- [ ] Exportação CSV/Excel
- [ ] Multi-merchant (várias lojas)
- [ ] Webhook ao invés de polling
- [ ] PWA (Progressive Web App)
- [ ] Integração com impressoras térmicas

---

## Contato e Suporte

Para dúvidas sobre a integração iFood:
- [Portal do Desenvolvedor](https://developer.ifood.com.br)
- [Portal do Parceiro](https://portal.ifood.com.br)

---

*Documento gerado automaticamente - iFood Partner Dashboard v1.0.0*
