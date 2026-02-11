# 📖 Documentação API iFood - Integração Centralizada

Esta documentação cobre todos os módulos implementados da API iFood para aplicativos centralizados.

---

## 🔐 Módulo 1: Autenticação

### Visão Geral
Apps centralizados usam o fluxo `client_credentials` (OAuth 2.0).

### Endpoint
```
POST https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token
Content-Type: application/x-www-form-urlencoded
```

### Parâmetros (camelCase)
| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| grantType | string | ✅ | `client_credentials` |
| clientId | string | ✅ | ID do aplicativo |
| clientSecret | string | ✅ | Chave secreta |

### Resposta
```json
{
  "accessToken": "eyJ...",
  "type": "Bearer",
  "expiresIn": 10800
}
```

### Tempos de Expiração
| Token/Código | Expiração |
|--------------|-----------|
| Access Token | 3 horas |
| Refresh Token | 168 horas (não usado em apps centralizados) |
| Código de Vínculo | 10 minutos |
| Código de Autorização | 5 minutos |

### Boas Práticas
- ✅ Usar `expiresIn` da resposta (nunca valores fixos)
- ✅ Renovar com margem de segurança (5 min antes)
- ✅ Tratar erro 401 renovando o token
- ✅ Não exceder rate limit
- ❌ Nunca expor clientSecret no frontend

### Erros Comuns
| Código | Causa | Solução |
|--------|-------|---------|
| 401 | Token expirado | Renovar token |
| 403 | Sem permissão | Verificar escopos/módulos |

---

## 🏪 Módulo 2: Merchant (Loja)

### Operações Disponíveis
| Operação | Descrição |
|----------|-----------|
| DELIVERY | Pedidos entregues no endereço |
| TAKEOUT | Pedidos retirados na loja |
| INDOOR | Consumo no local (indisponível) |

### Endpoints

#### Listar Lojas
```
GET /merchant/v1.0/merchants
Authorization: Bearer {token}
```

#### Detalhes da Loja
```
GET /merchant/v1.0/merchants/{merchantId}
Authorization: Bearer {token}
```

#### Status da Loja
```
GET /merchant/v1.0/merchants/{merchantId}/status
Authorization: Bearer {token}
```

**Estados Possíveis:**
| Estado | Cor | Ação |
|--------|-----|------|
| OK | 🟢 Verde | Nenhuma |
| WARNING | 🟡 Amarela | Nenhuma |
| CLOSED | ⚫ Cinza | Nenhuma |
| ERROR | 🔴 Vermelha | Verificar |

**Validações Retornadas:**
- `is-connected` - Polling a cada 30s
- `opening-hours` - Horário de funcionamento
- `unavailabilities` - Interrupções ativas
- `radius-restriction` - Entregadores na área
- `payout-blocked` - Pendências financeiras
- `logistics-blocked` - Problemas logísticos

### Interrupções

#### Listar Interrupções
```
GET /merchant/v1.0/merchants/{merchantId}/interruptions
```

#### Criar Interrupção
```
POST /merchant/v1.0/merchants/{merchantId}/interruptions
Content-Type: application/json

{
  "start": "2024-01-15T10:00:00",
  "end": "2024-01-15T14:00:00",
  "description": "Pausa para almoço"
}
```

⚠️ **Importante:** Interrupções seguem o fuso horário da loja.

#### Remover Interrupção
```
DELETE /merchant/v1.0/merchants/{merchantId}/interruptions/{interruptionId}
```

### Horários de Funcionamento

#### Consultar Horários
```
GET /merchant/v1.0/merchants/{merchantId}/opening-hours
```

#### Configurar Horários
```
PUT /merchant/v1.0/merchants/{merchantId}/opening-hours
Content-Type: application/json

{
  "storeId": "{merchantId}",
  "shifts": [
    {
      "dayOfWeek": "MONDAY",
      "start": "09:00:00",
      "duration": 360
    }
  ]
}
```

**Dias da Semana:**
- MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY

⚠️ **ATENÇÃO:** Este endpoint **substitui todos os horários**!
- Dias não enviados ficam como FECHADO
- `duration` em minutos (1439 = 23h59)

### QR Code Check-in
```
POST /merchant/v1.0/merchants/checkin-qrcode
Content-Type: application/json
Accept: application/pdf

{
  "merchantIds": ["merchant-id-1", "merchant-id-2"]
}
```
- Máximo: 20 lojas por requisição
- Retorna: PDF para impressão

---

## 📦 Módulo 3: Orders (Pedidos)

### Polling de Eventos
```
GET /order/v1.0/events:polling
Authorization: Bearer {token}
x-polling-merchants: {merchantId}
```

⚠️ **Obrigatório:** Fazer polling a cada **30 segundos** para manter loja online.

### Confirmar Recebimento (ACK)
```
POST /order/v1.0/events/acknowledgment
Content-Type: application/json

["event-id-1", "event-id-2"]
```

### Detalhes do Pedido
```
GET /order/v1.0/orders/{orderId}
```

### Ciclo de Vida do Pedido

```
PLACED → CONFIRMED → PREPARATION_STARTED → READY_TO_PICKUP → DISPATCHED → CONCLUDED
                                                    ↓
                                              (ou CANCELLED)
```

