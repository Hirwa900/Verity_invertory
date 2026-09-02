import { Routes, Route, Navigate } from 'react-router-dom';
import LoadingSpinner from './components/LoadingSpinner';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AddProductPage from './pages/AddProductPage';
import AddCategoryPage from './pages/AddCategoryPage';
import NewPurchasePage from './pages/NewPurchasePage';
import NewSalePage from './pages/NewSalePage';
import AddExpensePage from './pages/AddExpensePage';
import StockAdjustmentPage from './pages/StockAdjustmentPage';
import ReportsPage from './pages/ReportsPage';
import ProductsPage from './pages/ProductsPage';
import SalesHistoryPage from './pages/SalesHistoryPage';
import PurchasesHistoryPage from './pages/PurchasesHistoryPage';
import StockPage from './pages/StockPage';
import UsersPage from './pages/UsersPage';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('authToken');
  return token ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <>
    <LoadingSpinner />
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
      <Route path="/add-product" element={<PrivateRoute><AddProductPage /></PrivateRoute>} />
      <Route path="/add-category" element={<PrivateRoute><AddCategoryPage /></PrivateRoute>} />
      <Route path="/new-purchase" element={<PrivateRoute><NewPurchasePage /></PrivateRoute>} />
      <Route path="/new-sale" element={<PrivateRoute><NewSalePage /></PrivateRoute>} />
      <Route path="/add-expense" element={<PrivateRoute><AddExpensePage /></PrivateRoute>} />
      <Route path="/stock-adjustment" element={<PrivateRoute><StockAdjustmentPage /></PrivateRoute>} />
      <Route path="/reports" element={<PrivateRoute><ReportsPage /></PrivateRoute>} />
      <Route path="/products" element={<PrivateRoute><ProductsPage /></PrivateRoute>} />
      <Route path="/sales" element={<PrivateRoute><SalesHistoryPage /></PrivateRoute>} />
      <Route path="/purchases" element={<PrivateRoute><PurchasesHistoryPage /></PrivateRoute>} />
      <Route path="/stock" element={<PrivateRoute><StockPage /></PrivateRoute>} />
      <Route path="/users" element={<PrivateRoute><UsersPage /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    </>
  );
}

export default App;
