# 🚀 Guia de Setup - Fork/Clone

Este guia detalha como configurar o iFood Partner Dashboard após fazer fork ou clone do repositório.

## 📋 Pré-requisitos

- **Node.js** 18+ ([download](https://nodejs.org))
- **Python** 3.11+ ([download](https://python.org))
- **MongoDB** 6+ ([download](https://mongodb.com) ou use Atlas)
- **Yarn** (instalar via `npm install -g yarn`)
- **Credenciais iFood** (Portal do Parceiro)

## 🔧 Passo a Passo

### 1. Clone o Repositório

```bash
git clone https://github.com/SEU_USUARIO/ifood-partner-dashboard.git
cd ifood-partner-dashboard
```

### 2. Configure o Backend

```bash
cd backend

# Instale as dependências Python
pip install -r requirements.txt

# Copie o arquivo de exemplo
cp .env.example .env

# Edite o arquivo .env
nano .env
```

#### Configurações do .env (Backend)

```env
# MongoDB
MONGO_URL="mongodb://localhost:27017"
DB_NAME="ifood_dashboard"

# CORS
CORS_ORIGINS="*"

# iFood - OBTENHA NO PORTAL DO PARCEIRO
IFOOD_CLIENT_ID="seu-client-id"
IFOOD_CLIENT_SECRET="seu-client-secret"
IFOOD_MERCHANT_ID="seu-merchant-id"
```

### 3. Configure o Frontend

```bash
cd ../frontend

# Instale as dependências
yarn install

# Copie o arquivo de exemplo
cp .env.example .env
```

#### Configurações do .env (Frontend)

```env
REACT_APP_BACKEND_URL="http://localhost:8001/api"
```

### 4. Inicie o MongoDB

```bash
# Se instalado localmente
mongod --dbpath /data/db

# Ou use Docker
docker run -d -p 27017:27017 --name mongodb mongo:6
```

### 5. Execute a Aplicação

#### Terminal 1 - Backend
```bash
cd backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

#### Terminal 2 - Frontend
```bash
cd frontend
yarn start
```

### 6. Acesse a Aplicação

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8001/api
- **Swagger Docs:** http://localhost:8001/docs

---

## 🔐 Obtendo Credenciais iFood

### 1. Acesse o Portal do Parceiro
- URL: https://portal.ifood.com.br

### 2. Navegue até Credenciais
- Menu: **Meus Apps** → **Credenciais do Aplicativo**

### 3. Copie as Credenciais
- **Client ID:** Identificador único do app
- **Client Secret:** Chave secreta (NUNCA compartilhe!)
- **Merchant ID:** ID da sua loja (em Dados da Loja)

---

## ✅ Verificando a Instalação

### Teste o Backend
```bash
curl http://localhost:8001/api/health
```

**Resposta esperada:**
```json
{
  "status": "healthy",
  "database": "connected",
  "merchant_id": "seu-merchant-id",
  "polling_active": false,
  "has_credentials": true
}
```

### Teste a Autenticação
```bash
curl http://localhost:8001/api/auth/status
```

**Resposta esperada:**
```json
{
  "has_credentials": true,
  "has_token": false,
  "token_valid": false,
  "app_type": "centralized"
}
```

### Teste o Frontend
1. Acesse http://localhost:3000
2. A página Dashboard deve carregar
3. Veja o status do polling no canto superior direito

---

## 🏪 Configurando Loja de Teste

### 1. Configure Horários 24/7
- Acesse: **Minha Loja** → **Horários**
- Clique no botão **24/7**

### 2. Inicie o Polling
- O polling inicia automaticamente ao abrir o app
- Verifique o indicador verde no menu

### 3. Verifique o Status
```bash
curl http://localhost:8001/api/merchant/status/SEU_MERCHANT_ID
```

**Status esperado:** `state: "OK"` (loja online)

---

## 🐛 Troubleshooting

### Erro: "IFOOD_CLIENT_ID e IFOOD_CLIENT_SECRET são obrigatórios"
- Verifique se o arquivo `.env` existe no backend
- Confirme que as variáveis estão preenchidas

### Erro: "Module not found"
```bash
# Backend
pip install -r requirements.txt

# Frontend
yarn install
```

### Erro: "MongoDB connection failed"
- Verifique se o MongoDB está rodando
- Confirme a URL no MONGO_URL

### Erro: "CORS blocked"
- Verifique CORS_ORIGINS no backend
- Em desenvolvimento, use `*`

### Loja aparece como CLOSED
1. Configure horários 24/7
2. Inicie o polling
3. Aguarde 30 segundos

---

## 📁 Estrutura de Arquivos

```
ifood-partner-dashboard/
├── backend/
│   ├── server.py           # API principal
│   ├── ifood_client.py     # Cliente iFood
│   ├── models.py           # Modelos de dados
│   ├── requirements.txt    # Dependências Python
│   ├── .env               # Configurações (criar)
│   └── .env.example       # Exemplo de config
│
├── frontend/
│   ├── src/               # Código fonte React
│   ├── public/            # Assets estáticos
│   ├── package.json       # Dependências Node
│   ├── .env               # Configurações (criar)
│   └── .env.example       # Exemplo de config
│
├── docs/
│   └── IFOOD_API.md       # Documentação API
│
├── memory/
│   └── PRD.md             # Product Requirements
│
├── README.md              # Documentação principal
├── SETUP.md               # Este guia
└── .gitignore             # Arquivos ignorados
```

---

## 🔄 Atualizando do Repositório Original

```bash
# Adicione o repositório original como remote
git remote add upstream https://github.com/ORIGINAL/ifood-partner-dashboard.git

# Busque atualizações
git fetch upstream

# Merge com sua branch
git merge upstream/main
```

---

## 📞 Suporte

- **Documentação iFood:** https://developer.ifood.com.br
- **Portal do Parceiro:** https://portal.ifood.com.br

---

*Guia de Setup v1.0 - iFood Partner Dashboard*
