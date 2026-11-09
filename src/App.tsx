import { useEffect, useMemo, useState } from 'react';
import { api } from '@appdeploy/client';
import OperationsHub, { PAYMENT_DESTINATIONS } from './OperationsHub';
import WalletHub from './WalletHub';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Bell,
  Boxes,
  ChevronDown,
  CircleAlert,
  Clock3,
  Globe2,
  Languages,
  LayoutDashboard,
  Menu,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Wallet,
  X,
} from 'lucide-react';

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  stock: number;
  expiry: string;
  price: number;
  originalPrice?: number;
  discountApplied?: boolean;
  cost: number;
};
type Remittance = {
  id: string;
  recipient: string;
  country: string;
  amount: number;
  currency: string;
  status: string;
  date: string;
  localAmount?: number;
  localCurrency?: string;
  txHash?: string;
};
type DashboardData = {
  inventory: InventoryItem[];
  remittances: Remittance[];
  margin: number;
  revenue: number;
  costs: number;
  salesCount: number;
  initialized: boolean;
};
type PerformanceSummary = {
  period: string;
  startDate: string;
  endDate: string;
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
  salesCount: number;
};

type FxQuote = {
  amount: number;
  localCurrency: string;
  localAmount: number;
  zarAmount: number;
  rate: number;
  timestamp: string;
  quoteType: string;
};
type IntegrationStatus = {
  network: string;
  networkLiveValue: boolean;
  rlusdIssuer: string;
  privyCredentialsPresent: boolean;
  fxProviderConfigured: boolean;
  fxApiKeyConfigured: boolean;
  signingStatus: string;
  settlementStatus: string;
};

