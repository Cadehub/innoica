'use client';

import React, { useState } from 'react';
import { Plus, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

export interface ProductRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  base_price_xaf: number;
  stock_quantity: number;
  track_stock: boolean;
  is_active: boolean;
  is_featured: boolean;
  images: string[];
}

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

async function callApi(method: 'POST' | 'PATCH', payload: Record<string, unknown>) {
  const res = await fetch('/api/store/products', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Opération impossible');
  return data.product as ProductRow;
}

export function ProductsClient({ initialProducts }: { initialProducts: ProductRow[] }) {
  const [products, setProducts] = useState<ProductRow[]>(initialProducts);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const priceNum = Number(price);
    const stockNum = Number(stock);
    if (!Number.isInteger(priceNum) || priceNum < 0) {
      setError('Le prix doit être un entier en FCFA.');
      return;
    }
    if (!Number.isInteger(stockNum) || stockNum < 0) {
      setError('Le stock doit être un entier positif.');
      return;
    }
    setCreating(true);
    try {
      const created = await callApi('POST', {
        title,
        description: description || null,
        basePriceXaf: priceNum,
        stockQuantity: stockNum,
        trackStock: true,
        imageUrl: imageUrl || null,
      });
      setProducts((prev) => [created, ...prev]);
      setTitle('');
      setPrice('');
      setStock('0');
      setDescription('');
      setImageUrl('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function patch(id: string, changes: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      const updated = await callApi('PATCH', { productId: id, ...changes });
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const inputCls =
    'w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400';

  return (
    <div className="space-y-6 antialiased">
      <form onSubmit={handleCreate} className="p-5 rounded-2xl bg-white border border-zinc-200/80 space-y-3">
        <h2 className="text-sm font-black text-zinc-900">Ajouter un produit</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <input className={inputCls} required placeholder="Nom du produit" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          <input className={inputCls} required inputMode="numeric" placeholder="Prix (FCFA)" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))} />
          <input className={inputCls} required inputMode="numeric" placeholder="Stock" value={stock} onChange={(e) => setStock(e.target.value.replace(/[^0-9]/g, ''))} />
        </div>
        <textarea className={inputCls} rows={2} placeholder="Description (visible par vos clients et votre agent WhatsApp)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        <input className={inputCls} type="url" placeholder="Image (URL HTTPS, optionnel)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
        <button
          type="submit"
          disabled={creating}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-bold bg-zinc-900 hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Ajouter
        </button>
      </form>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {products.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white border border-dashed border-zinc-300 text-center text-sm text-zinc-500">
          Aucun produit. Ajoutez le premier : il apparaîtra sur votre boutique et sera connu de votre agent WhatsApp.
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-zinc-200/80 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-100">
                <th className="px-4 py-2.5 font-bold">Produit</th>
                <th className="px-4 py-2.5 font-bold">Prix</th>
                <th className="px-4 py-2.5 font-bold">Stock</th>
                <th className="px-4 py-2.5 font-bold">Visible</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-zinc-50 last:border-0">
                  <td className="px-4 py-2.5">
                    <p className="font-bold text-zinc-900">{p.title}</p>
                    <p className="text-[10px] text-zinc-400 font-mono">{p.slug}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      defaultValue={p.base_price_xaf}
                      inputMode="numeric"
                      aria-label={`Prix de ${p.title}`}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isInteger(v) && v >= 0 && v !== p.base_price_xaf) patch(p.id, { basePriceXaf: v });
                        else e.target.value = String(p.base_price_xaf);
                      }}
                      className="w-24 px-2 py-1 rounded-lg border border-zinc-200"
                    />
                    <span className="ml-1 text-zinc-400">FCFA</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      defaultValue={p.stock_quantity}
                      inputMode="numeric"
                      aria-label={`Stock de ${p.title}`}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isInteger(v) && v >= 0 && v !== p.stock_quantity) patch(p.id, { stockQuantity: v });
                        else e.target.value = String(p.stock_quantity);
                      }}
                      className={`w-20 px-2 py-1 rounded-lg border ${p.stock_quantity === 0 ? 'border-rose-300 bg-rose-50' : 'border-zinc-200'}`}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => patch(p.id, { isActive: !p.is_active })}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                        p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
                      }`}
                    >
                      {busyId === p.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : p.is_active ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" />
                      )}
                      {p.is_active ? 'En ligne' : 'Masqué'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
