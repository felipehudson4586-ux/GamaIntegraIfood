"""
iFood Partner Dashboard - Backend API
Sistema de gestão de pedidos integrado com iFood

Módulos implementados:
1. Authentication - Autenticação OAuth com iFood
2. Orders - Gestão completa de pedidos
3. Item - Catálogo de produtos
4. Promotion - Gestão de promoções
5. Picking - Separação de pedidos
6. Financial - Métricas e relatórios
"""

from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import asyncio

# Load environment FIRST before any other imports that use os.environ
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from models import (
    Order, OrderCreate, OrderUpdate, OrderStatus, OrderType, OrderCategory,
    CatalogItem, CatalogItemCreate, CatalogItemUpdate,
    Promotion, PromotionCreate,
    IFoodEvent, EventCreate,
    PollingStatus, DashboardMetrics, APIResponse,
    CANCELLATION_REASONS
)
from ifood_client import ifood_client

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(
    title="iFood Partner Dashboard API",
    description="Sistema de gestão de pedidos integrado com iFood",
    version="1.0.0"
)

# Create routers
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
orders_router = APIRouter(prefix="/orders", tags=["Orders"])
items_router = APIRouter(prefix="/items", tags=["Items/Catalog"])
promotions_router = APIRouter(prefix="/promotions", tags=["Promotions"])
picking_router = APIRouter(prefix="/picking", tags=["Picking"])
metrics_router = APIRouter(prefix="/metrics", tags=["Metrics/Financial"])
polling_router = APIRouter(prefix="/polling", tags=["Polling"])

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Polling control
polling_task: Optional[asyncio.Task] = None
polling_active = False


# ==================== HELPER FUNCTIONS ====================

def serialize_doc(doc: dict) -> dict:
    """Remove _id and convert datetime to ISO string"""
    if doc is None:
        return None
    doc.pop('_id', None)
    for key, value in doc.items():
        if isinstance(value, datetime):
            doc[key] = value.isoformat()
    return doc


async def get_merchant_id() -> str:
    """Retorna o merchant_id configurado"""
    return os.environ.get('IFOOD_MERCHANT_ID', '')


# ==================== MODULE 1: AUTHENTICATION ====================

@auth_router.post("/usercode")
async def generate_user_code():
    """
    Passo 1: Gera userCode para autorização no Portal iFood
    O usuário deve acessar a URL retornada e autorizar o app
    """
    try:
        result = await ifood_client.generate_user_code()
        
        # Salva no banco para recuperar depois
        await db.auth_state.update_one(
            {"type": "user_code"},
            {"$set": {
                "user_code": result.get("userCode"),
                "verification_url": result.get("verificationUrlComplete"),
                "code_verifier": result.get("authorizationCodeVerifier"),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "expires_in": result.get("expiresIn", 600)
            }},
            upsert=True
        )
        
        return APIResponse(success=True, data=result, message="Acesse a URL e autorize o aplicativo no Portal iFood")
    except Exception as e:
        logger.error(f"Erro ao gerar userCode: {str(e)}")
        return APIResponse(success=False, error=str(e))


