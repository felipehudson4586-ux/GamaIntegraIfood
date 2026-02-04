import { useState, useEffect } from "react";
import {
  Key,
  Store,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Server,
  Database,
  Zap,
  Users
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { toast } from "sonner";
import api from "../lib/api";

export default function Settings() {
  const [authStatus, setAuthStatus] = useState(null);
  const [pollingStatus, setPollingStatus] = useState(null);
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testingAuth, setTestingAuth] = useState(false);
  const [loadingMerchants, setLoadingMerchants] = useState(false);

  useEffect(function() {
    fetchAllStatus();
  }, []);

  var fetchAllStatus = async function() {
    try {
      var authRes = await api.get("/auth/status");
      var pollingRes = await api.get("/polling/status");
      setAuthStatus(authRes.data);
      setPollingStatus(pollingRes.data);
    } catch (error) {
      console.error("Erro ao carregar status:", error);
    } finally {
      setLoading(false);
    }
  };

  var testAuthentication = async function() {
    setTestingAuth(true);
    try {
      var response = await api.get("/auth/token");
      if (response.data.success) {
        toast.success("Autenticação bem sucedida!");
        fetchAllStatus();
      } else {
        toast.error(response.data.error || "Erro na autenticação");
      }
    } catch (error) {
      toast.error("Erro ao testar autenticação");
    } finally {
      setTestingAuth(false);
    }
  };

  var loadMerchants = async function() {
    setLoadingMerchants(true);
    try {
      var response = await api.get("/auth/merchants");
      if (response.data.success) {
        setMerchants(response.data.data || []);
        toast.success("Merchants carregados: " + (response.data.data || []).length);
      } else {
        toast.error(response.data.error || "Erro ao carregar merchants");
      }
    } catch (error) {
      toast.error("Erro ao carregar merchants");
    } finally {
      setLoadingMerchants(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="settings-loading">
        <div className="h-8 w-48 bg-gray-200 rounded animate-shimmer" />
        <div className="h-48 bg-gray-200 rounded-xl animate-shimmer" />
      </div>
    );
  }

  var hasToken = authStatus && authStatus.has_token && authStatus.token_valid;

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div>
        <h1 className="font-heading text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie a integração com o iFood (App Centralizado)</p>
      </div>

      {/* Connection Status */}
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
              label="Credenciais"
              status={authStatus && authStatus.has_credentials ? "connected" : "disconnected"}
              description={authStatus && authStatus.has_credentials ? "Configuradas" : "Não configuradas"}
            />
            <StatusItem
              label="Token iFood"
              status={hasToken ? "connected" : authStatus && authStatus.has_token ? "warning" : "disconnected"}
              description={hasToken ? "Válido" : authStatus && authStatus.has_token ? "Expirado" : "Não obtido"}
            />
            <StatusItem
              label="Polling"
              status={pollingStatus && pollingStatus.polling_active ? "connected" : "disconnected"}
              description={pollingStatus && pollingStatus.polling_active ? "Ativo" : "Inativo"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Authentication Card */}
      <Card className="border-2 border-green-200 bg-green-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <Zap size={20} />
            App Centralizado - client_credentials
          </CardTitle>
          <CardDescription>
            Este app usa autenticação direta (client_credentials). Não é necessário autorização do usuário.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white rounded-lg p-4 border border-green-100">
            <p className="text-sm text-gray-600 mb-4">
              Com as credenciais configuradas, o sistema obtém tokens automaticamente quando necessário.
              Clique abaixo para testar a conexão.
            </p>
            
            <div className="flex flex-wrap gap-3">
              <Button 
                className="btn-ifood gap-2"
                onClick={testAuthentication}
                disabled={testingAuth}
              >
                <Key size={16} />
                {testingAuth ? "Testando..." : "Testar Autenticação"}
              </Button>
              
              <Button 
                variant="outline"
                className="gap-2"
                onClick={loadMerchants}
                disabled={loadingMerchants}
              >
                <Users size={16} />
                {loadingMerchants ? "Carregando..." : "Listar Merchants"}
              </Button>
            </div>
          </div>

          {hasToken && (
            <div className="bg-green-100 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="text-green-600" size={24} />
              <div>
                <p className="font-medium text-green-800">Conexão ativa!</p>
                <p className="text-sm text-green-600">
                  {authStatus.token_expires_at && "Token expira em: " + new Date(authStatus.token_expires_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          )}

          {/* Merchants List */}
          {merchants.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Merchants vinculados:</h4>
              <div className="space-y-2">
                {merchants.map(function(m, i) {
                  return (
                    <div key={i} className="bg-white rounded-lg p-3 border flex items-center justify-between">
                      <div>
                        <p className="font-medium">{m.name || m.corporateName || "Merchant"}</p>
                        <p className="text-xs text-gray-500 font-mono">{m.id}</p>
                      </div>
                      <Badge variant="outline">{m.status || "ACTIVE"}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Polling Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server size={20} />
            Polling de Eventos
          </CardTitle>
          <CardDescription>
            Sistema de polling busca novos pedidos a cada 30 segundos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <Badge className={pollingStatus && pollingStatus.polling_active ? "bg-green-100 text-green-700" : ""}>
                {pollingStatus && pollingStatus.polling_active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-500">Último Polling</p>
              <p className="text-sm">
                {pollingStatus && pollingStatus.last_poll_at 
                  ? new Date(pollingStatus.last_poll_at).toLocaleString("pt-BR")
                  : "Nunca"
                }
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Eventos Recebidos</p>
              <p className="text-sm font-medium">{pollingStatus ? pollingStatus.events_received || 0 : 0}</p>
            </div>
          </div>

          {pollingStatus && pollingStatus.errors_count > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">
                <AlertCircle className="inline mr-2" size={16} />
                {pollingStatus.errors_count} erros. Último: {pollingStatus.last_error}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credentials Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store size={20} />
            Credenciais Configuradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Client ID</p>
              <p className="font-mono text-sm bg-gray-100 p-2 rounded truncate">
                {authStatus && authStatus.has_credentials ? "••••••••-••••-••••-••••-••••••••" : "Não configurado"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Merchant ID</p>
              <p className="font-mono text-sm bg-gray-100 p-2 rounded truncate">
                {authStatus && authStatus.merchant_id ? authStatus.merchant_id : "Não configurado"}
              </p>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
            <p className="font-medium text-blue-800 mb-2">Sobre Apps Centralizados:</p>
            <ul className="text-blue-700 list-disc list-inside space-y-1">
              <li>Usa grant_type: client_credentials</li>
              <li>Token obtido automaticamente com clientId e clientSecret</li>
              <li>Não recebe refresh_token - renova automaticamente ao expirar</li>
              <li>Ideal para servidores em ambiente privado/VPC</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Modules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database size={20} />
            Módulos Implementados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ModuleCard number={1} name="Authentication" description="client_credentials (centralizado)" status="active" />
            <ModuleCard number={2} name="Orders" description="Gestão de pedidos e polling" status="active" />
            <ModuleCard number={3} name="Merchant" description="Dados do estabelecimento" status="active" />
            <ModuleCard number={4} name="Item/Catalog" description="Catálogo de produtos" status="active" />
            <ModuleCard number={5} name="Promotion" description="Gestão de promoções" status="active" />
            <ModuleCard number={6} name="Picking" description="Separação de pedidos" status="active" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusItem(props) {
  var label = props.label;
  var status = props.status;
  var description = props.description;
  
  var styles = {
    connected: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-100" },
    disconnected: { icon: XCircle, color: "text-red-600", bg: "bg-red-100" },
    warning: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-100" },
  };

  var style = styles[status] || styles.disconnected;
  var Icon = style.icon;

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <div className={"w-10 h-10 rounded-full flex items-center justify-center " + style.bg}>
        <Icon size={20} className={style.color} />
      </div>
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </div>
  );
}

function ModuleCard(props) {
  var number = props.number;
  var name = props.name;
  var description = props.description;
  var status = props.status;
  
  return (
    <div className="p-4 border border-gray-200 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 bg-ifood-red text-white text-xs font-bold rounded flex items-center justify-center">
          {number}
        </span>
        <span className="font-medium">{name}</span>
        {status === "active" && <CheckCircle size={14} className="text-green-600 ml-auto" />}
      </div>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}
