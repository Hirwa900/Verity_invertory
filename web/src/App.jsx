import { Routes, Route, Navigate } from 'react-router-dom';
import LoadingSpinner from './components/LoadingSpinner';
import { useAuth } from './context/AuthContext';
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

function homeForRole(role) {
  return role === 'admin' ? '/dashboard' : '/new-sale';
}

function PrivateRoute({ children, allowedRoles = ['admin'] }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || !user.isActive || !['admin', 'seller'].includes(user.role)) {
    return <Navigate to="/login" replace />;
  }
  return allowedRoles.includes(user.role)
    ? children
    : <Navigate to={homeForRole(user.role)} replace />;
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
        <Route path="/new-sale" element={<PrivateRoute allowedRoles={['admin', 'seller']}><NewSalePage /></PrivateRoute>} />
        <Route path="/add-expense" element={<PrivateRoute><AddExpensePage /></PrivateRoute>} />
        <Route path="/stock-adjustment" element={<PrivateRoute><StockAdjustmentPage /></PrivateRoute>} />
        <Route path="/reports" element={<PrivateRoute><ReportsPage /></PrivateRoute>} />
        <Route path="/products" element={<PrivateRoute allowedRoles={['admin', 'seller']}><ProductsPage /></PrivateRoute>} />
        <Route path="/sales" element={<PrivateRoute allowedRoles={['admin', 'seller']}><SalesHistoryPage /></PrivateRoute>} />
        <Route path="/purchases" element={<PrivateRoute><PurchasesHistoryPage /></PrivateRoute>} />
        <Route path="/stock" element={<PrivateRoute allowedRoles={['admin', 'seller']}><StockPage /></PrivateRoute>} />
        <Route path="/users" element={<PrivateRoute><UsersPage /></PrivateRoute>} />
        <Route path="*" element={<RedirectHome />} />
      </Routes>
    </>
  );
}

function RedirectHome() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to={homeForRole(user.role)} replace /> : <Navigate to="/login" replace />;
}

export default App;
