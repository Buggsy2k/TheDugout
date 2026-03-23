import axios from 'axios';
import type {
  Card,
  CardQueryParams,
  PaginatedResult,
  CollectionStats,
  Binder,
  BinderDetail,
} from '../types';

// In Docker, nginx proxies /api/ to the backend — use relative paths (empty base).
// In development, set VITE_API_BASE to point to the backend port directly.
export const API_BASE = import.meta.env.VITE_API_BASE || '';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
});

export const cardApi = {
  getCards(params: CardQueryParams): Promise<PaginatedResult<Card>> {
    return api.get('/cards', { params }).then(r => r.data);
  },

  getCard(id: number): Promise<Card> {
    return api.get(`/cards/${id}`).then(r => r.data);
  },

  getStats(): Promise<CollectionStats> {
    return api.get('/cards/stats').then(r => r.data);
  },
};

export const binderApi = {
  getBinders(): Promise<Binder[]> {
    return api.get('/binders').then(r => r.data);
  },

  getBinder(id: number): Promise<BinderDetail> {
    return api.get(`/binders/${id}`).then(r => r.data);
  },
};

export const pageApi = {
  getPageCards(binderNumber: number, pageNumber: number): Promise<Card[]> {
    return api.get(`/pages/${binderNumber}/${pageNumber}`).then(r => r.data);
  },
};

export default api;
