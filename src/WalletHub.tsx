import { useEffect, useState } from 'react';
import { api } from '@appdeploy/client';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  CreditCard,
  Fingerprint,
  ShieldCheck,
  Wallet as WalletIcon,
} from 'lucide-react';

type WalletAccount = { email: string; balance: number; currency: string; updatedAt?: string };
type WalletTransaction = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  createdAt: string;
  reference?: string;
  userLabel?: string;
  recipient?: string;
  country?: string;
  flow?: string;
  senderAddress?: string;
  recipientAddress?: string;
};
type FaceSession = { sessionId: string; status: string; expiresAt: string };

const money = (amount: number) =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(amount);

const transactionAmount = (item: WalletTransaction) =>
  item.currency === 'RLUSD'
    ? Number(item.amount).toFixed(2) + ' RLUSD'
    : item.currency === 'XRP'
      ? Number(item.amount).toFixed(6) + ' XRP'
      : money(item.amount);

export default function WalletHub({ onNotice }: { onNotice: (message: string) => void }) {
  const [email, setEmail] = useState('');
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [amount, setAmount] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferRequestId, setTransferRequestId] = useState('');
  const [xrpSender, setXrpSender] = useState('');
  const [xrpRecipient, setXrpRecipient] = useState('');
  const [xrpTxHash, setXrpTxHash] = useState('');
  const [xrpNetwork, setXrpNetwork] = useState('testnet');
  const [xrpDirection, setXrpDirection] = useState('deposit');
  const [cardName, setCardName] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [cardType, setCardType] = useState('Visa');
  const [faceSession, setFaceSession] = useState<FaceSession | null>(null);
  const [faceBusy, setFaceBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [shopAddress, setShopAddress] = useState('');
  const [shopNetwork, setShopNetwork] = useState('testnet');
  const [shopBalanceXrp, setShopBalanceXrp] = useState<number | null>(null);
  const [shopRlusdBalance, setShopRlusdBalance] = useState<number | null>(null);
  const [shopTrustLine, setShopTrustLine] = useState(false);
  const [shopIssuer, setShopIssuer] = useState('');
  const [shopWalletBusy, setShopWalletBusy] = useState(false);
  const [shopDemoBalance, setShopDemoBalance] = useState(0);
  const [demoFundingBalance, setDemoFundingBalance] = useState(0);
  const [rlusdDepositAmount, setRlusdDepositAmount] = useState('');
  const [rlusdDepositBusy, setRlusdDepositBusy] = useState(false);
  const [depositDestination, setDepositDestination] = useState<'personal_zar' | 'store_rlusd'>('personal_zar');
  const [fxQuote, setFxQuote] = useState<{ zarAmount: number; rlusdAmount: number; zarPerRlusd: number; timestamp: string } | null>(null);
  const [fxQuoteLoading, setFxQuoteLoading] = useState(false);

  async function loadSharedTransactions() {
    const response = await api.get('/api/transactions');
    setTransactions(response.data.transactions as WalletTransaction[]);
  }

  async function loadWallet(targetEmail = email) {
    const normalized = targetEmail.trim().toLowerCase();
    if (!normalized) return;
    const response = await api.get('/api/wallet?email=' + encodeURIComponent(normalized));
    setAccount(response.data.account as WalletAccount);
    await loadSharedTransactions();
  }

  async function sendDemoTransfer(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(transferAmount);
    if (!email.trim() || !recipientEmail.trim() || !Number.isFinite(value) || value <= 0) {
      onNotice('Enter the sender email, recipient email and a valid transfer amount.');
      return;
    }
    const requestId = transferRequestId || window.crypto.randomUUID();
    setTransferRequestId(requestId);
    setBusy(true);
    try {
      const response = await api.post('/api/wallet/transfer', { email: email.trim().toLowerCase(), recipientEmail: recipientEmail.trim().toLowerCase(), amount: value, requestId });
      setTransferAmount('');
      setTransferRequestId('');
      await loadWallet();
      onNotice(response.data.message);
    } catch (err: any) {
      onNotice(err?.response?.data?.error || 'Demo wallet transfer failed. Retry using the same request.');
    } finally { setBusy(false); }
  }

  async function verifyXrpTransfer(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !xrpSender.trim() || !xrpRecipient.trim() || !xrpTxHash.trim()) {
      onNotice('Enter your wallet email, sender address, recipient address and transaction hash.');
      return;
    }
    setBusy(true);
    try {
      const response = await api.post('/api/xrp/verify', { email: email.trim().toLowerCase(), senderAddress: xrpSender.trim(), destinationAddress: xrpRecipient.trim(), txHash: xrpTxHash.trim(), network: xrpNetwork, direction: xrpDirection });
      setXrpTxHash('');
      await loadSharedTransactions();
      onNotice(response.data.message);
    } catch (err: any) {
      onNotice(err?.response?.data?.error || 'XRPL transaction verification failed.');
    } finally { setBusy(false); }
  }

  async function loadRlusdDemoAccount() {
    const response = await api.get('/api/rlusd/demo-account');
    setShopDemoBalance(Number(response.data.balance || 0));
    setDemoFundingBalance(Number(response.data.fundingPoolBalance || 0));
  }

  async function depositDemoRlusd(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(rlusdDepositAmount);
    if (!Number.isFinite(value) || value <= 0 || value > 10000) {
      onNotice('Enter a demo RLUSD deposit between 0.01 and 10,000.');
      return;
    }
    const requestId = window.crypto.randomUUID();
    setRlusdDepositBusy(true);
    try {
      const response = await api.post('/api/rlusd/demo-deposit', { amount: value, requestId });
      setRlusdDepositAmount('');
      await loadRlusdDemoAccount();
      await loadSharedTransactions();
      onNotice(response.data.message);
    } catch (err: any) {
      onNotice(err?.response?.data?.error || 'Demo RLUSD deposit failed.');
    } finally {
      setRlusdDepositBusy(false);
    }
  }

  async function loadShopWallet() {
    try {
      const response = await api.get('/api/shop-wallet');
      setShopAddress(response.data.address || '');
      setShopNetwork(response.data.network || 'testnet');
      setShopBalanceXrp(typeof response.data.balanceXrp === 'number' ? response.data.balanceXrp : null);
      setShopRlusdBalance(typeof response.data.rlusdBalance === 'number' ? response.data.rlusdBalance : null);
      setShopTrustLine(Boolean(response.data.trustLineActive));
      setShopIssuer(response.data.issuer || '');
    } catch {
      onNotice('Shop XRP wallet details could not load.');
    }
  }

  async function saveShopWallet(event: React.FormEvent) {
    event.preventDefault();
    setShopWalletBusy(true);
    try {
      const response = await api.put('/api/shop-wallet', { address: shopAddress.trim(), network: shopNetwork });
      await loadShopWallet();
      onNotice(response.data.message);
    } catch (err: any) {
      onNotice(err?.response?.data?.error || 'Shop wallet address could not be saved.');
    } finally {
      setShopWalletBusy(false);
    }
  }

  useEffect(() => {
    loadShopWallet();
    loadRlusdDemoAccount().catch(() => onNotice('Store RLUSD demo account could not load.'));
    loadSharedTransactions().catch(() => onNotice('Shared transactions could not load.'));
    const refresh = window.setInterval(() => {
      loadSharedTransactions().catch(() => undefined);
    }, 5000);
    return () => { window.clearInterval(refresh); };
  }, []);

  async function startFaceCheck() {
    if (!email.trim()) {
      onNotice('Enter the wallet email before starting face authentication.');
      return;
    }
    setFaceBusy(true);
    try {
      const created = await api.post('/api/face-auth/session', {
        email: email.trim().toLowerCase(),
        purpose: 'wallet_withdrawal',
      });
      const verified = await api.post('/api/face-auth/verify', {
        email: email.trim().toLowerCase(),
        sessionId: created.data.sessionId,
        consent: true,
        demoApproval: true,
      });
      setFaceSession({
        sessionId: created.data.sessionId,
        status: verified.data.status,
        expiresAt: verified.data.expiresAt,
      });
      onNotice('Demo face-authentication check passed. No biometric match was performed.');
    } catch (err: any) {
      onNotice(err?.response?.data?.error || 'Face-authentication demo check failed.');
    } finally {
      setFaceBusy(false);
    }
  }

  useEffect(() => {
    if (mode !== 'deposit' || depositDestination !== 'store_rlusd' || !amount || Number(amount) <= 0) {
      setFxQuote(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setFxQuoteLoading(true);
      try {
        const response = await api.get('/api/fx/zar-rlusd-quote?zarAmount=' + encodeURIComponent(amount));
        if (!cancelled) setFxQuote(response.data.quote);
      } catch {
        if (!cancelled) setFxQuote(null);
      } finally {
        if (!cancelled) setFxQuoteLoading(false);
      }
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [amount, depositDestination, mode]);

  async function submitTransaction(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!email.trim() || !Number.isFinite(value) || value <= 0 || value > 100000) {
      onNotice('Enter a valid wallet email and amount up to R100,000.');
      return;
    }
    if (!cardName.trim() || !/^\d{4}$/.test(cardLast4)) {
      onNotice('Enter the cardholder name and final four card digits.');
      return;
    }
    if (mode === 'withdraw' && !faceSession) {
      onNotice('Complete the demo face-authentication check before withdrawal.');
      return;
    }
    if (mode === 'deposit' && depositDestination === 'store_rlusd' && !fxQuote) {
      onNotice('A current ZAR/RLUSD quote is required before this demo conversion.');
      return;
    }
    setBusy(true);
    try {
      const response = await api.post('/api/wallet/' + mode, {
        email: email.trim().toLowerCase(),
        amount: value,
        cardholderName: cardName.trim(),
        cardLast4,
        cardType,
        ...(mode === 'deposit' ? { targetWallet: depositDestination } : {}),
        ...(mode === 'withdraw' ? { faceSessionId: faceSession?.sessionId } : {}),
      });
      setAmount('');
      setFaceSession(null);
      setFxQuote(null);
      if (mode === 'deposit') {
        await loadWallet();
        await loadRlusdDemoAccount();
        await loadSharedTransactions();
      } else {
        await loadWallet();
      }
      onNotice(response.data.message);
    } catch (err: any) {
      onNotice(err?.response?.data?.error || 'Wallet transaction failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wallet-layout">
      <section className="panel wallet-main">
        <div className="panel-heading">
          <div><span className="section-kicker">XRPL HACKATHON DEMO</span><h2>Wallet</h2></div>
          <div className="panel-icon"><WalletIcon size={19} /></div>
        </div>
        <p className="muted">Use your email as your demo wallet identity. Card payments run in simulation mode.</p>
        <label className="wallet-field">Wallet email
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={e => {
              setEmail(e.target.value);
              setAccount(null);
              setFaceSession(null);
            }}
          />
        </label>
        <button
          className="secondary-btn wallet-load"
          type="button"
          onClick={() => loadWallet().catch(() => onNotice('Wallet could not load.'))}
        >
          Load or create demo wallet
        </button>
        <div className="wallet-balance-card">
          <span>PERSONAL ZAR DEMO BALANCE</span>
          <strong>{money(account?.balance || 0)}</strong>
          <small>{account?.email || 'Enter an email to load your wallet'} · ZAR</small>
          <div className="wallet-asset-row"><span>XRPL network</span><b>Testnet demo</b></div>
          <div className="wallet-asset-row"><span>Real-money settlement</span><b>Disabled</b></div>
        </div>
        <section className="panel" style={{ marginBottom: 18 }}>
          <div className="panel-heading"><div><span className="section-kicker">STORE SETTLEMENT ASSET</span><h3>RLUSD stablecoin</h3></div><ShieldCheck size={18} /></div>
          <strong>RLUSD is the default asset for global demo transfers and shop settlement.</strong>
          <p className="muted">RLUSD is designed to track one US dollar. Global payment preparation uses RLUSD rather than XRP. Mainnet payments still require a verified wallet signer and recipient trust line.</p>
          <small>Local currency values are estimates. FX rates, redemption, liquidity and payout fees affect the final amount.</small>
        </section>
        <section className="panel" style={{ marginBottom: 18 }}>
          <div className="panel-heading"><div><span className="section-kicker">STORE RLUSD ACCOUNT</span><h3>Store stablecoin account</h3></div><WalletIcon size={18} /></div>
          <form className="form-stack" onSubmit={saveShopWallet}>
            <label>Store XRPL public address<input required value={shopAddress} onChange={e => setShopAddress(e.target.value.trim())} placeholder="Paste the store wallet r-address" autoCapitalize="none" spellCheck={false} /></label>
            <label>Network<select value={shopNetwork} onChange={e => setShopNetwork(e.target.value)}><option value="mainnet">XRPL Mainnet, real RLUSD</option><option value="testnet">XRPL Testnet, no financial value</option></select></label>
            <button className="primary-btn full" disabled={shopWalletBusy || !shopAddress.trim()}>{shopWalletBusy ? 'Saving…' : 'Connect store account'}</button>
          </form>
          <div className="wallet-balance-card">
            <span>STORE DEMO RLUSD BALANCE</span>
            <strong>{shopDemoBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RLUSD</strong>
            <small>Available · Internal demo account</small>
          </div>
          <div className="wallet-asset-row"><span>Demo funding pool available</span><b>{demoFundingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RLUSD</b></div>
          <form className="form-stack" onSubmit={depositDemoRlusd}>
            <label>Deposit RLUSD from demo funding pool<input type="number" min="0.01" max="10000" step="0.01" required value={rlusdDepositAmount} onChange={e => setRlusdDepositAmount(e.target.value)} placeholder="100.00" /></label>
            <button className="primary-btn full" disabled={rlusdDepositBusy || !rlusdDepositAmount || demoFundingBalance <= 0}>{rlusdDepositBusy ? 'Depositing…' : 'Deposit demo RLUSD'}</button>
          </form>
          <div className="wallet-asset-row"><span>On-chain RLUSD balance</span><b>{shopRlusdBalance === null ? 'Not connected' : shopRlusdBalance.toFixed(2) + ' RLUSD'}</b></div>
          <small>Demo deposits debit the SmartSpaza demo funding pool and credit the store demo account. The demo balance is separate from any real XRPL balance.</small>
          <div className="wallet-asset-row"><span>Network</span><b>{shopNetwork === 'mainnet' ? 'Mainnet' : 'Testnet'}</b></div>
          <div className="wallet-asset-row"><span>Store deposit address</span><b className="wallet-address">{shopAddress || 'Connect an XRPL account first'}</b></div>
          <div className="wallet-asset-row"><span>XRP reserve balance</span><b>{shopBalanceXrp === null ? 'Unavailable' : shopBalanceXrp.toFixed(6) + ' XRP'}</b></div>
          <div className="wallet-asset-row"><span>RLUSD issuer</span><b className="wallet-address">{shopIssuer || 'Select a network and connect an account'}</b></div>
          <p className="form-footnote">For real RLUSD deposits, send tokens from an external XRPL wallet to the connected store address using the same network and issuer. Real deposits appear in the separate on-chain balance after ledger validation. Demo deposits use the internal funding pool above.</p>
          <small>SmartSpaza reads public ledger data only. Connecting an address does not create a new wallet, sign transactions or activate a trust line. Never share a seed phrase or private key.</small>
        </section>
        <section className="panel" style={{ marginBottom: 18 }}>
          <div className="panel-heading"><div><span className="section-kicker">WALLET TRANSFERS</span><h3>Send demo funds to another user</h3></div><ArrowLeftRight size={18} /></div>
          <form className="form-stack" onSubmit={sendDemoTransfer}>
            <label>Recipient wallet email<input type="email" required value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder="recipient@example.com" /></label>
            <label>Amount ({mode === 'deposit' ? 'RLUSD' : 'ZAR'})<input type="number" min="0.01" step="0.01" required value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="100.00" /></label>
            <button className="primary-btn full" disabled={busy || !account}>Send demo transfer</button>
            <small>Both wallet balances update together. The sender and recipient each receive a transaction record. Demo ZAR only, no bank or blockchain settlement.</small>
          </form>
        </section>
        {false && <section className="panel" style={{ marginBottom: 18 }}>
          <div className="panel-heading"><div><span className="section-kicker">XRP WALLET ADDRESSES</span><h3>Verify an XRP deposit or withdrawal</h3></div><ArrowUpFromLine size={18} /></div>
          <form className="form-stack" onSubmit={verifyXrpTransfer}>
            <label>Wallet sending from<input required value={xrpSender} onChange={e => setXrpSender(e.target.value)} placeholder="r... sender address" autoCapitalize="none" spellCheck={false} /></label>
            <label>Wallet receiving to<input required value={xrpRecipient} onChange={e => setXrpRecipient(e.target.value)} placeholder="r... recipient address" autoCapitalize="none" spellCheck={false} /></label>
            <div className="form-two"><label>Transaction type<select value={xrpDirection} onChange={e => setXrpDirection(e.target.value)}><option value="deposit">Deposit into my account</option><option value="withdrawal">Withdrawal from my account</option></select></label><label>XRPL network<select value={xrpNetwork} onChange={e => setXrpNetwork(e.target.value)}><option value="testnet">Testnet, no real value</option><option value="mainnet">Mainnet, real XRP</option></select></label></div>
            <label>XRPL transaction hash<input required value={xrpTxHash} onChange={e => setXrpTxHash(e.target.value)} placeholder="64-character transaction hash" autoCapitalize="characters" spellCheck={false} /></label>
            <button className="primary-btn full" disabled={busy || !account}>Verify on XRP Ledger</button>
            <small>SmartSpaza checks the validated ledger transaction and records both wallet addresses. This does not sign transactions or credit your in-app XRP balance. Mainnet deposits require verified wallet ownership and a secure signer before balance crediting.</small>
          </form>
        </section>}
        <div className="wallet-tabs">
          <button
            type="button"
            className={mode === 'deposit' ? 'wallet-tab active' : 'wallet-tab'}
            onClick={() => { setMode('deposit'); setFaceSession(null); }}
          >
            <ArrowDownToLine size={16} /> Deposit
          </button>
          <button
            type="button"
            className={mode === 'withdraw' ? 'wallet-tab active' : 'wallet-tab'}
            onClick={() => setMode('withdraw')}
          >
            <ArrowUpFromLine size={16} /> Withdraw
          </button>
        </div>
        <form className="form-stack" onSubmit={submitTransaction}>
          <label>Amount (ZAR)
            <input
              type="number"
              min="1"
              max="100000"
              step="0.01"
              required
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="500.00"
            />
          </label>
          {mode === 'deposit' && (
            <div className="form-stack">
              <label>Where would you like this deposit to go?
                <select value={depositDestination} onChange={e => setDepositDestination(e.target.value as 'personal_zar' | 'store_rlusd')}>
                  <option value="personal_zar">Personal ZAR demo account</option>
                  <option value="store_rlusd">Store RLUSD account (convert from ZAR)</option>
                </select>
              </label>
              {depositDestination === 'store_rlusd' ? (
                <div className="wallet-asset-row">
                  <span>{fxQuoteLoading ? 'Getting current exchange rate…' : fxQuote ? `Indicative rate: 1 RLUSD ≈ R${fxQuote.zarPerRlusd.toFixed(4)}` : 'Live conversion quote unavailable'}</span>
                  <b>{fxQuote ? `${fxQuote.rlusdAmount.toFixed(2)} RLUSD` : '—'}</b>
                  {fxQuote && <small>R{fxQuote.zarAmount.toFixed(2)} converts to approximately {fxQuote.rlusdAmount.toFixed(2)} RLUSD. Rate updated {new Date(fxQuote.timestamp).toLocaleString()}.</small>}
                </div>
              ) : (
                <small>Your deposit will be credited in rand to the personal ZAR demo wallet linked to the email above.</small>
              )}
            </div>
          )}
          <label>Cardholder name
            <input required value={cardName} onChange={e => setCardName(e.target.value)} placeholder="Name on card" />
          </label>
          <label>Card brand
            <select value={cardType} onChange={e => setCardType(e.target.value)}>
              <option>Visa</option>
              <option>Mastercard</option>
              <option>Virtual card</option>
            </select>
          </label>
          <label>Card final four digits
            <input
              required
              inputMode="numeric"
              maxLength={4}
              pattern="[0-9]{4}"
              value={cardLast4}
              onChange={e => setCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="4242"
            />
          </label>
          {mode === 'withdraw' && (
            <div className="face-auth-card">
              <div className="face-auth-icon"><Fingerprint size={22} /></div>
              <div>
                <strong>Face authentication SDK adapter</strong>
                <span>{faceSession ? 'Demo check passed' : 'Required before a demo withdrawal'}</span>
              </div>
              <button
                type="button"
                className="secondary-btn"
                disabled={faceBusy || !email.includes('@')}
                onClick={startFaceCheck}
              >
                {faceBusy ? 'Checking…' : 'Run face check'}
              </button>
              <small>Demo API only. No camera scan, biometric template or identity match is performed. A production face SDK provider must be connected.</small>
            </div>
          )}
          <button className="primary-btn full" disabled={busy || !account}>
            {busy ? 'Processing…' : mode === 'deposit' ? 'Simulate card deposit' : 'Simulate card withdrawal'}
            <CreditCard size={16} />
          </button>
          <p className="form-footnote">Choose whether a deposit credits your personal ZAR demo wallet or converts ZAR into RLUSD for the store demo wallet. Withdrawals use the personal ZAR demo wallet. Only the cardholder name and final four digits are recorded. Never enter a full card number or CVV.</p>
        </form>
      </section>

      <section className="panel wallet-history">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">SHARED DEMO ACTIVITY</span>
            <h2>Transactions</h2>
          </div>
          <ShieldCheck size={19} />
        </div>
        <p className="muted">Shared across SmartSpaza demo users. New activity refreshes every 5 seconds. Email addresses are masked.</p>
        {transactions.length ? transactions.map(item => (
          <div className="history-row" key={item.id}>
            <div className="activity-avatar">
              {item.type === 'deposit'
                ? <ArrowDownToLine size={16} />
                : item.type === 'transfer'
                  ? <ArrowLeftRight size={16} />
                  : <ArrowUpFromLine size={16} />}
            </div>
            <div className="activity-detail">
              <strong>
                {item.type === 'deposit' || item.type === 'xrp_deposit'
                  ? 'Money deposited'
                  : item.type === 'withdrawal' || item.type === 'xrp_withdrawal'
                    ? 'Money withdrawn'
                    : item.type === 'transfer' && item.flow === 'received'
                      ? 'Money received'
                      : item.type === 'transfer'
                        ? 'Money transferred'
                        : 'XRP transfer verified'}
              </strong>
              <span>{item.userLabel || 'SmartSpaza demo user'}{item.recipient ? ' · To: ' + item.recipient : ''}</span>
              {item.senderAddress && <span>From: {item.senderAddress}</span>}
              {item.recipientAddress && <span>To: {item.recipientAddress}</span>}
              <span>{item.method || item.country || item.currency} · {new Date(item.createdAt).toLocaleString()}</span>
              <span>{item.status} · {item.reference || 'Demo reference'}</span>
            </div>
            <div className="history-value">
              <strong className={item.type === 'deposit' ? 'wallet-credit' : ''}>
                {item.type === 'deposit' || item.type === 'xrp_deposit' || (item.type === 'transfer' && item.flow === 'received') ? '+' : '−'}{transactionAmount(item)}
              </strong>
            </div>
          </div>
        )) : (
          <div className="empty-state">
            <div className="empty-icon"><WalletIcon size={22} /></div>
            <strong>No shared activity yet</strong>
            <span>Demo deposits, withdrawals and confirmed transfers appear here.</span>
          </div>
        )}
      </section>
      <div className="wallet-demo-note">
        <ShieldCheck size={16} />
        <span>Hackathon simulation. Demo RLUSD is an internal accounting unit, not a blockchain token or bank deposit. No card charge or payout occurs.</span>
      </div>
    </div>
  );
}
