import { useEffect, useState } from 'react';
import { api } from '@appdeploy/client';
import { Archive, Building2, CreditCard, Pencil, Plus, Save, Trash2, UserRound, X } from 'lucide-react';

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
type Supplier = {
  id: string;
  name: string;
  country: string;
  email?: string;
  phone?: string;
  contactName?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  bankCode?: string;
  mobileWallet?: string;
  xrplAddress?: string;
};
type OwnerProfile = {
  fullName: string;
  businessName: string;
  registrationNumber: string;
  email: string;
  phone: string;
  address: string;
  country: string;
  settlementCurrency: string;
  preferredPayoutMethod: string;
};
type Payment = {
  id: string;
  supplierName: string;
  amount: number;
  currency: string;
  dueDate: string;
  reference: string;
  method: string;
  status: string;
};
const emptyOwner: OwnerProfile = {
  fullName: '', businessName: '', registrationNumber: '', email: '',
  phone: '', address: '', country: 'South Africa', settlementCurrency: 'ZAR',
  preferredPayoutMethod: 'Bank transfer',
};
const emptySupplier = {
  name: '', country: 'South Africa', contactName: '', email: '', phone: '',
  bankName: '', accountName: '', accountNumber: '', bankCode: '',
  mobileWallet: '', xrplAddress: '',
};
const emptyProduct = {
  name: '', category: 'Groceries', stock: '0', expiry: '',
  price: '', cost: '',
};
const DEMO_SHOP_WALLET_EMAIL = 'demo.user@example.com';

function isExpiringSoon(item: InventoryItem) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(item.expiry + 'T00:00:00');
  const daysRemaining = Math.floor((expiryDate.getTime() - today.getTime()) / 86400000);
  return Number(item.stock) > 0 && daysRemaining >= 0 && daysRemaining <= 7;
}
export const PAYMENT_DESTINATIONS = [
  { country: 'Algeria', currency: 'DZD' }, { country: 'Angola', currency: 'AOA' },
  { country: 'Benin', currency: 'XOF' }, { country: 'Botswana', currency: 'BWP' },
  { country: 'Burkina Faso', currency: 'XOF' }, { country: 'Burundi', currency: 'BIF' },
  { country: 'Cabo Verde', currency: 'CVE' }, { country: 'Cameroon', currency: 'XAF' },
  { country: 'Central African Republic', currency: 'XAF' }, { country: 'Chad', currency: 'XAF' },
  { country: 'Comoros', currency: 'KMF' }, { country: 'Republic of the Congo', currency: 'XAF' },
  { country: 'Democratic Republic of the Congo', currency: 'CDF' }, { country: 'Côte d’Ivoire', currency: 'XOF' },
  { country: 'Djibouti', currency: 'DJF' }, { country: 'Egypt', currency: 'EGP' },
  { country: 'Equatorial Guinea', currency: 'XAF' }, { country: 'Eritrea', currency: 'ERN' },
  { country: 'Eswatini', currency: 'SZL' }, { country: 'Ethiopia', currency: 'ETB' },
  { country: 'Gabon', currency: 'XAF' }, { country: 'The Gambia', currency: 'GMD' },
  { country: 'Ghana', currency: 'GHS' }, { country: 'Guinea', currency: 'GNF' },
  { country: 'Guinea-Bissau', currency: 'XOF' }, { country: 'Kenya', currency: 'KES' },
  { country: 'Lesotho', currency: 'LSL' }, { country: 'Liberia', currency: 'LRD' },
  { country: 'Libya', currency: 'LYD' }, { country: 'Madagascar', currency: 'MGA' },
  { country: 'Malawi', currency: 'MWK' }, { country: 'Mali', currency: 'XOF' },
  { country: 'Mauritania', currency: 'MRU' }, { country: 'Mauritius', currency: 'MUR' },
  { country: 'Morocco', currency: 'MAD' }, { country: 'Mozambique', currency: 'MZN' },
  { country: 'Namibia', currency: 'NAD' }, { country: 'Niger', currency: 'XOF' },
  { country: 'Nigeria', currency: 'NGN' }, { country: 'Rwanda', currency: 'RWF' },
  { country: 'São Tomé and Príncipe', currency: 'STN' }, { country: 'Senegal', currency: 'XOF' },
  { country: 'Seychelles', currency: 'SCR' }, { country: 'Sierra Leone', currency: 'SLE' },
  { country: 'Somalia', currency: 'SOS' }, { country: 'South Africa', currency: 'ZAR' },
  { country: 'South Sudan', currency: 'SSP' }, { country: 'Sudan', currency: 'SDG' },
  { country: 'Tanzania', currency: 'TZS' }, { country: 'Togo', currency: 'XOF' },
  { country: 'Tunisia', currency: 'TND' }, { country: 'Uganda', currency: 'UGX' },
  { country: 'Zambia', currency: 'ZMW' }, { country: 'Zimbabwe', currency: 'ZWG' },
  { country: 'India', currency: 'INR' }, { country: 'China', currency: 'CNY' },
];

