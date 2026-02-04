"""
iFood API Client - Integração completa com os 6 módulos do iFood
Baseado na documentação oficial do iFood Partner API

Fluxo de Autenticação OAuth:
1. Gerar userCode via /authentication/v1.0/oauth/userCode
2. Usuário autoriza no Portal iFood e recebe authorizationCode
3. Usar authorizationCode para obter accessToken
4. Usar refreshToken para renovar tokens
"""

import httpx
import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List, Any
import asyncio
import hashlib
import secrets
import base64

logger = logging.getLogger(__name__)

class IFoodClient:
    """Cliente para integração com a API do iFood"""
    
    BASE_URL = "https://merchant-api.ifood.com.br"
    
    def __init__(self):
        self.client_id = os.environ.get('IFOOD_CLIENT_ID')
        self.client_secret = os.environ.get('IFOOD_CLIENT_SECRET')
        self.merchant_id = os.environ.get('IFOOD_MERCHANT_ID')
        self._access_token: Optional[str] = None
        self._refresh_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None
        self._http_client: Optional[httpx.AsyncClient] = None
        
        # Para o fluxo de authorization_code
        self._code_verifier: Optional[str] = None
        self._user_code: Optional[str] = None
        self._verification_url: Optional[str] = None
    
    async def _get_http_client(self) -> httpx.AsyncClient:
        """Retorna cliente HTTP reutilizável"""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=30.0)
        return self._http_client
    
    async def close(self):
        """Fecha o cliente HTTP"""
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
    
    def _generate_code_verifier(self) -> str:
        """Gera code_verifier para PKCE"""
        return secrets.token_urlsafe(64)
    
    def _generate_code_challenge(self, verifier: str) -> str:
        """Gera code_challenge a partir do verifier (S256)"""
        digest = hashlib.sha256(verifier.encode()).digest()
        return base64.urlsafe_b64encode(digest).rstrip(b'=').decode()
    
    # ==================== MÓDULO 1: AUTHENTICATION ====================
    
    async def generate_user_code(self) -> Dict[str, Any]:
        """
        Passo 1: Gera userCode para autorização do usuário
        Endpoint: POST /authentication/v1.0/oauth/userCode
        
        Retorna:
        - userCode: código para o usuário inserir no Portal iFood
        - verificationUrl: URL para autorização
        - verificationUrlComplete: URL completa com código
        - authorizationCodeVerifier: código para usar na autenticação
        """
        if not self.client_id:
            raise ValueError("IFOOD_CLIENT_ID é obrigatório")
        
        client = await self._get_http_client()
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/authentication/v1.0/oauth/userCode",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={"clientId": self.client_id}
            )
            response.raise_for_status()
            data = response.json()
            
            # Salva para uso posterior
            self._user_code = data.get("userCode")
            self._verification_url = data.get("verificationUrlComplete")
            self._code_verifier = data.get("authorizationCodeVerifier")
            
            logger.info(f"UserCode gerado: {self._user_code}")
            return {
                "userCode": data.get("userCode"),
                "verificationUrl": data.get("verificationUrl"),
                "verificationUrlComplete": data.get("verificationUrlComplete"),
                "authorizationCodeVerifier": data.get("authorizationCodeVerifier"),
                "expiresIn": data.get("expiresIn", 600)
            }
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao gerar userCode: {e.response.status_code} - {e.response.text}")
            raise
    
    async def authenticate_with_code(self, authorization_code: str, code_verifier: str = None) -> Dict[str, Any]:
        """
        Passo 2: Troca authorizationCode por accessToken
        Endpoint: POST /authentication/v1.0/oauth/token
        
        Args:
            authorization_code: código recebido pelo usuário após autorizar
            code_verifier: authorizationCodeVerifier retornado no passo 1
        """
        if not self.client_id or not self.client_secret:
            raise ValueError("IFOOD_CLIENT_ID e IFOOD_CLIENT_SECRET são obrigatórios")
        
        verifier = code_verifier or self._code_verifier
        if not verifier:
            raise ValueError("authorizationCodeVerifier é obrigatório")
        
        client = await self._get_http_client()
        
        # iFood aceita JSON no body para token
        payload = {
            "grantType": "authorization_code",
            "clientId": self.client_id,
            "clientSecret": self.client_secret,
            "authorizationCode": authorization_code,
            "authorizationCodeVerifier": verifier
        }
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/authentication/v1.0/oauth/token",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data=payload
            )
            response.raise_for_status()
            data = response.json()
            
            self._access_token = data.get("accessToken")
            self._refresh_token = data.get("refreshToken")
            expires_in = data.get("expiresIn", 3600)
            self._token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
            
            logger.info("Token iFood obtido com sucesso via authorization_code")
            return {
                "access_token": self._access_token,
                "refresh_token": self._refresh_token,
                "expires_at": self._token_expires_at.isoformat(),
                "expires_in": expires_in,
                "token_type": data.get("type", "Bearer")
            }
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro de autenticação iFood: {e.response.status_code} - {e.response.text}")
            raise
    
    async def refresh_access_token(self) -> Dict[str, Any]:
        """
        Renova accessToken usando refreshToken
        Endpoint: POST /authentication/v1.0/oauth/token
        """
        if not self._refresh_token:
            raise ValueError("refreshToken não disponível. Faça autenticação primeiro.")
        
        client = await self._get_http_client()
        
        payload = {
            "grantType": "refresh_token",
            "clientId": self.client_id,
            "clientSecret": self.client_secret,
            "refreshToken": self._refresh_token
        }
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/authentication/v1.0/oauth/token",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data=payload
            )
            response.raise_for_status()
            data = response.json()
            
            self._access_token = data.get("accessToken")
            # Refresh token pode ser renovado também
            if data.get("refreshToken"):
                self._refresh_token = data.get("refreshToken")
            expires_in = data.get("expiresIn", 3600)
            self._token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
            
            logger.info("Token renovado com sucesso")
            return {
                "access_token": self._access_token,
                "expires_at": self._token_expires_at.isoformat(),
                "expires_in": expires_in
            }
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao renovar token: {e.response.status_code} - {e.response.text}")
            raise
    
    async def ensure_token(self) -> str:
        """
        Garante que há um token válido disponível
        Renova automaticamente se necessário
        """
        if self._access_token and self._token_expires_at:
            # Renova 5 minutos antes de expirar
            if datetime.now(timezone.utc) < self._token_expires_at - timedelta(minutes=5):
                return self._access_token
            
            # Tenta renovar com refresh_token
            if self._refresh_token:
                try:
                    await self.refresh_access_token()
                    return self._access_token
                except Exception as e:
                    logger.warning(f"Falha ao renovar token: {e}")
        
        # Sem token válido - precisa de nova autenticação
        raise ValueError("Token não disponível. Execute o fluxo de autorização primeiro.")
    
    def set_tokens(self, access_token: str, refresh_token: str = None, expires_in: int = 3600):
        """
        Define tokens manualmente (útil para restaurar de banco de dados)
        """
        self._access_token = access_token
        self._refresh_token = refresh_token
        self._token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    
    def get_auth_status(self) -> Dict[str, Any]:
        """Retorna status atual da autenticação"""
        return {
            "has_credentials": bool(self.client_id and self.client_secret),
            "has_token": bool(self._access_token),
            "has_refresh_token": bool(self._refresh_token),
            "token_valid": self._token_expires_at and datetime.now(timezone.utc) < self._token_expires_at if self._token_expires_at else False,
            "token_expires_at": self._token_expires_at.isoformat() if self._token_expires_at else None,
            "merchant_id": self.merchant_id,
            "pending_user_code": self._user_code,
            "verification_url": self._verification_url
        }
    
    async def _get_headers(self) -> Dict[str, str]:
        """Retorna headers com token de autenticação"""
        token = await self.ensure_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
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
            logger.error(f"Erro no polling: {e.response.status_code}")
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
    
    async def confirm_order(self, order_id: str) -> Dict[str, Any]:
        """
        Confirma um pedido (resposta assíncrona - 202)
        Endpoint: POST /order/v1.0/orders/{id}/confirm
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/order/v1.0/orders/{order_id}/confirm",
                headers=headers
            )
            
            if response.status_code == 202:
                return {"order_id": order_id, "status": "confirmation_pending"}
            
            response.raise_for_status()
            return {"order_id": order_id, "status": "confirmed"}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao confirmar pedido: {e.response.status_code}")
            raise
    
    async def start_preparation(self, order_id: str) -> Dict[str, Any]:
        """Inicia preparo do pedido"""
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
        """Marca pedido como pronto para retirada"""
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
        """Despacha pedido para entrega"""
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
    
    async def request_cancellation(self, order_id: str, cancellation_code: str) -> Dict[str, Any]:
        """
        Solicita cancelamento de pedido
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
        """Rastreia entrega do pedido"""
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
    
    async def get_merchant_details(self, merchant_id: str = None) -> Dict[str, Any]:
        """Obtém detalhes do estabelecimento"""
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
        """Obtém status do estabelecimento (aberto/fechado)"""
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
    
    async def get_items(self, merchant_id: str = None) -> List[Dict[str, Any]]:
        """Lista itens do catálogo"""
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        try:
            response = await client.get(
                f"{self.BASE_URL}/catalog/v2.0/merchants/{mid}/items",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao listar itens: {e.response.status_code}")
            raise
    
    async def create_item(self, item_data: Dict[str, Any], merchant_id: str = None, reset: bool = False) -> Dict[str, Any]:
        """Cria novo item no catálogo"""
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/catalog/v2.0/merchants/{mid}/items",
                headers=headers,
                params={"reset": str(reset).lower()},
                json=item_data
            )
            response.raise_for_status()
            return {"success": True, "item": item_data}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao criar item: {e.response.status_code}")
            raise
    
    async def update_item(self, item_id: str, updates: Dict[str, Any], merchant_id: str = None) -> Dict[str, Any]:
        """Atualiza item existente"""
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        try:
            response = await client.patch(
                f"{self.BASE_URL}/catalog/v2.0/merchants/{mid}/items/{item_id}",
                headers=headers,
                json=updates
            )
            response.raise_for_status()
            return {"success": True, "item_id": item_id, "updates": updates}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao atualizar item: {e.response.status_code}")
            raise
    
    # ==================== MÓDULO 5: PROMOTION ====================
    
    async def get_promotions(self, merchant_id: str = None) -> List[Dict[str, Any]]:
        """Lista promoções ativas"""
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
        """Cria nova promoção (máximo 70% desconto)"""
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
        """Remove promoção"""
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
        """Inicia separação de pedido (para mercados)"""
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/order/v1.0/orders/{order_id}/startSeparation",
                headers=headers
            )
            response.raise_for_status()
            return {"order_id": order_id, "status": "separation_started"}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao iniciar separação: {e.response.status_code}")
            raise
    
    async def end_separation(self, order_id: str) -> Dict[str, Any]:
        """Finaliza separação de pedido"""
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/order/v1.0/orders/{order_id}/endSeparation",
                headers=headers
            )
            response.raise_for_status()
            return {"order_id": order_id, "status": "separation_ended"}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao finalizar separação: {e.response.status_code}")
            raise
    
    async def add_picking_item(self, order_id: str, item_data: Dict[str, Any]) -> Dict[str, Any]:
        """Adiciona item durante separação"""
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/order/v1.0/orders/{order_id}/picking/items",
                headers=headers,
                json=item_data
            )
            response.raise_for_status()
            return {"success": True, "order_id": order_id, "item_added": item_data}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao adicionar item: {e.response.status_code}")
            raise
    
    async def modify_picking_item(self, order_id: str, unique_id: str, modifications: Dict[str, Any]) -> Dict[str, Any]:
        """Modifica item durante separação (quantidade, peso)"""
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/order/v1.0/orders/{order_id}/picking/items/{unique_id}",
                headers=headers,
                json=modifications
            )
            response.raise_for_status()
            return {"success": True, "order_id": order_id, "item_modified": unique_id}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao modificar item: {e.response.status_code}")
            raise
    
    async def replace_picking_item(self, order_id: str, unique_id: str, replacement: Dict[str, Any]) -> Dict[str, Any]:
        """Substitui item durante separação"""
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/order/v1.0/orders/{order_id}/picking/items/{unique_id}/replace",
                headers=headers,
                json=replacement
            )
            response.raise_for_status()
            return {"success": True, "order_id": order_id, "item_replaced": unique_id}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao substituir item: {e.response.status_code}")
            raise
    
    async def remove_picking_item(self, order_id: str, unique_id: str) -> Dict[str, Any]:
        """Remove item durante separação (ruptura de estoque)"""
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.delete(
                f"{self.BASE_URL}/order/v1.0/orders/{order_id}/picking/items/{unique_id}",
                headers=headers
            )
            response.raise_for_status()
            return {"success": True, "order_id": order_id, "item_removed": unique_id}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao remover item: {e.response.status_code}")
            raise


# Instância global do cliente
ifood_client = IFoodClient()
