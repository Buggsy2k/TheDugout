import axios from 'axios';
import type {
  Card,
  CreateCard,
  UpdateCard,
  CardQueryParams,
  PaginatedResult,
  CollectionStats,
  Binder,
  BinderDetail,
  CreateBinder,
  UpdateBinder,
} from '../types';

const api = axios.create({
  baseURL: 'http://localhost:5137/api',
});

// Cards API
export const cardApi = {
  getCards(params: CardQueryParams): Promise<PaginatedResult<Card>> {
    return api.get('/cards', { params }).then(r => r.data);
  },

  getCard(id: number): Promise<Card> {
    return api.get(`/cards/${id}`).then(r => r.data);
  },

  createCard(data: CreateCard): Promise<Card> {
    return api.post('/cards', data).then(r => r.data);
  },

  updateCard(id: number, data: UpdateCard): Promise<Card> {
    return api.put(`/cards/${id}`, data).then(r => r.data);
  },

  deleteCard(id: number): Promise<void> {
    return api.delete(`/cards/${id}`);
  },

  uploadImage(id: number, file: File): Promise<{ imagePath: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/cards/upload-image/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },

  bulkCreate(cards: CreateCard[]): Promise<Card[]> {
    return api.post('/cards/bulk', cards).then(r => r.data);
  },

  getStats(): Promise<CollectionStats> {
    return api.get('/cards/stats').then(r => r.data);
  },
};

// Binders API
export const binderApi = {
  getBinders(): Promise<Binder[]> {
    return api.get('/binders').then(r => r.data);
  },

  getBinder(id: number): Promise<BinderDetail> {
    return api.get(`/binders/${id}`).then(r => r.data);
  },

  createBinder(data: CreateBinder): Promise<Binder> {
    return api.post('/binders', data).then(r => r.data);
  },

  updateBinder(id: number, data: UpdateBinder): Promise<Binder> {
    return api.put(`/binders/${id}`, data).then(r => r.data);
  },

  deleteBinder(id: number, cascade = false): Promise<void> {
    return api.delete(`/binders/${id}`, { params: { cascade } });
  },
};

// Pages API
export const pageApi = {
  getPageCards(binderNumber: number, pageNumber: number): Promise<Card[]> {
    return api.get(`/pages/${binderNumber}/${pageNumber}`).then(r => r.data);
  },

  uploadPageImage(binderNumber: number, pageNumber: number, file: File): Promise<{ imagePath: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/pages/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: { binderNumber, pageNumber },
    }).then(r => r.data);
  },
};

export default api;
