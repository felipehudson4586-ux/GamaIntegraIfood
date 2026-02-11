# 🤖 Instruções para Agente Emergent

Este documento contém instruções para o agente Emergent quando o projeto for clonado/forkeado.

## 📋 Resumo do Projeto

**Nome:** iFood Partner Dashboard  
**Tipo:** App Centralizado (client_credentials)  
**Stack:** React + FastAPI + MongoDB  
**Status:** MVP Funcional ✅

## 🏗️ Arquitetura Implementada

### Backend (FastAPI - porta 8001)
- `server.py` - API principal com todos os endpoints
- `ifood_client.py` - Cliente para API iFood
- `models.py` - Modelos Pydantic

### Frontend (React - porta 3000)
- Dashboard com métricas
- Gestão de pedidos
- Gestão de loja (Merchant)
- Catálogo e promoções
- Notificações sonoras

## ✅ Módulos Implementados

| Módulo | Status | Arquivo |
|--------|--------|---------|
| Autenticação | ✅ | ifood_client.py |
| Merchant | ✅ | server.py, Merchant.js |
| Orders | ✅ | server.py, Orders.js |
| Item/Catalog | ✅ | server.py, Items.js |
| Promotion | ✅ | server.py, Promotions.js |
| Picking | ✅ | server.py, Picking.js |
| Polling | ✅ | server.py, Layout.js |
| Notificações | ✅ | useNotificationSound.js |

## 🔧 Configuração Necessária

### Variáveis de Ambiente (Backend)
```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="ifood_dashboard"
CORS_ORIGINS="*"
IFOOD_CLIENT_ID="obter-no-portal"
IFOOD_CLIENT_SECRET="obter-no-portal"
IFOOD_MERCHANT_ID="obter-no-portal"
```

### Variáveis de Ambiente (Frontend)
```env
REACT_APP_BACKEND_URL="http://localhost:8001/api"
```

## 📡 Endpoints Principais

### Autenticação
- `GET /api/auth/token` - Obter token iFood
- `GET /api/auth/status` - Status da autenticação

### Merchant
- `GET /api/merchant/list` - Listar lojas
- `GET /api/merchant/details/{id}` - Detalhes
- `GET /api/merchant/status/{id}` - Status
- `GET/POST/DELETE /api/merchant/interruptions/{id}` - Interrupções
- `GET/PUT /api/merchant/opening-hours/{id}` - Horários

### Orders
- `GET /api/orders` - Listar pedidos
- `GET /api/orders/{id}` - Detalhes
- `POST /api/orders/{id}/confirm` - Confirmar
- `POST /api/orders/{id}/start-preparation` - Iniciar preparo
- `POST /api/orders/{id}/ready` - Pronto
- `POST /api/orders/{id}/dispatch` - Despachar

### Polling
- `GET /api/polling/status` - Status
- `POST /api/polling/start` - Iniciar
- `POST /api/polling/stop` - Parar

## 🔄 Fluxos Importantes

### Autenticação (client_credentials)
1. Usa grantType=client_credentials
2. Token expira em 3 horas
3. Renovação automática com margem de 5 min
4. Tratamento de erro 401

### Polling (Obrigatório)
1. Executa a cada 30 segundos
2. Mantém loja "conectada" ao iFood
3. Inicia automaticamente ao abrir o app
4. Sem polling = loja offline

### Horários
1. API substitui TODOS os horários ao atualizar
2. Dias não enviados = loja fechada
3. Botão 24/7 para testes

## 📖 Documentação

- `/README.md` - Guia principal
- `/SETUP.md` - Instruções de setup
- `/docs/IFOOD_API.md` - Documentação API iFood
- `/memory/PRD.md` - Product Requirements

## ⚠️ Avisos Importantes

1. **Credenciais:** Nunca commitar .env com credenciais reais
2. **Polling:** Obrigatório para loja ficar online
3. **Token:** Usar expiresIn da resposta, não valores fixos
4. **Homologação:** Todos os endpoints de merchant são obrigatórios

## 🎯 Para Continuar Desenvolvimento

### Features Pendentes (Backlog)
- [ ] Impressão de comandas
- [ ] Relatórios com gráficos
- [ ] Exportação CSV/Excel
- [ ] Multi-merchant
- [ ] Webhook (substituir polling)
- [ ] PWA

### Para Testar
1. Configure credenciais no .env
2. Inicie backend: `uvicorn server:app --port 8001`
3. Inicie frontend: `yarn start`
4. Configure horários 24/7
5. Inicie polling
6. Faça pedido pelo app iFood

## 📞 Recursos

- Portal do Parceiro: https://portal.ifood.com.br
- Portal do Desenvolvedor: https://developer.ifood.com.br
- Documentação: https://developer.ifood.com.br/docs

---

*Gerado automaticamente - iFood Partner Dashboard v1.0.0*
