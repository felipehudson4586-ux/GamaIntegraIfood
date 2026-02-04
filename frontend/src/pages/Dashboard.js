import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  ShoppingBag, 
  Clock, 
  ChefHat, 
  Package, 
  Truck,
  CheckCircle,
  XCircle,
  DollarSign,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  Volume2,
  VolumeX
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import api from "../lib/api";
import { useNotificationSound } from "../hooks/useNotificationSound";

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

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('ifood_sound_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const previousOrderCountRef = useRef(null);
  const { playNewOrderSound } = useNotificationSound();

  const fetchData = useCallback(async () => {
    try {
      const [metricsRes, ordersRes] = await Promise.all([
        api.get("/metrics/dashboard"),
        api.get("/orders/today")
      ]);
      
      const newMetrics = metricsRes.data;
      const newOrders = ordersRes.data.orders || [];
      
      // Verifica se há novos pedidos pendentes
      if (previousOrderCountRef.current !== null && 
          newMetrics?.pending_orders > previousOrderCountRef.current &&
          soundEnabled) {
        playNewOrderSound();
        toast.success("🔔 Novo pedido recebido!", {
          description: `${newMetrics.pending_orders - previousOrderCountRef.current} novo(s) pedido(s)`,
          duration: 5000,
        });
      }
      
      previousOrderCountRef.current = newMetrics?.pending_orders || 0;
      
      setMetrics(newMetrics);
      setRecentOrders(newOrders.slice(0, 10));
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados do dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [soundEnabled, playNewOrderSound]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Atualiza a cada 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const toggleSound = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    localStorage.setItem('ifood_sound_enabled', JSON.stringify(newValue));
    toast.info(newValue ? "Som de notificação ativado" : "Som de notificação desativado");
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value || 0);
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="dashboard-loading">
        <div className="h-8 w-48 bg-gray-200 rounded animate-shimmer" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-xl animate-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Visão geral dos pedidos de hoje</p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleRefresh}
          disabled={refreshing}
          className="gap-2"
          data-testid="refresh-btn"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          Atualizar
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Pedidos Hoje"
          value={metrics?.total_orders_today || 0}
          icon={ShoppingBag}
          color="text-ifood-red"
          bgColor="bg-red-50"
        />
        <StatCard
          title="Receita Hoje"
          value={formatCurrency(metrics?.total_revenue_today)}
          icon={DollarSign}
          color="text-green-600"
          bgColor="bg-green-50"
        />
        <StatCard
          title="Ticket Médio"
          value={formatCurrency(metrics?.average_order_value)}
          icon={TrendingUp}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <StatCard
          title="Pendentes"
          value={metrics?.pending_orders || 0}
          icon={Clock}
          color="text-amber-600"
          bgColor="bg-amber-50"
          highlight={metrics?.pending_orders > 0}
        />
      </div>

      {/* Status Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatusCard 
          label="Novos" 
          count={metrics?.pending_orders || 0} 
          color="bg-blue-500"
          status="PLACED"
        />
        <StatusCard 
          label="Preparando" 
          count={metrics?.in_preparation || 0} 
          color="bg-orange-500"
          status="PREPARATION_STARTED"
        />
        <StatusCard 
          label="Prontos" 
          count={metrics?.ready_orders || 0} 
          color="bg-green-500"
          status="READY_TO_PICKUP"
        />
        <StatusCard 
          label="Em Entrega" 
          count={metrics?.dispatched_orders || 0} 
          color="bg-purple-500"
          status="DISPATCHED"
        />
        <StatusCard 
          label="Concluídos" 
          count={metrics?.concluded_orders || 0} 
          color="bg-emerald-500"
          status="CONCLUDED"
        />
        <StatusCard 
          label="Cancelados" 
          count={metrics?.cancelled_orders || 0} 
          color="bg-red-500"
          status="CANCELLED"
        />
      </div>

      {/* Recent Orders */}
      <Card data-testid="recent-orders-card">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg font-heading">Pedidos Recentes</CardTitle>
          <Link to="/orders">
            <Button variant="ghost" size="sm" className="gap-1 text-ifood-red hover:text-ifood-red-dark">
              Ver todos <ArrowRight size={16} />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ShoppingBag className="mx-auto mb-3 text-gray-300" size={48} />
              <p>Nenhum pedido hoje</p>
              <p className="text-sm mt-1">Os novos pedidos aparecerão aqui</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders by Type */}
      {metrics?.orders_by_type && Object.keys(metrics.orders_by_type).length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-heading">Por Tipo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(metrics.orders_by_type).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{type}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-heading">Por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(metrics.orders_by_category || {}).map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{category}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, bgColor, highlight }) {
  return (
    <div 
      className={`stat-card ${highlight ? "ring-2 ring-amber-200" : ""}`}
      data-testid={`stat-${title.toLowerCase().replace(/\s/g, '-')}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-2 rounded-lg ${bgColor}`}>
          <Icon size={20} className={color} />
        </div>
      </div>
    </div>
  );
}

function StatusCard({ label, count, color, status }) {
  return (
    <Link 
      to={`/orders?status=${status}`}
      className="card-ifood card-ifood-interactive p-4 text-center"
      data-testid={`status-${status.toLowerCase()}`}
    >
      <div className={`w-3 h-3 rounded-full ${color} mx-auto mb-2`} />
      <p className="text-2xl font-bold text-gray-900">{count}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </Link>
  );
}

function OrderRow({ order }) {
  const status = statusConfig[order.status] || statusConfig.PLACED;
  const StatusIcon = status.icon;

  return (
    <Link 
      to={`/orders/${order.id}`}
      className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all"
      data-testid={`order-row-${order.id}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
          <StatusIcon size={20} className="text-gray-600" />
        </div>
        <div>
          <p className="font-medium text-gray-900">#{order.display_id}</p>
          <p className="text-xs text-gray-500">
            {order.customer?.name || "Cliente"} • {order.items?.length || 0} itens
          </p>
        </div>
      </div>
      <div className="text-right">
        <Badge className={status.color}>{status.label}</Badge>
        <p className="text-sm font-medium text-gray-900 mt-1">
          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.total || 0)}
        </p>
      </div>
    </Link>
  );
}
