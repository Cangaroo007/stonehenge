'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function PricingRuleForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: 'cutout',
    name: '',
    description: '',
    price: '',
    priceType: 'fixed',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/pricing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          price: parseFloat(form.price),
        }),
      });

      if (res.ok) {
        toast.success('Pricing rule created!');
        setOpen(false);
        setForm({ category: 'cutout', name: '', description: '', price: '', priceType: 'fixed' });
        router.refresh();
      } else {
        toast.error('Failed to create pricing rule');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Add Pricing Rule
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-semibold mb-4">New Pricing Rule</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="thickness">Thickness</option>
              <option value="edge">Edge Profile</option>
              <option value="cutout">Cutout</option>
              <option value="feature">Feature</option>
            </select>
          </div>
          <div>
            <label className="label">Name *</label>
            <input
              type="text"
              required
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Undermount Sink Cutout"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <input
              type="text"
              className="input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Price *</label>
              <input
                type="number"
                required
                step="0.01"
                className="input"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Price Type</label>
              <select
                className="input"
                value={form.priceType}
                onChange={(e) => setForm({ ...form, priceType: e.target.value })}
              >
                <option value="fixed">Fixed ($)</option>
                <option value="per_meter">Per Meter ($/m)</option>
                <option value="per_sqm">Per Sq Meter ($/m²)</option>
                <option value="multiplier">Multiplier (×)</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary flex-1"
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Saving...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
