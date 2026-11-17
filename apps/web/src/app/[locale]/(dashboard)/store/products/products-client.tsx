'use client';

import React, { useState } from 'react';
import { Plus, Loader2, AlertCircle, Eye, EyeOff, Layers, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

export interface ProductVariantRow {
  id: string;
  product_id: string;
  title: string;
  sku?: string | null;
  price_xaf: number;
  stock_quantity: number;
  track_stock?: boolean;
  is_active: boolean;
}

export interface ProductRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  base_price_xaf: number;
  stock_quantity: number;
  track_stock: boolean;
  has_variants?: boolean;
  is_active: boolean;
  is_featured: boolean;
  images: string[];
  product_variants?: ProductVariantRow[];
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

  // Form states
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [enableVariants, setEnableVariants] = useState(false);
  const [variantsList, setVariantsList] = useState<Array<{ title: string; priceXaf: number; stockQuantity: number }>>([]);
  const [newVarTitle, setNewVarTitle] = useState('');
  const [newVarPrice, setNewVarPrice] = useState('');
  const [newVarStock, setNewVarStock] = useState('10');

  // Expanded product ID for managing existing variants
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inlineVarTitle, setInlineVarTitle] = useState('');
  const [inlineVarPrice, setInlineVarPrice] = useState('');
  const [inlineVarStock, setInlineVarStock] = useState('10');
  const [addingInlineVar, setAddingInlineVar] = useState(false);

  const addVariantDraft = () => {
    if (!newVarTitle.trim()) return;
    const p = Number(newVarPrice || price || '0');
    const s = Number(newVarStock || '0');
    setVariantsList((prev) => [
      ...prev,
      { title: newVarTitle.trim(), priceXaf: p, stockQuantity: s },
    ]);
    setNewVarTitle('');
    setNewVarPrice('');
  };

  const removeVariantDraft = (index: number) => {
    setVariantsList((prev) => prev.filter((_, i) => i !== index));
  };

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const priceNum = Number(price);
    const stockNum = Number(stock);
    if (!Number.isInteger(priceNum) || priceNum < 0) {
      setError('Le prix de base doit être un entier en FCFA.');
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
        variants: enableVariants && variantsList.length > 0 ? variantsList : undefined,
      });

      // Refetch variants if created with variants
      let finalVariants: ProductVariantRow[] = [];
      if (enableVariants && variantsList.length > 0) {
        const vRes = await fetch(`/api/store/products/${created.id}/variants`);
        const vJson = await vRes.json();
        if (vJson.success) finalVariants = vJson.variants;
      }

      setProducts((prev) => [{ ...created, product_variants: finalVariants }, ...prev]);
      setTitle('');
      setPrice('');
      setStock('0');
      setDescription('');
      setImageUrl('');
      setEnableVariants(false);
      setVariantsList([]);
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

  async function handleAddVariantToProduct(productId: string) {
    if (!inlineVarTitle.trim()) return;
    const p = Number(inlineVarPrice);
    const s = Number(inlineVarStock);
    if (!Number.isInteger(p) || p < 0) {
      setError('Prix de la variante invalide.');
      return;
    }
    setAddingInlineVar(true);
    setError(null);
    try {
      const res = await fetch(`/api/store/products/${productId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: inlineVarTitle.trim(),
          priceXaf: p,
          stockQuantity: s >= 0 ? s : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erreur lors de l’ajout de la variante');

      setProducts((prev) =>
        prev.map((prod) => {
          if (prod.id !== productId) return prod;
          const currentVars = prod.product_variants || [];
          return {
            ...prod,
            has_variants: true,
            product_variants: [...currentVars, data.variant],
          };
        })
      );
      setInlineVarTitle('');
      setInlineVarPrice('');
      setInlineVarStock('10');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAddingInlineVar(false);
    }
  }

  async function handleDeleteVariant(productId: string, variantId: string) {
    if (!confirm('Supprimer cette variante ?')) return;
    try {
      const res = await fetch(`/api/store/products/${productId}/variants`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erreur');

      setProducts((prev) =>
        prev.map((prod) => {
          if (prod.id !== productId) return prod;
          const updatedVars = (prod.product_variants || []).filter((v) => v.id !== variantId);
          return {
            ...prod,
            has_variants: updatedVars.length > 0,
            product_variants: updatedVars,
          };
        })
      );
    } catch (err: any) {
      setError(err.message);
    }
  }

  const inputCls =
    'w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow';

  return (
    <div className="space-y-6 antialiased max-w-7xl mx-auto w-full">
      {/* Product Creation Card */}
      <form onSubmit={handleCreate} className="p-4 sm:p-6 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Nouveau produit</h2>
            <p className="text-xs text-zinc-500">Ajoutez un article avec ou sans variantes à votre catalogue.</p>
          </div>
          <button
            type="button"
            onClick={() => setEnableVariants((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border cursor-pointer transition-colors ${
              enableVariants
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>{enableVariants ? 'Variantes activées' : 'Ajouter des variantes'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-zinc-600 mb-1">Nom du produit *</label>
            <input
              className={inputCls}
              required
              placeholder="Ex: T-Shirt Coton Bio"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-zinc-600 mb-1">Prix de base (FCFA) *</label>
            <input
              className={inputCls}
              required
              inputMode="numeric"
              placeholder="Ex: 5000"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-zinc-600 mb-1">Stock disponible *</label>
            <input
              className={inputCls}
              required
              inputMode="numeric"
              placeholder="Ex: 25"
              value={stock}
              onChange={(e) => setStock(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-zinc-600 mb-1">Description (synchro agent WhatsApp)</label>
            <textarea
              className={inputCls}
              rows={2}
              placeholder="Description détaillée de l'article..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-zinc-600 mb-1">Image produit (URL HTTPS)</label>
            <input
              className={inputCls}
              type="url"
              placeholder="https://... image.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>
        </div>

        {/* Variants Builder when creating */}
        {enableVariants && (
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-800">
              <span>Variantes du produit (Tailles, Couleurs, Stockage)</span>
              <span className="text-[11px] text-zinc-500 font-normal">{variantsList.length} variante(s)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
              <div className="sm:col-span-2">
                <input
                  className={inputCls}
                  placeholder="Intitulé (ex: Noir / XL, 128 Go)"
                  value={newVarTitle}
                  onChange={(e) => setNewVarTitle(e.target.value)}
                />
              </div>
              <div>
                <input
                  className={inputCls}
                  inputMode="numeric"
                  placeholder="Prix FCFA"
                  value={newVarPrice}
                  onChange={(e) => setNewVarPrice(e.target.value.replace(/[^0-9]/g, ''))}
                />
              </div>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  inputMode="numeric"
                  placeholder="Stock"
                  value={newVarStock}
                  onChange={(e) => setNewVarStock(e.target.value.replace(/[^0-9]/g, ''))}
                />
                <button
                  type="button"
                  onClick={addVariantDraft}
                  className="px-3 py-2 rounded-xl bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 cursor-pointer shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {variantsList.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {variantsList.map((v, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-zinc-200 text-xs font-medium text-zinc-800"
                  >
                    <span>{v.title}</span>
                    <span className="text-zinc-400 font-mono text-[11px]">{fcfa(v.priceXaf)}</span>
                    <span className="text-zinc-500 text-[10px]">({v.stockQuantity} en stock)</span>
                    <button
                      type="button"
                      onClick={() => removeVariantDraft(idx)}
                      className="text-zinc-400 hover:text-rose-600 cursor-pointer ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-medium bg-zinc-900 hover:bg-zinc-800 cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Enregistrer le produit
          </button>
        </div>
      </form>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Products List / Table */}
      {products.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-dashed border-zinc-200 text-center text-xs text-zinc-500 space-y-1">
          <p className="font-medium text-zinc-700">Aucun produit dans votre catalogue</p>
          <p>Créez votre premier article ci-dessus pour qu’il soit immédiatement accessible sur votre boutique.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-zinc-200 shadow-xs overflow-hidden">
          {/* Desktop Table View (sm+) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-100 bg-zinc-50/50">
                  <th className="px-4 py-3 font-semibold">Produit</th>
                  <th className="px-4 py-3 font-semibold">Prix</th>
                  <th className="px-4 py-3 font-semibold">Stock</th>
                  <th className="px-4 py-3 font-semibold">Variantes</th>
                  <th className="px-4 py-3 font-semibold text-right">Statut</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const vars = p.product_variants || [];
                  const isExpanded = expandedId === p.id;
                  return (
                    <React.Fragment key={p.id}>
                      <tr className="border-b border-zinc-100 hover:bg-zinc-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-zinc-900">{p.title}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">{p.slug}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              defaultValue={p.base_price_xaf}
                              inputMode="numeric"
                              aria-label={`Prix de ${p.title}`}
                              onBlur={(e) => {
                                const v = Number(e.target.value);
                                if (Number.isInteger(v) && v >= 0 && v !== p.base_price_xaf)
                                  patch(p.id, { basePriceXaf: v });
                                else e.target.value = String(p.base_price_xaf);
                              }}
                              className="w-24 px-2.5 py-1 text-xs rounded-lg border border-zinc-200 font-mono"
                            />
                            <span className="text-zinc-400">FCFA</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            defaultValue={p.stock_quantity}
                            inputMode="numeric"
                            aria-label={`Stock de ${p.title}`}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (Number.isInteger(v) && v >= 0 && v !== p.stock_quantity)
                                patch(p.id, { stockQuantity: v });
                              else e.target.value = String(p.stock_quantity);
                            }}
                            className={`w-20 px-2.5 py-1 text-xs rounded-lg border font-mono ${
                              p.stock_quantity === 0
                                ? 'border-rose-300 bg-rose-50/50 text-rose-800'
                                : 'border-zinc-200 text-zinc-800'
                            }`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : p.id)}
                            className="inline-flex items-center gap-1.5 text-xs text-zinc-700 hover:text-zinc-950 font-medium cursor-pointer"
                          >
                            <Layers className="h-3.5 w-3.5 text-zinc-400" />
                            <span>{vars.length > 0 ? `${vars.length} variante(s)` : 'Gérer variantes'}</span>
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => patch(p.id, { isActive: !p.is_active })}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                              p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
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

                      {/* Expanded Variants Management Row */}
                      {isExpanded && (
                        <tr className="bg-zinc-50/80 border-b border-zinc-200">
                          <td colSpan={5} className="px-4 py-3 space-y-3">
                            <div className="flex items-center justify-between text-xs font-semibold text-zinc-800">
                              <span>Variantes de : {p.title}</span>
                              <span className="text-[11px] text-zinc-500 font-normal">
                                Les variantes permettent aux clients de choisir une taille, couleur ou option.
                              </span>
                            </div>

                            {/* Existing Variants list */}
                            {vars.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {vars.map((v) => (
                                  <div
                                    key={v.id}
                                    className="p-2.5 rounded-xl bg-white border border-zinc-200 text-xs flex items-center justify-between gap-2 shadow-2xs"
                                  >
                                    <div className="min-w-0">
                                      <p className="font-semibold text-zinc-900 truncate">{v.title}</p>
                                      <p className="text-[11px] text-zinc-500 font-mono">
                                        {fcfa(v.price_xaf)} • Stock: {v.stock_quantity}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteVariant(p.id, v.id)}
                                      className="text-zinc-400 hover:text-rose-600 p-1 rounded-md hover:bg-zinc-100 cursor-pointer transition-colors"
                                      title="Supprimer la variante"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-zinc-400 italic">Aucune variante configurée pour ce produit.</p>
                            )}

                            {/* Inline Add Variant Form */}
                            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-200/60">
                              <input
                                className="w-48 px-3 py-1.5 text-xs rounded-xl border border-zinc-200 bg-white"
                                placeholder="Titre (ex: Rouge / L)"
                                value={inlineVarTitle}
                                onChange={(e) => setInlineVarTitle(e.target.value)}
                              />
                              <input
                                className="w-28 px-3 py-1.5 text-xs rounded-xl border border-zinc-200 bg-white"
                                inputMode="numeric"
                                placeholder="Prix FCFA"
                                value={inlineVarPrice}
                                onChange={(e) => setInlineVarPrice(e.target.value.replace(/[^0-9]/g, ''))}
                              />
                              <input
                                className="w-24 px-3 py-1.5 text-xs rounded-xl border border-zinc-200 bg-white"
                                inputMode="numeric"
                                placeholder="Stock"
                                value={inlineVarStock}
                                onChange={(e) => setInlineVarStock(e.target.value.replace(/[^0-9]/g, ''))}
                              />
                              <button
                                type="button"
                                disabled={addingInlineVar}
                                onClick={() => handleAddVariantToProduct(p.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
                              >
                                {addingInlineVar ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Plus className="h-3.5 w-3.5" />
                                )}
                                <span>Ajouter variante</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (< sm) */}
          <div className="sm:hidden divide-y divide-zinc-100">
            {products.map((p) => {
              const vars = p.product_variants || [];
              const isExpanded = expandedId === p.id;
              return (
                <div key={p.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-zinc-900 text-sm">{p.title}</h3>
                      <p className="text-[10px] text-zinc-400 font-mono">{p.slug}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => patch(p.id, { isActive: !p.is_active })}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${
                        p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      {p.is_active ? 'En ligne' : 'Masqué'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                      <span className="text-[10px] text-zinc-400 block">Prix</span>
                      <span className="font-mono font-semibold text-zinc-800">{fcfa(p.base_price_xaf)}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                      <span className="text-[10px] text-zinc-400 block">Stock</span>
                      <span className="font-mono font-semibold text-zinc-800">{p.stock_quantity} unités</span>
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                      className="w-full py-1.5 px-3 rounded-lg bg-zinc-50 border border-zinc-200 text-xs font-medium text-zinc-700 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-zinc-500" />
                        <span>{vars.length > 0 ? `${vars.length} variante(s)` : 'Gérer variantes'}</span>
                      </span>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>

                    {isExpanded && (
                      <div className="mt-2.5 p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2.5">
                        {vars.map((v) => (
                          <div key={v.id} className="p-2 rounded-lg bg-white border border-zinc-200 text-xs flex justify-between items-center">
                            <div>
                              <p className="font-medium text-zinc-900">{v.title}</p>
                              <p className="text-[10px] text-zinc-500">{fcfa(v.price_xaf)} • Stock: {v.stock_quantity}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteVariant(p.id, v.id)}
                              className="text-zinc-400 hover:text-rose-600 p-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}

                        <div className="space-y-1.5 pt-1 border-t border-zinc-200">
                          <input
                            className={inputCls}
                            placeholder="Titre variante"
                            value={inlineVarTitle}
                            onChange={(e) => setInlineVarTitle(e.target.value)}
                          />
                          <div className="grid grid-cols-2 gap-1.5">
                            <input
                              className={inputCls}
                              inputMode="numeric"
                              placeholder="Prix FCFA"
                              value={inlineVarPrice}
                              onChange={(e) => setInlineVarPrice(e.target.value.replace(/[^0-9]/g, ''))}
                            />
                            <input
                              className={inputCls}
                              inputMode="numeric"
                              placeholder="Stock"
                              value={inlineVarStock}
                              onChange={(e) => setInlineVarStock(e.target.value.replace(/[^0-9]/g, ''))}
                            />
                          </div>
                          <button
                            type="button"
                            disabled={addingInlineVar}
                            onClick={() => handleAddVariantToProduct(p.id)}
                            className="w-full py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-medium cursor-pointer"
                          >
                            Ajouter variante
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
