import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  ChefHat,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  User,
  MapPin,
  Phone,
  CreditCard,
  Printer,
  Navigation
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
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
  PLACED: { label: "Novo", color: "badge-new", icon: Clock, nextAction: "Confirmar" },
  CONFIRMED: { label: "Confirmado", color: "badge-confirmed", icon: CheckCircle, nextAction: "Iniciar Preparo" },
  PREPARATION_STARTED: { label: "Preparando", color: "badge-preparing", icon: ChefHat, nextAction: "Marcar Pronto" },
  SEPARATION_STARTED: { label: "Separando", color: "badge-preparing", icon: Package, nextAction: "Finalizar Separação" },
  SEPARATION_ENDED: { label: "Separado", color: "badge-ready", icon: Package, nextAction: "Despachar" },
  READY_TO_PICKUP: { label: "Pronto", color: "badge-ready", icon: Package, nextAction: "Despachar" },
  DISPATCHED: { label: "Despachado", color: "badge-dispatched", icon: Truck, nextAction: null },
  ARRIVED: { label: "Chegou", color: "badge-dispatched", icon: Truck, nextAction: null },
  CONCLUDED: { label: "Concluído", color: "badge-concluded", icon: CheckCircle, nextAction: null },
  CANCELLED: { label: "Cancelado", color: "badge-cancelled", icon: XCircle, nextAction: null },
};

