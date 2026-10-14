import { HashRouter, Navigate, Route, Routes, useNavigate } from "react-router";
import { Shell } from "../components/layout/Shell.tsx";
import { BackupPage } from "../features/backup/Backup.tsx";
import { HomePage } from "../features/home/Home.tsx";
import { KhataPage } from "../features/parties/Khata.tsx";
import { PartyNewPage } from "../features/parties/PartyForm.tsx";
import { PartyListPage } from "../features/parties/PartyList.tsx";
import { Page } from "../components/ui/Card.tsx";
import { SummaryPage } from "../features/summary/Summary.tsx";
import { ConversionForm } from "../features/vouchers/ConversionForm.tsx";
import { NewEntryPicker } from "../features/vouchers/NewEntry.tsx";
import { OpeningForm } from "../features/vouchers/OpeningForm.tsx";
import { ItemsPage } from "../features/settings/Items.tsx";
import { SalePurchaseForm } from "../features/vouchers/SalePurchaseForm.tsx";
import { SettlementForm } from "../features/vouchers/SettlementForm.tsx";
import { VoucherDetailPage } from "../features/vouchers/VoucherDetail.tsx";

/**
 * HashRouter: works from any static host and file:// with zero rewrites,
 * and inside the installed PWA scope. Revisit only if clean URLs are needed.
 *
 * /parties/:id IS the khata (balance + actions + entries). The old
 * /parties/:id/ledger path redirects there.
 */
export function Router() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<HomePage />} />
          <Route path="parties" element={<PartyListPage />} />
          <Route path="parties/new" element={<PartyNewWrapper />} />
          <Route path="parties/:id" element={<KhataPage />} />
          <Route path="parties/:id/ledger" element={<Navigate to=".." relative="path" replace />} />
          <Route path="vouchers/new" element={<NewEntryPicker />} />
          <Route path="vouchers/new/sale" element={<SalePurchaseForm kind="SALE" />} />
          <Route path="vouchers/new/purchase" element={<SalePurchaseForm kind="PURCHASE" />} />
          <Route path="vouchers/new/receipt" element={<SettlementForm kind="RECEIPT" />} />
          <Route path="vouchers/new/payment" element={<SettlementForm kind="PAYMENT" />} />
          <Route path="vouchers/new/conversion" element={<ConversionForm />} />
          <Route path="vouchers/new/opening" element={<OpeningForm />} />
          <Route path="vouchers/:id" element={<VoucherDetailPage />} />
          <Route path="summary" element={<SummaryPage />} />
          <Route path="settings/backup" element={<BackupPage />} />
          <Route path="settings/items" element={<ItemsPage />} />
          <Route path="*" element={<Page title="Not found"><p className="text-sm text-stone-500">That screen does not exist.</p></Page>} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

function PartyNewWrapper() {
  const navigate = useNavigate();
  return <PartyNewPage onDone={(id, dup) => navigate(`/parties/${id}`, { state: { duplicateName: dup } })} />;
}