@auth_router.post("/authorize")
async def authorize_with_code(authorization_code: str):
    """
    Passo 2: Troca authorizationCode por accessToken
    Use o código que você recebeu após autorizar no Portal iFood
    """
    try:
        # Recupera code_verifier salvo
        auth_state = await db.auth_state.find_one({"type": "user_code"})
        code_verifier = auth_state.get("code_verifier") if auth_state else None
        
        result = await ifood_client.authenticate_with_code(authorization_code, code_verifier)
        
        # Salva tokens no banco
        await db.auth_state.update_one(
            {"type": "tokens"},
            {"$set": {
                "access_token": result.get("access_token"),
                "refresh_token": result.get("refresh_token"),
                "expires_at": result.get("expires_at"),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        return APIResponse(success=True, data={
            "message": "Autenticação concluída com sucesso!",
            "expires_at": result.get("expires_at")
        })
    except Exception as e:
        logger.error(f"Erro ao autorizar: {str(e)}")
        return APIResponse(success=False, error=str(e))


@auth_router.post("/refresh")
async def refresh_token():
    """Renova o accessToken usando refreshToken"""
    try:
        result = await ifood_client.refresh_access_token()
        
        # Atualiza tokens no banco
        await db.auth_state.update_one(
            {"type": "tokens"},
            {"$set": {
                "access_token": result.get("access_token"),
                "expires_at": result.get("expires_at"),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return APIResponse(success=True, data=result)
    except Exception as e:
        logger.error(f"Erro ao renovar token: {str(e)}")
        return APIResponse(success=False, error=str(e))


@auth_router.get("/status")
async def get_auth_status():
    """Verifica status da autenticação"""
    has_credentials = bool(
        os.environ.get('IFOOD_CLIENT_ID') and 
        os.environ.get('IFOOD_CLIENT_SECRET')
    )
    merchant_id = await get_merchant_id()
    
    # Verifica tokens salvos
    tokens = await db.auth_state.find_one({"type": "tokens"}, {"_id": 0})
    user_code_state = await db.auth_state.find_one({"type": "user_code"}, {"_id": 0})
    
    status = ifood_client.get_auth_status()
    status["has_credentials"] = has_credentials
    status["merchant_id"] = merchant_id
    
    if tokens:
        status["has_saved_tokens"] = True
        status["saved_token_expires_at"] = tokens.get("expires_at")
    
    if user_code_state:
        status["pending_authorization"] = {
            "user_code": user_code_state.get("user_code"),
            "verification_url": user_code_state.get("verification_url"),
            "created_at": user_code_state.get("created_at")
        }
    
    return status


@auth_router.post("/restore")
async def restore_tokens():
    """Restaura tokens salvos no banco de dados"""
    try:
        tokens = await db.auth_state.find_one({"type": "tokens"})
        if not tokens:
            return APIResponse(success=False, error="Nenhum token salvo encontrado")
        
        ifood_client.set_tokens(
            access_token=tokens.get("access_token"),
            refresh_token=tokens.get("refresh_token"),
            expires_in=3600
        )
        
        return APIResponse(success=True, message="Tokens restaurados com sucesso")
    except Exception as e:
        logger.error(f"Erro ao restaurar tokens: {str(e)}")
        return APIResponse(success=False, error=str(e))


# ==================== MODULE 2: ORDERS ====================

@orders_router.get("")
async def list_orders(
    status: Optional[OrderStatus] = None,
    order_type: Optional[OrderType] = None,
    category: Optional[OrderCategory] = None,
    limit: int = Query(default=50, le=200),
    skip: int = 0,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Lista pedidos com filtros"""
    query = {}
    
    if status:
        query["status"] = status.value
    if order_type:
        query["order_type"] = order_type.value
    if category:
        query["category"] = category.value
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.orders.count_documents(query)
    
    return {
        "orders": orders,
        "total": total,
        "limit": limit,
        "skip": skip
    }


@orders_router.get("/today")
async def list_orders_today():
    """Lista pedidos de hoje"""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    orders = await db.orders.find(
        {"created_at": {"$gte": today_start.isoformat()}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    return {"orders": orders, "count": len(orders)}


@orders_router.get("/{order_id}")
async def get_order(order_id: str):
    """Obtém detalhes de um pedido"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        # Tenta buscar pelo ifood_id
        order = await db.orders.find_one({"ifood_id": order_id}, {"_id": 0})
    
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    return order


@orders_router.post("/{order_id}/confirm")
async def confirm_order(order_id: str):
    """Confirma um pedido"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    if order.get("status") != OrderStatus.PLACED.value:
        raise HTTPException(status_code=400, detail="Pedido já foi processado")
    
    try:
        # Chama API do iFood
        result = await ifood_client.confirm_order(order.get("ifood_id", order_id))
        
        # Atualiza no banco
        now = datetime.now(timezone.utc).isoformat()
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "status": OrderStatus.CONFIRMED.value,
                "confirmed_at": now,
                "updated_at": now
            }}
        )
        
        return APIResponse(success=True, message="Pedido confirmado", data=result)
    except Exception as e:
        logger.error(f"Erro ao confirmar pedido: {str(e)}")
        return APIResponse(success=False, error=str(e))


@orders_router.post("/{order_id}/start-preparation")
async def start_order_preparation(order_id: str):
    """Inicia preparo do pedido"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    try:
        result = await ifood_client.start_preparation(order.get("ifood_id", order_id))
        
        now = datetime.now(timezone.utc).isoformat()
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "status": OrderStatus.PREPARATION_STARTED.value,
                "preparation_start_datetime": now,
                "updated_at": now
            }}
        )
        
        return APIResponse(success=True, message="Preparo iniciado", data=result)
    except Exception as e:
        logger.error(f"Erro ao iniciar preparo: {str(e)}")
        return APIResponse(success=False, error=str(e))


@orders_router.post("/{order_id}/ready")
async def mark_order_ready(order_id: str):
    """Marca pedido como pronto"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    try:
        result = await ifood_client.ready_to_pickup(order.get("ifood_id", order_id))
        
        now = datetime.now(timezone.utc).isoformat()
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "status": OrderStatus.READY_TO_PICKUP.value,
                "updated_at": now
            }}
        )
        
        return APIResponse(success=True, message="Pedido pronto para retirada", data=result)
    except Exception as e:
        logger.error(f"Erro ao marcar pronto: {str(e)}")
        return APIResponse(success=False, error=str(e))


@orders_router.post("/{order_id}/dispatch")
async def dispatch_order(order_id: str):
    """Despacha pedido para entrega"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    try:
        result = await ifood_client.dispatch_order(order.get("ifood_id", order_id))
        
        now = datetime.now(timezone.utc).isoformat()
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "status": OrderStatus.DISPATCHED.value,
                "dispatched_at": now,
                "updated_at": now
            }}
        )
        
        return APIResponse(success=True, message="Pedido despachado", data=result)
    except Exception as e:
        logger.error(f"Erro ao despachar: {str(e)}")
        return APIResponse(success=False, error=str(e))


@orders_router.post("/{order_id}/cancel")
async def cancel_order(order_id: str, cancellation_code: str = "501"):
    """Cancela um pedido"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    if order.get("status") == OrderStatus.CANCELLED.value:
        raise HTTPException(status_code=400, detail="Pedido já cancelado")
    
    try:
        result = await ifood_client.request_cancellation(
            order.get("ifood_id", order_id),
            cancellation_code
        )
        
        # Busca descrição do motivo
        reason_desc = next(
            (r.description for r in CANCELLATION_REASONS if r.code == cancellation_code),
            "Motivo não especificado"
        )
        
        now = datetime.now(timezone.utc).isoformat()
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "status": OrderStatus.CANCELLED.value,
                "cancelled_at": now,
                "cancellation_code": cancellation_code,
                "cancellation_reason": reason_desc,
                "updated_at": now
            }}
        )
        
        return APIResponse(success=True, message="Cancelamento solicitado", data=result)
    except Exception as e:
        logger.error(f"Erro ao cancelar: {str(e)}")
        return APIResponse(success=False, error=str(e))


@orders_router.get("/{order_id}/tracking")
async def get_order_tracking(order_id: str):
    """Obtém rastreamento do pedido"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    try:
        tracking = await ifood_client.get_order_tracking(order.get("ifood_id", order_id))
        return APIResponse(success=True, data=tracking)
    except Exception as e:
        logger.error(f"Erro ao rastrear: {str(e)}")
        return APIResponse(success=False, error=str(e))


@orders_router.get("/cancellation-reasons/list")
async def list_cancellation_reasons():
    """Lista motivos de cancelamento disponíveis"""
    return {"reasons": [r.model_dump() for r in CANCELLATION_REASONS]}


# ==================== MODULE 3: ITEMS/CATALOG ====================

@items_router.get("")
async def list_items(
    category: Optional[str] = None,
    available: Optional[bool] = None,
    limit: int = Query(default=50, le=200),
    skip: int = 0
):
    """Lista itens do catálogo"""
    query = {"merchant_id": await get_merchant_id()}
    
    if category:
        query["category"] = category
    if available is not None:
        query["available"] = available
    
    items = await db.items.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.items.count_documents(query)
    
    return {"items": items, "total": total}


@items_router.get("/{item_id}")
async def get_item(item_id: str):
    """Obtém detalhes de um item"""
    item = await db.items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    return item


@items_router.post("")
async def create_item(item_data: CatalogItemCreate):
    """Cria novo item no catálogo"""
    merchant_id = await get_merchant_id()
    
    item = CatalogItem(
        merchant_id=merchant_id,
        **item_data.model_dump()
    )
    
    doc = item.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.items.insert_one(doc)
    
    # Tenta sincronizar com iFood
    try:
        await ifood_client.create_item(item_data.model_dump(), merchant_id)
    except Exception as e:
        logger.warning(f"Não foi possível sincronizar item com iFood: {str(e)}")
    
    return serialize_doc(doc)


@items_router.patch("/{item_id}")
async def update_item(item_id: str, updates: CatalogItemUpdate):
    """Atualiza item existente"""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.items.update_one(
        {"id": item_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    
    # Tenta sincronizar com iFood
    try:
        await ifood_client.update_item(item_id, update_data, await get_merchant_id())
    except Exception as e:
        logger.warning(f"Não foi possível sincronizar atualização com iFood: {str(e)}")
    
    return APIResponse(success=True, message="Item atualizado")


@items_router.delete("/{item_id}")
async def delete_item(item_id: str):
    """Remove item do catálogo"""
    result = await db.items.delete_one({"id": item_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    
    return APIResponse(success=True, message="Item removido")


@items_router.patch("/{item_id}/availability")
async def toggle_item_availability(item_id: str, available: bool):
    """Alterna disponibilidade do item"""
    result = await db.items.update_one(
        {"id": item_id},
        {"$set": {"available": available, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    
    return APIResponse(success=True, message=f"Item {'disponível' if available else 'indisponível'}")


# ==================== MODULE 4: PROMOTIONS ====================

@promotions_router.get("")
async def list_promotions(
    active: Optional[bool] = None,
    limit: int = Query(default=50, le=200)
):
    """Lista promoções"""
    query = {"merchant_id": await get_merchant_id()}
    
    if active is not None:
        query["active"] = active
    
    promotions = await db.promotions.find(query, {"_id": 0}).limit(limit).to_list(limit)
    return {"promotions": promotions, "total": len(promotions)}


@promotions_router.get("/{promotion_id}")
async def get_promotion(promotion_id: str):
    """Obtém detalhes de uma promoção"""
    promotion = await db.promotions.find_one({"id": promotion_id}, {"_id": 0})
    if not promotion:
        raise HTTPException(status_code=404, detail="Promoção não encontrada")
    return promotion


@promotions_router.post("")
async def create_promotion(promo_data: PromotionCreate):
    """Cria nova promoção"""
    merchant_id = await get_merchant_id()
    
    # Valida desconto máximo de 70%
    if promo_data.discount_percentage and promo_data.discount_percentage > 70:
        raise HTTPException(status_code=400, detail="Desconto máximo permitido é 70%")
    
    promotion = Promotion(
        merchant_id=merchant_id,
        **promo_data.model_dump()
    )
    
    doc = promotion.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['start_date'] = doc['start_date'].isoformat()
    doc['end_date'] = doc['end_date'].isoformat()
    
    await db.promotions.insert_one(doc)
    
    # Tenta sincronizar com iFood
    try:
        await ifood_client.create_promotion(promo_data.model_dump(), merchant_id)
    except Exception as e:
        logger.warning(f"Não foi possível sincronizar promoção com iFood: {str(e)}")
    
    return serialize_doc(doc)


@promotions_router.delete("/{promotion_id}")
async def delete_promotion(promotion_id: str):
    """Remove promoção"""
    result = await db.promotions.delete_one({"id": promotion_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Promoção não encontrada")
    
    # Tenta sincronizar com iFood
    try:
        await ifood_client.delete_promotion(promotion_id, await get_merchant_id())
    except Exception as e:
        logger.warning(f"Não foi possível remover promoção do iFood: {str(e)}")
    
    return APIResponse(success=True, message="Promoção removida")


@promotions_router.patch("/{promotion_id}/toggle")
async def toggle_promotion(promotion_id: str, active: bool):
    """Ativa/desativa promoção"""
    result = await db.promotions.update_one(
        {"id": promotion_id},
        {"$set": {"active": active}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Promoção não encontrada")
    
    return APIResponse(success=True, message=f"Promoção {'ativada' if active else 'desativada'}")


# ==================== MODULE 5: PICKING ====================

@picking_router.post("/{order_id}/start")
async def start_picking(order_id: str):
    """Inicia separação de pedido (para mercados)"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    try:
        result = await ifood_client.start_separation(order.get("ifood_id", order_id))
        
        now = datetime.now(timezone.utc).isoformat()
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "status": OrderStatus.SEPARATION_STARTED.value,
                "updated_at": now
            }}
        )
        
        return APIResponse(success=True, message="Separação iniciada", data=result)
    except Exception as e:
        logger.error(f"Erro ao iniciar separação: {str(e)}")
        return APIResponse(success=False, error=str(e))


@picking_router.post("/{order_id}/end")
async def end_picking(order_id: str):
    """Finaliza separação de pedido"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    try:
        result = await ifood_client.end_separation(order.get("ifood_id", order_id))
        
        now = datetime.now(timezone.utc).isoformat()
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "status": OrderStatus.SEPARATION_ENDED.value,
                "updated_at": now
            }}
        )
        
        return APIResponse(success=True, message="Separação finalizada", data=result)
    except Exception as e:
        logger.error(f"Erro ao finalizar separação: {str(e)}")
        return APIResponse(success=False, error=str(e))


@picking_router.post("/{order_id}/items")
async def add_picking_item(order_id: str, item_data: dict):
    """Adiciona item durante separação"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    try:
        result = await ifood_client.add_picking_item(order.get("ifood_id", order_id), item_data)
        return APIResponse(success=True, message="Item adicionado", data=result)
    except Exception as e:
        logger.error(f"Erro ao adicionar item: {str(e)}")
        return APIResponse(success=False, error=str(e))


@picking_router.patch("/{order_id}/items/{unique_id}")
async def modify_picking_item(order_id: str, unique_id: str, modifications: dict):
    """Modifica item durante separação"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    try:
        result = await ifood_client.modify_picking_item(
            order.get("ifood_id", order_id),
            unique_id,
            modifications
        )
        return APIResponse(success=True, message="Item modificado", data=result)
    except Exception as e:
        logger.error(f"Erro ao modificar item: {str(e)}")
        return APIResponse(success=False, error=str(e))


@picking_router.post("/{order_id}/items/{unique_id}/replace")
async def replace_picking_item(order_id: str, unique_id: str, replacement: dict):
    """Substitui item durante separação"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    try:
        result = await ifood_client.replace_picking_item(
            order.get("ifood_id", order_id),
            unique_id,
            replacement
        )
        return APIResponse(success=True, message="Item substituído", data=result)
    except Exception as e:
        logger.error(f"Erro ao substituir item: {str(e)}")
        return APIResponse(success=False, error=str(e))


@picking_router.delete("/{order_id}/items/{unique_id}")
async def remove_picking_item(order_id: str, unique_id: str):
    """Remove item durante separação (ruptura de estoque)"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    try:
        result = await ifood_client.remove_picking_item(
            order.get("ifood_id", order_id),
            unique_id
        )
        return APIResponse(success=True, message="Item removido", data=result)
    except Exception as e:
        logger.error(f"Erro ao remover item: {str(e)}")
        return APIResponse(success=False, error=str(e))


# ==================== MODULE 6: METRICS/FINANCIAL ====================

@metrics_router.get("/dashboard")
async def get_dashboard_metrics():
    """Obtém métricas para o dashboard"""
    merchant_id = await get_merchant_id()
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Contagens por status
    pipeline_status = [
        {"$match": {"created_at": {"$gte": today_start.isoformat()}}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = {doc["_id"]: doc["count"] async for doc in db.orders.aggregate(pipeline_status)}
    
    # Contagens por tipo
    pipeline_type = [
        {"$match": {"created_at": {"$gte": today_start.isoformat()}}},
        {"$group": {"_id": "$order_type", "count": {"$sum": 1}}}
    ]
    type_counts = {doc["_id"]: doc["count"] async for doc in db.orders.aggregate(pipeline_type)}
    
    # Contagens por categoria
    pipeline_category = [
        {"$match": {"created_at": {"$gte": today_start.isoformat()}}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}}
    ]
    category_counts = {doc["_id"]: doc["count"] async for doc in db.orders.aggregate(pipeline_category)}
    
    # Total e receita
    pipeline_total = [
        {"$match": {"created_at": {"$gte": today_start.isoformat()}}},
        {"$group": {
            "_id": None,
            "total_orders": {"$sum": 1},
            "total_revenue": {"$sum": "$total"}
        }}
    ]
    totals = await db.orders.aggregate(pipeline_total).to_list(1)
    totals = totals[0] if totals else {"total_orders": 0, "total_revenue": 0}
    
    # Status do polling
    polling_status = await db.polling_status.find_one(
        {"merchant_id": merchant_id},
        {"_id": 0}
    )
    
    avg_order_value = totals["total_revenue"] / totals["total_orders"] if totals["total_orders"] > 0 else 0
    
    return DashboardMetrics(
        total_orders_today=totals.get("total_orders", 0),
        pending_orders=status_counts.get(OrderStatus.PLACED.value, 0),
        in_preparation=status_counts.get(OrderStatus.PREPARATION_STARTED.value, 0) + 
                       status_counts.get(OrderStatus.CONFIRMED.value, 0),
        ready_orders=status_counts.get(OrderStatus.READY_TO_PICKUP.value, 0) +
                     status_counts.get(OrderStatus.SEPARATION_ENDED.value, 0),
        dispatched_orders=status_counts.get(OrderStatus.DISPATCHED.value, 0),
        concluded_orders=status_counts.get(OrderStatus.CONCLUDED.value, 0),
        cancelled_orders=status_counts.get(OrderStatus.CANCELLED.value, 0),
        total_revenue_today=totals.get("total_revenue", 0),
        average_order_value=round(avg_order_value, 2),
        orders_by_type=type_counts,
        orders_by_category=category_counts,
        polling_status="active" if polling_active else "inactive",
        last_poll_at=polling_status.get("last_poll_at") if polling_status else None
    )


@metrics_router.get("/orders-by-hour")
async def get_orders_by_hour():
    """Obtém distribuição de pedidos por hora"""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    orders = await db.orders.find(
        {"created_at": {"$gte": today_start.isoformat()}},
        {"_id": 0, "created_at": 1, "total": 1}
    ).to_list(1000)
    
    hours = {str(i).zfill(2): {"count": 0, "revenue": 0} for i in range(24)}
    
    for order in orders:
        try:
            dt = datetime.fromisoformat(order["created_at"].replace("Z", "+00:00"))
            hour = str(dt.hour).zfill(2)
            hours[hour]["count"] += 1
            hours[hour]["revenue"] += order.get("total", 0)
        except:
            pass
    
    return {"hours": hours}


@metrics_router.get("/summary")
async def get_summary(days: int = 7):
    """Obtém resumo dos últimos N dias"""
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date.isoformat()}}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 10]},
            "orders": {"$sum": 1},
            "revenue": {"$sum": "$total"},
            "cancelled": {"$sum": {"$cond": [{"$eq": ["$status", "CANCELLED"]}, 1, 0]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    daily_data = await db.orders.aggregate(pipeline).to_list(days)
    
    return {
        "period_days": days,
        "daily_summary": daily_data
    }


# ==================== POLLING SYSTEM ====================

async def process_ifood_event(event: dict):
    """Processa um evento recebido do iFood"""
    event_id = event.get("id")
    event_type = event.get("code") or event.get("fullCode", "").split("/")[-1]
    order_id = event.get("orderId")
    merchant_id = event.get("merchantId", await get_merchant_id())
    
    # Verifica duplicidade
    existing = await db.events.find_one({"event_id": event_id})
    if existing:
        logger.info(f"Evento duplicado ignorado: {event_id}")
        return
    
    # Salva evento
    event_doc = {
        "id": str(__import__('uuid').uuid4()),
        "event_id": event_id,
        "event_type": event_type,
        "order_id": order_id,
        "merchant_id": merchant_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed": False,
        "payload": event
    }
    await db.events.insert_one(event_doc)
    
    # Processa por tipo de evento
    if event_type == "PLACED":
        # Novo pedido - busca detalhes e salva
        try:
            order_details = await ifood_client.get_order_details(order_id)
            await save_order_from_ifood(order_details, merchant_id)
            logger.info(f"Novo pedido recebido: {order_id}")
        except Exception as e:
            logger.error(f"Erro ao processar novo pedido: {str(e)}")
    
    elif event_type == "CONFIRMED":
        await db.orders.update_one(
            {"ifood_id": order_id},
            {"$set": {"status": OrderStatus.CONFIRMED.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    elif event_type == "CANCELLED":
        await db.orders.update_one(
            {"ifood_id": order_id},
            {"$set": {
                "status": OrderStatus.CANCELLED.value,
                "cancelled_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    elif event_type == "DISPATCHED":
        await db.orders.update_one(
            {"ifood_id": order_id},
            {"$set": {
                "status": OrderStatus.DISPATCHED.value,
                "dispatched_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    elif event_type == "CONCLUDED":
        await db.orders.update_one(
            {"ifood_id": order_id},
            {"$set": {
                "status": OrderStatus.CONCLUDED.value,
                "concluded_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    elif event_type == "ASSIGN_DRIVER":
        driver_info = event.get("driver", {})
        await db.orders.update_one(
            {"ifood_id": order_id},
            {"$set": {
                "driver": driver_info,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    # Marca como processado
    await db.events.update_one(
        {"event_id": event_id},
        {"$set": {"processed": True, "processed_at": datetime.now(timezone.utc).isoformat()}}
    )


async def save_order_from_ifood(order_data: dict, merchant_id: str):
    """Salva pedido recebido do iFood"""
    order_id = str(__import__('uuid').uuid4())
    
    # Mapeia dados do iFood para nosso modelo
    items = []
    for item in order_data.get("items", []):
        items.append({
            "id": item.get("id"),
            "name": item.get("name"),
            "quantity": item.get("quantity", 1),
            "unit_price": item.get("unitPrice", 0),
            "total_price": item.get("totalPrice", 0),
            "external_code": item.get("externalCode"),
            "observations": item.get("observations"),
            "garnish_items": item.get("garnishItems")
        })
    
    customer = order_data.get("customer", {})
    address = order_data.get("delivery", {}).get("deliveryAddress", {})
    
    order_doc = {
        "id": order_id,
        "ifood_id": order_data.get("id"),
        "display_id": order_data.get("displayId", order_data.get("id", "")[:8]),
        "merchant_id": merchant_id,
        "status": OrderStatus.PLACED.value,
        "order_type": order_data.get("orderType", "DELIVERY"),
        "category": order_data.get("salesChannel", "FOOD"),
        "moment": order_data.get("orderTiming", "IMMEDIATE"),
        "customer": {
            "id": customer.get("id"),
            "name": customer.get("name", "Cliente"),
            "phone": customer.get("phone"),
            "document_number": customer.get("documentNumber")
        },
        "address": {
            "street_name": address.get("streetName"),
            "street_number": address.get("streetNumber"),
            "complement": address.get("complement"),
            "neighborhood": address.get("neighborhood"),
            "city": address.get("city"),
            "state": address.get("state"),
            "postal_code": address.get("postalCode"),
            "reference": address.get("reference"),
            "coordinates": address.get("coordinates")
        },
        "items": items,
        "payments": order_data.get("payments", []),
        "delivery": order_data.get("delivery"),
        "scheduling": order_data.get("schedule"),
        "subtotal": order_data.get("total", {}).get("subTotal", 0),
        "delivery_fee": order_data.get("total", {}).get("deliveryFee", 0),
        "discount": order_data.get("total", {}).get("benefits", 0),
        "total": order_data.get("total", {}).get("orderAmount", 0),
        "observations": order_data.get("extraInfo"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.orders.insert_one(order_doc)
    return order_doc


async def polling_loop():
    """Loop de polling que roda a cada 30 segundos"""
    global polling_active
    merchant_id = await get_merchant_id()
    
    while polling_active:
        try:
            # Executa polling
            result = await ifood_client.poll_events(categories=["ALL"])
            events = result.get("events", [])
            
            # Processa eventos
            for event in events:
                await process_ifood_event(event)
            
            # Confirma eventos (acknowledgment)
            if events:
                event_ids = [e.get("id") for e in events if e.get("id")]
                if event_ids:
                    await ifood_client.acknowledge_events(event_ids)
            
            # Atualiza status do polling
            await db.polling_status.update_one(
                {"merchant_id": merchant_id},
                {"$set": {
                    "last_poll_at": datetime.now(timezone.utc).isoformat(),
                    "events_received": len(events),
                    "errors_count": 0,
                    "last_error": None,
                    "is_active": True,
                    "connection_status": "connected"
                }},
                upsert=True
            )
            
            logger.info(f"Polling executado: {len(events)} eventos")
            
        except Exception as e:
            logger.error(f"Erro no polling: {str(e)}")
            
            # Atualiza status com erro
            await db.polling_status.update_one(
                {"merchant_id": merchant_id},
                {
                    "$set": {
                        "last_error": str(e),
                        "connection_status": "error"
                    },
                    "$inc": {"errors_count": 1}
                },
                upsert=True
            )
        
        # Aguarda 30 segundos (conforme documentação iFood)
        await asyncio.sleep(30)


@polling_router.post("/start")
async def start_polling(background_tasks: BackgroundTasks):
    """Inicia o polling de eventos"""
    global polling_active, polling_task
    
    if polling_active:
        return APIResponse(success=True, message="Polling já está ativo")
    
    polling_active = True
    polling_task = asyncio.create_task(polling_loop())
    
    return APIResponse(success=True, message="Polling iniciado")


@polling_router.post("/stop")
async def stop_polling():
    """Para o polling de eventos"""
    global polling_active, polling_task
    
    polling_active = False
    
    if polling_task:
        polling_task.cancel()
        try:
            await polling_task
        except asyncio.CancelledError:
            pass
        polling_task = None
    
    # Atualiza status
    merchant_id = await get_merchant_id()
    await db.polling_status.update_one(
        {"merchant_id": merchant_id},
        {"$set": {"is_active": False, "connection_status": "disconnected"}},
        upsert=True
    )
    
    return APIResponse(success=True, message="Polling parado")


@polling_router.get("/status")
async def get_polling_status():
    """Obtém status do polling"""
    merchant_id = await get_merchant_id()
    
    status = await db.polling_status.find_one(
        {"merchant_id": merchant_id},
        {"_id": 0}
    )
    
    if not status:
        status = {
            "is_active": polling_active,
            "connection_status": "connected" if polling_active else "disconnected",
            "last_poll_at": None,
            "events_received": 0,
            "errors_count": 0
        }
    
    status["polling_active"] = polling_active
    
    return status


@polling_router.post("/force")
async def force_poll():
    """Força uma execução imediata do polling"""
    try:
        result = await ifood_client.poll_events(categories=["ALL"])
        events = result.get("events", [])
        
        # Processa eventos
        for event in events:
            await process_ifood_event(event)
        
        # Confirma eventos
        if events:
            event_ids = [e.get("id") for e in events if e.get("id")]
            if event_ids:
                await ifood_client.acknowledge_events(event_ids)
        
        return APIResponse(
            success=True,
            message=f"Polling forçado: {len(events)} eventos processados",
            data={"events_count": len(events)}
        )
    except Exception as e:
        logger.error(f"Erro no polling forçado: {str(e)}")
        return APIResponse(success=False, error=str(e))


# ==================== EVENTS ====================

@api_router.get("/events")
async def list_events(
    processed: Optional[bool] = None,
    limit: int = Query(default=50, le=200)
):
    """Lista eventos recebidos"""
    query = {}
    if processed is not None:
        query["processed"] = processed
    
    events = await db.events.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"events": events, "total": len(events)}


# ==================== MERCHANT ====================

@api_router.get("/merchant")
async def get_merchant_info():
    """Obtém informações do estabelecimento"""
    try:
        merchant = await ifood_client.get_merchant_details()
        return APIResponse(success=True, data=merchant)
    except Exception as e:
        return APIResponse(success=False, error=str(e))


@api_router.get("/merchant/status")
async def get_merchant_status():
    """Obtém status do estabelecimento"""
    try:
        status = await ifood_client.get_merchant_status()
        return APIResponse(success=True, data=status)
    except Exception as e:
        return APIResponse(success=False, error=str(e))


# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    """Health check"""
    return {
        "status": "healthy",
        "service": "iFood Partner Dashboard API",
        "version": "1.0.0",
        "polling_active": polling_active
    }


@api_router.get("/health")
async def health():
    """Health check detalhado"""
    merchant_id = await get_merchant_id()
    
    return {
        "status": "healthy",
        "database": "connected",
        "merchant_id": merchant_id,
        "polling_active": polling_active,
        "has_credentials": bool(os.environ.get('IFOOD_CLIENT_ID'))
    }


# ==================== INCLUDE ROUTERS ====================

api_router.include_router(auth_router)
api_router.include_router(orders_router)
api_router.include_router(items_router)
api_router.include_router(promotions_router)
api_router.include_router(picking_router)
api_router.include_router(metrics_router)
api_router.include_router(polling_router)

app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== LIFECYCLE ====================

@app.on_event("startup")
async def startup_event():
    """Inicialização do servidor"""
    logger.info("Iniciando iFood Partner Dashboard API...")
    
    # Cria índices no MongoDB
    await db.orders.create_index("id", unique=True)
    await db.orders.create_index("ifood_id")
    await db.orders.create_index("status")
    await db.orders.create_index("created_at")
    await db.events.create_index("event_id", unique=True)
    await db.items.create_index("id", unique=True)
    await db.promotions.create_index("id", unique=True)
    
    logger.info("Índices criados com sucesso")


@app.on_event("shutdown")
async def shutdown_event():
    """Finalização do servidor"""
    global polling_active
    
    # Para polling
    polling_active = False
    
    # Fecha cliente iFood
    await ifood_client.close()
    
    # Fecha MongoDB
    client.close()
    
    logger.info("Servidor finalizado")