#### Confirmar Pedido
```
POST /order/v1.0/orders/{orderId}/confirm
```
⏰ **Deadline:** 8 minutos após `createdAt`

#### Iniciar Preparo
```
POST /order/v1.0/orders/{orderId}/startPreparation
```

#### Pronto para Retirada
```
POST /order/v1.0/orders/{orderId}/readyToPickup
```

#### Despachar
```
POST /order/v1.0/orders/{orderId}/dispatch
```

### Cancelamento

#### Motivos de Cancelamento
```
GET /order/v1.0/orders/{orderId}/cancellationReasons
```

#### Solicitar Cancelamento
```
POST /order/v1.0/orders/{orderId}/requestCancellation
Content-Type: application/json

{
  "cancellationCode": "501"
}
```

### Rastreamento
```
GET /order/v1.0/orders/{orderId}/tracking
```

---

## 🛒 Módulo 4: Item (Catálogo)

### Listar Catálogos
```
GET /catalog/v2.0/merchants/{merchantId}/catalogs
```

### Criar Produto
```
POST /catalog/v2.0/merchants/{merchantId}/products
Content-Type: application/json

{
  "name": "Produto Teste",
  "description": "Descrição",
  "price": {
    "value": 29.90
  },
  "serving": "SERVES_1",
  "dietaryRestrictions": []
}
```

### Atualizar Produto
```
PUT /catalog/v2.0/merchants/{merchantId}/products/{productId}
```

---

## 🏷️ Módulo 5: Promotion (Promoções)

### Tipos de Promoção
| Tipo | Descrição |
|------|-----------|
| PERCENTAGE | Desconto percentual (até 70%) |
| LXPY | Leve X Pague Y |
| PERCENTAGE_PER_X_UNITS | Desconto por quantidade |

### Criar Promoção
```
POST /promotion/v1.0/merchants/{merchantId}/promotions
Content-Type: application/json

{
  "type": "PERCENTAGE",
  "value": 20,
  "itemIds": ["item-id"],
  "startDate": "2024-01-15",
  "endDate": "2024-01-31"
}
```

### Remover Promoção
```
DELETE /promotion/v1.0/merchants/{merchantId}/promotions/{promotionId}
```

---

## 🛍️ Módulo 6: Picking (Separação)

Para mercados/groceries com separação de itens.

### Iniciar Separação
```
POST /picking/v1.0/orders/{orderId}/startSeparation
```

### Finalizar Separação
```
POST /picking/v1.0/orders/{orderId}/endSeparation
```

### Adicionar Item
```
POST /picking/v1.0/orders/{orderId}/items
Content-Type: application/json

{
  "productId": "product-id",
  "quantity": 2
}
```

### Modificar Item
```
PATCH /picking/v1.0/orders/{orderId}/items/{uniqueId}
Content-Type: application/json

{
  "quantity": 3
}
```

### Substituir Item
```
POST /picking/v1.0/orders/{orderId}/items/{uniqueId}/replace
Content-Type: application/json

{
  "replacementProductId": "new-product-id",
  "quantity": 1
}
```

### Remover Item (Ruptura)
```
DELETE /picking/v1.0/orders/{orderId}/items/{uniqueId}
```

---

## 🔄 Grupos de Eventos

| Grupo | Descrição |
|-------|-----------|
| ORDER_STATUS | Mudanças de status do pedido |
| DELIVERY | Eventos de entrega |
| CANCELLATION | Cancelamentos |
| TAKEOUT | Retirada na loja |
| ORDER_SCHEDULED | Agendamentos |
| CONSUMER | Ações do consumidor |
| FINANCIAL | Eventos financeiros |

---

## ⚠️ Erros Comuns

### 401 Unauthorized
- Token expirado → Renovar token

### 403 Forbidden
- `ifood-kong-validate-headers-plugin: forbidden` → Módulo não autorizado
- `user is forbidden to access merchant` → Merchant não autorizou

### 429 Too Many Requests
- Rate limit excedido → Aguardar

### Propagação de Permissões
Novas permissões podem demorar até **10 minutos** para propagar.

---

## 📋 Checklist de Integração

### Para Homologação
- [ ] GET /merchants
- [ ] GET /merchants/{id}
- [ ] GET /merchants/{id}/status
- [ ] POST /merchants/{id}/interruptions
- [ ] GET /merchants/{id}/interruptions
- [ ] DELETE /merchants/{id}/interruptions/{id}
- [ ] GET /merchants/{id}/opening-hours
- [ ] PUT /merchants/{id}/opening-hours

### Para Produção
- [ ] Polling a cada 30s
- [ ] Tratamento de 401
- [ ] Confirmação de pedidos < 8 min
- [ ] ACK de eventos
- [ ] Horários configurados
- [ ] Catálogo habilitado

---

## 🔗 Links Úteis

- [Portal do Parceiro](https://portal.ifood.com.br)
- [Portal do Desenvolvedor](https://developer.ifood.com.br)
- [Documentação Oficial](https://developer.ifood.com.br/docs)

---

*Documentação atualizada em Fevereiro 2026*
