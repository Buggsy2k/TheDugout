import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CollectionBrowser from './pages/CollectionBrowser';
import BinderList from './pages/BinderList';
import BinderView from './pages/BinderView';
import CardDetail from './pages/CardDetail';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/collection" element={<CollectionBrowser />} />
          <Route path="/binders" element={<BinderList />} />
          <Route path="/binders/:id" element={<BinderView />} />
          <Route path="/cards/:id" element={<CardDetail />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  </React.StrictMode>
);
