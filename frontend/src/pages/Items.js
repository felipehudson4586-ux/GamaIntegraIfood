import { useState, useEffect } from "react";
import {
  Package,
  Plus,
  Search,
  Edit,
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

export default function Items() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [formData, setFormData] = useState({
    external_code: "",
    name: "",
    description: "",
    price: "",
    category: "",
    stock_quantity: "",
    available: true
  });

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await api.get("/items");
      setItems(response.data.items || []);
    } catch (error) {
      console.error("Erro ao carregar itens:", error);
      toast.error("Erro ao carregar itens");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        price: parseFloat(formData.price) || 0,
        stock_quantity: formData.stock_quantity ? parseInt(formData.stock_quantity) : null
      };

      if (editingItem) {
        await api.patch(`/items/${editingItem.id}`, data);
        toast.success("Item atualizado");
      } else {
        await api.post("/items", data);
        toast.success("Item criado");
      }

      setShowDialog(false);
      resetForm();
      fetchItems();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao salvar item");
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await api.delete(`/items/${deleteItem.id}`);
      toast.success("Item removido");
      setDeleteItem(null);
      fetchItems();
    } catch (error) {
      toast.error("Erro ao remover item");
    }
  };

  const handleToggleAvailability = async (item) => {
    try {
      await api.patch(`/items/${item.id}/availability?available=${!item.available}`);
      toast.success(item.available ? "Item indisponível" : "Item disponível");
      fetchItems();
    } catch (error) {
      toast.error("Erro ao alterar disponibilidade");
    }
  };

  const openEditDialog = (item) => {
    setEditingItem(item);
    setFormData({
      external_code: item.external_code || "",
      name: item.name || "",
      description: item.description || "",
      price: item.price?.toString() || "",
      category: item.category || "",
      stock_quantity: item.stock_quantity?.toString() || "",
      available: item.available ?? true
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      external_code: "",
      name: "",
      description: "",
      price: "",
      category: "",
      stock_quantity: "",
      available: true
    });
  };

  const filteredItems = items.filter(item => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      item.name?.toLowerCase().includes(searchLower) ||
      item.external_code?.toLowerCase().includes(searchLower) ||
      item.category?.toLowerCase().includes(searchLower)
    );
  });

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value || 0);
  };

  return (
    <div className="space-y-6" data-testid="items-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gray-900">Catálogo</h1>
          <p className="text-gray-500 text-sm mt-1">{items.length} itens cadastrados</p>
        </div>
        <Button
          className="btn-ifood gap-2"
          onClick={() => {
            resetForm();
            setShowDialog(true);
          }}
          data-testid="add-item-btn"
        >
          <Plus size={18} />
          Novo Item
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input
              placeholder="Buscar por nome, código ou categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="search-items"
            />
          </div>
        </CardContent>
      </Card>

      {/* Items Grid */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 rounded-xl animate-shimmer" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto mb-4 text-gray-300" size={48} />
            <p className="text-gray-500">Nenhum item encontrado</p>
            <Button
              variant="link"
              className="text-ifood-red mt-2"
              onClick={() => {
                resetForm();
                setShowDialog(true);
              }}
            >
              Adicionar primeiro item
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <Card 
              key={item.id} 
              className={`card-ifood ${!item.available ? "opacity-60" : ""}`}
              data-testid={`item-card-${item.id}`}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 line-clamp-1">{item.name}</h3>
                      {!item.available && (
                        <Badge variant="secondary" className="text-xs">Indisponível</Badge>
                      )}
                    </div>
                    {item.external_code && (
                      <p className="text-xs text-gray-400 mt-0.5">Cód: {item.external_code}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs whitespace-nowrap">
                    {item.category || "Sem categoria"}
                  </Badge>
                </div>

                {item.description && (
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">{item.description}</p>
                )}

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(item.price)}</p>
                    {item.stock_quantity !== null && (
                      <p className="text-xs text-gray-500">Estoque: {item.stock_quantity}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleAvailability(item)}
                      className="h-8 w-8"
                      data-testid={`toggle-item-${item.id}`}
                    >
                      {item.available ? (
                        <ToggleRight size={18} className="text-green-600" />
                      ) : (
                        <ToggleLeft size={18} className="text-gray-400" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(item)}
                      className="h-8 w-8"
                      data-testid={`edit-item-${item.id}`}
                    >
                      <Edit size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteItem(item)}
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      data-testid={`delete-item-${item.id}`}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Item" : "Novo Item"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Atualize as informações do item" : "Adicione um novo item ao catálogo"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="external_code">Código</Label>
                <Input
                  id="external_code"
                  value={formData.external_code}
                  onChange={(e) => setFormData({ ...formData, external_code: e.target.value })}
                  placeholder="SKU123"
                  data-testid="input-external-code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Lanches"
                  data-testid="input-category"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do item"
                required
                data-testid="input-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do item"
                data-testid="input-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Preço *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  required
                  data-testid="input-price"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock_quantity">Estoque</Label>
                <Input
                  id="stock_quantity"
                  type="number"
                  min="0"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  placeholder="0"
                  data-testid="input-stock"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label htmlFor="available">Disponível para venda</Label>
              <Switch
                id="available"
                checked={formData.available}
                onCheckedChange={(checked) => setFormData({ ...formData, available: checked })}
                data-testid="switch-available"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="btn-ifood" data-testid="save-item-btn">
                {editingItem ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Item</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover "{deleteItem?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-btn"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
