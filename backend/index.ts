import { router, json, error, db, secrets } from '@appdeploy/sdk';

type Product = {
  name: string;
  category: string;
  stock: number;
  expiry: string;
  price: number;
  cost: number;
  originalPrice?: number;
  discountApplied?: boolean;
  discountedAt?: string;
};
type Sale = { date: string; revenue: number; cost: number };
type Transfer = {
  recipient: string;
  country: string;
  amount: number;
  currency: string;
  status: string;
  date: string;
  sourceAddress?: string;
  destinationAddress?: string;
  localAmount?: number;
  localCurrency?: string;
  fxRate?: number;
  fxTimestamp?: string;
  paymentDraft?: Record<string, unknown>;
  txHash?: string;
  ledgerResult?: string;
};
type FxCountry = string;

const COUNTRY_CURRENCIES: Record<string, string> = {
  'Algeria': 'DZD', 'Angola': 'AOA', 'Benin': 'XOF', 'Botswana': 'BWP',
  'Burkina Faso': 'XOF', 'Burundi': 'BIF', 'Cabo Verde': 'CVE', 'Cameroon': 'XAF',
  'Central African Republic': 'XAF', 'Chad': 'XAF', 'Comoros': 'KMF',
  'Republic of the Congo': 'XAF', 'Democratic Republic of the Congo': 'CDF',
  "Côte d’Ivoire": 'XOF', 'Djibouti': 'DJF', 'Egypt': 'EGP',
  'Equatorial Guinea': 'XAF', 'Eritrea': 'ERN', 'Eswatini': 'SZL', 'Ethiopia': 'ETB',
  'Gabon': 'XAF', 'The Gambia': 'GMD', 'Ghana': 'GHS', 'Guinea': 'GNF',
  'Guinea-Bissau': 'XOF', 'Kenya': 'KES', 'Lesotho': 'LSL', 'Liberia': 'LRD',
  'Libya': 'LYD', 'Madagascar': 'MGA', 'Malawi': 'MWK', 'Mali': 'XOF',
  'Mauritania': 'MRU', 'Mauritius': 'MUR', 'Morocco': 'MAD', 'Mozambique': 'MZN',
  'Namibia': 'NAD', 'Niger': 'XOF', 'Nigeria': 'NGN', 'Rwanda': 'RWF',
  'São Tomé and Príncipe': 'STN', 'Senegal': 'XOF', 'Seychelles': 'SCR',
  'Sierra Leone': 'SLE', 'Somalia': 'SOS', 'South Africa': 'ZAR',
  'South Sudan': 'SSP', 'Sudan': 'SDG', 'Tanzania': 'TZS', 'Togo': 'XOF',
  'Tunisia': 'TND', 'Uganda': 'UGX', 'Zambia': 'ZMW', 'Zimbabwe': 'ZWG',
  'India': 'INR', 'China': 'CNY',
};

const INVENTORY = 'spaza_inventory';
const SALES = 'spaza_sales';
const TRANSFERS = 'spaza_transfers';
const OWNER = 'spaza_owner';
const SUPPLIERS = 'spaza_suppliers';
const SUPPLIER_PAYMENTS = 'spaza_supplier_payments';
const DISPOSALS = 'spaza_disposals';
const XRPL_RPC = 'https://s.altnet.rippletest.net:51234/';
const XRPL_MAINNET_RPC = 'https://xrplcluster.com/';
const RLUSD_ISSUER_TESTNET = 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV';
const RLUSD_ISSUER_MAINNET = 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De';
const RLUSD_CURRENCY = '524C555344000000000000000000000000000000';
const DEFAULT_FX_URL = 'https://open.er-api.com/v6/latest/USD';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidInternationalPhone(value: string) {
  if (!value.trim()) return true;
  const compact = value.trim().replace(/[\s().-]/g, '');
  return /^\+?[1-9]\d{6,14}$/.test(compact);
}


function isoDate(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

async function secretValue(name: string, fallback = '') {
  try {
    const names = await secrets.listSecretNames();
    if (!names.includes(name)) return fallback;
    return await secrets.readSecret(name);
  } catch {
    return fallback;
  }
}

async function ensureSeeded() {
  const inventory = await db.list<Product>(INVENTORY, { limit: 1 });
  if (inventory.items.length) return false;

  const products: Product[] = [
    { name: 'White Bread', category: 'Bakery', stock: 5, expiry: isoDate(-2), price: 16, cost: 12 },
    { name: 'Fresh Milk 1L', category: 'Dairy', stock: 18, expiry: isoDate(-4), price: 20, cost: 15.5 },
    { name: 'Long Grain Rice 2kg', category: 'Groceries', stock: 60, expiry: isoDate(-23), price: 45, cost: 38 },
    { name: 'Sunflower Oil 2L', category: 'Groceries', stock: 24, expiry: isoDate(-42), price: 58, cost: 47 },
    { name: 'Brown Eggs 6-pack', category: 'Dairy', stock: 8, expiry: isoDate(-3), price: 24, cost: 18 },
    { name: 'Maize Meal 5kg', category: 'Groceries', stock: 32, expiry: isoDate(-75), price: 68, cost: 55 },
  ];
  await db.add(INVENTORY, products);

  const sales: Sale[] = [];
  for (let day = 0; day < 180; day += 1) {
    const dailyCount = day % 7 === 0 ? 12 : 8;
    for (let index = 0; index < dailyCount; index += 1) {
      const product = products[(day + index) % products.length];
      sales.push({ date: isoDate(day), revenue: product.price, cost: product.cost });
    }
  }
  for (let offset = 0; offset < sales.length; offset += 400) {
    await db.add(SALES, sales.slice(offset, offset + 400));
  }
  return true;
}

async function applyExpiryDiscounts() {
  const result = await db.list<Product>(INVENTORY, { limit: 100 });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const updates: Array<{ id: string; record: Record<string, unknown> }> = [];
  for (const item of result.items) {
    const expiryDate = new Date(item.expiry + 'T00:00:00');
    const daysRemaining = Math.floor((expiryDate.getTime() - today.getTime()) / 86400000);
    const originalPrice = Number(item.originalPrice ?? item.price);
    const eligible = Number(item.stock) > 0 && daysRemaining >= 0 && daysRemaining <= 7;
    if (eligible) {
      const salePrice = Number((originalPrice * 0.5).toFixed(2));
      if (!item.discountApplied || Number(item.price) !== salePrice || Number(item.originalPrice) !== originalPrice) {
        updates.push({ id: item.id, record: { ...item, originalPrice, price: salePrice, discountApplied: true, discountedAt: new Date().toISOString() } });
      }
    } else if (item.discountApplied || item.originalPrice === undefined) {
      const restoredPrice = item.discountApplied ? originalPrice : Number(item.price);
      updates.push({ id: item.id, record: { ...item, originalPrice: restoredPrice, price: restoredPrice, discountApplied: false, discountedAt: undefined } });
    }
  }
  if (updates.length) await db.update(INVENTORY, updates);
  return updates.length;
}

async function dashboardData() {
  await ensureSeeded();
  await applyExpiryDiscounts();
  const [inventory, sales, transfers] = await Promise.all([
    db.list<Product>(INVENTORY, { limit: 100 }),
    db.list<Sale>(SALES, { limit: 500 }),
    db.list<Transfer>(TRANSFERS, { limit: 50 }),
  ]);
  const revenue = sales.items.reduce((sum, sale) => sum + Number(sale.revenue || 0), 0);
  const costs = sales.items.reduce((sum, sale) => sum + Number(sale.cost || 0), 0);
  const margin = revenue > 0 ? ((revenue - costs) / revenue) * 100 : 0;
  return {
    inventory: inventory.items,
    remittances: transfers.items,
    revenue: Math.round(revenue * 100) / 100,
    costs: Math.round(costs * 100) / 100,
    margin: Math.round(margin * 100) / 100,
    salesCount: sales.items.length,
    initialized: true,
  };
}

async function xrplRequest(command: string, params: Record<string, unknown>, network: 'mainnet' | 'testnet' = 'testnet') {
  const response = await fetch(network === 'mainnet' ? XRPL_MAINNET_RPC : XRPL_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method: command, params: [params] }),
  });
  if (!response.ok) throw new Error('XRPL node request failed.');
  const payload = await response.json() as {
    result?: Record<string, any>;
    error?: string;
    error_message?: string;
  };
  if (payload.error || payload.result?.status === 'error') {
    throw new Error(payload.error_message || payload.result?.error_message || payload.error || 'XRPL request failed.');
  }
  return payload.result || {};
}

function currencyMatches(value: string) {
  return value === 'RLUSD' || value.toUpperCase() === RLUSD_CURRENCY;
}

async function getFxRates() {
  const url = await secretValue('FX_ORACLE_URL', DEFAULT_FX_URL);
  const apiKey = await secretValue('FX_ORACLE_API_KEY');
  const refreshUrl = url + (url.includes('?') ? '&' : '?') + '_refresh=' + Date.now();
  const response = await fetch(refreshUrl, {
    headers: apiKey
      ? { authorization: 'Bearer ' + apiKey, 'x-api-key': apiKey, accept: 'application/json', 'cache-control': 'no-cache' }
      : { accept: 'application/json', 'cache-control': 'no-cache' },
  });
  if (!response.ok) throw new Error('Exchange-rate provider returned an error.');
  const payload = await response.json() as {
    rates?: Record<string, number>;
    conversion_rates?: Record<string, number>;
    base_code?: string;
    time_last_update_utc?: string;
    time_last_update_unix?: number;
    result?: string;
  };
  const rates = payload.rates || payload.conversion_rates;
  if (!rates || !Number(rates.ZAR)) {
    throw new Error('Exchange-rate response must include a ZAR reference rate.');
  }
  const timestamp = payload.time_last_update_unix
    ? new Date(payload.time_last_update_unix * 1000).toISOString()
    : payload.time_last_update_utc || new Date().toISOString();
  const age = Date.now() - new Date(timestamp).getTime();
  if (Number.isFinite(age) && age > 24 * 60 * 60 * 1000) {
    throw new Error('Exchange-rate data is older than 24 hours. Refresh the provider data.');
  }
  return { rates, timestamp, base: payload.base_code || 'USD' };
}

