import api from "./api";

export type OrdersListResponse<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

/** Send arrays as repeated keys (FastAPI `Query` list params). */
export type OrdersListParams = Record<
  string,
  string | number | boolean | string[] | undefined | null
>;

export async function fetchOrdersPage<T>(
  baseParams: OrdersListParams,
  page: number,
  pageSize: number
): Promise<OrdersListResponse<T>> {
  const { data } = await api.get<OrdersListResponse<T>>("/orders", {
    params: { ...baseParams, page, page_size: pageSize },
  });
  return data;
}

/** Load every page until `total` is reached (max `page_size` per request). */
export async function fetchOrdersAllPages<T>(
  baseParams: OrdersListParams,
  pageSize = 100
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  for (;;) {
    const { items, total } = await fetchOrdersPage<T>(baseParams, page, pageSize);
    all.push(...items);
    if (all.length >= total || items.length === 0) break;
    page += 1;
  }
  return all;
}
