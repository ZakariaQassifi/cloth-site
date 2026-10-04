import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CartProvider } from './context/CartContext'
import { CatalogProvider } from './context/CatalogContext'
import { WishlistProvider } from './context/WishlistContext'
import { I18nProvider } from './i18n/I18nProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <CatalogProvider>
        <CartProvider>
          <WishlistProvider>
            <App />
          </WishlistProvider>
        </CartProvider>
      </CatalogProvider>
    </I18nProvider>
  </StrictMode>,
)