const copy: Record<string, Record<string, string>> = {
  en: {
    overview: 'Overview',
    inventory: 'Inventory',
    transfers: 'Transfers',
    settings: 'Settings',
    greeting: 'Good morning',
    subtitle: 'Here is what is happening in your store today.',
    health: 'Business health',
    healthy: 'Healthy',
    atRisk: 'Needs attention',
    margin: 'Profit margin',
    revenue: 'Revenue, 180 days',
    expenses: 'Stock costs, 180 days',
    sales: 'Recorded sales',
    inventoryTitle: 'Inventory overview',
    allItems: 'All items',
    lowStock: 'Low stock',
    expiring: 'Expiring soon',
    product: 'Product',
    category: 'Category',
    units: 'Units',
    expiry: 'Expiry date',
    price: 'Selling price',
    remittance: 'Global transfers',
    remittanceSub: 'Prepare an international payment for owner review.',
    recipient: 'Recipient name',
    country: 'Destination country',
    amount: 'Amount in RLUSD',
    createTransfer: 'Prepare transfer',
    recent: 'Recent transfers',
    status: 'Status',
    destination: 'Destination',
    pending: 'Awaiting owner approval',
    completed: 'Completed',
    blocked: 'Blocked by business guardrail',
    protected: 'Protected by owner approval',
    protectedSub:
      'The agent prepares requests. Your wallet signs every payment.',
    addStock: 'Add product',
    save: 'Save product',
    cancel: 'Cancel',
    search: 'Search products',
    noTransfers: 'No transfers yet',
    noProducts: 'No products found',
    demo: 'Demo workspace',
    demoSub: 'Sample trading data. No live funds move in demo mode.',
    language: 'Language',
    marginGuard: '15% minimum margin guardrail',
    marginNote:
      'International transfers pause when the six-month profit margin falls below 15%.',
    addName: 'Product name',
    addCategory: 'Category',
    addUnits: 'Stock units',
    addExpiry: 'Expiry date',
    addPrice: 'Selling price (ZAR)',
    addCost: 'Unit cost (ZAR)',
    requestReady: 'Transfer request prepared',
    requestNote:
      'No payment has been sent. Connect and approve a supported wallet integration to sign.',
    selectCountry: 'Choose a country',
    nigeria: 'Nigeria',
    senegal: 'Senegal',
    angola: 'Angola',
    overviewLabel: 'STORE OVERVIEW',
    operations: 'OPERATIONS',
    finance: 'FINANCE',
    quickView: 'Quick view',
    marginSafe: 'Above 15% safety threshold',
    marginUnsafe: 'Below 15% safety threshold',
    viewInventory: 'View inventory',
    viewTransfers: 'View transfers',
    agent: 'Retail agent',
    agentText: 'Monitoring stock, expiry and business health',
    activity: 'Activity',
  },
  zu: {
    overview: 'Uhlolojikelele',
    inventory: 'Impahla',
    transfers: 'Ukudlulisa imali',
    settings: 'Izilungiselelo',
    greeting: 'Sawubona',
    subtitle: 'Nansi imininingwane yesitolo sakho yanamuhla.',
    health: 'Impilo yebhizinisi',
    healthy: 'Lihle',
    atRisk: 'Lidinga ukunakwa',
    margin: 'Inzuzo',
    revenue: 'Imali engenayo, izinsuku ezingu-180',
    expenses: 'Izindleko zesitoko',
    sales: 'Ukuthengisa okurekhodiwe',
    inventoryTitle: 'Isimo sempahla',
    allItems: 'Zonke izinto',
    lowStock: 'Isitoko esiphansi',
    expiring: 'Sekusondele ukuphela',
    product: 'Umkhiqizo',
    category: 'Isigaba',
    units: 'Amayunithi',
    expiry: 'Usuku lokuphelelwa',
    price: 'Intengo',
    remittance: 'Ukuthumela imali',
    remittanceSub: 'Lungiselela inkokhelo ukuze umnikazi ayigunyaze.',
    recipient: 'Igama lomamukeli',
    country: 'Izwe',
    amount: 'Inani nge-RLUSD',
    createTransfer: 'Lungiselela ukuthumela',
    recent: 'Okuthunyelwe kwakamuva',
    status: 'Isimo',
    destination: 'Indawo',
    pending: 'Ilinde ukugunyazwa',
    completed: 'Kuqediwe',
    blocked: 'Kuvinjwe umthetho wokuphepha',
    protected: 'Kuvikelwe ukugunyazwa ngumnikazi',
    protectedSub:
      'Umenzeli ulungiselela izicelo. Umnikazi usayina zonke izinkokhelo.',
    addStock: 'Engeza umkhiqizo',
    save: 'Gcina umkhiqizo',
    cancel: 'Khansela',
    search: 'Sesha imikhiqizo',
    noTransfers: 'Akukho okuthunyelwe okwamanje',
    noProducts: 'Ayikho imikhiqizo etholakele',
    demo: 'Indawo yokuhlola',
    demoSub: 'Idatha yesampula. Ayikho imali yangempela ethunyelwayo.',
    language: 'Ulimi',
    marginGuard: 'Umkhawulo wenzuzo ongu-15%',
    marginNote:
      'Ukuthumela imali kuyama uma inzuzo yezinyanga eziyisithupha ingaphansi kuka-15%.',
    addName: 'Igama lomkhiqizo',
    addCategory: 'Isigaba',
    addUnits: 'Inani lesitoko',
    addExpiry: 'Usuku lokuphelelwa',
    addPrice: 'Intengo yokuthengisa (ZAR)',
    addCost: 'Izindleko zeyunithi (ZAR)',
    requestReady: 'Isicelo sokuthumela silungile',
    requestNote:
      'Ayikho imali ethunyelwe. Xhuma isikhwama semali esisekelwayo ukuze usayine.',
    selectCountry: 'Khetha izwe',
    nigeria: 'Nigeria',
    senegal: 'Senegal',
    angola: 'Angola',
    overviewLabel: 'ISIMO SESITOLO',
    operations: 'UMSEBENZI',
    finance: 'EZEZIMALI',
    quickView: 'Ukubuka ngokushesha',
    marginSafe: 'Ingaphezulu komkhawulo ongu-15%',
    marginUnsafe: 'Ingaphansi komkhawulo ongu-15%',
    viewInventory: 'Buka impahla',
    viewTransfers: 'Buka ukuthumela',
    agent: 'Umenzeli wesitolo',
    agentText: 'Uhlola isitoko, ukuphelelwa yisikhathi nempilo yebhizinisi',
    activity: 'Umsebenzi',
  },
  sw: {
    overview: 'Muhtasari',
    inventory: 'Bidhaa',
    transfers: 'Uhamisho',
    settings: 'Mipangilio',
    greeting: 'Habari za asubuhi',
    subtitle: 'Huu ndio muhtasari wa duka lako leo.',
    health: 'Hali ya biashara',
    healthy: 'Salama',
    atRisk: 'Inahitaji uangalizi',
    margin: 'Faida',
    revenue: 'Mapato, siku 180',
    expenses: 'Gharama za bidhaa',
    sales: 'Mauzo yaliyorekodiwa',
    inventoryTitle: 'Muhtasari wa bidhaa',
    allItems: 'Bidhaa zote',
    lowStock: 'Bidhaa chache',
    expiring: 'Zinakaribia kuisha',
    product: 'Bidhaa',
    category: 'Aina',
    units: 'Idadi',
    expiry: 'Tarehe ya mwisho',
    price: 'Bei',
    remittance: 'Uhamisho wa kimataifa',
    remittanceSub: 'Andaa malipo ya kimataifa kwa idhini ya mmiliki.',
    recipient: 'Jina la mpokeaji',
    country: 'Nchi',
    amount: 'Kiasi katika RLUSD',
    createTransfer: 'Andaa uhamisho',
    recent: 'Uhamisho wa hivi karibuni',
    status: 'Hali',
    destination: 'Unakoenda',
    pending: 'Inasubiri idhini ya mmiliki',
    completed: 'Imekamilika',
    blocked: 'Imefungwa na kanuni ya usalama',
    protected: 'Imelindwa kwa idhini ya mmiliki',
    protectedSub: 'Wakala huandaa maombi. Mmiliki husaini kila malipo.',
    addStock: 'Ongeza bidhaa',
    save: 'Hifadhi bidhaa',
    cancel: 'Ghairi',
    search: 'Tafuta bidhaa',
    noTransfers: 'Hakuna uhamisho bado',
    noProducts: 'Hakuna bidhaa zilizopatikana',
    demo: 'Eneo la majaribio',
    demoSub: 'Data ya mfano. Hakuna fedha halisi zinazohamishwa.',
    language: 'Lugha',
    marginGuard: 'Kiwango cha chini cha faida 15%',
    marginNote: 'Uhamisho unasimama faida ya miezi sita ikiwa chini ya 15%.',
    addName: 'Jina la bidhaa',
    addCategory: 'Aina',
    addUnits: 'Idadi ya bidhaa',
    addExpiry: 'Tarehe ya mwisho',
    addPrice: 'Bei ya kuuza (ZAR)',
    addCost: 'Gharama ya bidhaa (ZAR)',
    requestReady: 'Ombi la uhamisho limeandaliwa',
    requestNote:
      'Hakuna malipo yaliyotumwa. Unganisha pochi inayotumika ili kusaini.',
    selectCountry: 'Chagua nchi',
    nigeria: 'Nigeria',
    senegal: 'Senegal',
    angola: 'Angola',
    overviewLabel: 'MUHTASARI WA DUKA',
    operations: 'SHUGHULI',
    finance: 'FEDHA',
    quickView: 'Muhtasari',
    marginSafe: 'Juu ya kiwango cha 15%',
    marginUnsafe: 'Chini ya kiwango cha 15%',
    viewInventory: 'Angalia bidhaa',
    viewTransfers: 'Angalia uhamisho',
    agent: 'Wakala wa rejareja',
    agentText: 'Anafuatilia bidhaa na hali ya biashara',
    activity: 'Shughuli',
  },
  fr: {
    overview: 'Vue générale',
    inventory: 'Inventaire',
    transfers: 'Transferts',
    settings: 'Paramètres',
    greeting: 'Bonjour',
    subtitle: 'Voici le résumé de votre boutique aujourd’hui.',
    health: 'Santé de l’entreprise',
    healthy: 'Stable',
    atRisk: 'À surveiller',
    margin: 'Marge bénéficiaire',
    revenue: 'Revenus, 180 jours',
    expenses: 'Coût du stock',
    sales: 'Ventes enregistrées',
    inventoryTitle: 'État du stock',
    allItems: 'Tous les articles',
    lowStock: 'Stock faible',
    expiring: 'Expiration proche',
    product: 'Produit',
    category: 'Catégorie',
    units: 'Unités',
    expiry: 'Date d’expiration',
    price: 'Prix de vente',
    remittance: 'Transferts internationaux',
    remittanceSub: 'Préparez un paiement pour validation par le propriétaire.',
    recipient: 'Nom du bénéficiaire',
    country: 'Pays de destination',
    amount: 'Montant en RLUSD',
    createTransfer: 'Préparer le transfert',
    recent: 'Transferts récents',
    status: 'Statut',
    destination: 'Destination',
    pending: 'En attente d’approbation',
    completed: 'Terminé',
    blocked: 'Bloqué par la règle de sécurité',
    protected: 'Protégé par validation du propriétaire',
    protectedSub:
      'L’agent prépare les demandes. Le propriétaire signe chaque paiement.',
    addStock: 'Ajouter un produit',
    save: 'Enregistrer',
    cancel: 'Annuler',
    search: 'Rechercher des produits',
    noTransfers: 'Aucun transfert',
    noProducts: 'Aucun produit trouvé',
    demo: 'Espace de démonstration',
    demoSub: 'Données fictives. Aucun fonds réel ne circule.',
    language: 'Langue',
    marginGuard: 'Marge minimale de 15%',
    marginNote:
      'Les transferts sont suspendus si la marge sur six mois passe sous 15%.',
    addName: 'Nom du produit',
    addCategory: 'Catégorie',
    addUnits: 'Unités en stock',
    addExpiry: 'Date d’expiration',
    addPrice: 'Prix de vente (ZAR)',
    addCost: 'Coût unitaire (ZAR)',
    requestReady: 'Demande de transfert préparée',
    requestNote:
      'Aucun paiement envoyé. Connectez un portefeuille pris en charge pour signer.',
    selectCountry: 'Choisir un pays',
    nigeria: 'Nigeria',
    senegal: 'Sénégal',
    angola: 'Angola',
    overviewLabel: 'APERÇU DU MAGASIN',
    operations: 'OPÉRATIONS',
    finance: 'FINANCE',
    quickView: 'Aperçu rapide',
    marginSafe: 'Au-dessus du seuil de 15%',
    marginUnsafe: 'Sous le seuil de 15%',
    viewInventory: 'Voir le stock',
    viewTransfers: 'Voir les transferts',
    agent: 'Agent commercial',
    agentText: 'Surveille le stock et la santé de l’entreprise',
    activity: 'Activité',
  },
  pt: {
    overview: 'Visão geral',
    inventory: 'Inventário',
    transfers: 'Transferências',
    settings: 'Definições',
    greeting: 'Bom dia',
    subtitle: 'Veja o resumo da sua loja hoje.',
    health: 'Saúde do negócio',
    healthy: 'Saudável',
    atRisk: 'Precisa de atenção',
    margin: 'Margem de lucro',
    revenue: 'Receita, 180 dias',
    expenses: 'Custo do stock',
    sales: 'Vendas registadas',
    inventoryTitle: 'Estado do inventário',
    allItems: 'Todos os produtos',
    lowStock: 'Stock baixo',
    expiring: 'A expirar em breve',
    product: 'Produto',
    category: 'Categoria',
    units: 'Unidades',
    expiry: 'Validade',
    price: 'Preço de venda',
    remittance: 'Transferências globais',
    remittanceSub:
      'Prepare um pagamento internacional para aprovação do proprietário.',
    recipient: 'Nome do destinatário',
    country: 'País de destino',
    amount: 'Valor em RLUSD',
    createTransfer: 'Preparar transferência',
    recent: 'Transferências recentes',
    status: 'Estado',
    destination: 'Destino',
    pending: 'A aguardar aprovação',
    completed: 'Concluído',
    blocked: 'Bloqueado pela regra de segurança',
    protected: 'Protegido pela aprovação do proprietário',
    protectedSub:
      'O agente prepara pedidos. O proprietário assina cada pagamento.',
    addStock: 'Adicionar produto',
    save: 'Guardar produto',
    cancel: 'Cancelar',
    search: 'Pesquisar produtos',
    noTransfers: 'Sem transferências',
    noProducts: 'Nenhum produto encontrado',
    demo: 'Área de demonstração',
    demoSub: 'Dados de exemplo. Nenhum dinheiro real é movimentado.',
    language: 'Idioma',
    marginGuard: 'Margem mínima de 15%',
    marginNote:
      'As transferências param se a margem de seis meses ficar abaixo de 15%.',
    addName: 'Nome do produto',
    addCategory: 'Categoria',
    addUnits: 'Unidades em stock',
    addExpiry: 'Data de validade',
    addPrice: 'Preço de venda (ZAR)',
    addCost: 'Custo unitário (ZAR)',
    requestReady: 'Pedido de transferência preparado',
    requestNote:
      'Nenhum pagamento foi enviado. Ligue uma carteira suportada para assinar.',
    selectCountry: 'Escolha um país',
    nigeria: 'Nigéria',
    senegal: 'Senegal',
    angola: 'Angola',
    overviewLabel: 'RESUMO DA LOJA',
    operations: 'OPERAÇÕES',
    finance: 'FINANÇAS',
    quickView: 'Resumo rápido',
    marginSafe: 'Acima do limite de 15%',
    marginUnsafe: 'Abaixo do limite de 15%',
    viewInventory: 'Ver inventário',
    viewTransfers: 'Ver transferências',
    agent: 'Agente de retalho',
    agentText: 'Monitoriza stock e saúde do negócio',
    activity: 'Atividade',
  },
};

