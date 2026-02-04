# iFood Partner Dashboard - PRD (Product Requirements Document)

## Problema Original
Desenvolver um Projeto Integrador completo tendo o iFood como sistema central, focado na integração, automação e gestão inteligente de pedidos. O sistema simula um sistema profissional utilizado por estabelecimentos parceiros.

## Arquitetura do Sistema

### Stack Tecnológico
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Banco de Dados**: MongoDB
- **Integração**: iFood Merchant API via polling (30s)

### Módulos Implementados (6 módulos conforme documentação iFood)

1. **Authentication** - OAuth token management com iFood API
2. **Orders** - Gestão completa do ciclo de vida de pedidos
3. **Merchant** - Dados do estabelecimento
4. **Item** - Catálogo de produtos (CRUD)
5. **Promotion** - Gestão de promoções (até 70% desconto)
6. **Picking** - Separação de pedidos (para mercados)

## User Personas

### Operador de Restaurante
- Recebe e confirma pedidos rapidamente
- Acompanha status de entrega
- Gerencia catálogo de produtos

### Gerente de Mercado
- Utiliza módulo de Picking para separação
- Monitora métricas de vendas
- Cria promoções

## Requisitos Funcionais Implementados ✅

- [x] Dashboard com métricas em tempo real
- [x] Lista de pedidos com filtros por status/tipo
- [x] Detalhes do pedido com timeline
- [x] Confirmação/cancelamento de pedidos
- [x] Ciclo de vida completo (PLACED → CONFIRMED → PREPARED → DISPATCHED → CONCLUDED)
- [x] Polling de eventos a cada 30 segundos
- [x] Tratamento de duplicidade de eventos
- [x] CRUD de itens do catálogo
- [x] CRUD de promoções
- [x] Módulo de separação (Picking)
- [x] Status de conexão com iFood
- [x] Tema visual padrão iFood

## Requisitos Não-Funcionais

- [x] Rate limiting conforme documentação (6000 RPM)
- [x] Retry automático em erros 5XX
- [x] Tolerância a falhas
- [x] Interface responsiva
- [x] Hot reload em desenvolvimento

## O Que Foi Implementado (Jan 2026)

### Backend (/app/backend/)
- `server.py` - API FastAPI com 35+ endpoints
- `ifood_client.py` - Cliente completo para iFood API
- `models.py` - Modelos Pydantic para todos os módulos

### Frontend (/app/frontend/src/)
- Dashboard com métricas
- Lista de pedidos com filtros
- Detalhes do pedido com ações
- Catálogo de itens
- Promoções
- Separação (Picking)
- Configurações

### Credenciais Configuradas
- Client ID: 0e43f047-43bd-4f9b-ae35-bea0c3aef665
- Merchant ID: fb3625ab-1907-4e8a-af83-2e0c52733e89

## Backlog Priorizado

### P0 (Crítico)
- ✅ Todos os 6 módulos implementados
- ⚠️ Validar credenciais iFood em ambiente de produção

### P1 (Alta Prioridade)
- [ ] Impressão de comandas
- [ ] Notificações sonoras para novos pedidos
- [ ] Integração com impressora térmica

### P2 (Média Prioridade)
- [ ] Relatórios avançados (gráficos por período)
- [ ] Exportação de dados (CSV/Excel)
- [ ] Multi-merchant (várias lojas)

### P3 (Baixa Prioridade)
- [ ] Integração com outros marketplaces (Rappi, Uber Eats)
- [ ] IA para previsão de demanda
- [ ] App mobile (React Native)

## Próximos Passos

1. **Validar credenciais iFood** - As credenciais atuais retornam erro 400. Verificar no portal do iFood se estão corretas e se o app foi aprovado para produção.

2. **Testar com pedidos reais** - Após validação das credenciais, testar fluxo completo com pedidos reais.

3. **Adicionar impressão** - Implementar template de comanda e integração com impressora.

## Tecnologias Sugeridas para Evolução

- **IA**: OpenAI GPT para resumo de pedidos
- **Relatórios**: Chart.js ou Recharts (já instalado)
- **Mobile**: React Native ou PWA
- **Filas**: Redis para processamento assíncrono
