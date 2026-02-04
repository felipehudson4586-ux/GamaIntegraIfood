import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, ChefHat, Package, Truck, CheckCircle, XCircle, User, MapPin, Phone, CreditCard, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import api from "../lib/api";

const CANCEL_REASONS = [
  { code: "501", desc: "Problemas de sistema" },
  { code: "502", desc: "Pedido duplicado" },
  { code: "503", desc: "Item indisponível" },
  { code: "504", desc: "Restaurante fechado" },
  { code: "505", desc: "Sem entregador" },
  { code: "506", desc: "Cliente cancelou" },
];

function OrderDetail() {
  const params = useParams();
  const orderId = params.orderId;
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelCode, setCancelCode] = useState("501");

  const loadOrder = useCallback(async function() {
    try {
      const res = await api.get("/orders/" + orderId);
      setOrder(res.data);
    } catch (e) {
      toast.error("Pedido não encontrado");
      navigate("/orders");
    } finally {
      setLoading(false);
    }
  }, [orderId, navigate]);

  useEffect(function() { loadOrder(); }, [loadOrder]);

  async function doAction(endpoint, msg) {
    setBusy(true);
    try {
      const res = await api.post(endpoint);
      if (res.data.success) { toast.success(msg); loadOrder(); }
      else { toast.error(res.data.error || "Erro"); }
    } catch (e) { toast.error("Erro"); }
    finally { setBusy(false); }
  }

  async function doCancel() {
    setBusy(true);
    try {
      const res = await api.post("/orders/" + orderId + "/cancel?cancellation_code=" + cancelCode);
      if (res.data.success) { toast.success("Cancelado"); setCancelOpen(false); loadOrder(); }
      else { toast.error(res.data.error || "Erro"); }
    } catch (e) { toast.error("Erro"); }
    finally { setBusy(false); }
  }

  function fmtDate(d) { return d ? new Date(d).toLocaleString("pt-BR") : "-"; }
  function fmtMoney(v) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0); }
  function getStatusLabel(s) {
    var map = { PLACED: "Novo", CONFIRMED: "Confirmado", PREPARATION_STARTED: "Preparando", SEPARATION_STARTED: "Separando", SEPARATION_ENDED: "Separado", READY_TO_PICKUP: "Pronto", DISPATCHED: "Despachado", CONCLUDED: "Concluído", CANCELLED: "Cancelado" };
    return map[s] || s;
  }
  function getStatusBadge(s) {
    var map = { PLACED: "badge-new", CONFIRMED: "badge-confirmed", PREPARATION_STARTED: "badge-preparing", SEPARATION_STARTED: "badge-preparing", READY_TO_PICKUP: "badge-ready", DISPATCHED: "badge-dispatched", CONCLUDED: "badge-concluded", CANCELLED: "badge-cancelled" };
    return map[s] || "";
  }

  if (loading) return <div className="space-y-6" data-testid="loading"><div className="h-64 bg-gray-200 rounded-xl animate-shimmer" /></div>;
  if (!order) return null;

  var s = order.status;
  var canConfirm = s === "PLACED";
  var canPrep = s === "CONFIRMED";
  var canReady = s === "PREPARATION_STARTED" || s === "SEPARATION_STARTED";
  var canDispatch = s === "READY_TO_PICKUP" || s === "SEPARATION_ENDED";
  var canCancel = s !== "CANCELLED" && s !== "CONCLUDED";

  var items = order.items || [];
  var customer = order.customer || {};
  var address = order.address || {};
  var payments = order.payments || [];

  return (
    <div className="space-y-6" data-testid="order-detail">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={function() { navigate("/orders"); }} data-testid="back-btn"><ArrowLeft size={20} /></Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-2xl font-bold">Pedido #{order.display_id}</h1>
              <Badge className={getStatusBadge(s)}>{getStatusLabel(s)}</Badge>
            </div>
            <p className="text-gray-500 text-sm mt-1">Criado em {fmtDate(order.created_at)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2"><Printer size={16} />Imprimir</Button>
          {canCancel && <Button variant="destructive" onClick={function() { setCancelOpen(true); }} data-testid="cancel-btn">Cancelar</Button>}
        </div>
      </div>

      {(canConfirm || canPrep || canReady || canDispatch) && (
        <Card className="border-2 border-ifood-red/20 bg-red-50/30">
          <CardContent className="py-4 flex flex-wrap gap-3">
            {canConfirm && <Button className="btn-ifood" onClick={function() { doAction("/orders/" + orderId + "/confirm", "Confirmado"); }} disabled={busy}><CheckCircle size={16} className="mr-2" />Confirmar</Button>}
            {canPrep && <Button className="btn-ifood" onClick={function() { doAction("/orders/" + orderId + "/start-preparation", "Preparo iniciado"); }} disabled={busy}><ChefHat size={16} className="mr-2" />Iniciar Preparo</Button>}
            {canReady && <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={function() { doAction("/orders/" + orderId + "/ready", "Pronto"); }} disabled={busy}><Package size={16} className="mr-2" />Marcar Pronto</Button>}
            {canDispatch && <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={function() { doAction("/orders/" + orderId + "/dispatch", "Despachado"); }} disabled={busy}><Truck size={16} className="mr-2" />Despachar</Button>}
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg font-heading">Itens</CardTitle></CardHeader>
            <CardContent>
              {items.map(function(it, i) {
                return (
                  <div key={i} className="flex justify-between py-3 border-b border-gray-100 last:border-0">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center font-bold text-gray-600">{it.quantity}x</div>
                      <div><p className="font-medium">{it.name}</p>{it.observations && <p className="text-sm text-gray-500">{it.observations}</p>}</div>
                    </div>
                    <p className="font-medium">{fmtMoney(it.total_price)}</p>
                  </div>
                );
              })}
              <Separator className="my-4" />
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span>{fmtMoney(order.subtotal)}</span></div>
                {order.delivery_fee > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">Entrega</span><span>{fmtMoney(order.delivery_fee)}</span></div>}
                {order.discount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Desconto</span><span>-{fmtMoney(order.discount)}</span></div>}
                <Separator />
                <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{fmtMoney(order.total)}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg font-heading">Histórico</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <TimelineItem icon={Clock} label="Criado" time={fmtDate(order.created_at)} active={true} />
              {order.confirmed_at && <TimelineItem icon={CheckCircle} label="Confirmado" time={fmtDate(order.confirmed_at)} active={true} />}
              {order.preparation_start_datetime && <TimelineItem icon={ChefHat} label="Preparo" time={fmtDate(order.preparation_start_datetime)} active={true} />}
              {order.dispatched_at && <TimelineItem icon={Truck} label="Despachado" time={fmtDate(order.dispatched_at)} active={true} />}
              {order.concluded_at && <TimelineItem icon={CheckCircle} label="Concluído" time={fmtDate(order.concluded_at)} active={true} success={true} />}
              {order.cancelled_at && <TimelineItem icon={XCircle} label={"Cancelado" + (order.cancellation_reason ? ": " + order.cancellation_reason : "")} time={fmtDate(order.cancelled_at)} active={true} error={true} />}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg font-heading flex items-center gap-2"><User size={18} />Cliente</CardTitle></CardHeader>
            <CardContent>
              <p className="font-medium text-lg">{customer.name || "Cliente"}</p>
              {customer.phone && <p className="text-sm text-gray-500 flex items-center gap-2 mt-1"><Phone size={14} />{customer.phone}</p>}
            </CardContent>
          </Card>

          {address.street_name && order.order_type === "DELIVERY" && (
            <Card>
              <CardHeader><CardTitle className="text-lg font-heading flex items-center gap-2"><MapPin size={18} />Endereço</CardTitle></CardHeader>
              <CardContent>
                <p className="font-medium">{address.street_name}, {address.street_number}</p>
                {address.complement && <p className="text-sm text-gray-500">{address.complement}</p>}
                <p className="text-sm text-gray-500">{address.neighborhood}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-lg font-heading flex items-center gap-2"><CreditCard size={18} />Pagamento</CardTitle></CardHeader>
            <CardContent>
              {payments.length > 0 ? payments.map(function(p, i) {
                return <div key={i} className="flex justify-between"><span className="text-sm text-gray-500">{p.method || p.type}</span><span className="font-medium">{fmtMoney(p.value)}</span></div>;
              }) : <p className="text-sm text-gray-500">Online</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg font-heading">Info</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Tipo</span><Badge variant="outline">{order.order_type}</Badge></div>
              <div className="flex justify-between"><span className="text-gray-500">Categoria</span><span>{order.category}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Pedido</AlertDialogTitle>
            <AlertDialogDescription>Selecione o motivo:</AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={cancelCode} onValueChange={setCancelCode}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CANCEL_REASONS.map(function(r) { return <SelectItem key={r.code} value={r.code}>{r.desc}</SelectItem>; })}
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={doCancel} className="bg-red-600 hover:bg-red-700" disabled={busy}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TimelineItem(props) {
  var Icon = props.icon;
  var label = props.label;
  var time = props.time;
  var active = props.active;
  var success = props.success;
  var error = props.error;
  
  var bg = "bg-gray-100";
  var ic = "text-gray-400";
  if (success) { bg = "bg-green-100"; ic = "text-green-600"; }
  else if (error) { bg = "bg-red-100"; ic = "text-red-600"; }
  else if (active) { bg = "bg-ifood-red/10"; ic = "text-ifood-red"; }
  
  var textColor = "";
  if (error) textColor = "text-red-600";
  else if (success) textColor = "text-green-600";
  
  return (
    <div className="flex items-start gap-3">
      <div className={"w-8 h-8 rounded-full flex items-center justify-center " + bg}><Icon size={16} className={ic} /></div>
      <div><p className={"font-medium " + textColor}>{label}</p><p className="text-xs text-gray-500">{time}</p></div>
    </div>
  );
}

export default OrderDetail;
