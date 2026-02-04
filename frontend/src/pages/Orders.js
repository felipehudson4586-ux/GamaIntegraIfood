import { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Clock,
  ChefHat,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Eye,
  MapPin,
  User
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import api from "../lib/api";

const statusConfig = {
  PLACED: { label: "Novo", color: "badge-new", icon: Clock },
  CONFIRMED: { label: "Confirmado", color: "badge-confirmed", icon: CheckCircle },
  PREPARATION_STARTED: { label: "Preparando", color: "badge-preparing", icon: ChefHat },
  SEPARATION_STARTED: { label: "Separando", color: "badge-preparing", icon: Package },
  SEPARATION_ENDED: { label: "Separado", color: "badge-ready", icon: Package },
  READY_TO_PICKUP: { label: "Pronto", color: "badge-ready", icon: Package },
  DISPATCHED: { label: "Despachado", color: "badge-dispatched", icon: Truck },
  ARRIVED: { label: "Chegou", color: "badge-dispatched", icon: Truck },
  CONCLUDED: { label: "Concluído", color: "badge-concluded", icon: CheckCircle },
  CANCELLED: { label: "Cancelado", color: "badge-cancelled", icon: XCircle },
};

const typeConfig = {
  DELIVERY: { label: "Delivery", color: "badge-delivery" },
  TAKEOUT: { label: "Retirada", color: "badge-takeout" },
  DINE_IN: { label: "Local", color: "bg-purple-50 text-purple-600" },
};

export default function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter && statusFilter !== "ALL") {
        params.status = statusFilter;
      }
      if (typeFilter && typeFilter !== "ALL") {
        params.order_type = typeFilter;
      }
      
      const response = await api.get("/orders", { params });
      setOrders(response.data.orders || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error("Erro ao carregar pedidos:", error);
      toast.error("Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleStatusChange = (value) => {
    setStatusFilter(value);
    if (value === "ALL") {
      searchParams.delete("status");
    } else {
      searchParams.set("status", value);
    }
    setSearchParams(searchParams);
  };

  const filteredOrders = orders.filter(order => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      order.display_id?.toLowerCase().includes(searchLower) ||
      order.customer?.name?.toLowerCase().includes(searchLower) ||
      order.ifood_id?.toLowerCase().includes(searchLower)
    );
  });

  const formatTime = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="space-y-6" data-testid="orders-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-gray-500 text-sm mt-1">{total} pedidos encontrados</p>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchOrders}
          className="gap-2"
          data-testid="refresh-orders-btn"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="Buscar por ID, cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="search-input"
              />
            </div>
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-full sm:w-44" data-testid="status-filter">
                <Filter size={16} className="mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {Object.entries(statusConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-44" data-testid="type-filter">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {Object.entries(typeConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl animate-shimmer" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto mb-4 text-gray-300" size={48} />
            <p className="text-gray-500">Nenhum pedido encontrado</p>
            <p className="text-sm text-gray-400 mt-1">Ajuste os filtros ou aguarde novos pedidos</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} formatTime={formatTime} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, formatTime }) {
  const status = statusConfig[order.status] || statusConfig.PLACED;
  const type = typeConfig[order.order_type] || typeConfig.DELIVERY;
  const StatusIcon = status.icon;

  return (
    <Card className="card-ifood-interactive hover:shadow-md transition-all" data-testid={`order-card-${order.id}`}>
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Order Info */}
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              order.status === "PLACED" ? "bg-blue-100" :
              order.status === "CANCELLED" ? "bg-red-100" :
              "bg-gray-100"
            }`}>
              <StatusIcon size={24} className={
                order.status === "PLACED" ? "text-blue-600" :
                order.status === "CANCELLED" ? "text-red-600" :
                "text-gray-600"
              } />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-lg">#{order.display_id}</span>
                <Badge className={status.color}>{status.label}</Badge>
                <Badge variant="outline" className={type.color}>{type.label}</Badge>
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <User size={14} />
                  {order.customer?.name || "Cliente"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {formatTime(order.created_at)}
                </span>
              </div>
              {order.address?.street_name && (
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <MapPin size={12} />
                  {order.address.street_name}, {order.address.street_number}
                  {order.address.neighborhood && ` - ${order.address.neighborhood}`}
                </p>
              )}
            </div>
          </div>

          {/* Items & Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="text-left sm:text-right">
              <p className="text-sm text-gray-500">{order.items?.length || 0} itens</p>
              <p className="font-bold text-lg">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.total || 0)}
              </p>
            </div>
            <Link to={`/orders/${order.id}`}>
              <Button variant="outline" className="gap-2" data-testid={`view-order-${order.id}`}>
                <Eye size={16} />
                Detalhes
              </Button>
            </Link>
          </div>
        </div>

        {/* Items Preview */}
        {order.items && order.items.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-wrap gap-2">
              {order.items.slice(0, 4).map((item, idx) => (
                <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                  {item.quantity}x {item.name}
                </span>
              ))}
              {order.items.length > 4 && (
                <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-500">
                  +{order.items.length - 4} mais
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