const money = (value: number) =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value);
const initialForm = {
  name: '',
  category: 'Groceries',
  stock: '10',
  expiry: '',
  price: '',
  cost: '',
};

function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [page, setPage] = useState('overview');
  const [lang, setLang] = useState('en');
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [transfer, setTransfer] = useState({
    recipient: '',
    country: 'Nigeria',
    amount: '',
    sourceAddress: '',
    destinationAddress: '',
  });
  const [quote, setQuote] = useState<FxQuote | null>(null);
  const [integrationStatus, setIntegrationStatus] =
    useState<IntegrationStatus | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [performancePeriod, setPerformancePeriod] = useState('week');
  const [performance, setPerformance] = useState<PerformanceSummary | null>(null);
  const [performanceBusy, setPerformanceBusy] = useState(false);
  const [demoTransferRequestId, setDemoTransferRequestId] = useState('');
  const t = (key: string) => copy[lang]?.[key] || copy.en[key] || key;

  async function load() {
    try {
      const response = await api.get('/api/dashboard');
      setData(response.data as DashboardData);
    } catch {
      setNotice('Dashboard data could not load. Refresh to try again.');
    }
  }

  async function loadPerformance(period = performancePeriod) {
    setPerformanceBusy(true);
    try {
      const response = await api.get('/api/performance?period=' + period);
      setPerformance(response.data as PerformanceSummary);
      setPerformancePeriod(period);
    } catch (err: any) {
      setNotice(err?.response?.data?.error || 'Shop performance could not load.');
    } finally {
      setPerformanceBusy(false);
    }
  }

  async function loadIntegrationStatus() {
    try {
      const response = await api.get('/api/integrations/status');
      setIntegrationStatus(response.data as IntegrationStatus);
    } catch {
      setIntegrationStatus(null);
    }
  }

  useEffect(() => {
    load();
    loadIntegrationStatus();
    loadPerformance('week');
  }, []);

  const filtered = useMemo(
    () =>
      (data?.inventory || []).filter(
        item =>
          item.name.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase())
      ),
    [data, query]
  );

  async function addProduct(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post('/api/inventory', {
        name: form.name,
        category: form.category,
        stock: Number(form.stock),
        expiry: form.expiry,
        price: Number(form.price),
        cost: Number(form.cost),
      });
      setShowAdd(false);
      setForm(initialForm);
      await load();
      setNotice('Product added to inventory.');
    } catch (err: any) {
      setNotice(err?.response?.data?.error || 'Product could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function getLiveQuote() {
    if (!transfer.amount || Number(transfer.amount) <= 0) {
      setNotice('Enter an RLUSD amount before requesting a quote.');
      return;
    }
    setBusy(true);
    try {
      const response = await api.post('/api/fx/quote', {
        amount: Number(transfer.amount),
        country: transfer.country,
      });
      setQuote(response.data as FxQuote);
      setNotice('Indicative exchange quote refreshed.');
    } catch (err: any) {
      setQuote(null);
      setNotice(err?.response?.data?.error || 'Live exchange quote unavailable.');
    } finally {
      setBusy(false);
    }
  }

  async function prepareTransfer(event: React.FormEvent) {
    event.preventDefault();
    const requestId = demoTransferRequestId || window.crypto.randomUUID();
    setDemoTransferRequestId(requestId);
    setBusy(true);
    try {
      const response = await api.post('/api/transfers/demo', {
        recipient: transfer.recipient,
        country: transfer.country,
        amount: Number(transfer.amount),
        requestId,
      });
      setNotice(response.data.message || 'RLUSD demo payment completed.');
      setDemoTransferRequestId('');
      setTransfer({
        recipient: '',
        country: 'Nigeria',
        amount: '',
        sourceAddress: '',
        destinationAddress: '',
      });
      setQuote(null);
      await load();
    } catch (err: any) {
      setNotice(err?.response?.data?.error || 'RLUSD demo payment failed. Retry with the same request.');
    } finally {
      setBusy(false);
    }
  }

  const nav = [
    {
      id: 'overview',
      label: t('overview'),
      icon: LayoutDashboard,
      group: t('overviewLabel'),
    },
    {
      id: 'inventory',
      label: t('inventory'),
      icon: Boxes,
      group: t('operations'),
    },
    {
      id: 'transfers',
      label: t('transfers'),
      icon: ArrowUpRight,
      group: t('finance'),
    },
    { id: 'wallet', label: 'Wallet', icon: Wallet, group: t('finance') },
    { id: 'suppliers', label: 'Suppliers', icon: ShoppingBag, group: t('operations') },
    { id: 'owner', label: 'Owner profile', icon: Store, group: t('finance') },
  ];

  if (!data)
    return (
      <div className="loading">
        <div className="brand-mark">S</div>
        <span>Preparing your workspace</span>
      </div>
    );

  return (
    <div className="shell">
      <aside className={mobileNav ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <strong>smartspaza</strong>
            <span>RETAIL FINANCE</span>
          </div>
          <button
            className="icon-btn close-nav"
            onClick={() => setMobileNav(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <div className="store-switch">
          <div className="store-avatar">
            <Store size={17} />
          </div>
          <div>
            <strong>My Spaza Store</strong>
            <span>Owner workspace</span>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">{t('overviewLabel')}</div>
        <nav>
          {nav.map(item => (
            <button
              key={item.id}
              className={page === item.id ? 'nav-item active' : 'nav-item'}
              onClick={() => {
                setPage(item.id);
                setMobileNav(false);
              }}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.id === 'transfers' && <i className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="agent-card">
            <div className="agent-icon">
              <Sparkles size={16} />
            </div>
            <div>
              <strong>{t('agent')}</strong>
              <span>{t('agentText')}</span>
            </div>
            <span className="live-dot" />
          </div>
          <div className="profile">
            <div className="profile-avatar">EO</div>
            <div>
              <strong>Store owner</strong>
              <span>Administrator</span>
            </div>
            <button className="icon-btn">
              <ChevronDown size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button
            className="icon-btn menu-btn"
            onClick={() => setMobileNav(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="crumb">
            My Spaza Store <span>/</span>{' '}
            <b>{nav.find(n => n.id === page)?.label || t('overview')}</b>
          </div>
          <div className="top-actions">
            <div className="demo-pill">
              <span /> {t('demo')}
            </div>
            <label className="language">
              <Languages size={16} />
              <select
                value={lang}
                onChange={e => setLang(e.target.value)}
                aria-label={t('language')}
              >
                <option value="en">English</option>
                <option value="zu">isiZulu</option>
                <option value="sw">Kiswahili</option>
                <option value="fr">Français</option>
                <option value="pt">Português</option>
              </select>
            </label>
            <button
              className="icon-btn notification"
              aria-label="Notifications"
            >
              <Bell size={18} />
              <i />
            </button>
            <div className="top-avatar">EO</div>
          </div>
        </header>

        <div className="content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">
                SATURDAY, 08 NOVEMBER 2026 <span className="eyebrow-line" />
              </div>
              <h1>
                {page === 'overview'
                  ? t('greeting') + ', store owner.'
                  : nav.find(n => n.id === page)?.label}
              </h1>
              <p>
                {page === 'overview'
                  ? t('subtitle')
                  : page === 'inventory'
                    ? t('inventoryTitle')
                    : t('remittanceSub')}
              </p>
            </div>
            {page === 'inventory' && (
              <button className="primary-btn" onClick={() => setShowAdd(true)}>
                <Plus size={17} />
                {t('addStock')}
              </button>
            )}
          </div>

          {notice && (
            <div className="notice">
              <span>{notice}</span>
              <button onClick={() => setNotice('')} aria-label="Dismiss">
                <X size={16} />
              </button>
            </div>
          )}

          {page === 'overview' && (
            <>
              <section className="health-banner">
                <div className="health-left">
                  <div className="health-icon">
                    <Activity size={20} />
                  </div>
                  <div>
                    <span className="section-kicker">{t('health')}</span>
                    <div className="health-status">
                      {data.margin >= 15 ? t('healthy') : t('atRisk')}{' '}
                      <span
                        className={
                          data.margin >= 15
                            ? 'status-chip good'
                            : 'status-chip risk'
                        }
                      >
                        {data.margin >= 15 ? '●' : '●'}{' '}
                        {data.margin >= 15
                          ? t('marginSafe')
                          : t('marginUnsafe')}
                      </span>
                    </div>
                    <p>{t('marginNote')}</p>
                  </div>
                </div>
                <div
                  className="margin-ring"
                  style={
                    {
                      '--progress':
                        Math.max(0, Math.min(100, data.margin)) + '%',
                    } as React.CSSProperties
                  }
                >
                  <div>
                    <strong>{data.margin.toFixed(1)}%</strong>
                    <span>{t('margin')}</span>
                  </div>
                </div>
              </section>

              <section className="panel" style={{ marginBottom: 22 }}>
                <div className="panel-heading">
                  <div><span className="section-kicker">SHOP PERFORMANCE</span><h2>Sales and profit report</h2></div>
                  <Activity size={18} />
                </div>
                <div className="wallet-tabs" style={{ marginBottom: 16 }}>
                  <button type="button" className={performancePeriod === 'week' ? 'wallet-tab active' : 'wallet-tab'} onClick={() => loadPerformance('week')} disabled={performanceBusy}>Last week</button>
                  <button type="button" className={performancePeriod === 'lastMonth' ? 'wallet-tab active' : 'wallet-tab'} onClick={() => loadPerformance('lastMonth')} disabled={performanceBusy}>Last month</button>
                  <button type="button" className={performancePeriod === 'thisMonth' ? 'wallet-tab active' : 'wallet-tab'} onClick={() => loadPerformance('thisMonth')} disabled={performanceBusy}>This month</button>
                </div>
                {performance && (
                  <>
                    <small>{performance.startDate} to {performance.endDate}</small>
                    <div className="metric-grid" style={{ marginTop: 14 }}>
                      <article className="metric-card"><span>Revenue</span><strong>{money(performance.revenue)}</strong></article>
                      <article className="metric-card"><span>Stock costs</span><strong>{money(performance.costs)}</strong></article>
                      <article className="metric-card"><span>Gross profit</span><strong>{money(performance.profit)}</strong></article>
                      <article className="metric-card"><span>Profit margin</span><strong>{performance.margin.toFixed(1)}%</strong></article>
                      <article className="metric-card"><span>Recorded sales</span><strong>{performance.salesCount}</strong></article>
                    </div>
                  </>
                )}
                {performanceBusy && <small>Updating performance report…</small>}
              </section>
              <section className="metric-grid">
                <article className="metric-card">
                  <div className="metric-top">
                    <span>{t('revenue')}</span>
                    <span className="metric-icon orange">
                      <Banknote size={18} />
                    </span>
                  </div>
                  <strong>{money(data.revenue)}</strong>
                  <small>
                    <ArrowUpRight size={13} /> 180-day trading history
                  </small>
                </article>
                <article className="metric-card">
                  <div className="metric-top">
                    <span>{t('expenses')}</span>
                    <span className="metric-icon">
                      <ShoppingBag size={18} />
                    </span>
                  </div>
                  <strong>{money(data.costs)}</strong>
                  <small>Recorded cost of goods</small>
                </article>
                <article className="metric-card">
                  <div className="metric-top">
                    <span>{t('sales')}</span>
                    <span className="metric-icon">
                      <Activity size={18} />
                    </span>
                  </div>
                  <strong>{data.salesCount.toLocaleString('en-ZA')}</strong>
                  <small>Across the last six months</small>
                </article>
              </section>

              <div className="section-heading">
                <div>
                  <span className="section-kicker">{t('operations')}</span>
                  <h2>{t('inventoryTitle')}</h2>
                </div>
                <button
                  className="text-link"
                  onClick={() => setPage('inventory')}
                >
                  {t('viewInventory')} <ArrowUpRight size={15} />
                </button>
              </div>
              <InventoryTable items={data.inventory.slice(0, 5)} t={t} />
              <div className="bottom-grid">
                <section className="panel transfer-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">{t('finance')}</span>
                      <h2>{t('remittance')}</h2>
                    </div>
                    <div className="panel-icon">
                      <Globe2 size={18} />
                    </div>
                  </div>
                  <p className="muted">{t('remittanceSub')}</p>
                  <div className="security-note">
                    <ShieldCheck size={17} />
                    <div>
                      <strong>{t('protected')}</strong>
                      <span>{t('protectedSub')}</span>
                    </div>
                  </div>
                  <button
                    className="primary-btn full"
                    onClick={() => setPage('transfers')}
                  >
                    {t('createTransfer')} <ArrowUpRight size={16} />
                  </button>
                </section>
                <section className="panel activity-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">{t('quickView')}</span>
                      <h2>{t('recent')}</h2>
                    </div>
                    <Clock3 size={18} className="muted-icon" />
                  </div>
                  {data.remittances.length ? (
                    data.remittances.slice(0, 3).map(r => (
                      <div className="activity-row" key={r.id}>
                        <div className="activity-avatar">
                          <ArrowUpRight size={16} />
                        </div>
                        <div className="activity-detail">
                          <strong>{r.recipient}</strong>
                          <span>
                            {r.country} · {r.date}
                          </span>
                        </div>
                        <div className="activity-amount">
                          {r.amount.toFixed(2)} <small>RLUSD</small>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-inline">{t('noTransfers')}</div>
                  )}
                </section>
              </div>
            </>
          )}

          {page === 'wallet' && <WalletHub onNotice={setNotice} />}

          {(page === 'inventory' || page === 'suppliers' || page === 'owner') && (
            <OperationsHub
              page={page}
              inventory={data.inventory}
              onRefresh={load}
              onNotice={setNotice}
            />
          )}

          {false && page === 'inventory' && (
            <section className="panel inventory-page">
              <div className="inventory-toolbar">
                <div>
                  <span className="section-kicker">{t('operations')}</span>
                  <h2>
                    {t('allItems')}{' '}
                    <span className="count">{data.inventory.length}</span>
                  </h2>
                </div>
                <div className="search-box">
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={t('search')}
                  />
                </div>
              </div>
              <InventoryTable items={filtered} t={t} detailed />
            </section>
          )}

          {page === 'transfers' && (
            <div className="transfer-layout">
              <section className="panel transfer-form-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">{t('finance')}</span>
                    <h2>{t('remittance')}</h2>
                  </div>
                  <div className="panel-icon">
                    <Globe2 size={18} />
                  </div>
                </div>
                <p className="muted">{t('remittanceSub')}</p>
                <div className="integration-status-card">
                  <div className="integration-status-top">
                    <strong>RLUSD DEMO TRANSFER</strong>
                    <span className="integration-live-tag">NO REAL FUNDS</span>
                  </div>
                  <p>Demo payments complete immediately. No owner approval or wallet signature is required.</p>
                  <p>Store RLUSD account balance is funded through the demo funding pool. Deposits debit the pool before crediting the store.</p>
                  <small>For real XRPL RLUSD settlement, verified wallet signing and recipient trust lines are still required.</small>
                </div>
                <form onSubmit={prepareTransfer} className="form-stack">
                  <label>
                    Recipient wallet email or cell phone number
                    <input
                      required
                      minLength={7}
                      value={transfer.recipient}
                      onChange={e =>
                        setTransfer({ ...transfer, recipient: e.target.value })
                      }
                      placeholder="name@example.com or +27821234567"
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    {t('country')}
                    <select
                      value={transfer.country}
                      onChange={e => {
                        setTransfer({ ...transfer, country: e.target.value });
                        setQuote(null);
                      }}
                    >
                      {PAYMENT_DESTINATIONS.map(destination => (
                        <option key={destination.country} value={destination.country}>
                          {destination.country} ({destination.currency})
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="form-footnote">Enter the recipient's registered SmartSpaza email address or international cell phone number. Recipient demo wallets are identified by this contact detail, not by a display name.</p>
                  <label>
                    {t('amount')}
                    <div className="amount-input">
                      <span>RLUSD</span>
                      <input
                        type="number"
                        min="0.01"
                        max="10000"
                        step="0.01"
                        required
                        value={transfer.amount}
                        onChange={e => {
                          setTransfer({ ...transfer, amount: e.target.value });
                          setQuote(null);
                        }}
                        placeholder="0.00"
                      />
                    </div>
                  </label>
                  <button
                    type="button"
                    className="secondary-btn quote-action"
                    onClick={getLiveQuote}
                    disabled={busy || !transfer.amount}
                  >
                    {busy ? 'Checking…' : 'Get live currency quote'}
                  </button>
                  {quote && (
                    <div className="fx-quote-card">
                      <span className="section-kicker">LIVE FX ESTIMATE</span>
                      <strong>
                        {quote.localAmount.toLocaleString('en-ZA', {
                          style: 'currency',
                          currency: quote.localCurrency,
                          maximumFractionDigits: 2,
                        })}
                      </strong>
                      <div>
                        {Number(transfer.amount).toFixed(2)} RLUSD ≈ {quote.localAmount.toLocaleString('en-ZA', {
                          maximumFractionDigits: 2,
                        })} {quote.localCurrency}
                      </div>
                      <small>
                        South African reference: {money(quote.zarAmount)} · 1 RLUSD assumed ≈ 1 USD
                      </small>
                      <small>
                        Updated {new Date(quote.timestamp).toLocaleString()}
                      </small>
                      <small>{quote.quoteType}</small>
                    </div>
                  )}
                  <div className="security-note">
                    <ShieldCheck size={17} />
                    <div>
                      <strong>Instant demo settlement</strong>
                      <span>The shop RLUSD demo balance is debited and the recipient demo balance is credited immediately.</span>
                    </div>
                  </div>
                  <button className="primary-btn full" disabled={busy || !transfer.recipient.trim() || !transfer.amount}>
                    {busy ? 'Sending…' : 'Send RLUSD demo payment'}{' '}
                    <ArrowUpRight size={16} />
                  </button>
                  <p className="form-footnote">This is an internal demo ledger, not a real RLUSD token transfer. Real blockchain payments remain separate.</p>
                </form>
              </section>
              <section className="panel transfer-history">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">{t('activity')}</span>
                    <h2>{t('recent')}</h2>
                  </div>
                </div>
                {data.remittances.length ? (
                  data.remittances.map(r => (
                    <div className="history-row" key={r.id}>
                      <div className="activity-avatar">
                        <ArrowUpRight size={16} />
                      </div>
                      <div className="activity-detail">
                        <strong>{r.recipient}</strong>
                        <span>
                          {r.country} · {r.date}
                        </span>
                      </div>
                      <div className="history-value">
                        <strong>{r.amount.toFixed(2)} RLUSD</strong>
                        <span className="pending-label">
                          {r.status || t('pending')}
                        </span>
                        {r.localAmount && r.localCurrency && (
                          <span className="history-local-value">
                            ≈ {r.localAmount.toLocaleString('en-ZA', {
                              style: 'currency',
                              currency: r.localCurrency,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        )}
                        {r.txHash && (
                          <span className="history-local-value">
                            Ledger: {r.txHash.slice(0, 10)}…
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <Wallet size={22} />
                    </div>
                    <strong>{t('noTransfers')}</strong>
                    <span>
                      Prepare a transfer request to see activity here.
                    </span>
                  </div>
                )}
              </section>
            </div>
          )}
          <footer>
            <span>
              SMARTSPAZA <b>·</b> RETAIL FINANCE ENGINE
            </span>
            <span>
              <ShieldCheck size={13} /> Owner-controlled payments
            </span>
          </footer>
        </div>
      </main>

      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <section className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <span className="section-kicker">{t('inventory')}</span>
                <h2>{t('addStock')}</h2>
              </div>
              <button className="icon-btn" onClick={() => setShowAdd(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={addProduct} className="form-stack">
              <label>
                {t('addName')}
                <input
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                {t('addCategory')}
                <input
                  required
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                />
              </label>
              <div className="form-two">
                <label>
                  {t('addUnits')}
                  <input
                    type="number"
                    min="0"
                    required
                    value={form.stock}
                    onChange={e => setForm({ ...form, stock: e.target.value })}
                  />
                </label>
                <label>
                  {t('addExpiry')}
                  <input
                    type="date"
                    required
                    value={form.expiry}
                    onChange={e => setForm({ ...form, expiry: e.target.value })}
                  />
                </label>
              </div>
              <div className="form-two">
                <label>
                  {t('addPrice')}
                  <input
                    type="number"
                    min="0"
                    step=".01"
                    required
                    value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })}
                  />
                </label>
                <label>
                  {t('addCost')}
                  <input
                    type="number"
                    min="0"
                    step=".01"
                    required
                    value={form.cost}
                    onChange={e => setForm({ ...form, cost: e.target.value })}
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowAdd(false)}
                >
                  {t('cancel')}
                </button>
                <button className="primary-btn" disabled={busy}>
                  {busy ? 'Saving…' : t('save')} <Plus size={16} />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      <div className="demo-ribbon">
        <CircleAlert size={13} />
        {t('demoSub')}
      </div>
    </div>
  );
}

function InventoryTable({
  items,
  t,
  detailed = false,
}: {
  items: InventoryItem[];
  t: (key: string) => string;
  detailed?: boolean;
}) {
  if (!items.length)
    return (
      <div className="empty-state">
        <Package size={22} />
        <strong>{t('noProducts')}</strong>
      </div>
    );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t('product')}</th>
            {detailed && <th>{t('category')}</th>}
            <th>{t('units')}</th>
            <th>{t('expiry')}</th>
            {detailed && <th>{t('price')}</th>}
            <th>{t('status')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const days = Math.ceil(
              (new Date(item.expiry + 'T00:00:00').getTime() - Date.now()) /
                86400000
            );
            const low = item.stock < 10;
            const expired = days < 0;
            const soon = days >= 0 && days <= 7;
            return (
              <tr key={item.id}>
                <td>
                  <div className="product-cell">
                    <div className="product-thumb">
                      <ShoppingBag size={16} />
                    </div>
                    <strong>{item.name}</strong>
                  </div>
                </td>
                {detailed && <td className="muted-cell">{item.category}</td>}
                <td>
                  <strong>{item.stock}</strong>
                </td>
                <td className="muted-cell">{item.expiry}</td>
                {detailed && <td>{item.discountApplied ? <><s>{money(item.originalPrice ?? item.price)}</s><br /><strong>{money(item.price)}</strong><br /><span>50% OFF</span></> : money(item.price)}</td>}
                <td>
                  <span
                    className={                    expired || low || soon ? 'table-status warning' : 'table-status'
                  }
                >
                  <i />
                  {expired ? 'Expired, remove from sale' : low ? t('lowStock') : soon ? '50% expiry sale' : 'In stock'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default App;
