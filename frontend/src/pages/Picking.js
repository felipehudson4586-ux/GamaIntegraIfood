import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Truck,
  Package,
  CheckCircle,
  Clock,
  Play,
  Square,
  ArrowRight,
  User,
  MapPin
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import api from "../lib/api";

const pickingStatuses = {
  CONFIRMED: { label: "Aguardando", action: "Iniciar Separação", nextStatus: "start" },
  SEPARATION_STARTED: { label: "Em Separação", action: "Finalizar Separação", nextStatus: "end" },
  SEPARATION_ENDED: { label: "Separado", action: "Despachar", nextStatus: "dispatch" },
};

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
      // Busca pedidos que precisam de separação
      const response = await api.get("/orders", {
        params: { limit: 50 }
      });
      
      // Filtra pedidos que são de mercado/grocery ou estão em processo de separação
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
      switch (action) {
        case "start":
          endpoint = `/picking/${order.id}/start`;
          break;
        case "end":
          endpoint = `/picking/${order.id}/end`;
          break;
        case "dispatch":
          endpoint = `/orders/${order.id}/dispatch`;
          break;
        default:
          return;
      }

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

  const groupedOrders = {
    waiting: orders.filter(o => o.status === "CONFIRMED"),
    separating: orders.filter(o => o.status === "SEPARATION_STARTED"),
    ready: orders.filter(o => o.status === "SEPARATION_ENDED"),
  };

  return (
    <div className="space-y-6" data-testid="picking-page">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-gray-900">Separação</h1>
        <p className="text-gray-500 text-sm mt-1">
          Gerencie a separação de pedidos (Módulo Picking)
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Aguardando"
          count={groupedOrders.waiting.length}
          icon={Clock}
          color="bg-amber-100"
          iconColor="text-amber-600"
        />
        <StatCard
          label="Em Separação"
          count={groupedOrders.separating.length}
          icon={Package}
          color="bg-blue-100"
          iconColor="text-blue-600"
        />
        <StatCard
          label="Prontos"
          count={groupedOrders.ready.length}
          icon={CheckCircle}
          color="bg-green-100"
          iconColor="text-green-600"
        />
      </div>

      {/* Info Card */}
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
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-xl animate-shimmer" />
          ))}
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
          {/* Aguardando */}
          {groupedOrders.waiting.length > 0 && (
            <Section
              title="Aguardando Separação"
              icon={Clock}
              count={groupedOrders.waiting.length}
              color="text-amber-600"
            >
              {groupedOrders.waiting.map((order) => (
                <PickingCard
                  key={order.id}
                  order={order}
                  onAction={() => handleAction(order, "start")}
                  actionLabel="Iniciar Separação"
                  actionIcon={Play}
                />
              ))}
            </Section>
          )}

          {/* Em Separação */}
          {groupedOrders.separating.length > 0 && (
            <Section
              title="Em Separação"
              icon={Package}
              count={groupedOrders.separating.length}
              color="text-blue-600"
            >
              {groupedOrders.separating.map((order) => (
                <PickingCard
                  key={order.id}
                  order={order}
                  onAction={() => handleAction(order, "end")}
                  actionLabel="Finalizar Separação"
                  actionIcon={Square}
                  inProgress
                />
              ))}
            </Section>
          )}

          {/* Prontos */}
          {groupedOrders.ready.length > 0 && (
            <Section
              title="Prontos para Despacho"
              icon={CheckCircle}
              count={groupedOrders.ready.length}
              color="text-green-600"
            >
              {groupedOrders.ready.map((order) => (
                <PickingCard
                  key={order.id}
                  order={order}
                  onAction={() => handleAction(order, "dispatch")}
                  actionLabel="Despachar"
                  actionIcon={Truck}
                  ready
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, count, icon: Icon, color, iconColor }) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={20} className={iconColor} />
        </div>
        <div>
          <p className="text-2xl font-bold">{count}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, count, color, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Icon size={20} className={color} />
        <h2 className="font-heading font-semibold text-lg">{title}</h2>
        <Badge variant="secondary">{count}</Badge>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function PickingCard({ order, onAction, actionLabel, actionIcon: ActionIcon, inProgress, ready }) {
  const formatTime = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <Card 
      className={`card-ifood ${inProgress ? "border-blue-200" : ready ? "border-green-200" : ""}`}
      data-testid={`picking-card-${order.id}`}
    >
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              inProgress ? "bg-blue-100" : ready ? "bg-green-100" : "bg-amber-100"
            }`}>
              <Package size={24} className={
                inProgress ? "text-blue-600" : ready ? "text-green-600" : "text-amber-600"
              } />
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
              <p className="text-sm text-gray-500">{order.items?.length || 0} itens</p>
              <p className="font-bold">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.total || 0)}
              </p>
            </div>
            <div className="flex gap-2">
              <Link to={`/orders/${order.id}`}>
                <Button variant="outline" size="sm">
                  Detalhes
                </Button>
              </Link>
              <Button
                size="sm"
                className={inProgress ? "bg-blue-600 hover:bg-blue-700" : ready ? "bg-green-600 hover:bg-green-700" : "btn-ifood"}
                onClick={onAction}
                data-testid={`action-${order.id}`}
              >
                <ActionIcon size={16} className="mr-1" />
                {actionLabel}
              </Button>
            </div>
          </div>
        </div>

        {/* Items Preview */}
        {order.items && order.items.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-wrap gap-2">
              {order.items.slice(0, 5).map((item, idx) => (
                <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                  {item.quantity}x {item.name}
                </span>
              ))}
              {order.items.length > 5 && (
                <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-500">
                  +{order.items.length - 5} mais
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
