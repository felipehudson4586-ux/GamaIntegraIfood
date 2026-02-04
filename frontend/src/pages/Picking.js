import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Truck,
  Package,
  CheckCircle,
  Clock,
  Play,
  Square,
  User,
  MapPin
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import api from "../lib/api";

export default function Picking() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await api.get("/orders", { params: { limit: 50 } });
      const pickingOrders = (response.data.orders || []).filter(order =>
        order.category === "GROCERY" ||
        ["CONFIRMED", "SEPARATION_STARTED", "SEPARATION_ENDED"].includes(order.status)
      );
      setOrders(pickingOrders);
    } catch (error) {
      console.error("Erro ao carregar pedidos:", error);
      toast.error("Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (order, action) => {
    try {
      let endpoint = "";
      if (action === "start") endpoint = `/picking/${order.id}/start`;
      else if (action === "end") endpoint = `/picking/${order.id}/end`;
      else if (action === "dispatch") endpoint = `/orders/${order.id}/dispatch`;
      else return;

      const response = await api.post(endpoint);
      if (response.data.success) {
        toast.success(response.data.message);
        fetchOrders();
      } else {
        toast.error(response.data.error || "Erro na operação");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao processar ação");
    }
  };

  const waitingOrders = orders.filter(o => o.status === "CONFIRMED");
  const separatingOrders = orders.filter(o => o.status === "SEPARATION_STARTED");
  const readyOrders = orders.filter(o => o.status === "SEPARATION_ENDED");

  const formatTime = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
  };

  return (
    <div className="space-y-6" data-testid="picking-page">
      <div>
        <h1 className="font-heading text-2xl font-bold text-gray-900">Separação</h1>
        <p className="text-gray-500 text-sm mt-1">
          Gerencie a separação de pedidos (Módulo Picking)
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-100">
              <Clock size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{waitingOrders.length}</p>
              <p className="text-xs text-gray-500">Aguardando</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100">
              <Package size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{separatingOrders.length}</p>
              <p className="text-xs text-gray-500">Em Separação</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-100">
              <CheckCircle size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{readyOrders.length}</p>
              <p className="text-xs text-gray-500">Prontos</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Truck size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-blue-800">Módulo de Separação (Picking)</p>
              <p className="text-sm text-blue-700">
                Este módulo é exclusivo para pedidos de mercado (GROCERY). Permite gerenciar 
                a separação de itens, adicionar/modificar/substituir/remover itens durante o processo.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-4">
          <div className="h-32 bg-gray-200 rounded-xl animate-shimmer" />
          <div className="h-32 bg-gray-200 rounded-xl animate-shimmer" />
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto mb-4 text-gray-300" size={48} />
            <p className="text-gray-500">Nenhum pedido para separação</p>
            <p className="text-sm text-gray-400 mt-1">
              Pedidos de mercado aparecerão aqui para separação
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {waitingOrders.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock size={20} className="text-amber-600" />
                <h2 className="font-heading font-semibold text-lg">Aguardando Separação</h2>
                <Badge variant="secondary">{waitingOrders.length}</Badge>
              </div>
              <div className="space-y-3">
                {waitingOrders.map((order) => (
                  <PickingOrderCard 
                    key={order.id} 
                    order={order} 
                    onAction={() => handleAction(order, "start")}
                    actionLabel="Iniciar Separação"
                    ActionIcon={Play}
                    formatTime={formatTime}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </div>
            </div>
          )}

          {separatingOrders.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Package size={20} className="text-blue-600" />
                <h2 className="font-heading font-semibold text-lg">Em Separação</h2>
                <Badge variant="secondary">{separatingOrders.length}</Badge>
              </div>
              <div className="space-y-3">
                {separatingOrders.map((order) => (
                  <PickingOrderCard 
                    key={order.id} 
                    order={order} 
                    onAction={() => handleAction(order, "end")}
                    actionLabel="Finalizar Separação"
                    ActionIcon={Square}
                    inProgress
                    formatTime={formatTime}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </div>
            </div>
          )}

          {readyOrders.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle size={20} className="text-green-600" />
                <h2 className="font-heading font-semibold text-lg">Prontos para Despacho</h2>
                <Badge variant="secondary">{readyOrders.length}</Badge>
              </div>
              <div className="space-y-3">
                {readyOrders.map((order) => (
                  <PickingOrderCard 
                    key={order.id} 
                    order={order} 
                    onAction={() => handleAction(order, "dispatch")}
                    actionLabel="Despachar"
                    ActionIcon={Truck}
                    ready
                    formatTime={formatTime}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PickingOrderCard({ order, onAction, actionLabel, ActionIcon, inProgress, ready, formatTime, formatCurrency }) {
  const getBgClass = () => {
    if (inProgress) return "border-blue-200";
    if (ready) return "border-green-200";
    return "";
  };

  const getIconBgClass = () => {
    if (inProgress) return "bg-blue-100";
    if (ready) return "bg-green-100";
    return "bg-amber-100";
  };

  const getIconClass = () => {
    if (inProgress) return "text-blue-600";
    if (ready) return "text-green-600";
    return "text-amber-600";
  };

  const getBtnClass = () => {
    if (inProgress) return "bg-blue-600 hover:bg-blue-700";
    if (ready) return "bg-green-600 hover:bg-green-700";
    return "btn-ifood";
  };

  const itemsList = order.items || [];
  const displayItems = itemsList.slice(0, 5);
  const remainingCount = itemsList.length - 5;

  return (
    <Card className={`card-ifood ${getBgClass()}`} data-testid={`picking-card-${order.id}`}>
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getIconBgClass()}`}>
              <Package size={24} className={getIconClass()} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">#{order.display_id}</span>
                <Badge variant="outline">{order.category}</Badge>
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
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="text-left sm:text-right">
              <p className="text-sm text-gray-500">{itemsList.length} itens</p>
              <p className="font-bold">{formatCurrency(order.total)}</p>
            </div>
            <div className="flex gap-2">
              <Link to={`/orders/${order.id}`}>
                <Button variant="outline" size="sm">Detalhes</Button>
              </Link>
              <Button size="sm" className={getBtnClass()} onClick={onAction} data-testid={`action-${order.id}`}>
                <ActionIcon size={16} className="mr-1" />
                {actionLabel}
              </Button>
            </div>
          </div>
        </div>

        {displayItems.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-wrap gap-2">
              {displayItems.map((item, idx) => (
                <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                  {item.quantity}x {item.name}
                </span>
              ))}
              {remainingCount > 0 && (
                <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-500">
                  +{remainingCount} mais
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
