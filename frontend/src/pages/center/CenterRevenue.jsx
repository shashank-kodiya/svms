import Layout from '../../components/Layout.jsx';
import RevenueView from '../../components/RevenueView.jsx';

export default function CenterRevenue() {
  return (
    <Layout title="Revenue" subtitle="Money from paid invoices at your center, including GST.">
      <RevenueView url="/center/revenue" />
    </Layout>
  );
}