async function verifyPaymentAccounts(sourceAddress: string, destinationAddress: string, amount: number) {
  const issuer = await secretValue('XRPL_RLUSD_ISSUER', RLUSD_ISSUER_TESTNET);
  const [sourceInfo, destinationInfo, sourceLines, destinationLines] = await Promise.all([
    xrplRequest('account_info', { account: sourceAddress, ledger_index: 'validated' }),
    xrplRequest('account_info', { account: destinationAddress, ledger_index: 'validated' }),
    xrplRequest('account_lines', { account: sourceAddress, peer: issuer, ledger_index: 'validated' }),
    xrplRequest('account_lines', { account: destinationAddress, peer: issuer, ledger_index: 'validated' }),
  ]);

  const sourceAccount = sourceInfo.account_data as { Account?: string } | undefined;
  const destinationAccount = destinationInfo.account_data as { Account?: string } | undefined;
  if (!sourceAccount?.Account || !destinationAccount?.Account) {
    throw new Error('Both sender and recipient need funded XRPL accounts.');
  }

  const sourceLine = ((sourceLines.lines || []) as Array<Record<string, any>>)
    .find(line => line.account === issuer && currencyMatches(String(line.currency || '')));
  const destinationLine = ((destinationLines.lines || []) as Array<Record<string, any>>)
    .find(line => line.account === issuer && currencyMatches(String(line.currency || '')));

  if (!sourceLine || Number(sourceLine.balance) < amount) {
    throw new Error('The sender wallet does not hold enough RLUSD from the configured issuer.');
  }
  if (!destinationLine || Number(destinationLine.limit) <= 0) {
    throw new Error('The recipient wallet has no active RLUSD trust line for this issuer.');
  }
  if (destinationLine.freeze || destinationLine.freeze_peer || sourceLine.freeze || sourceLine.freeze_peer) {
    throw new Error('The RLUSD trust line is frozen. The payment is blocked.');
  }

  return {
    issuer,
    sourceBalance: Number(sourceLine.balance),
    destinationLimit: Number(destinationLine.limit),
    ledgerIndex: Number(sourceInfo.ledger_index || destinationInfo.ledger_index || 0),
  };
}

async function getIntegrationStatus() {
  const names = await secrets.listSecretNames();
  const has = (name: string) => names.includes(name);
  return {
    network: 'XRPL Testnet',
    networkLiveValue: false,
    rlusdIssuer: has('XRPL_RLUSD_ISSUER') ? 'Custom issuer configured' : 'Official Ripple RLUSD Testnet issuer',
    privyCredentialsPresent: has('PRIVY_APP_ID') && has('PRIVY_APP_SECRET'),
    fxProviderConfigured: has('FX_ORACLE_URL'),
    fxApiKeyConfigured: has('FX_ORACLE_API_KEY'),
    signingStatus: 'Awaiting verified Privy XRPL signer connection',
    settlementStatus: 'Disabled until wallet signing is connected and validated',
  };
}

export const expiryMarkdownHandler = async (_event: { type: 'cron'; name: string; invocationId: string; scheduledTime: string }) => {
  try {
    const updatedProducts = await applyExpiryDiscounts();
    console.info('Expiry markdown job completed', { updatedProducts });
    return { statusCode: 200 };
  } catch (err) {
    console.error('Expiry markdown job failed', err);
    return { statusCode: 200 };
  }
};

async function ensureRlusdDemoAccounts() {
  const [pool] = await db.get<Record<string, any>>('spaza_rlusd_demo_wallets', ['demo-funding-pool'], { consistent: true });
  if (!pool) {
    await db.tx.add('spaza_rlusd_demo_wallets', [{
      id: 'demo-funding-pool',
      label: 'SmartSpaza Demo Funding Pool',
      balance: 10000,
      currency: 'RLUSD',
      accountType: 'demo_treasury',
      createdAt: new Date().toISOString(),
    }]);
  }
  let [shop] = await db.get<Record<string, any>>('spaza_rlusd_demo_wallets', ['shop'], { consistent: true });
  if (!shop) {
    await db.tx.add('spaza_rlusd_demo_wallets', [{
      id: 'shop',
      label: 'SmartSpaza Store RLUSD Demo Account',
      balance: 0,
      currency: 'RLUSD',
      accountType: 'store_demo',
      demoOpeningBalanceReset: true,
      createdAt: new Date().toISOString(),
    }]);
    [shop] = await db.get<Record<string, any>>('spaza_rlusd_demo_wallets', ['shop'], { consistent: true });
  } else if (!shop.demoOpeningBalanceReset) {
    const [reset] = await db.update('spaza_rlusd_demo_wallets', [{
      id: 'shop',
      record: { ...shop, balance: 0, demoOpeningBalanceReset: true, updatedAt: new Date().toISOString() },
    }]);
    if (!reset) throw new Error('Store demo RLUSD account could not be initialized.');
    [shop] = await db.get<Record<string, any>>('spaza_rlusd_demo_wallets', ['shop'], { consistent: true });
  }
  const [funding] = await db.get<Record<string, any>>('spaza_rlusd_demo_wallets', ['demo-funding-pool'], { consistent: true });
  if (!funding || !shop) throw new Error('RLUSD demo accounts could not be initialized.');
  return { shop, funding };
}

