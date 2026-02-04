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
  Printer
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

const cancellationReasons = [
  { code: "501", description: "Problemas de sistema" },
  { code: "502", description: "Pedido duplicado" },
  { code: "503", description: "Item indisponível" },
  { code: "504", description: "Restaurante fechado" },
  { code: "505", description: "Sem entregador disponível" },
  { code: "506", description: "Cliente solicitou cancelamento" },
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
    const loadOrder = async () => {
      try {
        const response = await api.get("/orders/" + orderId);
        setOrder(response.data);
      } catch (error) {
        toast.error("Pedido não encontrado");
        navigate("/orders");
      } finally {
        setLoading(false);
      }
    };
    loadOrder();
  }, [orderId, navigate]);

  const fetchOrder = async () => {
    try {
      const response = await api.get("/orders/" + orderId);
      setOrder(response.data);
    } catch (error) {
      toast.error("Pedido não encontrado");
      navigate("/orders");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setActionLoading(true);
    try {
      const response = await api.post("/orders/" + orderId + "/confirm");
      if (response.data.success) {
        toast.success("Pedido confirmado");
        fetchOrder();
      } else {
        toast.error(response.data.error || "Erro");
      }
    } catch (error) {
      toast.error("Erro ao confirmar");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartPreparation = async () => {
    setActionLoading(true);
    try {
      const response = await api.post("/orders/" + orderId + "/start-preparation");
      if (response.data.success) {
        toast.success("Preparo iniciado");
        fetchOrder();
      } else {
        toast.error(response.data.error || "Erro");
      }
    } catch (error) {
      toast.error("Erro ao iniciar preparo");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReady = async () => {
    setActionLoading(true);
    try {
      const response = await api.post("/orders/" + orderId + "/ready");
      if (response.data.success) {
        toast.success("Pedido pronto");
        fetchOrder();
      } else {
        toast.error(response.data.error || "Erro");
      }
    } catch (error) {
      toast.error("Erro ao marcar pronto");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDispatch = async () => {
    setActionLoading(true);
    try {
      const response = await api.post("/orders/" + orderId + "/dispatch");
      if (response.data.success) {
        toast.success("Pedido despachado");
        fetchOrder();
      } else {
        toast.error(response.data.error || "Erro");
      }
    } catch (error) {
      toast.error("Erro ao despachar");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      const response = await api.post("/orders/" + orderId + "/cancel?cancellation_code=" + cancelReason);
      if (response.data.success) {
        toast.success("Pedido cancelado");
        setShowCancelDialog(false);
        fetchOrder();
      } else {
        toast.error(response.data.error || "Erro");
      }
    } catch (error) {
      toast.error("Erro ao cancelar");
    } finally {
      setActionLoading(false);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("pt-BR");
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
  };

  const getStatusLabel = (status) => {
    const labels = {
      PLACED: "Novo",
      CONFIRMED: "Confirmado",
      PREPARATION_STARTED: "Preparando",
      SEPARATION_STARTED: "Separando",
      SEPARATION_ENDED: "Separado",
      READY_TO_PICKUP: "Pronto",
      DISPATCHED: "Despachado",
      CONCLUDED: "Concluído",
      CANCELLED: "Cancelado"
    };
    return labels[status] || status;
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      PLACED: "badge-new",
      CONFIRMED: "badge-confirmed",
      PREPARATION_STARTED: "badge-preparing",
      SEPARATION_STARTED: "badge-preparing",
      READY_TO_PICKUP: "badge-ready",
      DISPATCHED: "badge-dispatched",
      CONCLUDED: "badge-concluded",
      CANCELLED: "badge-cancelled"
    };
    return classes[status] || "";
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="order-detail-loading">
        <div className="h-8 w-32 bg-gray-200 rounded animate-shimmer" />
        <div className="h-64 bg-gray-200 rounded-xl animate-shimmer" />
      </div>
    );
  }

  if (!order) return null;

  const canConfirm = order.status === "PLACED";
  const canStartPrep = order.status === "CONFIRMED";
  const canMarkReady = order.status === "PREPARATION_STARTED" || order.status === "SEPARATION_STARTED";
  const canDispatch = order.status === "READY_TO_PICKUP" || order.status === "SEPARATION_ENDED";
  const canCancel = order.status !== "CANCELLED" && order.status !== "CONCLUDED";

  return (
    <div className="space-y-6" data-testid="order-detail">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/orders")} data-testid="back-btn">
            <ArrowLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-2xl font-bold">Pedido #{order.display_id}</h1>
              <Badge className={getStatusBadgeClass(order.status)}>{getStatusLabel(order.status)}</Badge>
            </div>
            <p className="text-gray-500 text-sm mt-1">Criado em {formatDateTime(order.created_at)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" data-testid="print-btn">
            <Printer size={16} />
            Imprimir
          </Button>
          {canCancel && (
            <Button variant="destructive" onClick={() => setShowCancelDialog(true)} data-testid="cancel-btn">
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {(canConfirm || canStartPrep || canMarkReady || canDispatch) && (
        <Card className="border-2 border-ifood-red/20 bg-red-50/30">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-3">
              {canConfirm && (
                <Button className="btn-ifood" onClick={handleConfirm} disabled={actionLoading} data-testid="confirm-btn">
                  <CheckCircle size={16} className="mr-2" />
                  Confirmar Pedido
                </Button>
              )}
              {canStartPrep && (
                <Button className="btn-ifood" onClick={handleStartPreparation} disabled={actionLoading} data-testid="start-prep-btn">
                  <ChefHat size={16} className="mr-2" />
                  Iniciar Preparo
                </Button>
              )}
              {canMarkReady && (
                <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleReady} disabled={actionLoading} data-testid="ready-btn">
                  <Package size={16} className="mr-2" />
                  Marcar Pronto
                </Button>
              )}
              {canDispatch && (
                <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleDispatch} disabled={actionLoading} data-testid="dispatch-btn">
                  <Truck size={16} className="mr-2" />
                  Despachar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <Card data-testid="order-items">
            <CardHeader>
              <CardTitle className="text-lg font-heading">Itens do Pedido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items && order.items.map((item, idx) => (
                  <div key={idx} className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-bold text-gray-600">
                        {item.quantity}x
                      </div>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.observations && <p className="text-sm text-gray-500 mt-1">{item.observations}</p>}
                      </div>
                    </div>
                    <p className="font-medium">{formatCurrency(item.total_price)}</p>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

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
                <TimelineItem icon={Clock} label="Pedido criado" time={formatDateTime(order.created_at)} active />
                {order.confirmed_at && <TimelineItem icon={CheckCircle} label="Confirmado" time={formatDateTime(order.confirmed_at)} active />}
                {order.preparation_start_datetime && <TimelineItem icon={ChefHat} label="Preparo iniciado" time={formatDateTime(order.preparation_start_datetime)} active />}
                {order.dispatched_at && <TimelineItem icon={Truck} label="Despachado" time={formatDateTime(order.dispatched_at)} active />}
                {order.concluded_at && <TimelineItem icon={CheckCircle} label="Concluído" time={formatDateTime(order.concluded_at)} active success />}
                {order.cancelled_at && <TimelineItem icon={XCircle} label={"Cancelado: " + (order.cancellation_reason || "")} time={formatDateTime(order.cancelled_at)} active error />}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Customer */}
          <Card data-testid="customer-info">
            <CardHeader>
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <User size={18} />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-lg">{order.customer?.name || "Cliente"}</p>
              {order.customer?.phone && (
                <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                  <Phone size={14} />
                  {order.customer.phone}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Address */}
          {order.address && order.order_type === "DELIVERY" && (
            <Card data-testid="delivery-address">
              <CardHeader>
                <CardTitle className="text-lg font-heading flex items-center gap-2">
                  <MapPin size={18} />
                  Endereço
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium">{order.address.street_name}, {order.address.street_number}</p>
                {order.address.complement && <p className="text-sm text-gray-500">{order.address.complement}</p>}
                <p className="text-sm text-gray-500">{order.address.neighborhood}</p>
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

          {/* Info */}
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
              Selecione o motivo do cancelamento:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={cancelReason} onValueChange={setCancelReason}>
            <SelectTrigger data-testid="cancel-reason-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cancellationReasons.map((reason) => (
                <SelectItem key={reason.code} value={reason.code}>{reason.description}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-red-600 hover:bg-red-700" disabled={actionLoading} data-testid="confirm-cancel-btn">
              {actionLoading ? "Cancelando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TimelineItem({ icon: Icon, label, time, active, success, error }) {
  const getBgClass = () => {
    if (success) return "bg-green-100";
    if (error) return "bg-red-100";
    if (active) return "bg-ifood-red/10";
    return "bg-gray-100";
  };

  const getIconClass = () => {
    if (success) return "text-green-600";
    if (error) return "text-red-600";
    if (active) return "text-ifood-red";
    return "text-gray-400";
  };

  return (
    <div className="flex items-start gap-3">
      <div className={"w-8 h-8 rounded-full flex items-center justify-center " + getBgClass()}>
        <Icon size={16} className={getIconClass()} />
      </div>
      <div>
        <p className={"font-medium " + (error ? "text-red-600" : success ? "text-green-600" : "")}>{label}</p>
        <p className="text-xs text-gray-500">{time}</p>
      </div>
    </div>
  );
}
