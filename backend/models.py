"""
Modelos Pydantic para o Sistema iFood Partner Dashboard
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Any, Dict
from datetime import datetime, timezone
from enum import Enum
import uuid


# ==================== ENUMS ====================

class OrderStatus(str, Enum):
    PLACED = "PLACED"
    CONFIRMED = "CONFIRMED"
    PREPARATION_STARTED = "PREPARATION_STARTED"
    SEPARATION_STARTED = "SEPARATION_STARTED"
    SEPARATION_ENDED = "SEPARATION_ENDED"
    READY_TO_PICKUP = "READY_TO_PICKUP"
    DISPATCHED = "DISPATCHED"
    ARRIVED = "ARRIVED"
    CONCLUDED = "CONCLUDED"
    CANCELLED = "CANCELLED"


class OrderType(str, Enum):
    DELIVERY = "DELIVERY"
    TAKEOUT = "TAKEOUT"
    DINE_IN = "DINE_IN"


class OrderCategory(str, Enum):
    FOOD = "FOOD"
    GROCERY = "GROCERY"
    ANOTAI = "ANOTAI"
    FOOD_SELF_SERVICE = "FOOD_SELF_SERVICE"


class OrderMoment(str, Enum):
    IMMEDIATE = "IMMEDIATE"
    TIME_SLOT = "TIME_SLOT"


class DeliveredBy(str, Enum):
    IFOOD = "IFOOD"
    MERCHANT = "MERCHANT"


class PromotionType(str, Enum):
    PERCENTAGE = "PERCENTAGE"
    LXPY = "LXPY"
    PERCENTAGE_PER_X_UNITS = "PERCENTAGE_PER_X_UNITS"


class EventType(str, Enum):
    PLACED = "PLACED"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    DISPATCHED = "DISPATCHED"
    CONCLUDED = "CONCLUDED"
    PREPARATION_STARTED = "PREPARATION_STARTED"
    READY_TO_PICKUP = "READY_TO_PICKUP"
    ASSIGN_DRIVER = "ASSIGN_DRIVER"
    ORDER_PATCHED = "ORDER_PATCHED"
    HANDSHAKE_DISPUTE = "HANDSHAKE_DISPUTE"
    HANDSHAKE_SETTLEMENT = "HANDSHAKE_SETTLEMENT"
    DELIVERY_GROUP_ASSIGNED = "DELIVERY_GROUP_ASSIGNED"
    RECOMMENDED_PREPARATION_START = "RECOMMENDED_PREPARATION_START"


# ==================== BASE MODELS ====================

class BaseDBModel(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


# ==================== ORDER MODELS ====================

class OrderItem(BaseModel):
    id: str
    name: str
    quantity: int
    unit_price: float
    total_price: float
    external_code: Optional[str] = None
    observations: Optional[str] = None
    garnish_items: Optional[List[Dict[str, Any]]] = None


class OrderCustomer(BaseModel):
    id: Optional[str] = None
    name: str
    phone: Optional[str] = None
    document_number: Optional[str] = None


class OrderAddress(BaseModel):
    street_name: Optional[str] = None
    street_number: Optional[str] = None
    complement: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    reference: Optional[str] = None
    coordinates: Optional[Dict[str, float]] = None


class OrderPayment(BaseModel):
    method: str
    type: str
    value: float
    change_for: Optional[float] = None
    prepaid: bool = True


class OrderDelivery(BaseModel):
    mode: Optional[str] = None
    delivered_by: Optional[DeliveredBy] = None
    delivery_time_in_seconds: Optional[int] = None
    pickup_time: Optional[str] = None
    delivery_time: Optional[str] = None


class OrderScheduling(BaseModel):
    scheduled_date_time_start: Optional[str] = None
    scheduled_date_time_end: Optional[str] = None


class OrderDriver(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    photo_url: Optional[str] = None
    vehicle_type: Optional[str] = None
    vehicle_license_plate: Optional[str] = None


class Order(BaseDBModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ifood_id: str
    display_id: str
    merchant_id: str
    status: OrderStatus = OrderStatus.PLACED
    order_type: OrderType = OrderType.DELIVERY
    category: OrderCategory = OrderCategory.FOOD
    moment: OrderMoment = OrderMoment.IMMEDIATE
    
    customer: Optional[OrderCustomer] = None
    address: Optional[OrderAddress] = None
    items: List[OrderItem] = []
    payments: List[OrderPayment] = []
    delivery: Optional[OrderDelivery] = None
    scheduling: Optional[OrderScheduling] = None
    driver: Optional[OrderDriver] = None
    
    subtotal: float = 0.0
    delivery_fee: float = 0.0
    discount: float = 0.0
    total: float = 0.0
    
    observations: Optional[str] = None
    extra_info: Optional[str] = None
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    confirmed_at: Optional[datetime] = None
    dispatched_at: Optional[datetime] = None
    concluded_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    
    preparation_start_datetime: Optional[datetime] = None
    cancellation_code: Optional[str] = None
    cancellation_reason: Optional[str] = None


class OrderCreate(BaseModel):
    ifood_id: str
    display_id: str
    merchant_id: str
    order_type: OrderType = OrderType.DELIVERY
    category: OrderCategory = OrderCategory.FOOD
    moment: OrderMoment = OrderMoment.IMMEDIATE
    customer: Optional[OrderCustomer] = None
    address: Optional[OrderAddress] = None
    items: List[OrderItem] = []
    payments: List[OrderPayment] = []
    delivery: Optional[OrderDelivery] = None
    scheduling: Optional[OrderScheduling] = None
    subtotal: float = 0.0
    delivery_fee: float = 0.0
    discount: float = 0.0
    total: float = 0.0
    observations: Optional[str] = None


class OrderUpdate(BaseModel):
    status: Optional[OrderStatus] = None
    driver: Optional[OrderDriver] = None
    confirmed_at: Optional[datetime] = None
    dispatched_at: Optional[datetime] = None
    concluded_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    cancellation_code: Optional[str] = None
    cancellation_reason: Optional[str] = None


# ==================== EVENT MODELS ====================

class IFoodEvent(BaseDBModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_id: str
    event_type: str
    order_id: str
    merchant_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processed: bool = False
    processed_at: Optional[datetime] = None
    payload: Optional[Dict[str, Any]] = None


class EventCreate(BaseModel):
    event_id: str
    event_type: str
    order_id: str
    merchant_id: str
    payload: Optional[Dict[str, Any]] = None


# ==================== ITEM/CATALOG MODELS ====================

class CatalogItem(BaseDBModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    merchant_id: str
    external_code: str
    name: str
    description: Optional[str] = None
    price: float
    original_price: Optional[float] = None
    ean: Optional[str] = None
    plu: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    available: bool = True
    stock_quantity: Optional[int] = None
    unit: Optional[str] = "un"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CatalogItemCreate(BaseModel):
    external_code: str
    name: str
    description: Optional[str] = None
    price: float
    original_price: Optional[float] = None
    ean: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    available: bool = True
    stock_quantity: Optional[int] = None
    unit: Optional[str] = "un"


class CatalogItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    original_price: Optional[float] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    available: Optional[bool] = None
    stock_quantity: Optional[int] = None


# ==================== PROMOTION MODELS ====================

class Promotion(BaseDBModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    merchant_id: str
    name: str
    description: Optional[str] = None
    promotion_type: PromotionType = PromotionType.PERCENTAGE
    discount_percentage: Optional[float] = None
    buy_quantity: Optional[int] = None
    get_quantity: Optional[int] = None
    item_ids: List[str] = []
    start_date: datetime
    end_date: datetime
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PromotionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    promotion_type: PromotionType = PromotionType.PERCENTAGE
    discount_percentage: Optional[float] = None
    buy_quantity: Optional[int] = None
    get_quantity: Optional[int] = None
    item_ids: List[str] = []
    start_date: datetime
    end_date: datetime


# ==================== POLLING STATUS MODELS ====================

class PollingStatus(BaseDBModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    merchant_id: str
    last_poll_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    events_received: int = 0
    errors_count: int = 0
    last_error: Optional[str] = None
    is_active: bool = True
    connection_status: str = "connected"


# ==================== DASHBOARD METRICS ====================

class DashboardMetrics(BaseModel):
    total_orders_today: int = 0
    pending_orders: int = 0
    in_preparation: int = 0
    ready_orders: int = 0
    dispatched_orders: int = 0
    concluded_orders: int = 0
    cancelled_orders: int = 0
    total_revenue_today: float = 0.0
    average_order_value: float = 0.0
    average_preparation_time: Optional[int] = None
    orders_by_type: Dict[str, int] = {}
    orders_by_category: Dict[str, int] = {}
    polling_status: str = "active"
    last_poll_at: Optional[datetime] = None


# ==================== RESPONSE MODELS ====================

class APIResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None
    data: Optional[Any] = None
    error: Optional[str] = None


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    per_page: int
    total_pages: int


# ==================== CANCELLATION MODELS ====================

class CancellationReason(BaseModel):
    code: str
    description: str
    category: Optional[str] = None


CANCELLATION_REASONS = [
    CancellationReason(code="501", description="Problemas de sistema", category="TECHNICAL"),
    CancellationReason(code="502", description="Pedido duplicado", category="DUPLICATE"),
    CancellationReason(code="503", description="Item indisponível", category="STOCK"),
    CancellationReason(code="504", description="Restaurante fechado", category="OPERATION"),
    CancellationReason(code="505", description="Sem entregador disponível", category="DELIVERY"),
    CancellationReason(code="506", description="Cliente solicitou cancelamento", category="CUSTOMER"),
    CancellationReason(code="507", description="Endereço inválido", category="ADDRESS"),
    CancellationReason(code="508", description="Área fora da cobertura", category="ADDRESS"),
    CancellationReason(code="509", description="Tempo de espera excedido", category="TIMEOUT"),
    CancellationReason(code="510", description="Pagamento não confirmado", category="PAYMENT"),
]