export const handler = router({
  'GET /api/dashboard': [
    async () => {
      try {
        return json(await dashboardData());
      } catch (err) {
        console.error('Dashboard load failed', err);
        return error('Dashboard data is temporarily unavailable.', 503);
      }
    },
  ],
  'GET /api/integrations/status': [
    async () => {
      try {
        return json(await getIntegrationStatus());
      } catch {
        return error('Integration status is temporarily unavailable.', 503);
      }
    },
  ],
  'GET /api/performance': [
    async ({ query }) => {
      try {
        await ensureSeeded();
        const period = String(query?.period || 'week');
        const now = new Date();
        const start = new Date(now);
        const end = new Date(now);
        if (period === 'week') {
          start.setDate(now.getDate() - 6);
          start.setHours(0, 0, 0, 0);
        } else if (period === 'lastMonth') {
          start.setDate(1);
          start.setMonth(start.getMonth() - 1);
          start.setHours(0, 0, 0, 0);
          end.setDate(0);
          end.setHours(23, 59, 59, 999);
        } else if (period === 'thisMonth') {
          start.setDate(1);
          start.setHours(0, 0, 0, 0);
        } else {
          return error('Choose week, lastMonth or thisMonth.', 400);
        }
        const sales = await db.list<Sale>(SALES, { limit: 5000 });
        const rows = sales.items.filter(sale => {
          const date = new Date(String(sale.date) + 'T12:00:00');
          return date >= start && date <= end;
        });
        const revenue = rows.reduce((sum, sale) => sum + Number(sale.revenue || 0), 0);
        const costs = rows.reduce((sum, sale) => sum + Number(sale.cost || 0), 0);
        return json({
          period,
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
          revenue: Number(revenue.toFixed(2)),
          costs: Number(costs.toFixed(2)),
          profit: Number((revenue - costs).toFixed(2)),
          margin: revenue ? Number((((revenue - costs) / revenue) * 100).toFixed(2)) : 0,
          salesCount: rows.length,
          source: 'SmartSpaza recorded sales',
        });
      } catch (err) {
        console.error('Performance summary failed', err);
        return error('Shop performance data could not be loaded.', 503);
      }
    },
  ],
  'GET /api/shop-wallet': [
    async () => {
      try {
        const [wallet] = await db.get<Record<string, any>>('spaza_shop_wallet', ['shop'], { consistent: true });
        if (!wallet?.address) {
          return json({ address: '', network: 'mainnet', balanceXrp: null, rlusdBalance: null, trustLineActive: false, configured: false });
        }
        const network = wallet.network === 'mainnet' ? 'mainnet' : 'testnet';
        const issuer = network === 'mainnet'
          ? RLUSD_ISSUER_MAINNET
          : await secretValue('XRPL_RLUSD_ISSUER', RLUSD_ISSUER_TESTNET);
        try {
          const [accountResult, linesResult] = await Promise.all([
            xrplRequest('account_info', { account: wallet.address, ledger_index: 'validated' }, network),
            xrplRequest('account_lines', { account: wallet.address, peer: issuer, ledger_index: 'validated' }, network),
          ]);
          const accountData = accountResult.account_data as Record<string, any> | undefined;
          if (!accountData?.Account) {
            return json({ ...wallet, balanceXrp: null, rlusdBalance: null, trustLineActive: false, issuer, configured: true, accountFunded: false });
          }
          const lines = (linesResult.lines || []) as Array<Record<string, any>>;
          const line = lines.find(item => item.account === issuer && currencyMatches(String(item.currency || '')));
          const drops = Number(accountData.Balance || 0);
          return json({
            ...wallet,
            balanceXrp: drops / 1000000,
            rlusdBalance: line ? Number(line.balance || 0) : 0,
            trustLineActive: Boolean(line && Number(line.limit) > 0),
            issuer,
            configured: true,
            accountFunded: true,
            balanceLedger: 'validated',
          });
        } catch {
          return json({
            ...wallet,
            balanceXrp: null,
            rlusdBalance: null,
            trustLineActive: false,
            issuer,
            configured: true,
            accountFunded: false,
            balanceNote: 'The address is not funded or is not visible on the selected XRPL network.',
          });
        }
      } catch {
        return error('Store RLUSD account details could not load.', 503);
      }
    },
  ],
  'PUT /api/shop-wallet': [
    async ({ body }) => {
      const input = body as Record<string, unknown>;
      const address = String(input.address || '').trim();
      const network = String(input.network || 'testnet');
      if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address) || !['testnet', 'mainnet'].includes(network)) {
        return error('Enter a valid public XRPL address and select a network.', 400);
      }
      try {
        const record = { address, network, updatedAt: new Date().toISOString() };
        const [existing] = await db.get<Record<string, any>>('spaza_shop_wallet', ['shop'], { consistent: true });
        if (existing) {
          const [saved] = await db.update('spaza_shop_wallet', [{ id: 'shop', record: { ...existing, ...record } }]);
          if (!saved) return error('Shop wallet address could not be updated.', 503);
        } else {
          const [created] = await db.add('spaza_shop_wallet', [{ id: 'shop', ...record }]);
          if (!created) return error('Shop wallet address could not be saved.', 503);
        }
        return json({ saved: true, address, network, message: 'Shop public XRPL wallet address saved. No private key was stored.' });
      } catch {
        return error('Shop wallet address could not be saved.', 503);
      }
    },
  ],
  'GET /api/xrp/market': [
    async () => {
      const currencies = 'usd,zar,eur,gbp,inr,cny,ngn,kes,ghs,bwp,zwl,aoa,mzn,egp,mur,aud,cad,jpy,chf,sgd,hkd,brl,mxn';
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=' + currencies + '&include_24hr_change=true&include_last_updated_at=true', {
          headers: { accept: 'application/json' },
        });
        if (!response.ok) throw new Error('XRP market data provider is temporarily unavailable.');
        const payload = await response.json() as Record<string, any>;
        const quote = payload.ripple;
        if (!quote || !Number(quote.usd) || !Number(quote.zar)) {
          throw new Error('XRP market response did not include USD and ZAR prices.');
        }
        const prices: Record<string, number> = {};
        for (const code of currencies.split(',')) {
          const value = Number(quote[code]);
          if (Number.isFinite(value) && value > 0) prices[code.toUpperCase()] = value;
        }
        return json({
          asset: 'XRP',
          network: 'Market data only, not a wallet balance',
          prices,
          change24hPercent: Number(quote.usd_24h_change || 0),
          source: 'CoinGecko',
          updatedAt: quote.last_updated_at ? new Date(quote.last_updated_at * 1000).toISOString() : new Date().toISOString(),
          quoteType: 'Indicative market price. Exchange spreads, liquidity, network fees and payout fees are excluded.',
        });
      } catch (err) {
        return error(err instanceof Error ? err.message : 'XRP market quote unavailable.', 503);
      }
    },
  ],
  'POST /api/fx/quote': [
    async ({ body }) => {
      const input = body as { amount?: number; country?: FxCountry };
      const amount = Number(input.amount);
      const country = input.country as FxCountry;
      if (!Number.isFinite(amount) || amount <= 0 || amount > 10000 || !COUNTRY_CURRENCIES[country]) {
        return error('Enter a valid RLUSD amount and destination country.', 400);
      }
      try {
        const { rates, timestamp } = await getFxRates();
        const localCurrency = COUNTRY_CURRENCIES[country];
        const localAmount = amount * Number(rates[localCurrency]);
        const zarAmount = amount * Number(rates.ZAR);
        return json({
          amount,
          sourceCurrency: 'RLUSD',
          assumedUsdPeg: 1,
          localCurrency,
          localAmount: Number(localAmount.toFixed(2)),
          zarAmount: Number(zarAmount.toFixed(2)),
          rate: Number(Number(rates[localCurrency]).toFixed(6)),
          zarRate: Number(Number(rates.ZAR).toFixed(6)),
          timestamp,
          quoteType: 'Indicative FX estimate. RLUSD/USD spread, provider fees and payout fees are excluded.',
        });
      } catch (err) {
        return error(err instanceof Error ? err.message : 'Live exchange quote unavailable.', 503);
      }
    },
  ],
  'POST /api/xrpl/preflight': [
    async ({ body }) => {
      const input = body as { sourceAddress?: string; destinationAddress?: string; amount?: number };
      const source = input.sourceAddress?.trim() || '';
      const destination = input.destinationAddress?.trim() || '';
      const amount = Number(input.amount);
      const classicAddress = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
      if (!classicAddress.test(source) || !classicAddress.test(destination) || source === destination ||
          !Number.isFinite(amount) || amount <= 0 || amount > 10000) {
        return error('Enter valid, different XRPL sender and recipient addresses and an amount up to 10,000 RLUSD.', 400);
      }
      try {
        const result = await verifyPaymentAccounts(source, destination, amount);
        return json({
          verified: true,
          network: 'XRPL Testnet',
          issuer: result.issuer,
          senderRlusdBalance: result.sourceBalance,
          recipientTrustLineLimit: result.destinationLimit,
          ledgerIndex: result.ledgerIndex,
          payment: {
            TransactionType: 'Payment',
            Account: source,
            Destination: destination,
            Amount: {
              currency: RLUSD_CURRENCY,
              issuer: result.issuer,
              value: amount.toFixed(2),
            },
          },
          signing: 'Not signed. Owner signature is still required.',
        });
      } catch (err) {
        return error(err instanceof Error ? err.message : 'XRPL account verification failed.', 422);
      }
    },
  ],
  'GET /api/transactions': [
    async () => {
      try {
        const result = await db.list<Record<string, any>>('spaza_wallet_transactions', { limit: 100 });
        const transactions = result.items
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
          .map(row => {
            const email = String(row.email || '');
            const parts = email.split('@');
            const userLabel = row.userLabel || (parts.length === 2
              ? parts[0].slice(0, 1) + '***@' + parts[1]
              : 'SmartSpaza demo user');
            return { ...row, email: undefined, userLabel };
          });
        return json({ transactions, refreshedAt: new Date().toISOString() });
      } catch {
        return error('Shared transactions could not be loaded.', 503);
      }
    },
  ],
  'GET /api/wallet': [
    async ({ query }) => {
      const email = String(query?.email || '').trim().toLowerCase();
      if (!isValidEmail(email)) return error('Enter a valid wallet email address.', 400);
      const walletId = 'wallet-' + encodeURIComponent(email);
      try {
        let [account] = await db.get<Record<string, any>>('spaza_wallet_accounts', [walletId], { consistent: true });
        if (!account) {
          const openingBalance = email === 'demo.user@example.com' ? 10000 : 0;
          await db.tx.add('spaza_wallet_accounts', [{
            id: walletId,
            email,
            balance: openingBalance,
            currency: 'ZAR',
            xrpBalance: 0,
            demoSeeded: email === 'demo.user@example.com',
            createdAt: new Date().toISOString(),
          }]);
          [account] = await db.get<Record<string, any>>('spaza_wallet_accounts', [walletId], { consistent: true });
        }
        const result = await db.list<Record<string, any>>('spaza_wallet_transactions', { limit: 200 });
        const transactions = result.items.filter(row => row.email === email).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        return json({ account: account || { email, balance: 0, currency: 'ZAR' }, transactions });
      } catch {
        return error('Wallet data could not be loaded.', 503);
      }
    },
  ],
  'POST /api/wallet/transfer': [
    async ({ body }) => {
      const input = body as Record<string, unknown>;
      const senderEmail = String(input.email || '').trim().toLowerCase();
      const recipientEmail = String(input.recipientEmail || '').trim().toLowerCase();
      const amount = Number(input.amount);
      const requestId = String(input.requestId || '').trim();
      const validEmail = isValidEmail;
      if (!validEmail(senderEmail) || !validEmail(recipientEmail) || senderEmail === recipientEmail || !Number.isFinite(amount) || amount <= 0 || amount > 100000 || !/^[A-Za-z0-9-]{12,80}$/.test(requestId)) {
        return error('Enter different valid wallet emails, an amount up to R100,000 and a unique request reference.', 400);
      }
      const receiptId = 'xfer-' + requestId;
      const senderId = 'wallet-' + encodeURIComponent(senderEmail);
      const recipientId = 'wallet-' + encodeURIComponent(recipientEmail);
      const value = Number(amount.toFixed(2));
      try {
        await db.list('spaza_wallet_transfer_receipts', { limit: 1 });
        const [prior] = await db.get<Record<string, any>>('spaza_wallet_transfer_receipts', [receiptId], { consistent: true });
        if (prior) {
          if (prior.senderEmail !== senderEmail || prior.recipientEmail !== recipientEmail || Number(prior.amount) !== value) return error('This request reference belongs to a different transfer.', 409);
          return json({ status: 'Completed (Demo)', reference: receiptId, replayed: true, message: 'This demo transfer was already completed.' });
        }
        const [sender] = await db.get<Record<string, any>>('spaza_wallet_accounts', [senderId], { consistent: true });
        let [recipient] = await db.get<Record<string, any>>('spaza_wallet_accounts', [recipientId], { consistent: true });
        if (!sender) return error('Load the sender wallet before sending demo funds.', 404);
        if (!recipient) {
          const [createdId] = await db.tx.add('spaza_wallet_accounts', [{ id: recipientId, email: recipientEmail, balance: 0, currency: 'ZAR', xrpBalance: 0, createdAt: new Date().toISOString() }]);
          [recipient] = await db.get<Record<string, any>>('spaza_wallet_accounts', [recipientId], { consistent: true });
          if (!createdId && !recipient) return error('Recipient wallet could not be created.', 503);
        }
        if (!recipient) return error('Recipient wallet could not be loaded.', 503);
        if (Number(sender.balance || 0) < value) return error('Insufficient ZAR demo balance.', 409);
        const now = new Date().toISOString();
        const reference = 'DEMO-TRF-' + requestId;
        const senderUpdate = db.tx.update('spaza_wallet_accounts', [{ id: senderId, record: { ...sender, balance: Number((Number(sender.balance || 0) - value).toFixed(2)), updatedAt: now }, if: { balance: Number(sender.balance || 0) } }]);
        const recipientUpdate = db.tx.update('spaza_wallet_accounts', [{ id: recipientId, record: { ...recipient, balance: Number((Number(recipient.balance || 0) + value).toFixed(2)), updatedAt: now }, if: { balance: Number(recipient.balance || 0) } }]);
        const activity = db.tx.add('spaza_wallet_transactions', [
          { id: reference + '-OUT', email: senderEmail, type: 'transfer', flow: 'sent', amount: value, currency: 'ZAR', status: 'Completed (Demo)', method: 'Internal SmartSpaza wallet', recipient: recipientEmail, reference, createdAt: now },
          { id: reference + '-IN', email: recipientEmail, type: 'transfer', flow: 'received', amount: value, currency: 'ZAR', status: 'Completed (Demo)', method: 'Internal SmartSpaza wallet', sender: senderEmail, reference, createdAt: now },
        ]);
        const receipt = db.tx.add('spaza_wallet_transfer_receipts', [{ id: receiptId, senderEmail, recipientEmail, amount: value, currency: 'ZAR', reference, status: 'Completed (Demo)', createdAt: now }]);
        const [senderSaved, recipientSaved, [outId, inId], [receiptSaved]] = await db.transact([senderUpdate, recipientUpdate, activity, receipt]);
        if (!senderSaved || !recipientSaved || !outId || !inId || !receiptSaved) return error('Transfer was not committed. Reload both wallets and check the activity feed.', 409);
        return json({ status: 'Completed (Demo)', reference, senderBalance: Number((Number(sender.balance || 0) - value).toFixed(2)), recipientBalance: Number((Number(recipient.balance || 0) + value).toFixed(2)), message: 'Demo funds moved between both SmartSpaza wallets. No bank or blockchain funds moved.' }, 201);
      } catch (err) {
        console.error('Internal demo transfer failed', err);
        return error(err instanceof Error ? err.message : 'Demo transfer could not be completed.', 503);
      }
    },
  ],
  'POST /api/xrp/verify': [
    async ({ body }) => {
      const input = body as Record<string, unknown>;
      const email = String(input.email || '').trim().toLowerCase();
      const senderAddress = String(input.senderAddress || '').trim();
      const destinationAddress = String(input.destinationAddress || '').trim();
      const txHash = String(input.txHash || '').trim().toUpperCase();
      const network = String(input.network || 'testnet');
      const direction = String(input.direction || 'deposit');
      const validAddress = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
      if (!isValidEmail(email) || !validAddress.test(senderAddress) || !validAddress.test(destinationAddress) || senderAddress === destinationAddress || !/^[A-F0-9]{64}$/.test(txHash) || !['mainnet', 'testnet'].includes(network) || !['deposit', 'withdrawal'].includes(direction)) {
        return error('Enter a valid wallet email, sender and recipient addresses, transaction hash, network and direction.', 400);
      }
      try {
        const txResult = await xrplRequest('tx', { transaction: txHash, binary: false }, network as 'mainnet' | 'testnet');
        const tx = txResult as Record<string, any>;
        const meta = (tx.meta || tx.metaData || {}) as Record<string, any>;
        const drops = typeof tx.Amount === 'string' ? Number(tx.Amount) : NaN;
        if (!tx.validated || meta.TransactionResult !== 'tesSUCCESS' || tx.TransactionType !== 'Payment' || tx.Account !== senderAddress || tx.Destination !== destinationAddress || !Number.isFinite(drops) || drops <= 0) {
          return error('No validated native XRP payment matching these sender and recipient details was found.', 422);
        }
        const reference = 'XRPL-' + network.toUpperCase() + '-' + txHash;
        const [prior] = await db.get<Record<string, any>>('spaza_wallet_transactions', [reference], { consistent: true });
        if (prior) return json({ status: prior.status, amount: prior.amount, reference, txHash, replayed: true, message: 'This XRPL transaction is already recorded.' });
        const amountXrp = Number((drops / 1000000).toFixed(6));
        const [savedId] = await db.tx.add('spaza_wallet_transactions', [{ id: reference, email, type: direction === 'deposit' ? 'xrp_deposit' : 'xrp_withdrawal', amount: amountXrp, currency: 'XRP', status: 'Confirmed on XRPL ' + (network === 'mainnet' ? 'Mainnet' : 'Testnet'), method: 'Validated XRPL Payment', senderAddress, recipientAddress: destinationAddress, txHash, reference, createdAt: new Date().toISOString(), balanceCredited: false }]);
        if (!savedId) return error('XRPL transaction was already recorded or the activity log could not be saved.', 409);
        return json({ status: 'Confirmed on XRPL ' + (network === 'mainnet' ? 'Mainnet' : 'Testnet'), amount: amountXrp, currency: 'XRP', senderAddress, destinationAddress, txHash, reference, balanceCredited: false, message: 'The validated XRP transfer was recorded. SmartSpaza has not credited an app balance or signed a payment.' }, 201);
      } catch (err) {
        return error(err instanceof Error ? err.message : 'XRPL transaction verification failed.', 422);
      }
    },
  ],
  'GET /api/fx/zar-rlusd-quote': [
    async ({ query }) => {
      const zarAmount = Number(query?.zarAmount || 0);
      if (!Number.isFinite(zarAmount) || zarAmount <= 0 || zarAmount > 100000) {
        return error('Enter a valid ZAR amount up to R100,000.', 400);
      }
      try {
        const { rates, timestamp } = await getFxRates();
        const zarPerRlusd = Number(rates.ZAR);
        if (!Number.isFinite(zarPerRlusd) || zarPerRlusd <= 0) return error('A valid ZAR exchange rate is unavailable.', 503);
        const rlusdAmount = Number((zarAmount / zarPerRlusd).toFixed(6));
        return json({ quote: { zarAmount: Number(zarAmount.toFixed(2)), rlusdAmount, zarPerRlusd, timestamp, sourceCurrency: 'ZAR', destinationCurrency: 'RLUSD', quoteType: 'Indicative demo conversion; RLUSD is assumed to track USD 1:1. Provider spreads and fees are not included.' } });
      } catch (err) {
        return error(err instanceof Error ? err.message : 'Current ZAR/RLUSD quote unavailable.', 503);
      }
    },
  ],
  'POST /api/wallet/deposit': [
    async ({ body }) => {
      const input = body as Record<string, unknown>;
      const email = String(input.email || '').trim().toLowerCase();
      const amount = Number(input.amount);
      const last4 = String(input.cardLast4 || '');
      const cardType = String(input.cardType || 'Card');
      const cardholderName = String(input.cardholderName || '').trim();
      const targetWallet = String(input.targetWallet || 'personal_zar');
      if (!isValidEmail(email) || !Number.isFinite(amount) || amount <= 0 || amount > 100000 ||
          !/^\d{4}$/.test(last4) || !cardholderName || !['Visa', 'Mastercard', 'Virtual card'].includes(cardType) ||
          !['personal_zar', 'store_rlusd'].includes(targetWallet)) {
        return error('Enter a valid email, amount, destination and card details using only the final four digits.', 400);
      }
      try {
        const value = Number(amount.toFixed(2));
        const now = new Date().toISOString();
        const reference = 'DEMO-CARD-' + (targetWallet === 'store_rlusd' ? 'RLUSD-' : 'ZAR-') + Date.now().toString(36).toUpperCase();
        if (targetWallet === 'personal_zar') {
          const walletId = 'wallet-' + encodeURIComponent(email);
          const [account] = await db.get<Record<string, any>>('spaza_wallet_accounts', [walletId], { consistent: true });
          if (!account) return error('Load or create your personal ZAR demo wallet before depositing.', 404);
          const updatedBalance = Number((Number(account.balance || 0) + value).toFixed(2));
          const update = db.tx.update('spaza_wallet_accounts', [{ id: walletId, record: { ...account, balance: updatedBalance, updatedAt: now }, if: { balance: account.balance || 0 } }]);
          const log = db.tx.add('spaza_wallet_transactions', [{
            id: reference, email, type: 'deposit', amount: value, currency: 'ZAR',
            status: 'Completed (Demo)', method: cardType + ' •••• ' + last4,
            cardholderName, reference, createdAt: now, destination: 'Personal ZAR demo account',
          }]);
          const [saved, [transactionId]] = await db.transact([update, log]);
          if (!saved || !transactionId) return error('Personal ZAR wallet balance changed. Reload and retry.', 409);
          return json({ status: 'Completed (Demo)', balance: updatedBalance, currency: 'ZAR', reference, targetWallet, message: 'Demo deposit credited to your personal ZAR wallet. No card was charged and no real funds were received.' }, 201);
        }

        const { shop } = await ensureRlusdDemoAccounts();
        const { rates, timestamp } = await getFxRates();
        const zarPerRlusd = Number(rates.ZAR);
        if (!Number.isFinite(zarPerRlusd) || zarPerRlusd <= 0) return error('A valid current ZAR/RLUSD rate is unavailable. No deposit was recorded.', 503);
        const rlusdValue = Number((value / zarPerRlusd).toFixed(6));
        if (rlusdValue <= 0) return error('The converted RLUSD amount is too small to record.', 400);
        const shopBalance = Number(shop.balance || 0);
        const updatedBalance = Number((shopBalance + rlusdValue).toFixed(6));
        const update = db.tx.update('spaza_rlusd_demo_wallets', [{
          id: 'shop', record: { ...shop, balance: updatedBalance, updatedAt: now }, if: { balance: shop.balance || 0 },
        }]);
        const activity = db.tx.add('spaza_wallet_transactions', [{
          id: reference, userLabel: 'SmartSpaza Store', email, type: 'card_deposit',
          amount: rlusdValue, currency: 'RLUSD', sourceAmount: value, sourceCurrency: 'ZAR',
          fxRate: zarPerRlusd, fxTimestamp: timestamp, status: 'Completed (Demo)',
          method: cardType + ' •••• ' + last4, cardholderName, reference, createdAt: now,
          destination: 'Store RLUSD demo account',
        }]);
        const [saved, [transactionId]] = await db.transact([update, activity]);
        if (!saved || !transactionId) return error('Store RLUSD balance changed. Reload and retry.', 409);
        return json({
          status: 'Completed (Demo)', balance: updatedBalance, currency: 'RLUSD',
          sourceAmount: value, sourceCurrency: 'ZAR', convertedAmount: rlusdValue,
          fxRate: zarPerRlusd, fxTimestamp: timestamp, reference, targetWallet,
          message: `Demo deposit converted R${value.toFixed(2)} to ${rlusdValue.toFixed(6)} RLUSD using an indicative rate of R${zarPerRlusd.toFixed(4)} per RLUSD. No card was charged and no real funds or tokens were received.`,
        }, 201);
      } catch (err) {
        return error(err instanceof Error ? err.message : 'Demo card deposit could not be recorded.', 503);
      }
    },
  ],
  'POST /api/wallet/withdraw': [
    async ({ body }) => {
      const input = body as Record<string, unknown>;
      const email = String(input.email || '').trim().toLowerCase();
      const amount = Number(input.amount);
      const last4 = String(input.cardLast4 || '');
      const cardType = String(input.cardType || 'Card');
      const cardholderName = String(input.cardholderName || '').trim();
      const sessionId = String(input.faceSessionId || '');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !Number.isFinite(amount) || amount <= 0 || amount > 100000 ||
          !/^\d{4}$/.test(last4) || !cardholderName || !sessionId) {
        return error('Enter a valid wallet email, amount, card details and completed face-auth demo session.', 400);
      }
      try {
        const [session] = await db.get<Record<string, any>>('spaza_face_sessions', [sessionId], { consistent: true });
        if (!session || session.email !== email || session.status !== 'DEMO_VERIFIED' || new Date(session.expiresAt).getTime() < Date.now()) {
          return error('Face-auth demo session is invalid or expired. Run the check again.', 403);
        }
        const walletId = 'wallet-' + encodeURIComponent(email);
        const [account] = await db.get<Record<string, any>>('spaza_wallet_accounts', [walletId], { consistent: true });
        if (!account) return error('Wallet not found. Load the wallet first.', 404);
        if (Number(account.balance || 0) < amount) return error('Insufficient demo wallet balance.', 409);
        const now = new Date().toISOString();
        const reference = 'DEMO-WDR-' + Date.now().toString(36).toUpperCase();
        const updated = { ...account, balance: Number((Number(account.balance) - amount).toFixed(2)), updatedAt: now };
        const update = db.tx.update('spaza_wallet_accounts', [{ id: walletId, record: updated, if: { balance: account.balance } }]);
        const log = db.tx.add('spaza_wallet_transactions', [{ email, type: 'withdrawal', amount: Number(amount.toFixed(2)), currency: 'ZAR', status: 'Demo completed', method: cardType + ' •••• ' + last4, cardholderName, reference, createdAt: now, faceAuth: 'DEMO_VERIFIED' }]);
        const [saved, [transactionId]] = await db.transact([update, log]);
        if (!saved || !transactionId) return error('Wallet balance changed. Reload and retry.', 409);
        await db.update('spaza_face_sessions', [{ id: sessionId, record: { ...session, status: 'CONSUMED' } }]);
        return json({ status: 'Demo completed', balance: updated.balance, reference, message: 'Demo card withdrawal recorded. No payout was sent.' }, 201);
      } catch {
        return error('Demo withdrawal could not be recorded.', 503);
      }
    },
  ],
  'POST /api/face-auth/session': [
    async ({ body }) => {
      const input = body as Record<string, unknown>;
      const email = String(input.email || '').trim().toLowerCase();
      if (!isValidEmail(email)) return error('Enter a valid wallet email.', 400);
      const sessionId = 'face-demo-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      const now = Date.now();
      const expiresAt = new Date(now + 5 * 60 * 1000).toISOString();
      try {
        await db.tx.add('spaza_face_sessions', [{ id: sessionId, email, purpose: String(input.purpose || 'wallet_withdrawal'), status: 'PENDING_DEMO', createdAt: new Date(now).toISOString(), expiresAt }]);
        return json({ sessionId, status: 'PENDING_DEMO', expiresAt, mode: 'SIMULATION' }, 201);
      } catch {
        return error('Face-auth session could not be created.', 503);
      }
    },
  ],
  'POST /api/face-auth/verify': [
    async ({ body }) => {
      const input = body as Record<string, unknown>;
      const email = String(input.email || '').trim().toLowerCase();
      const sessionId = String(input.sessionId || '');
      if (!input.consent || input.demoApproval !== true) return error('Explicit consent and demo approval are required.', 400);
      try {
        const [session] = await db.get<Record<string, any>>('spaza_face_sessions', [sessionId], { consistent: true });
        if (!session || session.email !== email || session.status !== 'PENDING_DEMO' || new Date(session.expiresAt).getTime() < Date.now()) {
          return error('Face-auth session is invalid or expired.', 403);
        }
        const verified = { ...session, status: 'DEMO_VERIFIED', verifiedAt: new Date().toISOString() };
        const [saved] = await db.update('spaza_face_sessions', [{ id: sessionId, record: verified }]);
        if (!saved) return error('Face-auth session could not be verified.', 503);
        return json({ status: 'DEMO_VERIFIED', expiresAt: session.expiresAt, provider: 'SmartSpaza demo face-auth adapter', biometricMatchPerformed: false });
      } catch {
        return error('Face-auth verification failed.', 503);
      }
    },
  ],
  'GET /api/owner': [
    async () => {
      try {
        let [profile] = await db.get<Record<string, unknown>>(OWNER, ['profile'], { consistent: true });
        if (!profile) {
          await db.tx.add(OWNER, [{
            id: 'profile',
            fullName: '',
            businessName: '',
            registrationNumber: '',
            email: '',
            phone: '',
            address: '',
            country: 'South Africa',
            settlementCurrency: 'ZAR',
            preferredPayoutMethod: 'Bank transfer',
          }]);
          [profile] = await db.get<Record<string, unknown>>(OWNER, ['profile'], { consistent: true });
        }
        return json(profile || {});
      } catch {
        return error('Owner profile could not be loaded.', 503);
      }
    },
  ],
  'PUT /api/owner': [
    async ({ body }) => {
      const input = body as Record<string, unknown>;
      const fields = ['fullName', 'businessName', 'registrationNumber', 'email', 'phone', 'address', 'country', 'settlementCurrency', 'preferredPayoutMethod'];
      const record: Record<string, unknown> = {};
      for (const field of fields) {
        const value = String(input[field] ?? '').trim();
        if (value.length > 240) return error('Owner profile fields must be 240 characters or fewer.', 400);
        record[field] = value;
      }
      if (!record.fullName || !record.businessName || !record.email || !record.phone) {
        return error('Enter the owner name, business name, email and phone number.', 400);
      }
      try {
        await db.get<Record<string, unknown>>(OWNER, ['profile'], { consistent: true }).then(async ([profile]) => {
          if (!profile) await db.tx.add(OWNER, [{ id: 'profile', ...record }]);
          else {
            const [saved] = await db.tx.update(OWNER, [{ id: 'profile', record, if: { fullName: profile.fullName } }], { patch: true });
            if (!saved) throw new Error('Owner profile changed during the update. Reload and retry.');
          }
        });
        return json({ saved: true, message: 'Owner profile updated.' });
      } catch (err) {
        return error(err instanceof Error ? err.message : 'Owner profile could not be saved.', 503);
      }
    },
  ],
  'GET /api/suppliers': [
    async () => {
      try {
        const result = await db.list<Record<string, any>>(SUPPLIERS, { limit: 100 });
        const paymentResult = await db.list<Record<string, any>>(SUPPLIER_PAYMENTS, { limit: 200 });
        const suppliers = await Promise.all(result.items.map(async supplier => {
          const [wallet] = await db.get<Record<string, any>>('spaza_rlusd_demo_wallets', ['supplier-' + supplier.id], { consistent: true });
          return {
            ...supplier,
            rlusdBalance: Number(wallet?.balance || 0),
            rlusdPaymentHistory: paymentResult.items
              .filter(payment => payment.supplierId === supplier.id && payment.currency === 'RLUSD')
              .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
          };
        }));
        return json(suppliers);
      } catch {
        return error('Supplier list could not be loaded.', 503);
      }
    },
  ],
  'POST /api/suppliers': [
    async ({ body }) => {
      const input = body as Record<string, unknown>;
      const name = String(input.name || '').trim();
      const country = String(input.country || '').trim();
      if (name.length < 2 || !country || name.length > 120) return error('Enter a supplier name and country.', 400);
      const email = String(input.email || '').trim();
      const phone = String(input.phone || '').trim();
      if ((email && !isValidEmail(email)) || !isValidInternationalPhone(phone)) return error('Enter a valid supplier email and an international phone number (include country code).', 400);
      const record = {
        name,
        country,
        email,
        phone,
        contactName: String(input.contactName || '').trim(),
        bankName: String(input.bankName || '').trim(),
        accountName: String(input.accountName || '').trim(),
        accountNumber: String(input.accountNumber || '').trim(),
        bankCode: String(input.bankCode || '').trim(),
        mobileWallet: String(input.mobileWallet || '').trim(),
        xrplAddress: String(input.xrplAddress || '').trim(),
        createdAt: new Date().toISOString(),
      };
      try {
        const [id] = await db.add(SUPPLIERS, [record]);
        if (!id) return error('Supplier was not saved.', 503);
        return json({ id, ...record, message: 'Supplier saved.' }, 201);
      } catch {
        return error('Supplier was not saved.', 503);
      }
    },
  ],
  'PUT /api/suppliers/:id': [
    async ({ params, body }) => {
      const input = body as Record<string, unknown>;
      const name = String(input.name || '').trim();
      const country = String(input.country || '').trim();
      if (name.length < 2 || !country) return error('Enter a supplier name and country.', 400);
      const email = String(input.email || '').trim();
      const phone = String(input.phone || '').trim();
      if ((email && !isValidEmail(email)) || !isValidInternationalPhone(phone)) return error('Enter a valid supplier email and an international phone number (include country code).', 400);
      try {
        const [old] = await db.get<Record<string, unknown>>(SUPPLIERS, [params.id], { consistent: true });
        if (!old) return error('Supplier was not found.', 404);
        const record = {
          ...old, name, country,
          email,
          phone,
          contactName: String(input.contactName || '').trim(),
          bankName: String(input.bankName || '').trim(),
          accountName: String(input.accountName || '').trim(),
          accountNumber: String(input.accountNumber || '').trim(),
          bankCode: String(input.bankCode || '').trim(),
          mobileWallet: String(input.mobileWallet || '').trim(),
          xrplAddress: String(input.xrplAddress || '').trim(),
        };
        const [saved] = await db.update(SUPPLIERS, [{ id: params.id, record }]);
        if (!saved) return error('Supplier update failed.', 503);
        return json({ saved: true, message: 'Supplier updated.' });
      } catch {
        return error('Supplier update failed.', 503);
      }
    },
  ],
  'DELETE /api/suppliers/:id': [
    async ({ params }) => {
      try {
        const [removed] = await db.delete(SUPPLIERS, [params.id]);
        return removed ? json({ deleted: true }) : error('Supplier was not found.', 404);
      } catch {
        return error('Supplier could not be deleted.', 503);
      }
    },
  ],
  'GET /api/supplier-payments': [
    async () => {
      try {
        const result = await db.list<Record<string, unknown>>(SUPPLIER_PAYMENTS, { limit: 100 });
        return json(result.items);
      } catch {
        return error('Supplier payment history could not be loaded.', 503);
      }
    },
  ],
  'POST /api/supplier-payments': [
    async ({ body }) => {
      const input = body as Record<string, unknown>;
      const supplierId = String(input.supplierId || '').trim();
      const amount = Number(input.amount);
      const currency = String(input.currency || 'ZAR').trim().toUpperCase();
      const shopWalletEmail = 'demo.user@example.com';
      if (!supplierId || !Number.isFinite(amount) || amount <= 0 || amount > 100000 || !['ZAR', 'RLUSD'].includes(currency)) {
        return error('Demo supplier payments require a supplier, a valid amount and ZAR or RLUSD currency.', 400);
      }
      try {
        const [supplier] = await db.get<Record<string, any>>(SUPPLIERS, [supplierId], { consistent: true });
        if (!supplier) return error('Select an existing supplier.', 404);
        if (currency === 'RLUSD') {
          const { shop } = await ensureRlusdDemoAccounts();
          const supplierWalletId = 'supplier-' + supplierId;
          let [supplierWallet] = await db.get<Record<string, any>>('spaza_rlusd_demo_wallets', [supplierWalletId], { consistent: true });
          if (!supplierWallet) {
            await db.tx.add('spaza_rlusd_demo_wallets', [{
              id: supplierWalletId,
              label: String(supplier.name || 'Supplier').trim() + ' RLUSD Demo Account',
              balance: 0,
              currency: 'RLUSD',
              accountType: 'supplier_demo',
              supplierId,
              createdAt: new Date().toISOString(),
            }]);
            [supplierWallet] = await db.get<Record<string, any>>('spaza_rlusd_demo_wallets', [supplierWalletId], { consistent: true });
          }
          if (!supplierWallet) return error('Supplier RLUSD demo account could not be loaded.', 503);
          const value = Number(amount.toFixed(2));
          const shopBalance = Number(shop.balance || 0);
          const supplierBalance = Number(supplierWallet.balance || 0);
          if (shopBalance < value) return error('The store demo account has insufficient RLUSD.', 409);
          const now = new Date().toISOString();
          const reference = 'SUPP-RLUSD-DEMO-' + Date.now().toString(36).toUpperCase();
          const storeUpdate = db.tx.update('spaza_rlusd_demo_wallets', [{
            id: 'shop',
            record: { ...shop, balance: Number((shopBalance - value).toFixed(2)), updatedAt: now },
            if: { balance: shop.balance || 0 },
          }]);
          const supplierUpdate = db.tx.update('spaza_rlusd_demo_wallets', [{
            id: supplierWalletId,
            record: { ...supplierWallet, balance: Number((supplierBalance + value).toFixed(2)), updatedAt: now },
            if: { balance: supplierWallet.balance || 0 },
          }]);
          const payment = db.tx.add(SUPPLIER_PAYMENTS, [{
            id: reference, supplierId, supplierName: supplier.name,
            amount: value, currency: 'RLUSD', dueDate: String(input.dueDate || ''),
            reference: String(input.reference || '').trim() || reference,
            method: 'Internal SmartSpaza RLUSD demo wallet',
            status: 'Completed (Demo)', createdAt: now, providerReference: reference,
          }]);
          const activity = db.tx.add('spaza_wallet_transactions', [
            { id: reference + '-OUT', userLabel: 'SmartSpaza Store', type: 'supplier_payment', amount: value, currency: 'RLUSD', status: 'Completed (Demo)', method: 'Store RLUSD demo wallet', recipient: String(supplier.name || 'Supplier'), reference, createdAt: now },
            { id: reference + '-IN', userLabel: String(supplier.name || 'Supplier'), type: 'supplier_receipt', amount: value, currency: 'RLUSD', status: 'Received (Demo)', method: 'Supplier RLUSD demo wallet', sender: 'SmartSpaza Store', reference, createdAt: now },
          ]);
          const [shopSaved, supplierSaved, [paymentId], [outId, inId]] = await db.transact([storeUpdate, supplierUpdate, payment, activity]);
          if (!shopSaved || !supplierSaved || !paymentId || !outId || !inId) return error('RLUSD supplier demo payment was not committed. Reload both balances and check the transaction history.', 409);
          return json({
            id: paymentId, status: 'Completed (Demo)', currency: 'RLUSD',
            storeBalance: Number((shopBalance - value).toFixed(2)),
            supplierBalance: Number((supplierBalance + value).toFixed(2)),
            message: 'RLUSD supplier payment completed in demo mode. The store RLUSD account was debited and the supplier RLUSD account was credited. No real tokens moved.',
          }, 201);
        }
        const supplierLabel = String(supplier.name || 'Supplier').trim();
        const supplierEmail = 'supplier-' + supplierId + '@demo.smartspaza';
        const shopWalletId = 'wallet-' + encodeURIComponent(shopWalletEmail);
        const supplierWalletId = 'supplier-demo-' + supplierId;
        let [shopWallet] = await db.get<Record<string, any>>('spaza_wallet_accounts', [shopWalletId], { consistent: true });
        if (!shopWallet) {
          await db.tx.add('spaza_wallet_accounts', [{
            id: shopWalletId,
            email: shopWalletEmail,
            balance: 10000,
            currency: 'ZAR',
            xrpBalance: 0,
            demoSeeded: true,
            createdAt: new Date().toISOString(),
          }]);
          [shopWallet] = await db.get<Record<string, any>>('spaza_wallet_accounts', [shopWalletId], { consistent: true });
        }
        if (!shopWallet) return error('Demo shop wallet could not be loaded.', 503);

        let [supplierWallet] = await db.get<Record<string, any>>('spaza_wallet_accounts', [supplierWalletId], { consistent: true });
        if (!supplierWallet) {
          await db.tx.add('spaza_wallet_accounts', [{
            id: supplierWalletId,
            email: supplierEmail,
            displayName: supplierLabel,
            balance: 0,
            currency: 'ZAR',
            xrpBalance: 0,
            createdAt: new Date().toISOString(),
          }]);
          [supplierWallet] = await db.get<Record<string, any>>('spaza_wallet_accounts', [supplierWalletId], { consistent: true });
        }
        if (!supplierWallet) return error('Supplier demo wallet could not be loaded.', 503);

        const value = Number(amount.toFixed(2));
        const shopBalance = Number(shopWallet.balance || 0);
        const supplierBalance = Number(supplierWallet.balance || 0);
        if (shopBalance < value) return error('The demo shop wallet has insufficient ZAR. Load demo funds first.', 409);

        const now = new Date().toISOString();
        const reference = 'SUPP-DEMO-' + Date.now().toString(36).toUpperCase();
        const senderUpdate = db.tx.update('spaza_wallet_accounts', [{
          id: shopWalletId,
          record: { ...shopWallet, balance: Number((shopBalance - value).toFixed(2)), updatedAt: now },
          if: { balance: shopWallet.balance || 0 },
        }]);
        const recipientUpdate = db.tx.update('spaza_wallet_accounts', [{
          id: supplierWalletId,
          record: { ...supplierWallet, balance: Number((supplierBalance + value).toFixed(2)), updatedAt: now },
          if: { balance: supplierWallet.balance || 0 },
        }]);
        const payment = db.tx.add(SUPPLIER_PAYMENTS, [{
          id: reference,
          supplierId,
          supplierName: supplier.name,
          supplierEmail,
          shopWalletEmail,
          amount: value,
          currency: 'ZAR',
          dueDate: String(input.dueDate || ''),
          reference: String(input.reference || '').trim() || reference,
          method: 'Internal SmartSpaza demo wallet',
          status: 'Completed (Demo)',
          createdAt: now,
          providerReference: reference,
        }]);
        const activity = db.tx.add('spaza_wallet_transactions', [
          { id: reference + '-OUT', email: shopWalletEmail, type: 'supplier_payment', amount: value, currency: 'ZAR', status: 'Completed (Demo)', method: 'Shop demo wallet', recipient: supplierEmail, reference, createdAt: now },
          { id: reference + '-IN', email: supplierEmail, userLabel: supplierLabel, type: 'supplier_receipt', amount: value, currency: 'ZAR', status: 'Received (Demo)', method: 'Supplier demo wallet', sender: shopWalletEmail, reference, createdAt: now },
        ]);
        const [shopSaved, supplierSaved, [paymentId], [outId, inId]] = await db.transact([senderUpdate, recipientUpdate, payment, activity]);
        if (!shopSaved || !supplierSaved || !paymentId || !outId || !inId) {
          return error('Supplier demo payment was not committed. Reload both wallets and check balances.', 409);
        }
        return json({
          id: paymentId,
          status: 'Completed (Demo)',
          shopWalletEmail,
          shopBalance: Number((shopBalance - value).toFixed(2)),
          supplierWalletEmail: supplierLabel,
          supplierBalance: Number((supplierBalance + value).toFixed(2)),
          message: 'Supplier payment completed in demo mode. The shop wallet was debited and the supplier demo balance was credited. No supplier email, bank account or blockchain transfer was required.',
        }, 201);
      } catch (err) {
        console.error('Demo supplier payment failed', err);
        return error(err instanceof Error ? err.message : 'Supplier demo payment failed.', 503);
      }
    },
  ],
  'PUT /api/inventory/:id': [
    async ({ params, body }) => {
      const input = body as Partial<Product>;
      if (!input.name?.trim() || !input.category?.trim() || !input.expiry ||
          !Number.isFinite(input.stock) || Number(input.stock) < 0 ||
          !Number.isFinite(input.price) || Number(input.price) < 0 ||
          !Number.isFinite(input.cost) || Number(input.cost) < 0) {
        return error('Enter a product name, category, expiry date and valid stock and price values.', 400);
      }
      try {
        const [old] = await db.get<Product>(INVENTORY, [params.id], { consistent: true });
        if (!old) return error('Inventory item was not found.', 404);
        const [saved] = await db.update(INVENTORY, [{ id: params.id, record: {
          ...old,
          name: input.name.trim(),
          category: input.category.trim(),
          stock: Number(input.stock),
          expiry: input.expiry,
          price: Number(input.price),
          originalPrice: Number(input.price),
          discountApplied: false,
          cost: Number(input.cost),
        } }]);
        return saved ? json({ saved: true, message: 'Inventory item updated.' }) : error('Inventory item update failed.', 503);
      } catch {
        return error('Inventory item update failed.', 503);
      }
    },
  ],
  'POST /api/inventory/:id/dispose': [
    async ({ params, body }) => {
      const input = body as { quantity?: number; reason?: string };
      const quantity = Number(input.quantity);
      const reason = String(input.reason || '').trim();
      if (!Number.isInteger(quantity) || quantity <= 0 || !reason || reason.length > 240) {
        return error('Enter a whole-number quantity and a disposal reason.', 400);
      }
      try {
        const [item] = await db.get<Product>(INVENTORY, [params.id], { consistent: true });
        if (!item) return error('Inventory item was not found.', 404);
        if (quantity > item.stock) return error('Disposal quantity exceeds available stock.', 409);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiryDate = new Date(item.expiry + 'T00:00:00');
        const daysRemaining = Math.floor((expiryDate.getTime() - today.getTime()) / 86400000);
        if (daysRemaining < 0 || daysRemaining > 7 || Number(item.stock) <= 0) {
          return error('Disposal action is available only for in-stock products expiring within the next seven days.', 403);
        }
        await db.list(DISPOSALS, { limit: 1 });
        const update = db.tx.update(INVENTORY, [{
          id: params.id,
          record: { stock: item.stock - quantity },
          if: { stock: item.stock },
        }], { patch: true });
        const log = db.tx.add(DISPOSALS, [{
          productId: params.id,
          productName: item.name,
          quantity,
          reason,
          date: new Date().toISOString(),
        }]);
        const [updated, [logId]] = await db.transact([update, log]);
        if (!updated || !logId) return error('Stock changed before disposal could be recorded. Reload and retry.', 409);
        return json({ saved: true, remainingStock: item.stock - quantity, message: 'Disposal recorded and stock reduced.' });
      } catch (err) {
        return error(err instanceof Error ? err.message : 'Disposal could not be recorded.', 503);
      }
    },
  ],
  'GET /api/disposals': [
    async () => {
      try {
        const result = await db.list<Record<string, unknown>>(DISPOSALS, { limit: 100 });
        return json(result.items);
      } catch {
        return error('Disposal history could not be loaded.', 503);
      }
    },
  ],
  'DELETE /api/inventory/:id': [
    async ({ params }) => {
      try {
        const [removed] = await db.delete(INVENTORY, [params.id]);
        return removed ? json({ deleted: true }) : error('Inventory item was not found.', 404);
      } catch {
        return error('Inventory item could not be removed.', 503);
      }
    },
  ],
  'POST /api/inventory': [
    async ({ body }) => {
      const input = body as Partial<Product>;
      if (!input.name?.trim() || !input.category?.trim() || !input.expiry ||
          !Number.isFinite(input.stock) || Number(input.stock) < 0 ||
          !Number.isFinite(input.price) || Number(input.price) < 0 ||
          !Number.isFinite(input.cost) || Number(input.cost) < 0) {
        return error('Enter a product name, category, expiry date and valid stock and price values.', 400);
      }
      try {
        const [id] = await db.add(INVENTORY, [{
          name: input.name.trim(),
          category: input.category.trim(),
          stock: Number(input.stock),
          expiry: input.expiry,
          price: Number(input.price),
          originalPrice: Number(input.price),
          discountApplied: false,
          cost: Number(input.cost),
        }]);
        if (!id) return error('The product was not saved. Please retry.', 503);
        return json({ id, message: 'Product added to inventory.' }, 201);
      } catch {
        return error('Product could not be saved.', 503);
      }
    },
  ],
  'GET /api/rlusd/demo-account': [
    async () => {
      try {
        const { shop, funding } = await ensureRlusdDemoAccounts();
        return json({
          status: 'Available',
          balance: Number(shop.balance || 0),
          currency: 'RLUSD',
          fundingPoolBalance: Number(funding.balance || 0),
          accountType: 'Internal demo ledger',
          source: 'SmartSpaza demo funding pool',
          updatedAt: shop.updatedAt || shop.createdAt,
        });
      } catch (err) {
        return error(err instanceof Error ? err.message : 'Store RLUSD demo account could not load.', 503);
      }
    },
  ],
  'POST /api/rlusd/demo-deposit': [
    async ({ body }) => {
      const input = body as Record<string, unknown>;
      const amount = Number(input.amount);
      const requestId = String(input.requestId || '').trim();
      if (!Number.isFinite(amount) || amount <= 0 || amount > 10000 || !/^[A-Za-z0-9-]{12,80}$/.test(requestId)) {
        return error('Enter a valid demo RLUSD deposit amount up to 10,000 RLUSD.', 400);
      }
      const receiptId = 'rlusd-deposit-' + requestId;
      try {
        const [prior] = await db.get<Record<string, any>>('spaza_rlusd_demo_receipts', [receiptId], { consistent: true });
        if (prior) return json({ status: 'Completed (Demo)', reference: prior.reference, replayed: true, message: 'This demo deposit was already credited.' });
        const { shop, funding } = await ensureRlusdDemoAccounts();
        const value = Number(amount.toFixed(2));
        const shopBalance = Number(shop.balance || 0);
        const fundingBalance = Number(funding.balance || 0);
        if (fundingBalance < value) return error('The SmartSpaza demo funding pool has insufficient RLUSD.', 409);
        const now = new Date().toISOString();
        const reference = 'RLUSD-DEPOSIT-' + requestId;
        const poolUpdate = db.tx.update('spaza_rlusd_demo_wallets', [{
          id: 'demo-funding-pool',
          record: { ...funding, balance: Number((fundingBalance - value).toFixed(2)), updatedAt: now },
          if: { balance: funding.balance || 0 },
        }]);
        const storeUpdate = db.tx.update('spaza_rlusd_demo_wallets', [{
          id: 'shop',
          record: { ...shop, balance: Number((shopBalance + value).toFixed(2)), updatedAt: now },
          if: { balance: shop.balance || 0 },
        }]);
        const receipt = db.tx.add('spaza_rlusd_demo_receipts', [{
          id: receiptId, reference, amount: value, currency: 'RLUSD', status: 'Completed (Demo)',
          source: 'SmartSpaza Demo Funding Pool', destination: 'SmartSpaza Store RLUSD Account', createdAt: now,
        }]);
        const activity = db.tx.add('spaza_wallet_transactions', [{
          id: reference, userLabel: 'SmartSpaza Store', type: 'deposit', amount: value, currency: 'RLUSD',
          status: 'Completed (Demo)', method: 'Internal demo funding pool', reference, createdAt: now,
        }]);
        const [poolSaved, shopSaved, [receiptSaved], [activitySaved]] = await db.transact([poolUpdate, storeUpdate, receipt, activity]);
        if (!poolSaved || !shopSaved || !receiptSaved || !activitySaved) {
          return error('The demo deposit was not committed. Reload the store account before retrying.', 409);
        }
        return json({
          status: 'Completed (Demo)', reference, amount: value, currency: 'RLUSD',
          storeBalance: Number((shopBalance + value).toFixed(2)),
          fundingPoolBalance: Number((fundingBalance - value).toFixed(2)),
          message: 'Demo RLUSD deposit completed. The funding pool was debited and the store account was credited. No real money or XRPL token moved.',
        }, 201);
      } catch (err) {
        console.error('Store RLUSD demo deposit failed', err);
        return error(err instanceof Error ? err.message : 'Demo RLUSD deposit failed.', 503);
      }
    },
  ],
  'POST /api/transfers/demo': [
    async ({ body }) => {
      const input = body as Record<string, unknown>;
      const recipient = String(input.recipient || '').trim();
      const country = String(input.country || '').trim();
      const amount = Number(input.amount);
      const requestId = String(input.requestId || '').trim();
      const emailContact = isValidEmail(recipient);
      const phoneDigits = recipient.replace(/\D/g, '');
      const phoneContact = /^\+?[0-9() .-]{7,20}$/.test(recipient) && phoneDigits.length >= 7 && phoneDigits.length <= 15;
      if (!emailContact && !phoneContact) {
        return error('Enter a valid recipient email address or cell phone number.', 400);
      }
      if (recipient.length > 100) return error('Recipient contact details are too long.', 400);
      if (!COUNTRY_CURRENCIES[country]) return error('Select a supported destination country.', 400);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) {
        return error('Enter an RLUSD amount greater than 0 and no more than 10,000.', 400);
      }
      if (!/^[A-Za-z0-9-]{12,80}$/.test(requestId)) {
        return error('The payment reference is invalid. Please submit again.', 400);
      }
      const normalizedContact = emailContact ? recipient.toLowerCase() : '+' + phoneDigits;
      const shopId = 'shop';
      const recipientId = 'recipient-' + encodeURIComponent(normalizedContact);
      const receiptId = 'rlusd-demo-' + requestId;
      const value = Number(amount.toFixed(2));
      try {
        const [prior] = await db.get<Record<string, any>>('spaza_rlusd_demo_receipts', [receiptId], { consistent: true });
        if (prior) return json({ status: 'Completed (Demo)', reference: receiptId, replayed: true, message: 'This RLUSD demo payment was already completed.' });
        await ensureRlusdDemoAccounts();
        let [shop] = await db.get<Record<string, any>>('spaza_rlusd_demo_wallets', [shopId], { consistent: true });
        let [receiver] = await db.get<Record<string, any>>('spaza_rlusd_demo_wallets', [recipientId], { consistent: true });
        if (!receiver) {
          await db.tx.add('spaza_rlusd_demo_wallets', [{ id: recipientId, label: recipient, country, balance: 0, currency: 'RLUSD', createdAt: new Date().toISOString() }]);
          [receiver] = await db.get<Record<string, any>>('spaza_rlusd_demo_wallets', [recipientId], { consistent: true });
        }
        if (!shop || !receiver) return error('Demo RLUSD wallets could not be loaded.', 503);
        const shopBalance = Number(shop.balance || 0);
        const receiverBalance = Number(receiver.balance || 0);
        if (shopBalance < value) return error('The shop demo RLUSD wallet has insufficient funds.', 409);
        const now = new Date().toISOString();
        const reference = 'RLUSD-DEMO-' + requestId;
        let fx: any = null;
        try {
          const rates = await getFxRates();
          const localCurrency = COUNTRY_CURRENCIES[country];
          fx = { localCurrency, localAmount: Number((value * Number(rates.rates[localCurrency])).toFixed(2)), fxTimestamp: rates.timestamp };
        } catch {
          fx = null;
        }
        const senderUpdate = db.tx.update('spaza_rlusd_demo_wallets', [{ id: shopId, record: { ...shop, balance: Number((shopBalance - value).toFixed(2)), updatedAt: now }, if: { balance: shop.balance || 0 } }]);
        const recipientUpdate = db.tx.update('spaza_rlusd_demo_wallets', [{ id: recipientId, record: { ...receiver, balance: Number((receiverBalance + value).toFixed(2)), updatedAt: now }, if: { balance: receiver.balance || 0 } }]);
        const transfer = db.tx.add(TRANSFERS, [{
          id: reference, recipient, country, amount: value, currency: 'RLUSD',
          status: 'Completed (Demo)', date: isoDate(), localAmount: fx?.localAmount,
          localCurrency: fx?.localCurrency, fxTimestamp: fx?.fxTimestamp,
          ledgerResult: 'Internal demo settlement, no XRPL transaction submitted',
        }]);
        const receipt = db.tx.add('spaza_rlusd_demo_receipts', [{
          id: receiptId, reference, recipient, country, amount: value, currency: 'RLUSD',
          status: 'Completed (Demo)', createdAt: now,
        }]);
        const activity = db.tx.add('spaza_wallet_transactions', [
          { id: reference + '-OUT', userLabel: 'SmartSpaza Shop', type: 'global_transfer', flow: 'sent', amount: value, currency: 'RLUSD', status: 'Completed (Demo)', method: 'Internal RLUSD demo wallet', recipient, country, reference, createdAt: now },
          { id: reference + '-IN', userLabel: recipient, type: 'global_transfer', flow: 'received', amount: value, currency: 'RLUSD', status: 'Received (Demo)', method: 'Internal RLUSD demo wallet', sender: 'SmartSpaza Shop', country, reference, createdAt: now },
        ]);
        const [shopSaved, receiverSaved, [transferId], [receiptSaved], [outId, inId]] = await db.transact([senderUpdate, recipientUpdate, transfer, receipt, activity]);
        if (!shopSaved || !receiverSaved || !transferId || !receiptSaved || !outId || !inId) {
          return error('The RLUSD demo payment was not committed. Check the shop and recipient balances before retrying.', 409);
        }
        return json({
          id: transferId, status: 'Completed (Demo)', reference,
          amount: value, currency: 'RLUSD',
          shopBalance: Number((shopBalance - value).toFixed(2)),
          recipientBalance: Number((receiverBalance + value).toFixed(2)),
          localAmount: fx?.localAmount, localCurrency: fx?.localCurrency,
          message: 'RLUSD demo payment completed immediately. The shop demo balance was debited and the recipient demo balance was credited. No XRPL, bank or real funds moved.',
        }, 201);
      } catch (err) {
        console.error('RLUSD demo transfer failed', err);
        return error(err instanceof Error ? err.message : 'RLUSD demo payment failed.', 503);
      }
    },
  ],
  'POST /api/transfers': [
    async ({ body }) => {
      const input = body as {
        recipient?: string;
        country?: FxCountry;
        amount?: number;
        sourceAddress?: string;
        destinationAddress?: string;
      };
      const recipient = input.recipient?.trim() || '';
      const country = input.country as FxCountry;
      const amount = Number(input.amount);
      const sourceAddress = input.sourceAddress?.trim() || '';
      const destinationAddress = input.destinationAddress?.trim() || '';
      const classicAddress = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
      if (!recipient || recipient.length < 2 || !COUNTRY_CURRENCIES[country] ||
          !Number.isFinite(amount) || amount <= 0 || amount > 10000 ||
          !classicAddress.test(sourceAddress) || !classicAddress.test(destinationAddress) ||
          sourceAddress === destinationAddress) {
        return error('Enter a recipient, destination country, valid RLUSD amount and both XRPL wallet addresses.', 400);
      }
      try {
        const current = await dashboardData();
        if (current.margin < 15) {
          return error('Transfer blocked. Six-month profit margin is ' + current.margin + '%, below the 15% safety threshold.', 403);
        }
        const [fx, ledger] = await Promise.all([
          getFxRates(),
          verifyPaymentAccounts(sourceAddress, destinationAddress, amount),
        ]);
        const localCurrency = COUNTRY_CURRENCIES[country];
        const localAmount = Number((amount * Number(fx.rates[localCurrency])).toFixed(2));
        const paymentDraft = {
          TransactionType: 'Payment',
          Account: sourceAddress,
          Destination: destinationAddress,
          Amount: {
            currency: RLUSD_CURRENCY,
            issuer: ledger.issuer,
            value: amount.toFixed(2),
          },
        };
        const [id] = await db.add(TRANSFERS, [{
          recipient,
          country,
          amount: Number(amount.toFixed(2)),
          currency: 'RLUSD',
          status: 'Preflight passed. Awaiting owner signature.',
          date: isoDate(),
          sourceAddress,
          destinationAddress,
          localAmount,
          localCurrency,
          fxRate: Number(fx.rates[localCurrency]),
          fxTimestamp: fx.timestamp,
          paymentDraft,
          ledgerResult: 'Preflight passed on XRPL Testnet',
        }]);
        if (!id) return error('Transfer request was not saved.', 503);
        const [feedId] = await db.add('spaza_wallet_transactions', [{
          userLabel: 'XRPL wallet ' + sourceAddress.slice(0, 6) + '…',
          type: 'transfer',
          amount: Number(amount.toFixed(2)),
          currency: 'RLUSD',
          status: 'Awaiting owner signature',
          method: 'XRPL Testnet',
          reference: 'DEMO-TRF-' + id,
          transferId: id,
          recipient,
          country,
          createdAt: new Date().toISOString(),
        }]);
        if (!feedId) return error('Transfer was prepared but the shared activity record failed.', 503);
        return json({
          id,
          status: 'Preflight passed. Awaiting owner signature.',
          amount: Number(amount.toFixed(2)),
          localAmount,
          localCurrency,
          zarAmount: Number((amount * Number(fx.rates.ZAR)).toFixed(2)),
          fxRate: Number(fx.rates[localCurrency]),
          fxTimestamp: fx.timestamp,
          payment: paymentDraft,
          issuer: ledger.issuer,
          senderRlusdBalance: ledger.sourceBalance,
          message: 'XRPL accounts and RLUSD trust lines verified. No payment was signed or sent.',
        }, 201);
      } catch (err) {
        return error(err instanceof Error ? err.message : 'Transfer preflight failed.', 422);
      }
    },
  ],
  'POST /api/transfers/:id/confirm': [
    async ({ params, body }) => {
      const input = body as { txHash?: string };
      const txHash = input.txHash?.trim().toUpperCase() || '';
      if (!/^[A-F0-9]{64}$/.test(txHash)) return error('Enter a valid 64-character XRPL transaction hash.', 400);
      try {
        const [transfer] = await db.get<Transfer>(TRANSFERS, [params.id], { consistent: true });
        if (!transfer) return error('Transfer request was not found.', 404);
        if (transfer.status === 'Completed') return error('This transfer already has a confirmed result.', 409);
        if (!transfer.paymentDraft) return error('This transfer has no verified payment draft.', 409);

        const txResult = await xrplRequest('tx', { transaction: txHash, binary: false });
        const tx = txResult as Record<string, any>;
        const meta = (tx.meta || tx.metaData || {}) as Record<string, any>;
        const amount = tx.Amount || tx.DeliverMax;
        const expected = transfer.paymentDraft.Amount as Record<string, string>;
        const exactPayment = tx.TransactionType === 'Payment' &&
          tx.Account === transfer.sourceAddress &&
          tx.Destination === transfer.destinationAddress &&
          amount?.currency && currencyMatches(String(amount.currency)) &&
          amount?.issuer === expected.issuer &&
          Number(amount?.value) === Number(expected.value);
        if (!tx.validated || meta.TransactionResult !== 'tesSUCCESS' || !exactPayment) {
          return error('The ledger result is not a validated successful payment matching this request.', 422);
        }
        const delivered = meta.delivered_amount;
        if (delivered && typeof delivered === 'object' &&
            (!currencyMatches(String(delivered.currency || '')) ||
             delivered.issuer !== expected.issuer ||
             Number(delivered.value) < Number(expected.value))) {
          return error('The validated ledger result does not confirm the requested RLUSD amount.', 422);
        }
        const updated: Transfer = {
          ...transfer,
          status: 'Completed',
          txHash,
          ledgerResult: 'tesSUCCESS',
        };
        const saved = await db.update(TRANSFERS, [{ id: params.id, record: updated as unknown as Record<string, unknown> }]);
        if (!saved[0]) return error('Ledger result was verified but the transfer record could not be updated.', 503);
        const feed = await db.list<Record<string, any>>('spaza_wallet_transactions', { limit: 200 });
        const activity = feed.items.find(row => row.transferId === params.id);
        if (activity?.id) {
          await db.update('spaza_wallet_transactions', [{
            id: activity.id,
            record: {
              ...activity,
              status: 'Completed on XRPL Testnet',
              txHash,
              confirmedAt: new Date().toISOString(),
            },
          }]);
        }
        return json({ status: 'Completed', txHash, ledgerResult: 'tesSUCCESS', message: 'XRPL validated the RLUSD payment and updated the shared transactions feed.' });
      } catch (err) {
        return error(err instanceof Error ? err.message : 'Transaction confirmation failed.', 422);
      }
    },
  ],
});
