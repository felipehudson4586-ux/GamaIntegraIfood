"""
iFood API Client - Integração completa com os 6 módulos do iFood
App CENTRALIZADO - usa client_credentials diretamente

Autenticação para apps centralizados:
- Endpoint: POST /authentication/v1.0/oauth/token
- Content-Type: application/x-www-form-urlencoded
- Parâmetros em camelCase: grantType, clientId, clientSecret
- Não recebe refresh_token (apenas access_token)
"""

import httpx
import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List, Any

logger = logging.getLogger(__name__)


class IFoodClient:
    """Cliente para integração com a API do iFood - App Centralizado"""
    
    BASE_URL = "https://merchant-api.ifood.com.br"
    
    def __init__(self):
        self.client_id = os.environ.get('IFOOD_CLIENT_ID')
        self.client_secret = os.environ.get('IFOOD_CLIENT_SECRET')
        self.merchant_id = os.environ.get('IFOOD_MERCHANT_ID')
        self._access_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None
        self._http_client: Optional[httpx.AsyncClient] = None
    
    async def _get_http_client(self) -> httpx.AsyncClient:
        """Retorna cliente HTTP reutilizável"""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=30.0)
        return self._http_client
    
    async def close(self):
        """Fecha o cliente HTTP"""
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
    
    # ==================== MÓDULO 1: AUTHENTICATION (Centralizado) ====================
    
    async def authenticate(self) -> Dict[str, Any]:
        """
        Obtém token de autenticação do iFood para app CENTRALIZADO
        Endpoint: POST /authentication/v1.0/oauth/token
        Content-Type: application/x-www-form-urlencoded
        
        Parâmetros (camelCase!):
        - grantType: client_credentials
        - clientId: ID do app
        - clientSecret: Secret do app
        """
        if not self.client_id or not self.client_secret:
            raise ValueError("IFOOD_CLIENT_ID e IFOOD_CLIENT_SECRET são obrigatórios")
        
        # Verifica se token atual ainda é válido (margem de 5 minutos)
        if self._access_token and self._token_expires_at:
            if datetime.now(timezone.utc) < self._token_expires_at - timedelta(minutes=5):
                return {
                    "accessToken": self._access_token,
                    "expiresAt": self._token_expires_at.isoformat(),
                    "cached": True
                }
        
        client = await self._get_http_client()
        
        # IMPORTANTE: Usar camelCase nos parâmetros!
        payload = {
            "grantType": "client_credentials",
            "clientId": self.client_id,
            "clientSecret": self.client_secret
        }
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/authentication/v1.0/oauth/token",
                data=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            response.raise_for_status()
            data = response.json()
            
            self._access_token = data.get("accessToken")
            expires_in = data.get("expiresIn", 3600)
            self._token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
            
            logger.info("Token iFood obtido com sucesso (app centralizado)")
            return {
                "accessToken": self._access_token,
                "expiresIn": expires_in,
                "expiresAt": self._token_expires_at.isoformat(),
                "type": data.get("type", "Bearer"),
                "cached": False
            }
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro de autenticação iFood: {e.response.status_code} - {e.response.text}")
            raise Exception(f"Erro de autenticação: {e.response.text}")
        except Exception as e:
            logger.error(f"Erro ao autenticar com iFood: {str(e)}")
            raise
    
    async def _get_headers(self) -> Dict[str, str]:
        """Retorna headers com token de autenticação"""
        await self.authenticate()
        return {
            "Authorization": f"Bearer {self._access_token}",
            "Content-Type": "application/json"
        }
    
    def get_auth_status(self) -> Dict[str, Any]:
        """Retorna status atual da autenticação"""
        token_valid = False
        if self._access_token and self._token_expires_at:
            token_valid = datetime.now(timezone.utc) < self._token_expires_at
        
        return {
            "has_credentials": bool(self.client_id and self.client_secret),
            "has_token": bool(self._access_token),
            "token_valid": token_valid,
            "token_expires_at": self._token_expires_at.isoformat() if self._token_expires_at else None,
            "merchant_id": self.merchant_id,
            "app_type": "centralized"
        }
    
    # ==================== MÓDULO 2: ORDERS ====================
    
    async def poll_events(self, categories: List[str] = None, groups: List[str] = None) -> Dict[str, Any]:
        """
        Polling de eventos - busca novos eventos a cada 30s
        Endpoint: GET /order/v1.0/events:polling
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        if self.merchant_id:
            headers["x-polling-merchants"] = self.merchant_id
        
        params = {}
        if categories:
            params["categories"] = ",".join(categories)
        if groups:
            params["groups"] = ",".join(groups)
        
        try:
            response = await client.get(
                f"{self.BASE_URL}/order/v1.0/events:polling",
                headers=headers,
                params=params
            )
            
            if response.status_code == 204:
                return {"events": [], "message": "Sem novos eventos"}
            
            response.raise_for_status()
            events = response.json()
            
            logger.info(f"Polling retornou {len(events)} eventos")
            return {"events": events, "count": len(events)}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro no polling: {e.response.status_code} - {e.response.text}")
            raise
    
    async def acknowledge_events(self, event_ids: List[str]) -> Dict[str, Any]:
        """
        Confirma recebimento de eventos (acknowledgment)
        Endpoint: POST /order/v1.0/events/acknowledgment
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/order/v1.0/events/acknowledgment",
                headers=headers,
                json=event_ids
            )
            response.raise_for_status()
            return {"acknowledged": event_ids, "success": True}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao confirmar eventos: {e.response.status_code}")
            raise
    
    async def get_order_details(self, order_id: str) -> Dict[str, Any]:
        """
        Obtém detalhes completos de um pedido
        Endpoint: GET /order/v1.0/orders/{id}
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.get(
                f"{self.BASE_URL}/order/v1.0/orders/{order_id}",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return {"error": "Pedido não encontrado", "order_id": order_id}
            raise
    
    async def get_order_virtual_bag(self, order_id: str) -> Dict[str, Any]:
        """
        Obtém detalhes do pedido para Groceries (virtual bag)
        Endpoint: GET /order/v1.0/orders/{id}/virtual-bag
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.get(
                f"{self.BASE_URL}/order/v1.0/orders/{order_id}/virtual-bag",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return {"error": "Virtual bag não encontrada", "order_id": order_id}
            raise
    
    async def confirm_order(self, order_id: str) -> Dict[str, Any]:
        """
        Confirma um pedido (resposta assíncrona - 202)
        Endpoint: POST /order/v1.0/orders/{id}/confirm
        Deadline: 8 minutos após createdAt
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/order/v1.0/orders/{order_id}/confirm",
                headers=headers
            )
            
            if response.status_code == 202:
                return {"order_id": order_id, "status": "confirmation_pending", "message": "Confirmação em processamento"}
            
            response.raise_for_status()
            return {"order_id": order_id, "status": "confirmed"}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao confirmar pedido: {e.response.status_code}")
            raise
    
    async def start_preparation(self, order_id: str) -> Dict[str, Any]:
        """
        Inicia preparo do pedido
        Endpoint: POST /order/v1.0/orders/{id}/startPreparation
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/order/v1.0/orders/{order_id}/startPreparation",
                headers=headers
            )
            response.raise_for_status()
            return {"order_id": order_id, "status": "preparation_started"}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao iniciar preparo: {e.response.status_code}")
            raise
    
    async def ready_to_pickup(self, order_id: str) -> Dict[str, Any]:
        """
        Marca pedido como pronto para retirada
        Endpoint: POST /order/v1.0/orders/{id}/readyToPickup
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/order/v1.0/orders/{order_id}/readyToPickup",
                headers=headers
            )
            response.raise_for_status()
            return {"order_id": order_id, "status": "ready_to_pickup"}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao marcar pronto: {e.response.status_code}")
            raise
    
    async def dispatch_order(self, order_id: str) -> Dict[str, Any]:
        """
        Despacha pedido para entrega
        Endpoint: POST /order/v1.0/orders/{id}/dispatch
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/order/v1.0/orders/{order_id}/dispatch",
                headers=headers
            )
            response.raise_for_status()
            return {"order_id": order_id, "status": "dispatched"}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao despachar: {e.response.status_code}")
            raise
    
    async def get_cancellation_reasons(self, order_id: str = None) -> List[Dict[str, Any]]:
        """
        Obtém lista de motivos de cancelamento válidos
        Endpoint: GET /order/v1.0/orders/{id}/cancellationReasons ou geral
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            if order_id:
                url = f"{self.BASE_URL}/order/v1.0/orders/{order_id}/cancellationReasons"
            else:
                url = f"{self.BASE_URL}/order/v1.0/orders/cancellationReasons"
            
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao buscar motivos: {e.response.status_code}")
            raise
    
    async def request_cancellation(self, order_id: str, cancellation_code: str) -> Dict[str, Any]:
        """
        Solicita cancelamento de pedido
        Endpoint: POST /order/v1.0/orders/{id}/requestCancellation
        Códigos: 501 (Sistema), 502 (Duplicado), 503 (Item indisponível), etc.
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/order/v1.0/orders/{order_id}/requestCancellation",
                headers=headers,
                json={"cancellationCode": cancellation_code}
            )
            
            if response.status_code == 202:
                return {"order_id": order_id, "status": "cancellation_pending"}
            
            response.raise_for_status()
            return {"order_id": order_id, "status": "cancelled"}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao cancelar: {e.response.status_code}")
            raise
    
    async def get_order_tracking(self, order_id: str) -> Dict[str, Any]:
        """
        Rastreia entrega do pedido
        Endpoint: GET /order/v1.0/orders/{id}/tracking
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.get(
                f"{self.BASE_URL}/order/v1.0/orders/{order_id}/tracking",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return {"error": "Tracking não disponível", "order_id": order_id}
            raise
    
    # ==================== MÓDULO 3: MERCHANT ====================
    
    async def get_merchants(self) -> List[Dict[str, Any]]:
        """
        Lista todos os merchants vinculados ao app
        Endpoint: GET /merchant/v1.0/merchants
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.get(
                f"{self.BASE_URL}/merchant/v1.0/merchants",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao listar merchants: {e.response.status_code}")
            raise
    
    async def get_merchant_details(self, merchant_id: str = None) -> Dict[str, Any]:
        """
        Obtém detalhes do estabelecimento
        Endpoint: GET /merchant/v1.0/merchants/{id}
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        try:
            response = await client.get(
                f"{self.BASE_URL}/merchant/v1.0/merchants/{mid}",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao buscar merchant: {e.response.status_code}")
            raise
    
    async def get_merchant_status(self, merchant_id: str = None) -> Dict[str, Any]:
        """
        Obtém status do estabelecimento (aberto/fechado)
        Endpoint: GET /merchant/v1.0/merchants/{id}/status
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        try:
            response = await client.get(
                f"{self.BASE_URL}/merchant/v1.0/merchants/{mid}/status",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao buscar status: {e.response.status_code}")
            raise
    
    # ==================== MÓDULO 4: ITEM (Catálogo) ====================
    
    async def get_catalogs(self, merchant_id: str = None) -> List[Dict[str, Any]]:
        """
        Lista catálogos do merchant
        Endpoint: GET /catalog/v2.0/merchants/{merchantId}/catalogs
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        try:
            response = await client.get(
                f"{self.BASE_URL}/catalog/v2.0/merchants/{mid}/catalogs",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao listar catálogos: {e.response.status_code}")
            raise
    
    async def get_products(self, merchant_id: str = None) -> List[Dict[str, Any]]:
        """
        Lista produtos do catálogo
        Endpoint: GET /catalog/v2.0/merchants/{merchantId}/products
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        try:
            response = await client.get(
                f"{self.BASE_URL}/catalog/v2.0/merchants/{mid}/products",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao listar produtos: {e.response.status_code}")
            raise
    
    async def create_product(self, product_data: Dict[str, Any], merchant_id: str = None) -> Dict[str, Any]:
        """
        Cria novo produto no catálogo
        Endpoint: POST /catalog/v2.0/merchants/{merchantId}/products
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/catalog/v2.0/merchants/{mid}/products",
                headers=headers,
                json=product_data
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao criar produto: {e.response.status_code} - {e.response.text}")
            raise
    
    async def update_product(self, product_id: str, product_data: Dict[str, Any], merchant_id: str = None) -> Dict[str, Any]:
        """
        Atualiza produto existente
        Endpoint: PUT /catalog/v2.0/merchants/{merchantId}/products/{productId}
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        try:
            response = await client.put(
                f"{self.BASE_URL}/catalog/v2.0/merchants/{mid}/products/{product_id}",
                headers=headers,
                json=product_data
            )
            response.raise_for_status()
            return {"success": True, "product_id": product_id}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao atualizar produto: {e.response.status_code}")
            raise
    
    async def update_product_status(self, updates: List[Dict[str, Any]], merchant_id: str = None) -> Dict[str, Any]:
        """
        Atualiza status de produtos em lote
        Endpoint: PATCH /catalog/v2.0/merchants/{merchantId}/products/status
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        try:
            response = await client.patch(
                f"{self.BASE_URL}/catalog/v2.0/merchants/{mid}/products/status",
                headers=headers,
                json=updates
            )
            response.raise_for_status()
            return {"success": True}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao atualizar status: {e.response.status_code}")
            raise
    
    # ==================== MÓDULO 5: PROMOTION ====================
    
    async def get_promotions(self, merchant_id: str = None) -> List[Dict[str, Any]]:
        """
        Lista promoções ativas
        Endpoint: GET /promotion/v1.0/merchants/{merchantId}/promotions
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        try:
            response = await client.get(
                f"{self.BASE_URL}/promotion/v1.0/merchants/{mid}/promotions",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao listar promoções: {e.response.status_code}")
            raise
    
    async def create_promotion(self, promotion_data: Dict[str, Any], merchant_id: str = None) -> Dict[str, Any]:
        """
        Cria nova promoção
        Endpoint: POST /promotion/v1.0/merchants/{merchantId}/promotions
        Tipos: PERCENTAGE, LXPY (Buy X Get Y), PERCENTAGE_PER_X_UNITS
        Limite: máximo 70% desconto
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/promotion/v1.0/merchants/{mid}/promotions",
                headers=headers,
                json=promotion_data
            )
            response.raise_for_status()
            return {"success": True, "promotion": promotion_data}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao criar promoção: {e.response.status_code}")
            raise
    
    async def delete_promotion(self, promotion_id: str, merchant_id: str = None) -> Dict[str, Any]:
        """
        Remove promoção
        Endpoint: DELETE /promotion/v1.0/merchants/{merchantId}/promotions/{promotionId}
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        try:
            response = await client.delete(
                f"{self.BASE_URL}/promotion/v1.0/merchants/{mid}/promotions/{promotion_id}",
                headers=headers
            )
            response.raise_for_status()
            return {"success": True, "promotion_id": promotion_id, "deleted": True}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao deletar promoção: {e.response.status_code}")
            raise
    
    # ==================== MÓDULO 6: PICKING (Separação) ====================
    
    async def start_separation(self, order_id: str) -> Dict[str, Any]:
        """
        Inicia separação de pedido (para mercados)
        Endpoint: POST /picking/v1.0/orders/{id}/startSeparation
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/picking/v1.0/orders/{order_id}/startSeparation",
                headers=headers
            )
            response.raise_for_status()
            return {"order_id": order_id, "status": "separation_started"}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao iniciar separação: {e.response.status_code}")
            raise
    
    async def end_separation(self, order_id: str) -> Dict[str, Any]:
        """
        Finaliza separação de pedido
        Endpoint: POST /picking/v1.0/orders/{id}/endSeparation
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/picking/v1.0/orders/{order_id}/endSeparation",
                headers=headers
            )
            response.raise_for_status()
            return {"order_id": order_id, "status": "separation_ended"}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao finalizar separação: {e.response.status_code}")
            raise
    
    async def add_picking_item(self, order_id: str, item_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Adiciona item durante separação
        Endpoint: POST /picking/v1.0/orders/{id}/items
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/picking/v1.0/orders/{order_id}/items",
                headers=headers,
                json=item_data
            )
            response.raise_for_status()
            return {"success": True, "order_id": order_id, "item_added": item_data}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao adicionar item: {e.response.status_code}")
            raise
    
    async def modify_picking_item(self, order_id: str, unique_id: str, modifications: Dict[str, Any]) -> Dict[str, Any]:
        """
        Modifica item durante separação (quantidade, peso)
        Endpoint: PATCH /picking/v1.0/orders/{id}/items/{uniqueId}
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.patch(
                f"{self.BASE_URL}/picking/v1.0/orders/{order_id}/items/{unique_id}",
                headers=headers,
                json=modifications
            )
            response.raise_for_status()
            return {"success": True, "order_id": order_id, "item_modified": unique_id}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao modificar item: {e.response.status_code}")
            raise
    
    async def replace_picking_item(self, order_id: str, unique_id: str, replacement: Dict[str, Any]) -> Dict[str, Any]:
        """
        Substitui item durante separação
        Endpoint: POST /picking/v1.0/orders/{id}/items/{uniqueId}/replace
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/picking/v1.0/orders/{order_id}/items/{unique_id}/replace",
                headers=headers,
                json=replacement
            )
            response.raise_for_status()
            return {"success": True, "order_id": order_id, "item_replaced": unique_id}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao substituir item: {e.response.status_code}")
            raise
    
    async def remove_picking_item(self, order_id: str, unique_id: str) -> Dict[str, Any]:
        """
        Remove item durante separação (ruptura de estoque)
        Endpoint: DELETE /picking/v1.0/orders/{id}/items/{uniqueId}
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.delete(
                f"{self.BASE_URL}/picking/v1.0/orders/{order_id}/items/{unique_id}",
                headers=headers
            )
            response.raise_for_status()
            return {"success": True, "order_id": order_id, "item_removed": unique_id}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao remover item: {e.response.status_code}")
            raise
    
    # ==================== HANDSHAKE / NEGOCIAÇÃO ====================
    
    async def accept_dispute(self, dispute_id: str) -> Dict[str, Any]:
        """
        Aceita disputa/negociação
        Endpoint: POST /order/v1.0/disputes/{disputeId}/accept
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/order/v1.0/disputes/{dispute_id}/accept",
                headers=headers
            )
            response.raise_for_status()
            return {"dispute_id": dispute_id, "action": "accepted"}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao aceitar disputa: {e.response.status_code}")
            raise
    
    async def reject_dispute(self, dispute_id: str, reason: str = None) -> Dict[str, Any]:
        """
        Rejeita disputa/negociação
        Endpoint: POST /order/v1.0/disputes/{disputeId}/reject
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        body = {}
        if reason:
            body["reason"] = reason
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/order/v1.0/disputes/{dispute_id}/reject",
                headers=headers,
                json=body if body else None
            )
            response.raise_for_status()
            return {"dispute_id": dispute_id, "action": "rejected"}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao rejeitar disputa: {e.response.status_code}")
            raise


# Instância global do cliente
ifood_client = IFoodClient()
