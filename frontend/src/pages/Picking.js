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
      const allOrders = response.data.orders || [];
      const pickingOrders = allOrders.filter(function(order) {
        return order.category === "GROCERY" ||
          order.status === "CONFIRMED" ||
          order.status === "SEPARATION_STARTED" ||
          order.status === "SEPARATION_ENDED";
      });
      setOrders(pickingOrders);
    } catch (error) {
      console.error("Erro ao carregar pedidos:", error);
      toast.error("Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  };

  const handleStartSeparation = async (orderId) => {
    try {
      const response = await api.post(`/picking/${orderId}/start`);
      if (response.data.success) {
        toast.success("Separação iniciada");
        fetchOrders();
      } else {
        toast.error(response.data.error || "Erro");
      }
    } catch (error) {
      toast.error("Erro ao iniciar separação");
    }
  };

  const handleEndSeparation = async (orderId) => {
    try {
      const response = await api.post(`/picking/${orderId}/end`);
      if (response.data.success) {
        toast.success("Separação finalizada");
        fetchOrders();
      } else {
        toast.error(response.data.error || "Erro");
      }
    } catch (error) {
      toast.error("Erro ao finalizar separação");
    }
  };

  const handleDispatch = async (orderId) => {
    try {
      const response = await api.post(`/orders/${orderId}/dispatch`);
      if (response.data.success) {
        toast.success("Pedido despachado");
        fetchOrders();
      } else {
        toast.error(response.data.error || "Erro");
      }
    } catch (error) {
      toast.error("Erro ao despachar");
    }
  };

  const countByStatus = (status) => {
    return orders.filter(o => o.status === status).length;
  };

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
        <p className="text-gray-500 text-sm mt-1">Gerencie a separação de pedidos (Módulo Picking)</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-100">
              <Clock size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{countByStatus("CONFIRMED")}</p>
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
              <p className="text-2xl font-bold">{countByStatus("SEPARATION_STARTED")}</p>
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
              <p className="text-2xl font-bold">{countByStatus("SEPARATION_ENDED")}</p>
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
                a separação de itens durante o processo.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-4">
          <div className="h-32 bg-gray-200 rounded-xl animate-shimmer" />
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto mb-4 text-gray-300" size={48} />
            <p className="text-gray-500">Nenhum pedido para separação</p>
            <p className="text-sm text-gray-400 mt-1">Pedidos de mercado aparecerão aqui</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="card-ifood" data-testid={`picking-card-${order.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gray-100">
                      <Package size={24} className="text-gray-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">#{order.display_id}</span>
                        <Badge variant="outline">{order.category}</Badge>
                        <Badge variant="secondary">{order.status}</Badge>
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
                          {order.address.street_name}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="text-left sm:text-right">
                      <p className="font-bold">{formatCurrency(order.total)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Link to={`/orders/${order.id}`}>
                        <Button variant="outline" size="sm">Detalhes</Button>
                      </Link>
                      {order.status === "CONFIRMED" && (
                        <Button 
                          size="sm" 
                          className="btn-ifood" 
                          onClick={() => handleStartSeparation(order.id)}
                          data-testid={`start-${order.id}`}
                        >
                          <Play size={16} className="mr-1" />
                          Iniciar
                        </Button>
                      )}
                      {order.status === "SEPARATION_STARTED" && (
                        <Button 
                          size="sm" 
                          className="bg-blue-600 hover:bg-blue-700" 
                          onClick={() => handleEndSeparation(order.id)}
                          data-testid={`end-${order.id}`}
                        >
                          <Square size={16} className="mr-1" />
                          Finalizar
                        </Button>
                      )}
                      {order.status === "SEPARATION_ENDED" && (
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700" 
                          onClick={() => handleDispatch(order.id)}
                          data-testid={`dispatch-${order.id}`}
                        >
                          <Truck size={16} className="mr-1" />
                          Despachar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
