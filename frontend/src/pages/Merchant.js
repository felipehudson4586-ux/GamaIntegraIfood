import React, { useState, useEffect, useCallback } from "react";
import {
  Store,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Calendar,
  Pause,
  Play,
  Trash2,
  Plus,
  QrCode,
  MapPin,
  AlertTriangle,
  Settings,
  Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Separator } from "../components/ui/separator";
import { toast } from "sonner";
import api from "../lib/api";

// Dias da semana
const DAYS_OF_WEEK = [
  { value: "MONDAY", label: "Segunda-feira" },
  { value: "TUESDAY", label: "Terça-feira" },
  { value: "WEDNESDAY", label: "Quarta-feira" },
  { value: "THURSDAY", label: "Quinta-feira" },
  { value: "FRIDAY", label: "Sexta-feira" },
  { value: "SATURDAY", label: "Sábado" },
  { value: "SUNDAY", label: "Domingo" }
];

// Cores de status
const STATUS_COLORS = {
  OK: "bg-green-100 text-green-800 border-green-200",
  WARNING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  CLOSED: "bg-gray-100 text-gray-800 border-gray-200",
  ERROR: "bg-red-100 text-red-800 border-red-200"
};

const STATUS_ICONS = {
  OK: CheckCircle,
  WARNING: AlertTriangle,
  CLOSED: Pause,
  ERROR: XCircle
};

