import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from './App'
import Home from './pages/Home'
import Queue from './pages/Queue'
import Policy from './pages/Policy'
import Simulator from './pages/Simulator'
import Analytics from './pages/Analytics'
import Funnel from './pages/Funnel'
import Audit from './pages/Audit'
import Economics from './pages/Economics'
import PaymentDetail from './pages/PaymentDetail'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'queue', element: <Queue /> },
      { path: 'policy', element: <Policy /> },
      { path: 'workbench', element: <Simulator /> },
      { path: 'simulator', element: <Navigate to="/workbench" replace /> },

      // Preserved deep links & secondary pages
      { path: 'analytics', element: <Analytics /> },
      { path: 'funnel', element: <Funnel /> },
      { path: 'audit', element: <Audit /> },
      { path: 'economics', element: <Economics /> },
      { path: 'payment/:id', element: <PaymentDetail /> },

      // Redirects for folded routes
      { path: 'downtime', element: <Navigate to="/queue#downtime" replace /> },
      { path: 'model-health', element: <Navigate to="/analytics#model-health" replace /> },
      { path: 'insights', element: <Navigate to="/audit#insights" replace /> },

      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
