import { useState, useEffect } from "react";
import {
  Tag,
  Plus,
  Percent,
  Calendar,
  Trash2,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
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
import { toast } from "sonner";
import api from "../lib/api";

const promotionTypes = {
  PERCENTAGE: { label: "Porcentagem", description: "Desconto em porcentagem" },
  LXPY: { label: "Leve X Pague Y", description: "Compre X, Pague Y" },
  PERCENTAGE_PER_X_UNITS: { label: "Desconto por Quantidade", description: "% a cada X unidades" },
};

export default function Promotions() {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [deletePromo, setDeletePromo] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    promotion_type: "PERCENTAGE",
    discount_percentage: "",
    buy_quantity: "",
    get_quantity: "",
    start_date: "",
    end_date: ""
  });

  useEffect(() => {
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    try {
      const response = await api.get("/promotions");
      setPromotions(response.data.promotions || []);
    } catch (error) {
      console.error("Erro ao carregar promoções:", error);
      toast.error("Erro ao carregar promoções");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Valida desconto máximo de 70%
    if (formData.discount_percentage && parseFloat(formData.discount_percentage) > 70) {
      toast.error("Desconto máximo permitido é 70%");
      return;
    }

    try {
      const data = {
        name: formData.name,
        description: formData.description,
        promotion_type: formData.promotion_type,
        discount_percentage: formData.discount_percentage ? parseFloat(formData.discount_percentage) : null,
        buy_quantity: formData.buy_quantity ? parseInt(formData.buy_quantity) : null,
        get_quantity: formData.get_quantity ? parseInt(formData.get_quantity) : null,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        item_ids: []
      };

      await api.post("/promotions", data);
      toast.success("Promoção criada");
      setShowDialog(false);
      resetForm();
      fetchPromotions();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao criar promoção");
    }
  };

  const handleDelete = async () => {
    if (!deletePromo) return;
    try {
      await api.delete(`/promotions/${deletePromo.id}`);
      toast.success("Promoção removida");
      setDeletePromo(null);
      fetchPromotions();
    } catch (error) {
      toast.error("Erro ao remover promoção");
    }
  };

  const handleToggle = async (promo) => {
    try {
      await api.patch(`/promotions/${promo.id}/toggle?active=${!promo.active}`);
      toast.success(promo.active ? "Promoção desativada" : "Promoção ativada");
      fetchPromotions();
    } catch (error) {
      toast.error("Erro ao alterar promoção");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      promotion_type: "PERCENTAGE",
      discount_percentage: "",
      buy_quantity: "",
      get_quantity: "",
      start_date: "",
      end_date: ""
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const isExpired = (endDate) => {
    if (!endDate) return false;
    return new Date(endDate) < new Date();
  };

  return (
    <div className="space-y-6" data-testid="promotions-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gray-900">Promoções</h1>
          <p className="text-gray-500 text-sm mt-1">{promotions.length} promoções cadastradas</p>
        </div>
        <Button
          className="btn-ifood gap-2"
          onClick={() => {
            resetForm();
            setShowDialog(true);
          }}
          data-testid="add-promo-btn"
        >
          <Plus size={18} />
          Nova Promoção
        </Button>
      </div>

      {/* Info Card */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Percent size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-amber-800">Limite de desconto</p>
              <p className="text-sm text-amber-700">
                O iFood permite desconto máximo de 70% nas promoções. Promoções ativas podem não aparecer 
                imediatamente devido às regras de priorização do iFood.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Promotions List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-xl animate-shimmer" />
          ))}
        </div>
      ) : promotions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Tag className="mx-auto mb-4 text-gray-300" size={48} />
            <p className="text-gray-500">Nenhuma promoção cadastrada</p>
            <Button
              variant="link"
              className="text-ifood-red mt-2"
              onClick={() => {
                resetForm();
                setShowDialog(true);
              }}
            >
              Criar primeira promoção
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {promotions.map((promo) => (
            <Card 
              key={promo.id} 
              className={`card-ifood ${!promo.active || isExpired(promo.end_date) ? "opacity-60" : ""}`}
              data-testid={`promo-card-${promo.id}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      promo.active && !isExpired(promo.end_date) ? "bg-green-100" : "bg-gray-100"
                    }`}>
                      <Tag size={24} className={
                        promo.active && !isExpired(promo.end_date) ? "text-green-600" : "text-gray-400"
                      } />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-lg">{promo.name}</h3>
                        {isExpired(promo.end_date) ? (
                          <Badge variant="secondary">Expirada</Badge>
                        ) : promo.active ? (
                          <Badge className="bg-green-100 text-green-700">Ativa</Badge>
                        ) : (
                          <Badge variant="secondary">Inativa</Badge>
                        )}
                        <Badge variant="outline">
                          {promotionTypes[promo.promotion_type]?.label || promo.promotion_type}
                        </Badge>
                      </div>
                      {promo.description && (
                        <p className="text-sm text-gray-500 mt-1">{promo.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {formatDate(promo.start_date)} - {formatDate(promo.end_date)}
                        </span>
                        {promo.discount_percentage && (
                          <span className="text-ifood-red font-semibold">
                            {promo.discount_percentage}% OFF
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggle(promo)}
                      disabled={isExpired(promo.end_date)}
                      data-testid={`toggle-promo-${promo.id}`}
                    >
                      {promo.active ? (
                        <ToggleRight size={20} className="text-green-600" />
                      ) : (
                        <ToggleLeft size={20} className="text-gray-400" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletePromo(promo)}
                      className="text-red-500 hover:text-red-600"
                      data-testid={`delete-promo-${promo.id}`}
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Promoção</DialogTitle>
            <DialogDescription>
              Crie uma nova promoção para seus produtos
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Promoção *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Desconto de Verão"
                required
                data-testid="input-promo-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição da promoção"
                data-testid="input-promo-description"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Promoção</Label>
              <Select
                value={formData.promotion_type}
                onValueChange={(value) => setFormData({ ...formData, promotion_type: value })}
              >
                <SelectTrigger data-testid="select-promo-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(promotionTypes).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div>
                        <p>{config.label}</p>
                        <p className="text-xs text-gray-500">{config.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.promotion_type === "PERCENTAGE" && (
              <div className="space-y-2">
                <Label htmlFor="discount">Porcentagem de Desconto *</Label>
                <div className="relative">
                  <Input
                    id="discount"
                    type="number"
                    min="1"
                    max="70"
                    value={formData.discount_percentage}
                    onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                    placeholder="10"
                    required
                    className="pr-8"
                    data-testid="input-discount"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                </div>
                <p className="text-xs text-gray-500">Máximo: 70%</p>
              </div>
            )}

            {formData.promotion_type === "LXPY" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="buy">Leve (X)</Label>
                  <Input
                    id="buy"
                    type="number"
                    min="1"
                    value={formData.buy_quantity}
                    onChange={(e) => setFormData({ ...formData, buy_quantity: e.target.value })}
                    placeholder="3"
                    required
                    data-testid="input-buy-qty"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="get">Pague (Y)</Label>
                  <Input
                    id="get"
                    type="number"
                    min="1"
                    value={formData.get_quantity}
                    onChange={(e) => setFormData({ ...formData, get_quantity: e.target.value })}
                    placeholder="2"
                    required
                    data-testid="input-get-qty"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Data Início *</Label>
                <Input
                  id="start_date"
                  type="datetime-local"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Data Fim *</Label>
                <Input
                  id="end_date"
                  type="datetime-local"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  required
                  data-testid="input-end-date"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="btn-ifood" data-testid="save-promo-btn">
                Criar Promoção
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePromo} onOpenChange={() => setDeletePromo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Promoção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover "{deletePromo?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-promo"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