export default function Merchant() {
  // Estados principais
  const [loading, setLoading] = useState(true);
  const [merchants, setMerchants] = useState([]);
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [merchantDetails, setMerchantDetails] = useState(null);
  const [merchantStatus, setMerchantStatus] = useState(null);
  
  // Estados de interrupções
  const [interruptions, setInterruptions] = useState([]);
  const [showAddInterruption, setShowAddInterruption] = useState(false);
  const [newInterruption, setNewInterruption] = useState({
    start: "",
    end: "",
    description: "Interrupção temporária"
  });
  
  // Estados de horários
  const [openingHours, setOpeningHours] = useState(null);
  const [showEditHours, setShowEditHours] = useState(false);
  const [editingShifts, setEditingShifts] = useState([]);
  
  // Estados de loading
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingInterruptions, setLoadingInterruptions] = useState(false);
  const [loadingHours, setLoadingHours] = useState(false);
  const [creatingInterruption, setCreatingInterruption] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [generatingQR, setGeneratingQR] = useState(false);

  // Carrega lista de merchants ao iniciar
  useEffect(() => {
    loadMerchants();
  }, []);

  // Carrega detalhes quando seleciona merchant
  useEffect(() => {
    if (selectedMerchant) {
      loadMerchantDetails();
      loadMerchantStatus();
      loadInterruptions();
      loadOpeningHours();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMerchant]);

  const loadMerchants = async () => {
    try {
      setLoading(true);
      const response = await api.get("/merchant/list");
      if (response.data.success) {
        const list = response.data.data || [];
        setMerchants(list);
        
        // Seleciona o primeiro automaticamente se houver
        if (list.length > 0) {
          setSelectedMerchant(list[0].id || list[0].merchantId);
        }
      } else {
        toast.error(response.data.error || "Erro ao carregar merchants");
      }
    } catch (error) {
      console.error("Erro ao carregar merchants:", error);
      toast.error("Erro ao carregar lista de lojas");
    } finally {
      setLoading(false);
    }
  };

  const loadMerchantDetails = async () => {
    if (!selectedMerchant) return;
    
    try {
      const response = await api.get(`/merchant/details/${selectedMerchant}`);
      if (response.data.success) {
        setMerchantDetails(response.data.data);
      }
    } catch (error) {
      console.error("Erro ao carregar detalhes:", error);
    }
  };

  const loadMerchantStatus = async () => {
    if (!selectedMerchant) return;
    
    try {
      setLoadingStatus(true);
      const response = await api.get(`/merchant/status/${selectedMerchant}`);
      if (response.data.success) {
        setMerchantStatus(response.data.data);
      }
    } catch (error) {
      console.error("Erro ao carregar status:", error);
    } finally {
      setLoadingStatus(false);
    }
  };

  const loadInterruptions = async () => {
    if (!selectedMerchant) return;
    
    try {
      setLoadingInterruptions(true);
      const response = await api.get(`/merchant/interruptions/${selectedMerchant}`);
      if (response.data.success) {
        setInterruptions(response.data.data || []);
      }
    } catch (error) {
      console.error("Erro ao carregar interrupções:", error);
    } finally {
      setLoadingInterruptions(false);
    }
  };

  const loadOpeningHours = async () => {
    if (!selectedMerchant) return;
    
    try {
      setLoadingHours(true);
      const response = await api.get(`/merchant/opening-hours/${selectedMerchant}`);
      if (response.data.success) {
        setOpeningHours(response.data.data);
      }
    } catch (error) {
      console.error("Erro ao carregar horários:", error);
    } finally {
      setLoadingHours(false);
    }
  };

  const createInterruption = async () => {
    if (!newInterruption.start || !newInterruption.end) {
      toast.error("Preencha início e fim da interrupção");
      return;
    }
    
    try {
      setCreatingInterruption(true);
      const params = new URLSearchParams({
        start: newInterruption.start,
        end: newInterruption.end,
        description: newInterruption.description
      });
      
      const response = await api.post(`/merchant/interruptions/${selectedMerchant}?${params}`);
      if (response.data.success) {
        toast.success("Interrupção criada com sucesso");
        setShowAddInterruption(false);
        setNewInterruption({ start: "", end: "", description: "Interrupção temporária" });
        loadInterruptions();
        loadMerchantStatus();
      } else {
        toast.error(response.data.error || "Erro ao criar interrupção");
      }
    } catch (error) {
      console.error("Erro ao criar interrupção:", error);
      toast.error("Erro ao criar interrupção");
    } finally {
      setCreatingInterruption(false);
    }
  };

  const deleteInterruption = async (interruptionId) => {
    if (!confirm("Deseja remover esta interrupção? A loja voltará a ficar online.")) return;
    
    try {
      const response = await api.delete(`/merchant/interruptions/${interruptionId}?merchant_id=${selectedMerchant}`);
      if (response.data.success) {
        toast.success("Interrupção removida com sucesso");
        loadInterruptions();
        loadMerchantStatus();
      } else {
        toast.error(response.data.error || "Erro ao remover interrupção");
      }
    } catch (error) {
      console.error("Erro ao remover interrupção:", error);
      toast.error("Erro ao remover interrupção");
    }
  };

  const saveOpeningHours = async () => {
    try {
      setSavingHours(true);
      const response = await api.put(`/merchant/opening-hours/${selectedMerchant}`, {
        shifts: editingShifts
      });
      if (response.data.success) {
        toast.success("Horários atualizados com sucesso");
        setShowEditHours(false);
        loadOpeningHours();
      } else {
        toast.error(response.data.error || "Erro ao salvar horários");
      }
    } catch (error) {
      console.error("Erro ao salvar horários:", error);
      toast.error("Erro ao salvar horários");
    } finally {
      setSavingHours(false);
    }
  };

  const generateQRCode = async () => {
    try {
      setGeneratingQR(true);
      const response = await api.post(`/merchant/checkin-qrcode?merchant_ids=${selectedMerchant}`);
      if (response.data.success && response.data.data.pdf_base64) {
        // Cria link para download
        const linkSource = `data:application/pdf;base64,${response.data.data.pdf_base64}`;
        const downloadLink = document.createElement("a");
        downloadLink.href = linkSource;
        downloadLink.download = `qrcode-checkin-${selectedMerchant}.pdf`;
        downloadLink.click();
        toast.success("QR Code baixado com sucesso!");
      } else {
        toast.error("Erro ao gerar QR Code");
      }
    } catch (error) {
      console.error("Erro ao gerar QR Code:", error);
      toast.error("Erro ao gerar QR Code");
    } finally {
      setGeneratingQR(false);
    }
  };

  // Configura horários 24/7 com um clique
  const set24x7Hours = async () => {
    try {
      setSavingHours(true);
      const allDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
      const shifts = allDays.map(day => ({
        dayOfWeek: day,
        start: "00:00:00",
        duration: 1439 // 23:59
      }));
      
      const response = await api.put(`/merchant/opening-hours/${selectedMerchant}`, { shifts });
      if (response.data.success) {
        toast.success("Horários configurados para 24/7!");
        loadOpeningHours();
        loadMerchantStatus();
      } else {
        toast.error(response.data.error || "Erro ao configurar horários");
      }
    } catch (error) {
      console.error("Erro ao configurar 24/7:", error);
      toast.error("Erro ao configurar horários 24/7");
    } finally {
      setSavingHours(false);
    }
  };

  const addShift = () => {
    setEditingShifts([
      ...editingShifts,
      { dayOfWeek: "MONDAY", start: "09:00:00", duration: 480 }
    ]);
  };

  const removeShift = (index) => {
    setEditingShifts(editingShifts.filter((_, i) => i !== index));
  };

  const updateShift = (index, field, value) => {
    const updated = [...editingShifts];
    updated[index] = { ...updated[index], [field]: value };
    setEditingShifts(updated);
  };

  const startEditingHours = () => {
    // Converte horários existentes para formato editável
    const shifts = openingHours?.shifts || [];
    setEditingShifts(shifts.map(s => ({
      dayOfWeek: s.dayOfWeek,
      start: s.start,
      duration: s.duration
    })));
    setShowEditHours(true);
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins > 0 ? mins + 'min' : ''}`;
  };

  const getStatusColor = (state) => STATUS_COLORS[state] || STATUS_COLORS.CLOSED;
  const StatusIcon = (state) => STATUS_ICONS[state] || AlertCircle;

  if (loading) {
    return (
      <div className="space-y-6" data-testid="merchant-loading">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="merchant-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gray-900">Gerenciar Loja</h1>
          <p className="text-gray-500 text-sm mt-1">Status, interrupções e horários de funcionamento</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={loadMerchants}
            className="gap-2"
          >
            <RefreshCw size={16} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Seletor de Merchant */}
      {merchants.length > 1 && (
        <Card>
          <CardContent className="pt-4">
            <Label>Selecionar Loja</Label>
            <Select value={selectedMerchant} onValueChange={setSelectedMerchant}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione uma loja" />
              </SelectTrigger>
              <SelectContent>
                {merchants.map((m) => (
                  <SelectItem key={m.id || m.merchantId} value={m.id || m.merchantId}>
                    {m.name || m.corporateName || m.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Status da Loja */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Store className="text-gray-600" size={20} />
              </div>
              <div>
                <CardTitle className="text-lg">Status da Loja</CardTitle>
                <CardDescription>
                  {merchantDetails?.name || selectedMerchant}
                </CardDescription>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={loadMerchantStatus}
              disabled={loadingStatus}
            >
              <RefreshCw size={16} className={loadingStatus ? "animate-spin" : ""} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {merchantStatus ? (
            <div className="space-y-4">
              {/* Estado Principal */}
              <div className="flex items-center gap-3">
                {React.createElement(StatusIcon(merchantStatus.state || merchantStatus.operation?.[0]?.state), {
                  size: 24,
                  className: merchantStatus.state === "OK" ? "text-green-600" : 
                             merchantStatus.state === "WARNING" ? "text-yellow-600" :
                             merchantStatus.state === "ERROR" ? "text-red-600" : "text-gray-600"
                })}
                <Badge className={getStatusColor(merchantStatus.state || merchantStatus.operation?.[0]?.state)}>
                  {merchantStatus.state || merchantStatus.operation?.[0]?.state || "DESCONHECIDO"}
                </Badge>
                <span className="text-gray-600">
                  {merchantStatus.message || merchantStatus.operation?.[0]?.message || ""}
                </span>
              </div>

              {/* Validações */}
              {merchantStatus.validations && merchantStatus.validations.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Validações:</p>
                  <div className="space-y-2">
                    {merchantStatus.validations.map((v, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        {v.state === "OK" ? (
                          <CheckCircle size={16} className="text-green-600" />
                        ) : (
                          <XCircle size={16} className="text-red-600" />
                        )}
                        <span>{v.id}: {v.message?.title || v.message || ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Operações Disponíveis */}
              {merchantDetails?.availableOperations && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium text-gray-700 mb-2">Operações Disponíveis:</p>
                  <div className="flex gap-2">
                    {merchantDetails.availableOperations.map((op) => (
                      <Badge key={op} variant="outline">
                        {op === "DELIVERY" && "🚗 Entrega"}
                        {op === "TAKEOUT" && "🏪 Retirada"}
                        {op === "INDOOR" && "🍽️ Local"}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Endereço */}
              {merchantDetails?.address && (
                <div className="mt-4 pt-4 border-t flex items-start gap-2">
                  <MapPin size={16} className="text-gray-400 mt-1" />
                  <div className="text-sm text-gray-600">
                    <p>{merchantDetails.address.streetName}, {merchantDetails.address.streetNumber}</p>
                    <p>{merchantDetails.address.neighborhood}, {merchantDetails.address.city} - {merchantDetails.address.state}</p>
                    <p>CEP: {merchantDetails.address.postalCode}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle size={24} className="mx-auto mb-2 text-gray-400" />
              <p>Não foi possível carregar o status</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Code Check-in */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <QrCode className="text-blue-600" size={20} />
            </div>
            <div>
              <CardTitle className="text-lg">Check-in de Entregadores</CardTitle>
              <CardDescription>
                Gere QR Code para entregadores fazerem check-in
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={generateQRCode} 
            disabled={generatingQR}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            {generatingQR ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <QrCode size={16} />
            )}
            Baixar QR Code (PDF)
          </Button>
          <p className="text-xs text-gray-500 mt-2">
            Imprima e coloque no balcão para entregadores escanearem ao coletar pedidos.
          </p>
        </CardContent>
      </Card>

      {/* Interrupções */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Pause className="text-orange-600" size={20} />
              </div>
              <div>
                <CardTitle className="text-lg">Interrupções</CardTitle>
                <CardDescription>
                  Pause temporariamente o recebimento de pedidos
                </CardDescription>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowAddInterruption(true)}
              className="gap-1"
            >
              <Plus size={16} />
              Nova
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingInterruptions ? (
            <div className="animate-pulse space-y-2">
              <div className="h-12 bg-gray-100 rounded" />
              <div className="h-12 bg-gray-100 rounded" />
            </div>
          ) : interruptions.length > 0 ? (
            <div className="space-y-2">
              {interruptions.map((int, i) => (
                <div 
                  key={int.id || i} 
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100"
                >
                  <div>
                    <p className="font-medium text-sm">{int.description || "Interrupção"}</p>
                    <p className="text-xs text-gray-600">
                      {new Date(int.start).toLocaleString("pt-BR")} até {new Date(int.end).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => deleteInterruption(int.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <Play size={24} className="mx-auto mb-2 text-green-500" />
              <p className="text-sm">Nenhuma interrupção ativa</p>
              <p className="text-xs text-gray-400">A loja está recebendo pedidos normalmente</p>
            </div>
          )}

          {/* Formulário Nova Interrupção */}
          {showAddInterruption && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border space-y-4">
              <h4 className="font-medium">Nova Interrupção</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Início</Label>
                  <Input 
                    type="datetime-local"
                    value={newInterruption.start}
                    onChange={(e) => setNewInterruption({...newInterruption, start: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Fim</Label>
                  <Input 
                    type="datetime-local"
                    value={newInterruption.end}
                    onChange={(e) => setNewInterruption({...newInterruption, end: e.target.value})}
                  />
                </div>
              </div>
              
              <div>
                <Label>Descrição</Label>
                <Input 
                  value={newInterruption.description}
                  onChange={(e) => setNewInterruption({...newInterruption, description: e.target.value})}
                  placeholder="Ex: Falta de energia, pausa para almoço..."
                />
              </div>
              
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowAddInterruption(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={createInterruption}
                  disabled={creatingInterruption}
                  className="gap-2 bg-orange-600 hover:bg-orange-700"
                >
                  {creatingInterruption && <RefreshCw size={16} className="animate-spin" />}
                  Criar Interrupção
                </Button>
              </div>
              
              <div className="p-2 bg-yellow-50 rounded text-xs text-yellow-800 flex gap-2">
                <Info size={14} className="shrink-0 mt-0.5" />
                <p>O fechamento pode levar alguns segundos para efetivar. Continue fazendo polling para não perder pedidos.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Horários de Funcionamento */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Clock className="text-green-600" size={20} />
              </div>
              <div>
                <CardTitle className="text-lg">Horários de Funcionamento</CardTitle>
                <CardDescription>
                  Configure quando a loja está aberta no iFood Marketplace
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={set24x7Hours}
                disabled={savingHours}
                className="gap-1 text-green-600 border-green-300 hover:bg-green-50"
              >
                {savingHours ? <RefreshCw size={16} className="animate-spin" /> : <Clock size={16} />}
                24/7
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={startEditingHours}
                className="gap-1"
              >
                <Settings size={16} />
                Editar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingHours ? (
            <div className="animate-pulse space-y-2">
              {[1,2,3,4,5,6,7].map(i => (
                <div key={i} className="h-8 bg-gray-100 rounded" />
              ))}
            </div>
          ) : openingHours?.shifts?.length > 0 ? (
            <div className="space-y-2">
              {DAYS_OF_WEEK.map(day => {
                const dayShifts = openingHours.shifts.filter(s => s.dayOfWeek === day.value);
                return (
                  <div key={day.value} className="flex items-center gap-4 py-2 border-b last:border-0">
                    <span className="w-32 text-sm font-medium">{day.label}</span>
                    <div className="flex-1">
                      {dayShifts.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {dayShifts.map((s, i) => (
                            <Badge key={i} variant="outline" className="bg-green-50">
                              {s.start?.substring(0, 5)} - {formatDuration(s.duration)}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Fechado</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <Calendar size={24} className="mx-auto mb-2 text-gray-400" />
              <p className="text-sm">Nenhum horário configurado</p>
            </div>
          )}

          {/* Editor de Horários */}
          {showEditHours && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Editar Horários</h4>
                <Button variant="outline" size="sm" onClick={addShift} className="gap-1">
                  <Plus size={14} />
                  Adicionar Turno
                </Button>
              </div>
              
              <div className="p-2 bg-red-50 rounded text-xs text-red-800 flex gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <p><strong>ATENÇÃO:</strong> Este endpoint substitui TODOS os horários! Dias não enviados ficarão como fechados.</p>
              </div>
              
              {editingShifts.length > 0 ? (
                <div className="space-y-2">
                  {editingShifts.map((shift, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-white rounded border">
                      <Select 
                        value={shift.dayOfWeek} 
                        onValueChange={(v) => updateShift(i, "dayOfWeek", v)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS_OF_WEEK.map(d => (
                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Input 
                        type="time"
                        value={shift.start?.substring(0, 5)}
                        onChange={(e) => updateShift(i, "start", e.target.value + ":00")}
                        className="w-28"
                      />
                      
                      <span className="text-gray-400 text-sm">por</span>
                      
                      <Input 
                        type="number"
                        min="30"
                        max="1440"
                        step="30"
                        value={shift.duration}
                        onChange={(e) => updateShift(i, "duration", parseInt(e.target.value))}
                        className="w-24"
                      />
                      <span className="text-gray-500 text-sm">min</span>
                      
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeShift(i)}
                        className="text-red-600"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-4 text-gray-500 text-sm">
                  Nenhum turno configurado. Adicione turnos ou a loja ficará fechada.
                </p>
              )}
              
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowEditHours(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={saveOpeningHours}
                  disabled={savingHours}
                  className="gap-2"
                >
                  {savingHours && <RefreshCw size={16} className="animate-spin" />}
                  Salvar Horários
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
