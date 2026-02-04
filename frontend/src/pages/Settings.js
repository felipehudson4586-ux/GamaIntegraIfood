import { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  Key,
  Store,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Server,
  Database
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { toast } from "sonner";
import api from "../lib/api";

export default function Settings() {
  const [authStatus, setAuthStatus] = useState(null);
  const [merchantInfo, setMerchantInfo] = useState(null);
  const [pollingStatus, setPollingStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testingAuth, setTestingAuth] = useState(false);

  useEffect(() => {
    fetchAllStatus();
  }, []);

  const fetchAllStatus = async () => {
    try {
      const [authRes, pollingRes] = await Promise.all([
        api.get("/auth/status"),
        api.get("/polling/status")
      ]);
      
      setAuthStatus(authRes.data);
      setPollingStatus(pollingRes.data);

      // Tenta buscar info do merchant
      try {
        const merchantRes = await api.get("/merchant");
        if (merchantRes.data.success) {
          setMerchantInfo(merchantRes.data.data);
        }
      } catch {
        // Merchant info pode falhar se não houver token
      }
    } catch (error) {
      console.error("Erro ao carregar status:", error);
    } finally {
      setLoading(false);
    }
  };

  const testAuthentication = async () => {
    setTestingAuth(true);
    try {
      const response = await api.get("/auth/token");
      if (response.data.success) {
        toast.success("Autenticação bem sucedida!");
        fetchAllStatus();
      } else {
        toast.error(response.data.error || "Erro na autenticação");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao testar autenticação");
    } finally {
      setTestingAuth(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="settings-loading">
        <div className="h-8 w-48 bg-gray-200 rounded animate-shimmer" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 rounded-xl animate-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="settings-page">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500 text-sm mt-1">
          Gerencie as configurações de integração com o iFood
        </p>
      </div>

      {/* Connection Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity size={20} />
            Status da Conexão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <StatusItem
              label="API iFood"
              status={authStatus?.has_credentials ? "connected" : "disconnected"}
              description={authStatus?.has_credentials ? "Credenciais configuradas" : "Sem credenciais"}
            />
            <StatusItem
              label="Token"
              status={authStatus?.token_valid ? "connected" : "warning"}
              description={authStatus?.token_valid ? "Token válido" : "Token não obtido"}
            />
            <StatusItem
              label="Polling"
              status={pollingStatus?.polling_active ? "connected" : "disconnected"}
              description={pollingStatus?.polling_active ? "Ativo" : "Inativo"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key size={20} />
            Autenticação iFood
          </CardTitle>
          <CardDescription>
            Módulo 1: Authentication - Gerenciamento de tokens OAuth
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-gray-500">Client ID</p>
              <p className="font-mono text-sm bg-gray-100 p-2 rounded truncate">
                {authStatus?.has_credentials ? "••••••••" + (process.env.REACT_APP_IFOOD_CLIENT_ID?.slice(-8) || "****") : "Não configurado"}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-500">Merchant ID</p>
              <p className="font-mono text-sm bg-gray-100 p-2 rounded truncate">
                {authStatus?.merchant_id || "Não configurado"}
              </p>
            </div>
          </div>

          {authStatus?.token_expires_at && (
            <div className="pt-2">
              <p className="text-sm text-gray-500">Token expira em</p>
              <p className="text-sm">
                {new Date(authStatus.token_expires_at).toLocaleString("pt-BR")}
              </p>
            </div>
          )}

          <Separator />

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={testAuthentication}
              disabled={testingAuth}
              className="gap-2"
              data-testid="test-auth-btn"
            >
              <RefreshCw size={16} className={testingAuth ? "animate-spin" : ""} />
              {testingAuth ? "Testando..." : "Testar Autenticação"}
            </Button>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 text-sm">
            <p className="font-medium mb-2">Sobre a autenticação:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>O token é renovado automaticamente quando expira</li>
              <li>Tokens são reutilizados até 5 minutos antes da expiração</li>
              <li>Erro 401: Token expirado, será renovado automaticamente</li>
              <li>Erro 403: Verifique permissões do merchant</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Polling */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server size={20} />
            Polling de Eventos
          </CardTitle>
          <CardDescription>
            Módulo 2: Orders - Polling a cada 30 segundos para novos eventos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Status</p>
              <Badge className={pollingStatus?.polling_active ? "bg-green-100 text-green-700" : ""}>
                {pollingStatus?.polling_active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Último Polling</p>
              <p className="text-sm">
                {pollingStatus?.last_poll_at 
                  ? new Date(pollingStatus.last_poll_at).toLocaleString("pt-BR")
                  : "Nunca"
                }
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Eventos Recebidos</p>
              <p className="text-sm font-medium">{pollingStatus?.events_received || 0}</p>
            </div>
          </div>

          {pollingStatus?.errors_count > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">
                <AlertCircle className="inline mr-1" size={14} />
                {pollingStatus.errors_count} erros no polling. Último erro: {pollingStatus.last_error}
              </p>
            </div>
          )}

          <Separator />

          <div className="bg-gray-50 rounded-lg p-4 text-sm">
            <p className="font-medium mb-2">Sobre o polling:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Frequência recomendada: 30 segundos (conforme documentação iFood)</li>
              <li>Rate limit: 6000 requisições/minuto por token</li>
              <li>Eventos são mantidos por 8 horas após a entrega</li>
              <li>Eventos duplicados são tratados automaticamente</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Merchant Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store size={20} />
            Estabelecimento
          </CardTitle>
          <CardDescription>
            Módulo 3: Merchant - Informações do estabelecimento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {merchantInfo ? (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Nome</p>
                <p className="font-medium">{merchantInfo.name || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge>{merchantInfo.status || "Desconhecido"}</Badge>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">
              Informações do merchant não disponíveis. Teste a autenticação primeiro.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Modules Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database size={20} />
            Módulos Implementados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ModuleCard
              number={1}
              name="Authentication"
              description="OAuth token management"
              status="active"
            />
            <ModuleCard
              number={2}
              name="Orders"
              description="Gestão de pedidos e polling"
              status="active"
            />
            <ModuleCard
              number={3}
              name="Merchant"
              description="Dados do estabelecimento"
              status="active"
            />
            <ModuleCard
              number={4}
              name="Item"
              description="Catálogo de produtos"
              status="active"
            />
            <ModuleCard
              number={5}
              name="Promotion"
              description="Gestão de promoções"
              status="active"
            />
            <ModuleCard
              number={6}
              name="Picking"
              description="Separação de pedidos"
              status="active"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusItem({ label, status, description }) {
  const statusStyles = {
    connected: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-100" },
    disconnected: { icon: XCircle, color: "text-red-600", bg: "bg-red-100" },
    warning: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-100" },
  };

  const style = statusStyles[status] || statusStyles.disconnected;
  const Icon = style.icon;

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${style.bg}`}>
        <Icon size={20} className={style.color} />
      </div>
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </div>
  );
}

function ModuleCard({ number, name, description, status }) {
  return (
    <div className="p-4 border border-gray-200 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 bg-ifood-red text-white text-xs font-bold rounded flex items-center justify-center">
          {number}
        </span>
        <span className="font-medium">{name}</span>
        {status === "active" && (
          <CheckCircle size={14} className="text-green-600 ml-auto" />
        )}
      </div>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}
