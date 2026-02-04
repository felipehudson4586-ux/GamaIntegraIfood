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
  Database,
  ExternalLink,
  Copy,
  Play
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import api from "../lib/api";

export default function Settings() {
  const [authStatus, setAuthStatus] = useState(null);
  const [pollingStatus, setPollingStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [authCode, setAuthCode] = useState("");

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

  var generateUserCode = async function() {
    setGeneratingCode(true);
    try {
      var response = await api.post("/auth/usercode");
      if (response.data.success) {
        toast.success("Código gerado! Acesse a URL para autorizar.");
        fetchAllStatus();
      } else {
        toast.error(response.data.error || "Erro ao gerar código");
      }
    } catch (error) {
      toast.error("Erro ao gerar código de autorização");
    } finally {
      setGeneratingCode(false);
    }
  };

  var authorizeWithCode = async function() {
    if (!authCode.trim()) {
      toast.error("Digite o código de autorização");
      return;
    }
    setAuthorizing(true);
    try {
      var response = await api.post("/auth/authorize?authorization_code=" + authCode.trim());
      if (response.data.success) {
        toast.success("Autorização concluída com sucesso!");
        setAuthCode("");
        fetchAllStatus();
      } else {
        toast.error(response.data.error || "Erro na autorização");
      }
    } catch (error) {
      toast.error("Erro ao autorizar");
    } finally {
      setAuthorizing(false);
    }
  };

  var copyToClipboard = function(text) {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  var restoreTokens = async function() {
    try {
      var response = await api.post("/auth/restore");
      if (response.data.success) {
        toast.success("Tokens restaurados!");
        fetchAllStatus();
      } else {
        toast.error(response.data.error || "Erro");
      }
    } catch (error) {
      toast.error("Erro ao restaurar tokens");
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

  var pendingAuth = authStatus && authStatus.pending_authorization;
  var hasToken = authStatus && authStatus.has_token;

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div>
        <h1 className="font-heading text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie a integração com o iFood</p>
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
              status={hasToken ? "connected" : "warning"}
              description={hasToken ? "Ativo" : "Não autorizado"}
            />
            <StatusItem
              label="Polling"
              status={pollingStatus && pollingStatus.polling_active ? "connected" : "disconnected"}
              description={pollingStatus && pollingStatus.polling_active ? "Ativo" : "Inativo"}
            />
          </div>
        </CardContent>
      </Card>

      {/* OAuth Flow */}
      <Card className="border-2 border-ifood-red/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-ifood-red">
            <Key size={20} />
            Autorização iFood (OAuth)
          </CardTitle>
          <CardDescription>
            Siga os passos para autorizar o app a acessar sua loja no iFood
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1 */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-ifood-red text-white rounded-full flex items-center justify-center font-bold">1</div>
              <div>
                <p className="font-medium">Gerar código de autorização</p>
                <p className="text-sm text-gray-500">Clique para gerar um código (userCode)</p>
              </div>
            </div>
            
            {pendingAuth && pendingAuth.user_code ? (
              <div className="ml-11 space-y-3">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-2">Seu código:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-2xl font-mono font-bold text-ifood-red">{pendingAuth.user_code}</code>
                    <Button variant="ghost" size="icon" onClick={function() { copyToClipboard(pendingAuth.user_code); }}>
                      <Copy size={16} />
                    </Button>
                  </div>
                </div>
                
                {pendingAuth.verification_url && (
                  <a 
                    href={pendingAuth.verification_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-ifood-red hover:underline"
                  >
                    <ExternalLink size={16} />
                    Abrir Portal iFood para autorizar
                  </a>
                )}
              </div>
            ) : (
              <div className="ml-11">
                <Button 
                  className="btn-ifood gap-2" 
                  onClick={generateUserCode}
                  disabled={generatingCode}
                >
                  <Play size={16} />
                  {generatingCode ? "Gerando..." : "Gerar Código"}
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Step 2 */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-ifood-red text-white rounded-full flex items-center justify-center font-bold">2</div>
              <div>
                <p className="font-medium">Autorizar no Portal iFood</p>
                <p className="text-sm text-gray-500">Acesse o link acima, faça login e clique em "Autorizar". Copie o código recebido.</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Step 3 */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-ifood-red text-white rounded-full flex items-center justify-center font-bold">3</div>
              <div>
                <p className="font-medium">Inserir código de autorização</p>
                <p className="text-sm text-gray-500">Cole aqui o código (authorizationCode) que você recebeu</p>
              </div>
            </div>
            
            <div className="ml-11 flex gap-3">
              <div className="flex-1 max-w-xs">
                <Input
                  placeholder="XXXX-XXXX"
                  value={authCode}
                  onChange={function(e) { setAuthCode(e.target.value); }}
                  className="font-mono"
                  data-testid="auth-code-input"
                />
              </div>
              <Button 
                className="btn-ifood"
                onClick={authorizeWithCode}
                disabled={authorizing || !authCode.trim()}
              >
                {authorizing ? "Autorizando..." : "Autorizar"}
              </Button>
            </div>
          </div>

          {hasToken && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="text-green-600" size={24} />
              <div>
                <p className="font-medium text-green-800">Autorização ativa!</p>
                <p className="text-sm text-green-600">
                  {authStatus.token_expires_at && "Expira em: " + new Date(authStatus.token_expires_at).toLocaleString("pt-BR")}
                </p>
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

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              <AlertCircle className="inline mr-2" size={16} />
              O polling só funciona após a autorização. Complete o fluxo OAuth acima primeiro.
            </p>
          </div>
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

          {authStatus && authStatus.has_saved_tokens && (
            <div className="mt-4">
              <Button variant="outline" onClick={restoreTokens} className="gap-2">
                <RefreshCw size={16} />
                Restaurar Tokens Salvos
              </Button>
            </div>
          )}
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
            <ModuleCard number={1} name="Authentication" description="OAuth token management" status="active" />
            <ModuleCard number={2} name="Orders" description="Gestão de pedidos e polling" status="active" />
            <ModuleCard number={3} name="Merchant" description="Dados do estabelecimento" status="active" />
            <ModuleCard number={4} name="Item" description="Catálogo de produtos" status="active" />
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
