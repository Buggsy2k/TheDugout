import axios from 'axios';
import type {
  Card,
  CardQueryParams,
  PaginatedResult,
  CollectionStats,
  Binder,
  BinderDetail,
} from '../types';

// In Docker, the API runs on the same host as the frontend (proxied via nginx)
// In development, point to the backend port directly
export const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:8080`;

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
