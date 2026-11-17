import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

describe('Persistent Cart API Validation & Robustness', () => {
  const deleteCalls: Array<{ table: string; filters: Record<string, any> }> = [];
  let mockInsertError: any = null;
  let mockUpdateError: any = null;
  let mockExistingCartItem: any = { id: 'item-1', quantity: 1 };
  const mockProductStock = {
    id: '11111111-1111-1111-1111-111111111111',
    base_price_xaf: 10000,
    stock_quantity: 2,
    track_stock: true,
    is_active: true,
  };

  beforeEach(() => {
    deleteCalls.length = 0;
    mockInsertError = null;
    mockUpdateError = null;
    mockExistingCartItem = { id: 'item-1', quantity: 1 };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';
  });

  it('rejects malformed cartToken, invalid DELETE productId/variantId, malformed JSON, PATCH over-stock, and surfaces DB errors', async () => {
    vi.resetModules();
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        rpc: async () => ({ data: { id: 'cart-1' }, error: null }),
        from: (table: string) => {
          const filters: Record<string, any> = {};
          const chain: any = {
            select: () => chain,
            eq: (col: string, val: any) => {
              filters[col] = val;
              return chain;
            },
            is: (col: string, val: any) => {
              filters[col] = val;
              return chain;
            },
            order: async () => ({ data: [], error: null }),
            maybeSingle: async () => {
              if (table === 'store_settings') {
                return { data: { id: 'store-1', workspace_id: 'ws-1' }, error: null };
              }
              if (table === 'store_carts') {
                return { data: { id: 'cart-1' }, error: null };
              }
              if (table === 'products') {
                return { data: mockProductStock, error: null };
              }
              if (table === 'store_cart_items') {
                return { data: filters.cart_id ? mockExistingCartItem : null, error: null };
              }
              return { data: null, error: null };
            },
            insert: async () => ({ error: mockInsertError }),
            update: () => ({ eq: async () => ({ error: mockUpdateError }) }),
            delete: () => {
              const delFilters: Record<string, any> = {};
              const delChain: any = {
                eq: (c: string, v: any) => {
                  delFilters[c] = v;
                  return delChain;
                },
                is: (c: string, v: any) => {
                  delFilters[c] = v;
                  return delChain;
                },
                then: (resolve: any) => {
                  deleteCalls.push({ table, filters: delFilters });
                  resolve({ error: null });
                },
              };
              return delChain;
            },
          };
          return chain;
        },
      }),
    }));

    const { GET, POST, PATCH, DELETE } = await import(
      '../app/api/store/[storeSlug]/cart/route'
    );
    const validUuid = '11111111-1111-1111-1111-111111111111';
    const params = Promise.resolve({ storeSlug: 'demo' });

    // 1. GET with malformed cartToken -> 400
    const getBadRes = await GET(
      new NextRequest('https://innoica.com/api/store/demo/cart?cartToken=not-a-uuid'),
      { params }
    );
    expect(getBadRes.status).toBe(400);

    // 2. DELETE without cartToken -> 400
    const delNoTokenRes = await DELETE(
      new NextRequest('https://innoica.com/api/store/demo/cart', { method: 'DELETE' }),
      { params }
    );
    expect(delNoTokenRes.status).toBe(400);

    // 3. DELETE with invalid productId -> 400 and ZERO deletes executed
    const delBadProdRes = await DELETE(
      new NextRequest(
        `https://innoica.com/api/store/demo/cart?cartToken=${validUuid}&productId=not-a-uuid`,
        { method: 'DELETE' }
      ),
      { params }
    );
    expect(delBadProdRes.status).toBe(400);
    expect(deleteCalls.length).toBe(0);

    // 4. DELETE with invalid variantId -> 400 and ZERO deletes executed
    const delBadVarRes = await DELETE(
      new NextRequest(
        `https://innoica.com/api/store/demo/cart?cartToken=${validUuid}&productId=${validUuid}&variantId=bad`,
        { method: 'DELETE' }
      ),
      { params }
    );
    expect(delBadVarRes.status).toBe(400);
    expect(deleteCalls.length).toBe(0);

    // 5. POST / PATCH with malformed JSON -> 400
    const postBadJson = await POST(
      new NextRequest('https://innoica.com/api/store/demo/cart', {
        method: 'POST',
        body: '{bad-json',
      }),
      { params }
    );
    expect(postBadJson.status).toBe(400);

    const patchBadJson = await PATCH(
      new NextRequest('https://innoica.com/api/store/demo/cart', {
        method: 'PATCH',
        body: '{bad-json',
      }),
      { params }
    );
    expect(patchBadJson.status).toBe(400);

    // 6. PATCH exceeding stock_quantity when track_stock is true -> 400
    const patchOverStock = await PATCH(
      new NextRequest('https://innoica.com/api/store/demo/cart', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartToken: validUuid,
          productId: validUuid,
          quantity: 99,
        }),
      }),
      { params }
    );
    expect(patchOverStock.status).toBe(400);

    // 7. POST propagating Supabase insert & update errors instead of swallowing -> 400
    mockExistingCartItem = null;
    mockInsertError = { message: 'new row violates row-level security policy' };
    const postInsertDbErr = await POST(
      new NextRequest('https://innoica.com/api/store/demo/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartToken: validUuid,
          productId: validUuid,
          quantity: 1,
        }),
      }),
      { params }
    );
    expect(postInsertDbErr.status).toBe(400);

    mockExistingCartItem = { id: 'item-1', quantity: 1 };
    mockInsertError = null;
    mockUpdateError = { message: 'update failed by RLS' };
    const postUpdateDbErr = await POST(
      new NextRequest('https://innoica.com/api/store/demo/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartToken: validUuid,
          productId: validUuid,
          quantity: 1,
        }),
      }),
      { params }
    );
    expect(postUpdateDbErr.status).toBe(400);

    vi.doUnmock('@supabase/supabase-js');
  });
});
