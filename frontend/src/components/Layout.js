import { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Package, 
  Tag, 
  Truck,
  Settings,
  Menu,
  X,
  RefreshCw
} from "lucide-react";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import api from "../lib/api";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/orders", icon: ShoppingBag, label: "Pedidos" },
  { path: "/items", icon: Package, label: "Catálogo" },
  { path: "/promotions", icon: Tag, label: "Promoções" },
  { path: "/picking", icon: Truck, label: "Separação" },
  { path: "/settings", icon: Settings, label: "Configurações" },
];

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pollingStatus, setPollingStatus] = useState({
    polling_active: false,
    connection_status: "disconnected",
    last_poll_at: null
  });

  useEffect(() => {
    fetchPollingStatus();
    const interval = setInterval(fetchPollingStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchPollingStatus = async () => {
    try {
      const response = await api.get("/polling/status");
      setPollingStatus(response.data);
    } catch (error) {
      console.error("Erro ao buscar status do polling:", error);
    }
  };

  const togglePolling = async () => {
    try {
      if (pollingStatus.polling_active) {
        await api.post("/polling/stop");
        toast.success("Polling parado");
      } else {
        await api.post("/polling/start");
        toast.success("Polling iniciado");
      }
      fetchPollingStatus();
    } catch (error) {
      toast.error("Erro ao alterar polling");
    }
  };

  const forcePoll = async () => {
    try {
      const response = await api.post("/polling/force");
      if (response.data.success) {
        toast.success(`Polling forçado: ${response.data.data?.events_count || 0} eventos`);
      } else {
        toast.error(response.data.error || "Erro no polling");
      }
      fetchPollingStatus();
    } catch (error) {
      toast.error("Erro ao forçar polling");
    }
  };

  const getPollingStatusClass = () => {
    if (pollingStatus.connection_status === "error") return "polling-error";
    if (pollingStatus.polling_active) return "polling-active";
    return "polling-inactive";
  };

  const getPollingDotClass = () => {
    if (pollingStatus.connection_status === "error") return "error";
    if (pollingStatus.polling_active) return "active";
    return "inactive";
  };

  return (
    <div className="min-h-screen bg-background" data-testid="app-layout">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100"
            data-testid="mobile-menu-btn"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-ifood-red rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">iF</span>
            </div>
            <span className="font-heading font-bold text-lg">Partner</span>
          </div>
        </div>
        
        <div className={`polling-indicator ${getPollingStatusClass()}`}>
          <span className={`polling-dot ${getPollingDotClass()}`}></span>
          <span>{pollingStatus.polling_active ? "Ativo" : "Inativo"}</span>
        </div>
      </header>

      {/* Sidebar */}
      <aside 
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-40 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        data-testid="sidebar"
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-100">
          <div className="w-10 h-10 bg-ifood-red rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-lg">iF</span>
          </div>
          <div>
            <h1 className="font-heading font-bold text-lg leading-tight">Partner</h1>
            <p className="text-xs text-gray-500">Dashboard</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `sidebar-item ${isActive ? "active" : ""}`
              }
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Polling Status */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
          <div className="card-ifood p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Polling iFood</span>
              <div className={`polling-indicator ${getPollingStatusClass()}`}>
                <span className={`polling-dot ${getPollingDotClass()}`}></span>
              </div>
            </div>
            
            {pollingStatus.last_poll_at && (
              <p className="text-xs text-gray-500">
                Último: {new Date(pollingStatus.last_poll_at).toLocaleTimeString('pt-BR')}
              </p>
            )}
            
            <div className="flex gap-2">
              <Button 
                variant={pollingStatus.polling_active ? "destructive" : "default"}
                size="sm"
                className="flex-1 text-xs"
                onClick={togglePolling}
                data-testid="toggle-polling-btn"
              >
                {pollingStatus.polling_active ? "Parar" : "Iniciar"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={forcePoll}
                disabled={!pollingStatus.polling_active}
                data-testid="force-poll-btn"
              >
                <RefreshCw size={14} />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
