import { useEffect, useMemo, useState } from 'react';
import { api } from '@appdeploy/client';
import { Banknote, CheckCircle2, Minus, Plus, ShoppingCart, TrendingUp, X } from 'lucide-react';

type Product = { id:string; name:string; category:string; stock:number; price:number; cost:number; expiry:string; discountApplied?:boolean };
type CartLine = { productId:string; quantity:number };
type Sale = { saleId:string; createdAt:string; revenue:number; cost:number; profit:number; margin:number; items:Array<{productName:string;quantity:number}> };

const zar=(value:number)=>Number(value||0).toLocaleString('en-ZA',{style:'currency',currency:'ZAR'});
export default function SalesHub({inventory,onNotice,onRefresh}:{inventory:Product[];onNotice:(message:string)=>void;onRefresh:()=>Promise<void>}){
 const [cart,setCart]=useState<CartLine[]>([]);
 const [sales,setSales]=useState<Sale[]>([]);
 const [busy,setBusy]=useState(false);
 const [search,setSearch]=useState('');
 const [requestId,setRequestId]=useState('');
 const [manualProductId,setManualProductId]=useState('');
 const [manualQuantity,setManualQuantity]=useState('1');
 const [manualRequestId,setManualRequestId]=useState('');
 const [reportPeriod,setReportPeriod]=useState('this-week');
 async function loadSales(){
  try{
   const r=await api.get('/api/sales');
   const payload:any=r.data;
   const rows:any[]=Array.isArray(payload)?payload:Array.isArray(payload?.sales)?payload.sales:Array.isArray(payload?.items)?payload.items:Array.isArray(payload?.data)?payload.data:[];
   const normalized:Sale[]=rows.filter(row=>row&&typeof row==='object').map((row:any)=>{
    const rowRevenue=Number(row.revenue??row.totalRevenue??row.total??0);
    const rowCost=Number(row.cost??row.stockCost??row.costOfGoods??0);
    const rowItems=Array.isArray(row.items)?row.items.map((item:any)=>({productName:String(item.productName??item.name??'Item'),quantity:Number(item.quantity??item.qty??0)})):[];
    return {...row,saleId:String(row.saleId??row.id??row.requestId??''),createdAt:String(row.createdAt??row.completedAt??row.timestamp??row.date??''),revenue:rowRevenue,cost:rowCost,profit:Number(row.profit??row.grossProfit??(rowRevenue-rowCost)),margin:Number(row.margin??(rowRevenue>0?((rowRevenue-rowCost)/rowRevenue)*100:0)),items:rowItems};
   });
   setSales(normalized);
  }catch{onNotice('Recent sales could not be loaded. Please refresh and try again.')}
 }
 useEffect(()=>{loadSales()},[]);
 const products=useMemo(()=>inventory.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())||p.category.toLowerCase().includes(search.toLowerCase())),[inventory,search]);
 const cartRows=cart.map(line=>{const p=inventory.find(x=>x.id===line.productId)!;return {...line,product:p,revenue:p.price*line.quantity,cost:p.cost*line.quantity}}).filter(x=>x.product);
 const revenue=cartRows.reduce((s,x)=>s+x.revenue,0),cost=cartRows.reduce((s,x)=>s+x.cost,0),profit=revenue-cost;
 function add(p:Product){if(p.stock<1)return;setCart(old=>{const exists=old.find(x=>x.productId===p.id);if(exists)return old.map(x=>x.productId===p.id?{...x,quantity:Math.min(p.stock,x.quantity+1)}:x);return [...old,{productId:p.id,quantity:1}]})}
 function setQuantity(id:string,value:number){setCart(old=>old.map(x=>x.productId===id?{...x,quantity:Math.max(1,Math.min(inventory.find(p=>p.id===id)?.stock||1,value))}:x))}
 async function checkout(){if(!cart.length)return;const id=requestId||window.crypto.randomUUID();setRequestId(id);setBusy(true);try{const r=await api.post('/api/sales/checkout',{requestId:id,items:cart});onNotice(r.data.message||'Sale recorded.');setCart([]);setRequestId('');await Promise.all([onRefresh(),loadSales()])}catch(e:any){onNotice(e?.response?.data?.error||'Sale could not be recorded. Please review stock and retry.')}finally{setBusy(false)}}
 async function recordItemsSold(){
  const product=inventory.find(p=>p.id===manualProductId);
  const quantity=Number(manualQuantity);
  if(!product){onNotice('Choose a product from inventory first.');return}
  if(!Number.isSafeInteger(quantity)||quantity<1){onNotice('Enter a whole-number quantity of at least 1.');return}
  if(quantity>product.stock){onNotice('Only '+product.stock+' '+product.name+' available. Reduce the quantity and try again.');return}
  const id=manualRequestId||window.crypto.randomUUID();
  setManualRequestId(id);setBusy(true);
  try{
   const r=await api.post('/api/sales/checkout',{requestId:id,items:[{productId:product.id,quantity}]});
   onNotice('Recorded '+quantity+' '+product.name+' sold. Remaining stock: '+(product.stock-quantity)+'. '+(r.data.message||''));
   setManualQuantity('1');setManualRequestId('');
   await Promise.all([onRefresh(),loadSales()]);
  }catch(e:any){onNotice(e?.response?.data?.error||'Items sold could not be recorded. Stock has not been changed.')}
  finally{setBusy(false)}
 }
 const manualProduct=inventory.find(p=>p.id===manualProductId);
 const localDay=(value:string)=>{const d=new Date(value);if(Number.isNaN(d.getTime()))return '';return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
 const todayDate=new Date();todayDate.setHours(0,0,0,0);
 const weekStart=new Date(todayDate);weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));
 const reportStart=new Date(weekStart);if(reportPeriod==='previous-week')reportStart.setDate(reportStart.getDate()-7);
 const reportEnd=new Date(reportStart);reportEnd.setDate(reportEnd.getDate()+7);
 const todayKey=localDay(todayDate.toISOString());
 const datedSales=sales.map(s=>({...s,_date:new Date(s.createdAt)})).filter(s=>!Number.isNaN(s._date.getTime()));
 const todaySales=datedSales.filter(s=>localDay(s.createdAt)===todayKey);
 const reportSales=reportPeriod==='all'?datedSales:datedSales.filter(s=>s._date>=reportStart&&s._date<reportEnd);
 const reportRevenue=reportSales.reduce((sum,s)=>sum+Number(s.revenue||0),0),reportCost=reportSales.reduce((sum,s)=>sum+Number(s.cost||0),0),reportProfit=reportSales.reduce((sum,s)=>sum+Number(s.profit||0),0);
 const reportUnits=reportSales.reduce((sum,s)=>sum+(s.items||[]).reduce((n,item)=>n+Number(item.quantity||0),0),0);
 const reportMargin=reportRevenue>0?(reportProfit/reportRevenue)*100:0;
 const reportLabel=reportPeriod==='all'?'All recorded sales':reportPeriod==='today'?'Today':reportPeriod==='previous-week'?'Previous week':'This week';
 const visibleSales=reportPeriod==='all'?datedSales:reportPeriod==='today'?todaySales:reportSales;
 const chartStart=reportPeriod==='today'?todayDate:reportStart;
 const chartDays=Array.from({length:7},(_,i)=>{const d=new Date(chartStart);d.setDate(d.getDate()+i);const key=localDay(d.toISOString());return {key,label:d.toLocaleDateString('en-ZA',{weekday:'short'}),revenue:reportSales.filter(s=>localDay(s.createdAt)===key).reduce((n,s)=>n+s.revenue,0),profit:reportSales.filter(s=>localDay(s.createdAt)===key).reduce((n,s)=>n+s.profit,0)}});
 const maxProfit=Math.max(1,...chartDays.map(x=>x.profit));
 const reportDateText=reportPeriod==='all'?'All available recorded dates':reportPeriod==='today'?todayDate.toLocaleDateString('en-ZA'):(reportStart.toLocaleDateString('en-ZA')+' – '+new Date(reportEnd.getTime()-86400000).toLocaleDateString('en-ZA'));
 return <div className="sales-layout">
  <section className="panel sales-panel">
   <div className="panel-heading"><div><span className="section-kicker">QUICK STOCK-OUT</span><h2>Record items sold</h2></div><TrendingUp size={19}/></div>
   <p className="muted">For sales already made at the counter, choose the product and enter how many units were sold. SmartSpaza will subtract them from stock and add the sale to today’s totals. This is separate from the existing customer-basket checkout below.</p>
   <div className="manual-sale-grid">
    <label className="manual-sale-field"><span>What product was sold?</span><select value={manualProductId} onChange={e=>setManualProductId(e.target.value)}><option value="">Choose a product…</option>{inventory.map(p=><option key={p.id} value={p.id}>{p.name} — {p.stock} in stock</option>)}</select></label>
    <label className="manual-sale-field"><span>Quantity sold</span><input aria-label="Quantity sold" type="number" min="1" max={manualProduct?.stock||1} step="1" inputMode="numeric" value={manualQuantity} onChange={e=>setManualQuantity(e.target.value)}/></label>
   </div>
   {manualProduct&&<div className="manual-sale-preview"><span>Currently in stock <strong>{manualProduct.stock}</strong></span><span>After recording <strong>{Math.max(0,manualProduct.stock-(Number(manualQuantity)||0))}</strong></span><span>Sale value <strong>{zar(manualProduct.price*(Number(manualQuantity)||0))}</strong></span><span>Estimated gross profit <strong className="sales-profit">{zar((manualProduct.price-manualProduct.cost)*(Number(manualQuantity)||0))}</strong></span></div>}
   <button className="primary-btn" disabled={busy||!manualProduct||!Number.isSafeInteger(Number(manualQuantity))||Number(manualQuantity)<1||Number(manualQuantity)>manualProduct.stock} onClick={recordItemsSold}>{busy?"Recording…":"Record quantity sold"} <CheckCircle2 size={16}/></button>
   <p className="form-footnote">Example: 15 loaves in stock − 10 sold = 5 remaining. The entry is saved in sales history and included in revenue and gross-profit reports. It does not process a card or bank payment.</p>
  </section>
  <section className="panel sales-panel">
   <div className="panel-heading"><div><span className="section-kicker">POINT OF SALE</span><h2>Record a sale</h2></div><ShoppingCart size={19}/></div>
   <p className="muted">Tap products as the customer buys them. SmartSpaza uses each product's current selling price and unit cost.</p>
   <input aria-label="Search products" placeholder="Search products…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:'100%',padding:12,border:'1px solid var(--line)',borderRadius:9,margin:'8px 0 14px'}}/>
   <div className="sales-product-grid">{products.map(p=><button key={p.id} className="sales-product" disabled={p.stock<1} onClick={()=>add(p)}><strong>{p.name}</strong><span>{p.category} · {p.stock} in stock</span><b>{zar(p.price)}</b><small>{p.stock<1?'Out of stock':'Tap to add'}</small></button>)}</div>
   {!products.length&&<div className="empty-inline">No matching products in inventory.</div>}
  </section>
  <div style={{display:'grid',gap:18}}>
   <section className="panel sales-panel">
    <div className="panel-heading"><div><span className="section-kicker">CURRENT SALE</span><h2>Customer basket</h2></div><Banknote size={19}/></div>
    {cartRows.length?cartRows.map(x=><div className="sales-cart-row" key={x.productId}><div><strong>{x.product.name}</strong><small>{zar(x.product.price)} each · {zar(x.revenue)} total</small></div><input aria-label={'Quantity for '+x.product.name} type="number" min="1" max={x.product.stock} step="1" value={x.quantity} onChange={e=>setQuantity(x.productId,Number(e.target.value))}/><button className="icon-btn" onClick={()=>setCart(old=>old.filter(v=>v.productId!==x.productId))} aria-label="Remove product"><X size={15}/></button></div>):<div className="empty-inline">Your basket is empty. Choose products to start a sale.</div>}
    <div className="sales-summary"><div><span>Sale total</span><strong>{zar(revenue)}</strong></div><div><span>Stock cost</span><strong>{zar(cost)}</strong></div><div className="sales-profit"><span>Estimated gross profit</span><strong>{zar(profit)}</strong></div><div><span>Gross margin</span><strong>{revenue?((profit/revenue)*100).toFixed(1):'0.0'}%</strong></div></div>
    <button className="primary-btn full" disabled={!cart.length||busy} onClick={checkout}>{busy?'Recording sale…':'Complete sale'} <CheckCircle2 size={16}/></button>
    <p className="form-footnote">Completing a sale records it, deducts stock and updates profit reports together. No card or bank payment is processed by this demo POS.</p>
   </section>
   <section className="panel sales-panel">
    <div className="panel-heading"><div><span className="section-kicker">SALES PERFORMANCE REPORT</span><h2>{reportLabel}</h2></div><TrendingUp size={19}/></div>
    <label className="manual-sale-field" style={{display:"block",margin:"10px 0 14px"}}><span>Choose sales report</span><select aria-label="Choose sales report" value={reportPeriod} onChange={e=>setReportPeriod(e.target.value)}><option value="this-week">This week (Monday–Sunday)</option><option value="previous-week">Previous week</option><option value="today">Today</option><option value="all">All recorded sales</option></select></label>
    <p className="muted" style={{marginTop:0}}>{reportDateText} · Completed recorded sales only</p>
    <div className="metric-grid"><article className="metric-card"><span>Transactions</span><strong>{reportSales.length}</strong></article><article className="metric-card"><span>Items sold</span><strong>{reportUnits}</strong></article><article className="metric-card"><span>Revenue</span><strong>{zar(reportRevenue)}</strong></article><article className="metric-card"><span>Stock cost</span><strong>{zar(reportCost)}</strong></article><article className="metric-card"><span>Gross profit</span><strong className="sales-profit">{zar(reportProfit)}</strong></article><article className="metric-card"><span>Gross margin</span><strong>{reportMargin.toFixed(1)}%</strong></article></div>
    <h3 style={{fontSize:13,marginTop:18}}>Daily gross profit</h3>
    <div className="sales-trend">{chartDays.map(d=><div className="sales-trend-col" key={d.key}><div className="sales-trend-bar" title={zar(d.profit)} style={{height:Math.max(3,(d.profit/maxProfit)*78)+"px"}}/><small>{d.label}</small></div>)}</div>
    <div className="section-kicker" style={{marginTop:18}}>SALES IN THIS REPORT</div>
    {visibleSales.sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,30).map((s,i)=><div className="sales-history-row" key={s.saleId||s.createdAt+i}><div><strong>{(s.items||[]).reduce((n,item)=>n+Number(item.quantity||0),0)} items · {new Date(s.createdAt).toLocaleString("en-ZA")}</strong><span>{(s.items||[]).map(item=>item.productName+" × "+item.quantity).join(", ")||"Recorded sale"}</span></div><div style={{textAlign:"right"}}><strong>{zar(s.revenue)}</strong><span className="sales-profit">Profit {zar(s.profit)}</span></div></div>)}
    {!visibleSales.length&&<div className="empty-inline">No completed sales are recorded for this period yet. When you record items sold or complete a checkout, they will appear here.</div>}
   </section>
  </div>
 </div>;
}
