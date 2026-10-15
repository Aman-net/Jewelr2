import { Suspense, lazy } from "react";
import type { ReactNode } from "react";
import { Navigate, RouterProvider, createHashRouter, useNavigate, useParams } from "react-router";
import { Shell } from "../components/layout/Shell.tsx";
import { HomePage } from "../features/home/Home.tsx";
import { KhataPage } from "../features/parties/Khata.tsx";
import { PartyEditPage } from "../features/parties/PartyEdit.tsx";
import { PartyNewPage } from "../features/parties/PartyForm.tsx";
import { PartyListPage } from "../features/parties/PartyList.tsx";
import { Page } from "../components/ui/Card.tsx";
import { ConversionForm } from "../features/vouchers/ConversionForm.tsx";
import { NewEntryPicker } from "../features/vouchers/NewEntry.tsx";
import { OpeningForm } from "../features/vouchers/OpeningForm.tsx";
import { SalePurchaseForm } from "../features/vouchers/SalePurchaseForm.tsx";
import { SettlementForm } from "../features/vouchers/SettlementForm.tsx";
import { Spinner } from "../components/ui/Loader.tsx";

/** Rarely-used screens split out so first paint stays light. */
const BackupPage = lazy(() => import("../features/backup/Backup.tsx").then((m) => ({ default: m.BackupPage })));
const SummaryPage = lazy(() => import("../features/summary/Summary.tsx").then((m) => ({ default: m.SummaryPage })));
const ItemsPage = lazy(() => import("../features/settings/Items.tsx").then((m) => ({ default: m.ItemsPage })));
const DetailPage = lazy(() => import("../features/vouchers/VoucherDetail.tsx").then((m) => ({ default: m.VoucherDetailPage })));
const BillPage = lazy(() => import("../features/bills/Bill.tsx").then((m) => ({ default: m.BillPage })));
const StockPage = lazy(() => import("../features/stock/Stock.tsx").then((m) => ({ default: m.StockPage })));
const StockMovePage = lazy(() => import("../features/stock/Stock.tsx").then((m) => ({ default: m.StockMovePage })));

function deferred(node: ReactNode) {
  return (
    <Suspense fallback={
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 px-4 pt-16 text-sm text-stone-500">
        <Spinner className="h-8 w-8" />
        Loading…
      </div>
    }>
      {node}
    </Suspense>
  );
}

/**
 * Data router (hash-based): zero-config static hosting + PWA scope like
 * before, plus blocking/navigation APIs the entry guards rely on.
 * useBlocker crashes under a component router — this is why it exists.
 *
 * /parties/:id IS the khata (balance + actions + entries). The old
 * /parties/:id/ledger path redirects there.
 */
const router = createHashRouter([
  {
    element: <Shell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "parties", element: <PartyListPage /> },
      { path: "parties/new", element: <PartyNewWrapper /> },
      { path: "parties/:id", element: <KhataPage /> },
      { path: "parties/:id/edit", element: <PartyEditPage /> },
      { path: "parties/:id/ledger", element: <LedgerRedirect /> },
      { path: "parties/:id/bill", element: deferred(<BillPage />) },
      { path: "stock", element: deferred(<StockPage />) },
      { path: "stock/move", element: deferred(<StockMovePage />) },
      { path: "vouchers/new", element: <NewEntryPicker /> },
      { path: "vouchers/new/sale", element: <SalePurchaseForm kind="SALE" /> },
      { path: "vouchers/new/purchase", element: <SalePurchaseForm kind="PURCHASE" /> },
      { path: "vouchers/new/receipt", element: <SettlementForm kind="RECEIPT" /> },
      { path: "vouchers/new/payment", element: <SettlementForm kind="PAYMENT" /> },
      { path: "vouchers/new/conversion", element: <ConversionForm /> },
      { path: "vouchers/new/opening", element: <OpeningForm /> },
      { path: "vouchers/:id", element: deferred(<DetailPage />) },
      { path: "summary", element: deferred(<SummaryPage />) },
      { path: "settings/backup", element: deferred(<BackupPage />) },
      { path: "settings/items", element: deferred(<ItemsPage />) },
      { path: "*", element: <Page title="Not found"><p className="text-sm text-stone-500">That screen does not exist.</p></Page> },
    ],
  },
]);

export function Router() {
  return <RouterProvider router={router} />;
}

function PartyNewWrapper() {
  const navigate = useNavigate();
  return <PartyNewPage onDone={(id, dup) => navigate(`/parties/${id}`, { state: { duplicateName: dup } })} />;
}

function LedgerRedirect() {
  const { id = "" } = useParams();
  return <Navigate to={`/parties/${id}`} replace />;
}
