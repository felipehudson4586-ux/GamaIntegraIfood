"""
iFood API Client - Integração completa com os módulos do iFood
App CENTRALIZADO - usa client_credentials diretamente

Autenticação para apps centralizados:
- Endpoint: POST /authentication/v1.0/oauth/token
- Content-Type: application/x-www-form-urlencoded
- Parâmetros em camelCase: grantType, clientId, clientSecret
- Não recebe refresh_token (apenas access_token)
- Token expira em 3 horas (usar expiresIn da resposta)
- Requisições sem autenticação serão rejeitadas
- Usar HTTPS com TLS 1.2 ou superior
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
        self._token_expires_in: Optional[int] = None
        self._http_client: Optional[httpx.AsyncClient] = None
    
    async def _get_http_client(self) -> httpx.AsyncClient:
        """Retorna cliente HTTP reutilizável com TLS 1.2+"""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                timeout=30.0,
                http2=True  # Suporta HTTP/2 com TLS
            )
        return self._http_client
    
    async def close(self):
        """Fecha o cliente HTTP"""
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
    
    # ==================== MÓDULO 1: AUTHENTICATION (Centralizado) ====================
    
    def _is_token_valid(self) -> bool:
        """
        Verifica se o token atual é válido.
        Implementa renovação baseada no expiresIn recebido com margem de segurança.
        """
        if not self._access_token or not self._token_expires_at:
            return False
        
        # Margem de segurança de 5 minutos antes da expiração
        margin = timedelta(minutes=5)
        return datetime.now(timezone.utc) < (self._token_expires_at - margin)
    
    async def authenticate(self, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Obtém token de autenticação do iFood para app CENTRALIZADO
        
        Endpoint: POST /authentication/v1.0/oauth/token
        Content-Type: application/x-www-form-urlencoded
        
        Parâmetros (camelCase):
        - grantType: client_credentials
        - clientId: ID do app
        - clientSecret: Secret do app
        
        Apps centralizados NÃO recebem refresh_token.
        Quando token expira, deve-se solicitar novo token via esta API.
        """
        if not self.client_id or not self.client_secret:
            raise ValueError("IFOOD_CLIENT_ID e IFOOD_CLIENT_SECRET são obrigatórios")
        
        # Reutiliza token válido (evita rate limit)
        if not force_refresh and self._is_token_valid():
            logger.debug("Reutilizando token válido existente")
            return {
                "accessToken": self._access_token,
                "expiresIn": self._token_expires_in,
                "expiresAt": self._token_expires_at.isoformat(),
                "type": "Bearer",
                "cached": True
            }
        
        client = await self._get_http_client()
        
        # Parâmetros em camelCase conforme documentação
        payload = {
            "grantType": "client_credentials",
            "clientId": self.client_id,
            "clientSecret": self.client_secret
        }
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/authentication/v1.0/oauth/token",
                data=payload,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "accept": "application/json"
                }
            )
            response.raise_for_status()
            data = response.json()
            
            # Armazena token (máximo 8000 caracteres conforme doc)
            self._access_token = data.get("accessToken")
            
            # Usa expiresIn da resposta (não valores fixos!)
            # Padrão: 3 horas = 10800 segundos
            self._token_expires_in = data.get("expiresIn", 10800)
            self._token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=self._token_expires_in)
            
            logger.info(f"Token iFood obtido com sucesso. Expira em {self._token_expires_in}s")
            return {
                "accessToken": self._access_token,
                "expiresIn": self._token_expires_in,
                "expiresAt": self._token_expires_at.isoformat(),
                "type": data.get("type", "Bearer"),
                "cached": False
            }
        except httpx.HTTPStatusError as e:
            error_msg = f"Erro de autenticação iFood: {e.response.status_code}"
            logger.error(f"{error_msg} - {e.response.text}")
            
            # Limpa token inválido
            self._access_token = None
            self._token_expires_at = None
            
            raise Exception(f"{error_msg}: {e.response.text}")
        except Exception as e:
            logger.error(f"Erro ao autenticar com iFood: {str(e)}")
            raise
    
    async def _get_headers(self) -> Dict[str, str]:
        """
        Retorna headers com token de autenticação.
        Renova automaticamente se token expirado.
        """
        await self.authenticate()
        return {
            "Authorization": f"Bearer {self._access_token}",
            "Content-Type": "application/json",
            "accept": "application/json"
        }
    
    async def _handle_response(self, response: httpx.Response, retry_auth: bool = True) -> Dict[str, Any]:
        """
        Trata resposta da API com suporte a retry em 401.
        
        Quando token expira, APIs retornam 401.
        Este método renova o token automaticamente.
        """
        if response.status_code == 401 and retry_auth:
            logger.warning("Token expirado (401). Renovando...")
            await self.authenticate(force_refresh=True)
            return None  # Indica que deve retry
        
        if response.status_code == 403:
            error_data = response.json() if response.text else {}
            raise PermissionError(f"Acesso proibido (403): {error_data}")
        
        response.raise_for_status()
        
        if response.status_code == 204:
            return {"message": "No content", "status": 204}
        
        return response.json()
    
    def get_auth_status(self) -> Dict[str, Any]:
        """Retorna status atual da autenticação"""
        token_valid = self._is_token_valid()
        time_remaining = None
        
        if self._token_expires_at:
            remaining = self._token_expires_at - datetime.now(timezone.utc)
            time_remaining = max(0, int(remaining.total_seconds()))
        
        return {
            "has_credentials": bool(self.client_id and self.client_secret),
            "has_token": bool(self._access_token),
            "token_valid": token_valid,
            "token_expires_at": self._token_expires_at.isoformat() if self._token_expires_at else None,
            "token_expires_in": self._token_expires_in,
            "time_remaining_seconds": time_remaining,
            "merchant_id": self.merchant_id,
            "app_type": "centralized"
        }
    
    # ==================== MÓDULO 2: MERCHANT ====================
    
    async def get_merchants(self) -> List[Dict[str, Any]]:
        """
        Lista todas as lojas vinculadas ao token de acesso.
        Endpoint: GET /merchant/v1.0/merchants
        
        Retorna: ID, nome e nome corporativo das lojas.
        
        Use para verificar se o token tem as permissões corretas
        para o merchant recém adicionado.
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.get(
                f"{self.BASE_URL}/merchant/v1.0/merchants",
                headers=headers
            )
            
            result = await self._handle_response(response)
            if result is None:
                # Retry após renovar token
                headers = await self._get_headers()
                response = await client.get(
                    f"{self.BASE_URL}/merchant/v1.0/merchants",
                    headers=headers
                )
                result = await self._handle_response(response, retry_auth=False)
            
            logger.info(f"Listados {len(result) if isinstance(result, list) else 0} merchants")
            return result if isinstance(result, list) else []
        except Exception as e:
            logger.error(f"Erro ao listar merchants: {str(e)}")
            raise
    
    async def get_merchant_details(self, merchant_id: str = None) -> Dict[str, Any]:
        """
        Obtém detalhes de uma loja específica.
        Endpoint: GET /merchant/v1.0/merchants/{id}
        
        Retorna: Nome, endereço e operações disponíveis.
        
        Operações disponíveis:
        - DELIVERY: Pedidos entregues no endereço do cliente
        - TAKEOUT: Pedidos retirados pelo cliente na loja
        - INDOOR: Pedidos consumidos na loja (indisponível no momento)
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        if not mid:
            raise ValueError("merchant_id é obrigatório")
        
        try:
            response = await client.get(
                f"{self.BASE_URL}/merchant/v1.0/merchants/{mid}",
                headers=headers
            )
            
            result = await self._handle_response(response)
            if result is None:
                headers = await self._get_headers()
                response = await client.get(
                    f"{self.BASE_URL}/merchant/v1.0/merchants/{mid}",
                    headers=headers
                )
                result = await self._handle_response(response, retry_auth=False)
            
            return result
        except Exception as e:
            logger.error(f"Erro ao buscar detalhes do merchant {mid}: {str(e)}")
            raise
    
    async def get_merchant_status(self, merchant_id: str = None) -> Dict[str, Any]:
        """
        Verifica se uma loja pode receber pedidos.
        Endpoint: GET /merchant/v1.0/merchants/{id}/status
        
        Estados possíveis:
        - OK (Verde): Loja online
        - WARNING (Amarela): Online com restrições
        - CLOSED (Cinza): Fechada conforme esperado
        - ERROR (Vermelha): Fechada inesperadamente
        
        Validações sempre retornadas:
        - is-connected: Polling a cada 30 segundos
        - opening-hours: Dentro do horário de funcionamento
        
        Validações em ERROR/WARNING:
        - unavailabilities: Há interrupção ativa
        - radius-restriction: Sem entregadores na área
        - payout-blocked: Pendências financeiras
        - logistics-blocked: Problemas logísticos
        - terms-service-violation: Violação dos Termos
        - status-availability: Loja desativada ou em teste
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        if not mid:
            raise ValueError("merchant_id é obrigatório")
        
        try:
            response = await client.get(
                f"{self.BASE_URL}/merchant/v1.0/merchants/{mid}/status",
                headers=headers
            )
            
            result = await self._handle_response(response)
            if result is None:
                headers = await self._get_headers()
                response = await client.get(
                    f"{self.BASE_URL}/merchant/v1.0/merchants/{mid}/status",
                    headers=headers
                )
                result = await self._handle_response(response, retry_auth=False)
            
            return result
        except Exception as e:
            logger.error(f"Erro ao buscar status do merchant {mid}: {str(e)}")
            raise
    
    async def get_interruptions(self, merchant_id: str = None) -> List[Dict[str, Any]]:
        """
        Lista interrupções ativas e futuras de uma loja.
        Endpoint: GET /merchant/v1.0/merchants/{id}/interruptions
        
        Interrupções fecham temporariamente uma loja para parar de receber pedidos.
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        if not mid:
            raise ValueError("merchant_id é obrigatório")
        
        try:
            response = await client.get(
                f"{self.BASE_URL}/merchant/v1.0/merchants/{mid}/interruptions",
                headers=headers
            )
            
            result = await self._handle_response(response)
            if result is None:
                headers = await self._get_headers()
                response = await client.get(
                    f"{self.BASE_URL}/merchant/v1.0/merchants/{mid}/interruptions",
                    headers=headers
                )
                result = await self._handle_response(response, retry_auth=False)
            
            return result if isinstance(result, list) else []
        except Exception as e:
            logger.error(f"Erro ao listar interrupções: {str(e)}")
            raise
    
    async def create_interruption(
        self, 
        start: str, 
        end: str, 
        description: str = "Interrupção via API",
        merchant_id: str = None
    ) -> Dict[str, Any]:
        """
        Cria uma interrupção para fechar temporariamente a loja.
        Endpoint: POST /merchant/v1.0/merchants/{id}/interruptions
        
        Args:
            start: Data/hora início no formato ISO 8601 (ex: 2024-01-15T10:00:00)
            end: Data/hora fim no formato ISO 8601
            description: Descrição da interrupção
            merchant_id: ID do merchant (opcional, usa o configurado)
        
        IMPORTANTE:
        - Interrupções seguem o fuso horário da loja
        - O timezone enviado no payload será descartado
        - O fechamento pode levar alguns segundos para efetivar
        - Continue fazendo polling para não perder pedidos
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        if not mid:
            raise ValueError("merchant_id é obrigatório")
        
        payload = {
            "start": start,
            "end": end,
            "description": description
        }
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/merchant/v1.0/merchants/{mid}/interruptions",
                headers=headers,
                json=payload
            )
            
            result = await self._handle_response(response)
            if result is None:
                headers = await self._get_headers()
                response = await client.post(
                    f"{self.BASE_URL}/merchant/v1.0/merchants/{mid}/interruptions",
                    headers=headers,
                    json=payload
                )
                result = await self._handle_response(response, retry_auth=False)
            
            logger.info(f"Interrupção criada para merchant {mid}")
            return result
        except Exception as e:
            logger.error(f"Erro ao criar interrupção: {str(e)}")
            raise
    
    async def delete_interruption(self, interruption_id: str, merchant_id: str = None) -> Dict[str, Any]:
        """
        Remove uma interrupção da loja.
        Endpoint: DELETE /merchant/v1.0/merchants/{id}/interruptions/{interruptionId}
        
        Use quando a loja puder reabrir antes do fim previsto.
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        if not mid:
            raise ValueError("merchant_id é obrigatório")
        
        try:
            response = await client.delete(
                f"{self.BASE_URL}/merchant/v1.0/merchants/{mid}/interruptions/{interruption_id}",
                headers=headers
            )
            
            if response.status_code == 204:
                logger.info(f"Interrupção {interruption_id} removida")
                return {"success": True, "interruption_id": interruption_id}
            
            result = await self._handle_response(response)
            if result is None:
                headers = await self._get_headers()
                response = await client.delete(
                    f"{self.BASE_URL}/merchant/v1.0/merchants/{mid}/interruptions/{interruption_id}",
                    headers=headers
                )
                if response.status_code == 204:
                    return {"success": True, "interruption_id": interruption_id}
                result = await self._handle_response(response, retry_auth=False)
            
            return result
        except Exception as e:
            logger.error(f"Erro ao remover interrupção: {str(e)}")
            raise
    
    async def get_opening_hours(self, merchant_id: str = None) -> Dict[str, Any]:
        """
        Consulta horários de funcionamento da loja.
        Endpoint: GET /merchant/v1.0/merchants/{id}/opening-hours
        
        NOTA: Esta API gerencia apenas o horário padrão do iFood Marketplace.
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        if not mid:
            raise ValueError("merchant_id é obrigatório")
        
        try:
            response = await client.get(
                f"{self.BASE_URL}/merchant/v1.0/merchants/{mid}/opening-hours",
                headers=headers
            )
            
            result = await self._handle_response(response)
            if result is None:
                headers = await self._get_headers()
                response = await client.get(
                    f"{self.BASE_URL}/merchant/v1.0/merchants/{mid}/opening-hours",
                    headers=headers
                )
                result = await self._handle_response(response, retry_auth=False)
            
            return result
        except Exception as e:
            logger.error(f"Erro ao buscar horários: {str(e)}")
            raise
    
    async def set_opening_hours(self, shifts: List[Dict[str, Any]], merchant_id: str = None) -> Dict[str, Any]:
        """
        Define horários de funcionamento da loja.
        Endpoint: PUT /merchant/v1.0/merchants/{id}/opening-hours
        
        ATENÇÃO: Este endpoint SUBSTITUI todos os horários!
        - Dias não enviados serão removidos (loja fechada nesses dias)
        - Múltiplos horários permitidos no mesmo dia (sem sobreposição)
        - Intervalo válido: 00:00 a 23:59
        
        Args:
            shifts: Lista de turnos com formato:
                {
                    "dayOfWeek": "MONDAY" | "TUESDAY" | ... | "SUNDAY",
                    "start": "HH:MM:SS",
                    "duration": int (minutos)
                }
            merchant_id: ID do merchant (opcional)
        
        Exemplo de shift:
            {"dayOfWeek": "MONDAY", "start": "09:00:00", "duration": 360}
            = Segunda das 09:00 às 15:00 (360 min = 6h)
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        if not mid:
            raise ValueError("merchant_id é obrigatório")
        
        payload = {
            "storeId": mid,
            "shifts": shifts
        }
        
        try:
            response = await client.put(
                f"{self.BASE_URL}/merchant/v1.0/merchants/{mid}/opening-hours",
                headers=headers,
                json=payload
            )
            
            result = await self._handle_response(response)
            if result is None:
                headers = await self._get_headers()
                response = await client.put(
                    f"{self.BASE_URL}/merchant/v1.0/merchants/{mid}/opening-hours",
                    headers=headers,
                    json=payload
                )
                result = await self._handle_response(response, retry_auth=False)
            
            logger.info(f"Horários atualizados para merchant {mid}")
            return result if result else {"success": True}
        except Exception as e:
            logger.error(f"Erro ao atualizar horários: {str(e)}")
            raise
    
    async def generate_checkin_qrcode(self, merchant_ids: List[str] = None) -> bytes:
        """
        Gera PDF com QR code para check-in de entregadores.
        Endpoint: POST /merchant/v1.0/merchants/checkin-qrcode
        
        Limites:
        - Máximo: 20 lojas por requisição
        - Todas as lojas devem estar vinculadas ao token
        
        Retorna: Arquivo PDF em bytes (pronto para impressão)
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        # Usa merchant configurado se não especificado
        mids = merchant_ids or ([self.merchant_id] if self.merchant_id else [])
        
        if not mids:
            raise ValueError("Pelo menos um merchant_id é obrigatório")
        
        if len(mids) > 20:
            raise ValueError("Máximo de 20 merchants por requisição")
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/merchant/v1.0/merchants/checkin-qrcode",
                headers={**headers, "accept": "application/pdf"},
                json={"merchantIds": mids}
            )
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
                response = await client.post(
                    f"{self.BASE_URL}/merchant/v1.0/merchants/checkin-qrcode",
                    headers={**headers, "accept": "application/pdf"},
                    json={"merchantIds": mids}
                )
            
            response.raise_for_status()
            
            logger.info(f"QR code gerado para {len(mids)} merchants")
            return response.content
        except Exception as e:
            logger.error(f"Erro ao gerar QR code: {str(e)}")
            raise
    
    # ==================== MÓDULO 3: ORDERS ====================
    
    async def poll_events(self, categories: List[str] = None, groups: List[str] = None) -> Dict[str, Any]:
        """
        Polling de eventos - busca novos eventos a cada 30s
        Endpoint: GET /order/v1.0/events:polling
        
        Este polling mantém o merchant ativo na plataforma.
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
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
                if self.merchant_id:
                    headers["x-polling-merchants"] = self.merchant_id
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
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
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
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
                response = await client.get(
                    f"{self.BASE_URL}/order/v1.0/orders/{order_id}",
                    headers=headers
                )
            
            if response.status_code == 404:
                return {"error": "Pedido não encontrado", "order_id": order_id}
            
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
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
                response = await client.get(
                    f"{self.BASE_URL}/order/v1.0/orders/{order_id}/virtual-bag",
                    headers=headers
                )
            
            if response.status_code == 404:
                return {"error": "Virtual bag não encontrada", "order_id": order_id}
            
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
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
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
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
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
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
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
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
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
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
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
        """
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/order/v1.0/orders/{order_id}/requestCancellation",
                headers=headers,
                json={"cancellationCode": cancellation_code}
            )
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
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
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
                response = await client.get(
                    f"{self.BASE_URL}/order/v1.0/orders/{order_id}/tracking",
                    headers=headers
                )
            
            if response.status_code == 404:
                return {"error": "Tracking não disponível", "order_id": order_id}
            
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return {"error": "Tracking não disponível", "order_id": order_id}
            raise
    
    # ==================== MÓDULO 4: ITEM (Catálogo) ====================
    
    async def get_catalogs(self, merchant_id: str = None) -> List[Dict[str, Any]]:
        """Lista catálogos do merchant"""
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        try:
            response = await client.get(
                f"{self.BASE_URL}/catalog/v2.0/merchants/{mid}/catalogs",
                headers=headers
            )
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
                response = await client.get(
                    f"{self.BASE_URL}/catalog/v2.0/merchants/{mid}/catalogs",
                    headers=headers
                )
            
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao listar catálogos: {e.response.status_code}")
            raise
    
    async def create_item(self, item_data: Dict[str, Any], merchant_id: str = None) -> Dict[str, Any]:
        """Cria novo item no catálogo"""
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/catalog/v2.0/merchants/{mid}/products",
                headers=headers,
                json=item_data
            )
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
                response = await client.post(
                    f"{self.BASE_URL}/catalog/v2.0/merchants/{mid}/products",
                    headers=headers,
                    json=item_data
                )
            
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao criar item: {e.response.status_code} - {e.response.text}")
            raise
    
    async def update_item(self, item_id: str, item_data: Dict[str, Any], merchant_id: str = None) -> Dict[str, Any]:
        """Atualiza item existente"""
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        try:
            response = await client.put(
                f"{self.BASE_URL}/catalog/v2.0/merchants/{mid}/products/{item_id}",
                headers=headers,
                json=item_data
            )
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
                response = await client.put(
                    f"{self.BASE_URL}/catalog/v2.0/merchants/{mid}/products/{item_id}",
                    headers=headers,
                    json=item_data
                )
            
            response.raise_for_status()
            return {"success": True, "product_id": item_id}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao atualizar item: {e.response.status_code}")
            raise
    
    # ==================== MÓDULO 5: PROMOTION ====================
    
    async def create_promotion(self, promotion_data: Dict[str, Any], merchant_id: str = None) -> Dict[str, Any]:
        """Cria nova promoção"""
        client = await self._get_http_client()
        headers = await self._get_headers()
        mid = merchant_id or self.merchant_id
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/promotion/v1.0/merchants/{mid}/promotions",
                headers=headers,
                json=promotion_data
            )
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
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
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
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
                f"{self.BASE_URL}/picking/v1.0/orders/{order_id}/startSeparation",
                headers=headers
            )
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
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
        """Finaliza separação de pedido"""
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/picking/v1.0/orders/{order_id}/endSeparation",
                headers=headers
            )
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
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
        """Adiciona item durante separação"""
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/picking/v1.0/orders/{order_id}/items",
                headers=headers,
                json=item_data
            )
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
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
        """Modifica item durante separação"""
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.patch(
                f"{self.BASE_URL}/picking/v1.0/orders/{order_id}/items/{unique_id}",
                headers=headers,
                json=modifications
            )
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
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
        """Substitui item durante separação"""
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.post(
                f"{self.BASE_URL}/picking/v1.0/orders/{order_id}/items/{unique_id}/replace",
                headers=headers,
                json=replacement
            )
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
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
        """Remove item durante separação (ruptura de estoque)"""
        client = await self._get_http_client()
        headers = await self._get_headers()
        
        try:
            response = await client.delete(
                f"{self.BASE_URL}/picking/v1.0/orders/{order_id}/items/{unique_id}",
                headers=headers
            )
            
            if response.status_code == 401:
                await self.authenticate(force_refresh=True)
                headers = await self._get_headers()
                response = await client.delete(
                    f"{self.BASE_URL}/picking/v1.0/orders/{order_id}/items/{unique_id}",
                    headers=headers
                )
            
            response.raise_for_status()
            return {"success": True, "order_id": order_id, "item_removed": unique_id}
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro ao remover item: {e.response.status_code}")
            raise


# Instância global do cliente
ifood_client = IFoodClient()
