import prisma from '@/lib/db';
import { formatCurrency } from '@/lib/utils';
import PricingRuleForm from '@/components/PricingRuleForm';

export const dynamic = 'force-dynamic';

async function getPricingRules() {
  return prisma.featurePricing.findMany({
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
}

export default async function PricingPage() {
  const rules = await getPricingRules();

  // Group by category
  const categories = {
    thickness: rules.filter((r) => r.category === 'thickness'),
    edge: rules.filter((r) => r.category === 'edge'),
    cutout: rules.filter((r) => r.category === 'cutout'),
    feature: rules.filter((r) => r.category === 'feature'),
  };

  const categoryLabels: Record<string, string> = {
    thickness: 'Thickness Multipliers',
    edge: 'Edge Profiles',
    cutout: 'Cutouts',
    feature: 'Features',
  };

  const priceTypeLabels: Record<string, string> = {
    fixed: 'Fixed',
    per_meter: '/m',
    per_sqm: '/m²',
    multiplier: '×',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pricing Rules</h1>
        <PricingRuleForm />
      </div>

      {Object.entries(categories).map(([category, categoryRules]) => (
        <div key={category} className="card">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
            <h2 className="text-lg font-semibold">{categoryLabels[category]}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Description</th>
                  <th className="table-header">Price</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {categoryRules.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No {categoryLabels[category].toLowerCase()} defined yet.
                    </td>
                  </tr>
                ) : (
                  categoryRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">{rule.name}</td>
                      <td className="table-cell text-gray-500">{rule.description || '-'}</td>
                      <td className="table-cell">
                        {rule.priceType === 'multiplier'
                          ? `${Number(rule.price)}×`
                          : formatCurrency(Number(rule.price))}
                      </td>
                      <td className="table-cell">{priceTypeLabels[rule.priceType]}</td>
                      <td className="table-cell">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            rule.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="card p-6">
        <h3 className="font-medium text-gray-900 mb-2">How Pricing Works</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>Thickness Multipliers:</strong> Applied to base material cost (e.g., 40mm = 1.5× base price)</li>
          <li>• <strong>Edge Profiles:</strong> Charged per linear meter of edge</li>
          <li>• <strong>Cutouts:</strong> Fixed price per cutout</li>
          <li>• <strong>Features:</strong> Fixed price or per square meter for items like waterfall ends</li>
        </ul>
      </div>
    </div>
  );
}
