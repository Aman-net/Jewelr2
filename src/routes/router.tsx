import { Navigate, RouterProvider, createHashRouter, useNavigate, useParams } from "react-router";
import { Shell } from "../components/layout/Shell.tsx";
import { BackupPage } from "../features/backup/Backup.tsx";
import { HomePage } from "../features/home/Home.tsx";
import { KhataPage } from "../features/parties/Khata.tsx";
import { PartyEditPage } from "../features/parties/PartyEdit.tsx";
import { PartyNewPage } from "../features/parties/PartyForm.tsx";
import { PartyListPage } from "../features/parties/PartyList.tsx";
import { ItemsPage } from "../features/settings/Items.tsx";
import { Page } from "../components/ui/Card.tsx";
import { SummaryPage } from "../features/summary/Summary.tsx";
import { ConversionForm } from "../features/vouchers/ConversionForm.tsx";
import { NewEntryPicker } from "../features/vouchers/NewEntry.tsx";
import { OpeningForm } from "../features/vouchers/OpeningForm.tsx";
import { SalePurchaseForm } from "../features/vouchers/SalePurchaseForm.tsx";
import { SettlementForm } from "../features/vouchers/SettlementForm.tsx";
import { VoucherDetailPage } from "../features/vouchers/VoucherDetail.tsx";

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
      { path: "vouchers/new", element: <NewEntryPicker /> },
      { path: "vouchers/new/sale", element: <SalePurchaseForm kind="SALE" /> },
      { path: "vouchers/new/purchase", element: <SalePurchaseForm kind="PURCHASE" /> },
      { path: "vouchers/new/receipt", element: <SettlementForm kind="RECEIPT" /> },
      { path: "vouchers/new/payment", element: <SettlementForm kind="PAYMENT" /> },
      { path: "vouchers/new/conversion", element: <ConversionForm /> },
      { path: "vouchers/new/opening", element: <OpeningForm /> },
      { path: "vouchers/:id", element: <VoucherDetailPage /> },
      { path: "summary", element: <SummaryPage /> },
      { path: "settings/backup", element: <BackupPage /> },
      { path: "settings/items", element: <ItemsPage /> },
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