const cancellationReasons = [
  { code: "501", description: "Problemas de sistema" },
  { code: "502", description: "Pedido duplicado" },
  { code: "503", description: "Item indisponível" },
  { code: "504", description: "Restaurante fechado" },
  { code: "505", description: "Sem entregador disponível" },
  { code: "506", description: "Cliente solicitou cancelamento" },
  { code: "507", description: "Endereço inválido" },
  { code: "508", description: "Área fora da cobertura" },
];

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("501");

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const response = await api.get(`/orders/${orderId}`);
      setOrder(response.data);
    } catch (error) {
      console.error("Erro ao carregar pedido:", error);
      toast.error("Pedido não encontrado");
      navigate("/orders");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action) => {
    setActionLoading(true);
    try {
      let endpoint = "";
      switch (action) {
        case "confirm":
          endpoint = `/orders/${orderId}/confirm`;
          break;
        case "start-preparation":
          endpoint = `/orders/${orderId}/start-preparation`;
          break;
        case "ready":
          endpoint = `/orders/${orderId}/ready`;
          break;
        case "dispatch":
          endpoint = `/orders/${orderId}/dispatch`;
          break;
        default:
          return;
      }

      const response = await api.post(endpoint);
      if (response.data.success) {
        toast.success(response.data.message);
        fetchOrder();
      } else {
        toast.error(response.data.error || "Erro na operação");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao processar ação");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      const response = await api.post(`/orders/${orderId}/cancel?cancellation_code=${cancelReason}`);
      if (response.data.success) {
        toast.success("Pedido cancelado");
        setShowCancelDialog(false);
        fetchOrder();
      } else {
        toast.error(response.data.error || "Erro ao cancelar");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao cancelar pedido");
    } finally {
      setActionLoading(false);
    }
  };

  const getNextAction = () => {
    const status = statusConfig[order?.status];
    if (!status?.nextAction) return null;

    const actionMap = {
      "Confirmar": "confirm",
      "Iniciar Preparo": "start-preparation",
      "Marcar Pronto": "ready",
      "Finalizar Separação": "ready",
      "Despachar": "dispatch",
    };

    return {
      label: status.nextAction,
      action: actionMap[status.nextAction]
    };
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("pt-BR");
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value || 0);
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="order-detail-loading">
        <div className="h-8 w-32 bg-gray-200 rounded animate-shimmer" />
        <div className="h-64 bg-gray-200 rounded-xl animate-shimmer" />
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const status = statusConfig[order.status] || statusConfig.PLACED;
  const StatusIcon = status.icon;
  const nextAction = getNextAction();

  return (
    <div className="space-y-6" data-testid="order-detail">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/orders")}
            data-testid="back-btn"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-2xl font-bold">Pedido #{order.display_id}</h1>
              <Badge className={status.color}>{status.label}</Badge>
            </div>
            <p className="text-gray-500 text-sm mt-1">
              Criado em {formatDateTime(order.created_at)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" data-testid="print-btn">
            <Printer size={16} />
            Imprimir
          </Button>
          {order.status !== "CANCELLED" && order.status !== "CONCLUDED" && (
            <Button
              variant="destructive"
              onClick={() => setShowCancelDialog(true)}
              data-testid="cancel-btn"
            >
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Action Bar */}
      {nextAction && (
        <Card className="border-2 border-ifood-red/20 bg-red-50/30">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-ifood-red/10 rounded-full flex items-center justify-center">
                  <StatusIcon size={20} className="text-ifood-red" />
                </div>
                <div>
                  <p className="font-medium">Próxima ação disponível</p>
                  <p className="text-sm text-gray-500">Avance o pedido para o próximo estágio</p>
                </div>
              </div>
              <Button
                className="btn-ifood"
                onClick={() => handleAction(nextAction.action)}
                disabled={actionLoading}
                data-testid="next-action-btn"
              >
                {actionLoading ? "Processando..." : nextAction.label}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Order Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <Card data-testid="order-items">
            <CardHeader>
              <CardTitle className="text-lg font-heading">Itens do Pedido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items?.map((item, idx) => (
                  <div key={idx} className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-bold text-gray-600">
                        {item.quantity}x
                      </div>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.observations && (
                          <p className="text-sm text-gray-500 mt-1">{item.observations}</p>
                        )}
                        {item.garnish_items && item.garnish_items.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {item.garnish_items.map((garnish, gIdx) => (
                              <p key={gIdx} className="text-xs text-gray-400">
                                + {garnish.quantity || 1}x {garnish.name}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="font-medium">{formatCurrency(item.total_price)}</p>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
                {order.delivery_fee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Taxa de entrega</span>
                    <span>{formatCurrency(order.delivery_fee)}</span>
                  </div>
                )}
                {order.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Desconto</span>
                    <span>-{formatCurrency(order.discount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(order.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card data-testid="order-timeline">
            <CardHeader>
              <CardTitle className="text-lg font-heading">Histórico</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <TimelineItem
                  icon={Clock}
                  label="Pedido criado"
                  time={formatDateTime(order.created_at)}
                  active
                />
                {order.confirmed_at && (
                  <TimelineItem
                    icon={CheckCircle}
                    label="Confirmado"
                    time={formatDateTime(order.confirmed_at)}
                    active
                  />
                )}
                {order.preparation_start_datetime && (
                  <TimelineItem
                    icon={ChefHat}
                    label="Preparo iniciado"
                    time={formatDateTime(order.preparation_start_datetime)}
                    active
                  />
                )}
                {order.dispatched_at && (
                  <TimelineItem
                    icon={Truck}
                    label="Despachado"
                    time={formatDateTime(order.dispatched_at)}
                    active
                  />
                )}
                {order.concluded_at && (
                  <TimelineItem
                    icon={CheckCircle}
                    label="Concluído"
                    time={formatDateTime(order.concluded_at)}
                    active
                    success
                  />
                )}
                {order.cancelled_at && (
                  <TimelineItem
                    icon={XCircle}
                    label={`Cancelado: ${order.cancellation_reason || ""}`}
                    time={formatDateTime(order.cancelled_at)}
                    active
                    error
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Customer & Delivery */}
        <div className="space-y-6">
          {/* Customer */}
          <Card data-testid="customer-info">
            <CardHeader>
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <User size={18} />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium text-lg">{order.customer?.name || "Cliente"}</p>
                {order.customer?.phone && (
                  <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                    <Phone size={14} />
                    {order.customer.phone}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Delivery Address */}
          {order.address && order.order_type === "DELIVERY" && (
            <Card data-testid="delivery-address">
              <CardHeader>
                <CardTitle className="text-lg font-heading flex items-center gap-2">
                  <MapPin size={18} />
                  Endereço de Entrega
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium">
                  {order.address.street_name}, {order.address.street_number}
                </p>
                {order.address.complement && (
                  <p className="text-sm text-gray-500">{order.address.complement}</p>
                )}
                <p className="text-sm text-gray-500">
                  {order.address.neighborhood}
                  {order.address.city && `, ${order.address.city}`}
                  {order.address.state && ` - ${order.address.state}`}
                </p>
                {order.address.postal_code && (
                  <p className="text-sm text-gray-400">CEP: {order.address.postal_code}</p>
                )}
                {order.address.reference && (
                  <p className="text-sm text-gray-500 mt-2 italic">
                    Ref: {order.address.reference}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Driver */}
          {order.driver && (
            <Card data-testid="driver-info">
              <CardHeader>
                <CardTitle className="text-lg font-heading flex items-center gap-2">
                  <Navigation size={18} />
                  Entregador
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium">{order.driver.name}</p>
                {order.driver.phone && (
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <Phone size={14} />
                    {order.driver.phone}
                  </p>
                )}
                {order.driver.vehicle_type && (
                  <p className="text-sm text-gray-500">
                    {order.driver.vehicle_type}
                    {order.driver.vehicle_license_plate && ` - ${order.driver.vehicle_license_plate}`}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Payment */}
          <Card data-testid="payment-info">
            <CardHeader>
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <CreditCard size={18} />
                Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              {order.payments && order.payments.length > 0 ? (
                <div className="space-y-2">
                  {order.payments.map((payment, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="text-sm text-gray-500">{payment.method || payment.type}</span>
                      <span className="font-medium">{formatCurrency(payment.value)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Pagamento online</p>
              )}
            </CardContent>
          </Card>

          {/* Order Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-heading">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Tipo</span>
                <Badge variant="outline">{order.order_type}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Categoria</span>
                <span>{order.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Momento</span>
                <span>{order.moment === "IMMEDIATE" ? "Imediato" : "Agendado"}</span>
              </div>
              {order.ifood_id && (
                <div className="flex justify-between">
                  <span className="text-gray-500">iFood ID</span>
                  <span className="text-xs font-mono">{order.ifood_id.slice(0, 8)}...</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cancel Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Selecione o motivo do cancelamento:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={cancelReason} onValueChange={setCancelReason}>
            <SelectTrigger data-testid="cancel-reason-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cancellationReasons.map((reason) => (
                <SelectItem key={reason.code} value={reason.code}>
                  {reason.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-red-600 hover:bg-red-700"
              disabled={actionLoading}
              data-testid="confirm-cancel-btn"
            >
              {actionLoading ? "Cancelando..." : "Confirmar Cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TimelineItem({ icon: Icon, label, time, active, success, error }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
        success ? "bg-green-100" :
        error ? "bg-red-100" :
        active ? "bg-ifood-red/10" :
        "bg-gray-100"
      }`}>
        <Icon size={16} className={
          success ? "text-green-600" :
          error ? "text-red-600" :
          active ? "text-ifood-red" :
          "text-gray-400"
        } />
      </div>
      <div>
        <p className={`font-medium ${error ? "text-red-600" : success ? "text-green-600" : ""}`}>
          {label}
        </p>
        <p className="text-xs text-gray-500">{time}</p>
      </div>
    </div>
  );
}