export default function OperationsHub({
  page,
  inventory,
  onRefresh,
  onNotice,
}: {
  page: string;
  inventory: InventoryItem[];
  onRefresh: () => Promise<void>;
  onNotice: (message: string) => void;
}) {
  const [owner, setOwner] = useState<OwnerProfile>(emptyOwner);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [disposals, setDisposals] = useState<any[]>([]);
  const [supplierForm, setSupplierForm] = useState(emptySupplier);
  const [editingSupplier, setEditingSupplier] = useState('');
  const [productForm, setProductForm] = useState(emptyProduct);
  const [editingProduct, setEditingProduct] = useState('');
  const [disposeItem, setDisposeItem] = useState<InventoryItem | null>(null);
  const [disposeQuantity, setDisposeQuantity] = useState('1');
  const [disposeReason, setDisposeReason] = useState('Expired or spoiled');
  const [paymentForm, setPaymentForm] = useState({
    supplierId: '', amount: '', currency: 'ZAR', dueDate: '', reference: '',
    method: 'Bank transfer',
  });
  const [busy, setBusy] = useState(false);

  async function loadSuppliers() {
    const [s, p, d] = await Promise.all([
      api.get('/api/suppliers'), api.get('/api/supplier-payments'), api.get('/api/disposals'),
    ]);
    setSuppliers(s.data as Supplier[]);
    setPayments(p.data as Payment[]);
    setDisposals(d.data as any[]);
  }
  async function loadOwner() {
    const response = await api.get('/api/owner');
    setOwner({ ...emptyOwner, ...(response.data as OwnerProfile) });
  }
  useEffect(() => {
    if (page === 'owner') loadOwner().catch(() => onNotice('Owner profile could not load.'));
    if (page === 'suppliers') loadSuppliers().catch(() => onNotice('Supplier records could not load.'));
  }, [page]);

  async function saveOwner(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.put('/api/owner', owner);
      onNotice('Owner and business profile saved.');
    } catch (err: any) {
      onNotice(err?.response?.data?.error || 'Owner profile could not be saved.');
    } finally { setBusy(false); }
  }
  function beginSupplierEdit(supplier: Supplier) {
    setEditingSupplier(supplier.id);
    setSupplierForm({ ...emptySupplier, ...supplier });
  }
  async function saveSupplier(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (editingSupplier) await api.put('/api/suppliers/' + editingSupplier, supplierForm);
      else await api.post('/api/suppliers', supplierForm);
      setSupplierForm(emptySupplier);
      setEditingSupplier('');
      await loadSuppliers();
      onNotice('Supplier record saved.');
    } catch (err: any) {
      onNotice(err?.response?.data?.error || 'Supplier could not be saved.');
    } finally { setBusy(false); }
  }
  async function removeSupplier(id: string) {
    if (!window.confirm('Delete this supplier record? Existing payment history stays.')) return;
    try {
      await api.delete('/api/suppliers/' + id);
      await loadSuppliers();
      onNotice('Supplier record deleted.');
    } catch { onNotice('Supplier could not be deleted.'); }
  }
  async function startProductEdit(item: InventoryItem) {
    setEditingProduct(item.id);
    setProductForm({
      name: item.name, category: item.category, stock: String(item.stock),
      expiry: item.expiry, price: String(item.originalPrice ?? item.price), cost: String(item.cost),
    });
  }
  async function saveProduct(event: React.FormEvent) {
    event.preventDefault();
    if (!editingProduct) return;
    setBusy(true);
    try {
      await api.put('/api/inventory/' + editingProduct, {
        name: productForm.name, category: productForm.category,
        stock: Number(productForm.stock), expiry: productForm.expiry,
        price: Number(productForm.price), cost: Number(productForm.cost),
      });
      setEditingProduct('');
      setProductForm(emptyProduct);
      await onRefresh();
      onNotice('Inventory item updated.');
    } catch (err: any) {
      onNotice(err?.response?.data?.error || 'Inventory item could not be updated.');
    } finally { setBusy(false); }
  }
  async function disposeStock(event: React.FormEvent) {
    event.preventDefault();
    if (!disposeItem) return;
    setBusy(true);
    try {
      await api.post('/api/inventory/' + disposeItem.id + '/dispose', {
        quantity: Number(disposeQuantity), reason: disposeReason,
      });
      setDisposeItem(null);
      await onRefresh();
      const result = await api.get('/api/disposals');
      setDisposals(result.data as any[]);
      onNotice('Disposal recorded. Stock quantity reduced.');
    } catch (err: any) {
      onNotice(err?.response?.data?.error || 'Disposal was not recorded.');
    } finally { setBusy(false); }
  }
  async function deleteProduct(item: InventoryItem) {
    if (!window.confirm('Permanently remove ' + item.name + ' from inventory?')) return;
    try {
      await api.delete('/api/inventory/' + item.id);
      await onRefresh();
      onNotice('Inventory item removed.');
    } catch { onNotice('Inventory item could not be removed.'); }
  }
  async function createPayment(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await api.post('/api/supplier-payments', {
        ...paymentForm,
        shopWalletEmail: DEMO_SHOP_WALLET_EMAIL,
        amount: Number(paymentForm.amount),
      });
      setPaymentForm({ supplierId: '', amount: '', currency: 'ZAR', dueDate: '', reference: '', method: 'Bank transfer' });
      await loadSuppliers();
      onNotice(response.data.message || 'Supplier demo payment completed.');
    } catch (err: any) {
      onNotice(err?.response?.data?.error || 'Supplier demo payment failed.');
    } finally { setBusy(false); }
  }

  if (page === 'owner') return (
    <section className="panel ops-panel">
      <div className="panel-heading"><div><span className="section-kicker">ACCOUNT</span><h2>Owner and business information</h2></div><UserRound size={19} /></div>
      <p className="muted">Edit the owner identity, company details and preferred settlement settings.</p>
      <form className="form-stack ops-form" onSubmit={saveOwner}>
        <div className="form-two"><label>Owner full name<input required value={owner.fullName} onChange={e => setOwner({ ...owner, fullName: e.target.value })} /></label><label>Business name<input required value={owner.businessName} onChange={e => setOwner({ ...owner, businessName: e.target.value })} /></label></div>
        <div className="form-two"><label>Company registration number<input value={owner.registrationNumber} onChange={e => setOwner({ ...owner, registrationNumber: e.target.value })} /></label><label>Email address<input required type="email" value={owner.email} onChange={e => setOwner({ ...owner, email: e.target.value })} /></label></div>
        <div className="form-two"><label>Phone number<input required value={owner.phone} onChange={e => setOwner({ ...owner, phone: e.target.value })} /></label><label>Country<input value={owner.country} onChange={e => setOwner({ ...owner, country: e.target.value })} /></label></div>
        <label>Business address<input value={owner.address} onChange={e => setOwner({ ...owner, address: e.target.value })} /></label>
        <div className="form-two"><label>Settlement currency<input maxLength={3} value={owner.settlementCurrency} onChange={e => setOwner({ ...owner, settlementCurrency: e.target.value.toUpperCase() })} /></label><label>Preferred payout method<select value={owner.preferredPayoutMethod} onChange={e => setOwner({ ...owner, preferredPayoutMethod: e.target.value })}><option>Bank transfer</option><option>Mobile money</option><option>XRPL wallet</option></select></label></div>
        <button className="primary-btn" disabled={busy}><Save size={15} />{busy ? 'Saving…' : 'Save owner profile'}</button>
      </form>
    </section>
  );

  if (page === 'suppliers') return (
    <div className="ops-grid">
      <section className="panel ops-panel">
        <div className="panel-heading"><div><span className="section-kicker">VENDOR DIRECTORY</span><h2>{editingSupplier ? 'Edit supplier' : 'Add supplier'}</h2></div><Building2 size={19} /></div>
        <form className="form-stack ops-form" onSubmit={saveSupplier}>
          <label>Supplier / company name<input required value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} /></label>
          <div className="form-two"><label>Country<select value={supplierForm.country} onChange={e => setSupplierForm({ ...supplierForm, country: e.target.value })}>{PAYMENT_DESTINATIONS.map(c => <option key={c.country}>{c.country}</option>)}</select></label><label>Contact person<input value={supplierForm.contactName} onChange={e => setSupplierForm({ ...supplierForm, contactName: e.target.value })} /></label></div>
          <label>Phone number, optional<input value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} /></label>
          <label>Bank name<input value={supplierForm.bankName} onChange={e => setSupplierForm({ ...supplierForm, bankName: e.target.value })} /></label>
          <div className="form-two"><label>Account name<input value={supplierForm.accountName} onChange={e => setSupplierForm({ ...supplierForm, accountName: e.target.value })} /></label><label>Account number<input value={supplierForm.accountNumber} onChange={e => setSupplierForm({ ...supplierForm, accountNumber: e.target.value })} /></label></div>
          <div className="form-two"><label>Bank / branch code<input value={supplierForm.bankCode} onChange={e => setSupplierForm({ ...supplierForm, bankCode: e.target.value })} /></label><label>Mobile-money number<input value={supplierForm.mobileWallet} onChange={e => setSupplierForm({ ...supplierForm, mobileWallet: e.target.value })} /></label></div>
          <label>XRPL wallet address, optional<input value={supplierForm.xrplAddress} onChange={e => setSupplierForm({ ...supplierForm, xrplAddress: e.target.value })} /></label>
          <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => { setEditingSupplier(''); setSupplierForm(emptySupplier); }}>Clear</button><button className="primary-btn" disabled={busy}>{busy ? 'Saving…' : 'Save supplier'}</button></div>
        </form>
      </section>
      <section className="panel ops-panel">
        <div className="panel-heading"><div><span className="section-kicker">SUPPLIERS</span><h2>Saved supplier records</h2></div><Building2 size={19} /></div>
        {suppliers.length ? suppliers.map(s => <div className="ops-row" key={s.id}><div><strong>{s.name}</strong><span>{s.country} · {s.email || s.phone || 'No contact details'}</span></div><button className="icon-btn" onClick={() => beginSupplierEdit(s)} aria-label="Edit supplier"><Pencil size={15} /></button><button className="icon-btn" onClick={() => removeSupplier(s.id)} aria-label="Delete supplier"><Trash2 size={15} /></button></div>) : <div className="empty-inline">No suppliers saved yet.</div>}
      </section>
      <section className="panel ops-panel">
        <div className="panel-heading"><div><span className="section-kicker">ACCOUNTS PAYABLE</span><h2>Prepare supplier payment</h2></div><CreditCard size={19} /></div>
        <form className="form-stack ops-form" onSubmit={createPayment}>
          <label>Supplier<select required value={paymentForm.supplierId} onChange={e => setPaymentForm({ ...paymentForm, supplierId: e.target.value })}><option value="">Choose supplier</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <div className="form-two"><label>Amount<input type="number" min="0.01" step="0.01" required value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></label><label>Currency<input maxLength={3} required value={paymentForm.currency} onChange={e => setPaymentForm({ ...paymentForm, currency: e.target.value.toUpperCase() })} /></label></div>
          <div className="form-two"><label>Due date<input type="date" value={paymentForm.dueDate} onChange={e => setPaymentForm({ ...paymentForm, dueDate: e.target.value })} /></label><label>Payment method<select value={paymentForm.method} onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })}><option>Bank transfer</option><option>Mobile money</option><option>XRPL wallet</option></select></label></div>
          <label>Invoice / payment reference<input value={paymentForm.reference} onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })} /></label>
          <button className="primary-btn" disabled={busy || !suppliers.length}>{busy ? 'Paying…' : 'Pay supplier from demo shop account'}</button>
        </form>
        <p className="form-footnote">Demo shop account: {DEMO_SHOP_WALLET_EMAIL}. Select a supplier and enter an amount. No email address is required. SmartSpaza debits the shop demo balance and credits the supplier's internal demo balance immediately. No bank or XRPL payout occurs.</p>
        {payments.map(p => <div className="ops-row" key={p.id}><div><strong>{p.supplierName}</strong><span>{p.reference || p.dueDate || 'Supplier payment'} · {p.shopWalletEmail || DEMO_SHOP_WALLET_EMAIL}</span></div><div className="ops-payment"><strong>{p.amount.toFixed(2)} {p.currency}</strong><span>{p.status}</span></div></div>)}
      </section>
    </div>
  );

  return (
    <div className="ops-grid">
      <section className="panel ops-panel ops-wide">
        <div className="panel-heading"><div><span className="section-kicker">STOCK CONTROL</span><h2>Edit inventory</h2></div><Archive size={19} /></div>
        {editingProduct ? (
          <form className="form-stack ops-form" onSubmit={saveProduct}>
            <div className="form-two"><label>Product name<input required value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} /></label><label>Category<input required value={productForm.category} onChange={e => setProductForm({ ...productForm, category: e.target.value })} /></label></div>
            <div className="form-two"><label>Stock quantity<input type="number" min="0" required value={productForm.stock} onChange={e => setProductForm({ ...productForm, stock: e.target.value })} /></label><label>Expiry date<input type="date" required value={productForm.expiry} onChange={e => setProductForm({ ...productForm, expiry: e.target.value })} /></label></div>
            <div className="form-two"><label>Selling price (ZAR)<input type="number" min="0" step="0.01" required value={productForm.price} onChange={e => setProductForm({ ...productForm, price: e.target.value })} /></label><label>Unit cost (ZAR)<input type="number" min="0" step="0.01" required value={productForm.cost} onChange={e => setProductForm({ ...productForm, cost: e.target.value })} /></label></div>
            <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setEditingProduct('')}>Cancel</button><button className="primary-btn" disabled={busy}><Save size={15} />Save changes</button></div>
          </form>
        ) : null}
        <div className="table-wrap"><table><thead><tr><th>Product</th><th>Stock</th><th>Expiry</th><th>Price</th><th>Actions</th></tr></thead><tbody>{inventory.map(item => <tr key={item.id}><td><strong>{item.name}</strong><div className="muted-cell">{item.category}</div></td><td>{item.stock}</td><td>{item.expiry}{isExpiringSoon(item) && <div className="table-status warning">Expiring soon</div>}</td><td>{item.discountApplied ? <><s>{(item.originalPrice ?? item.price).toFixed(2)} ZAR</s><br /><strong>{item.price.toFixed(2)} ZAR</strong><br /><span className="table-status warning">50% OFF</span></> : <>{item.price.toFixed(2)} ZAR</>}</td><td><div className="ops-actions"><button className="secondary-btn" onClick={() => startProductEdit(item)}>Edit</button>{isExpiringSoon(item) && <button className="secondary-btn" onClick={() => { setDisposeItem(item); setDisposeQuantity('1'); }}>Dispose</button>}<button className="icon-btn" onClick={() => deleteProduct(item)} aria-label="Delete product"><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>
      </section>
      {disposeItem && <section className="panel ops-panel"><div className="panel-heading"><div><span className="section-kicker">STOCK ADJUSTMENT</span><h2>Dispose {disposeItem.name}</h2></div><button className="icon-btn" onClick={() => setDisposeItem(null)}><X size={16} /></button></div><form className="form-stack ops-form" onSubmit={disposeStock}><label>Quantity to dispose<input type="number" min="1" max={disposeItem.stock} step="1" required value={disposeQuantity} onChange={e => setDisposeQuantity(e.target.value)} /></label><label>Reason<select value={disposeReason} onChange={e => setDisposeReason(e.target.value)}><option>Expired or spoiled</option><option>Damaged in storage</option><option>Returned to supplier</option><option>Lost or stolen</option><option>Quality control rejection</option><option>Other</option></select></label><button className="primary-btn" disabled={busy}>Confirm disposal and reduce stock</button></form></section>}
      <section className="panel ops-panel"><div className="panel-heading"><div><span className="section-kicker">DISPOSAL LOG</span><h2>Recent stock disposals</h2></div><Archive size={18} /></div>{disposals.length ? disposals.map(d => <div className="ops-row" key={d.id}><div><strong>{d.productName}</strong><span>{d.reason} · {new Date(d.date).toLocaleDateString()}</span></div><strong>−{d.quantity}</strong></div>) : <div className="empty-inline">No disposal records.</div>}</section>
    </div>
  );
}
