import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import MenuPage from "./pages/MenuPage";
import OrderListPage from "./pages/OrderListPage";
import CreateOrderPage from "./pages/CreateOrderPage";
import PackingPage from "./pages/PackingPage";
import DevPage from "./pages/DevPage";
import AccountantPage from "./pages/AccountantPage";
import TrackingNumberPage from "./pages/TrackingNumberPage";
import InvoiceSubmitPage from "./pages/InvoiceSubmitPage";
import DashboardPage from "./pages/DashboardPage";
import LineNotificationSetupPage from "./pages/LineNotificationSetupPage";
import SaleSummaryPage from "./pages/SaleSummaryPage";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/sale-summary" element={<SaleSummaryPage />} />
        <Route path="/line-notification-setup" element={<LineNotificationSetupPage />} />
        <Route path="/orders" element={<OrderListPage />} />
        <Route path="/orders/packing" element={<PackingPage />} />
        <Route path="/orders/tracking" element={<TrackingNumberPage />} />
        <Route path="/orders/invoice-submit" element={<InvoiceSubmitPage />} />
        <Route path="/orders/create" element={<CreateOrderPage />} />
        <Route path="/dev" element={<DevPage />} />
        <Route path="/orders/accountant" element={<AccountantPage />} />
      </Routes>
    </BrowserRouter>
  );
}
