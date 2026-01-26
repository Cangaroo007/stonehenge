'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface ClientType {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface ClientTier {
  id: string;
  name: string;
  description: string | null;
  priority: number;
  isActive: boolean;
}

interface PriceBook {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export default function NewCustomerPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    clientTypeId: '',
    clientTierId: '',
    defaultPriceBookId: '',
  });

  // Pricing options
  const [clientTypes, setClientTypes] = useState<ClientType[]>([]);
  const [clientTiers, setClientTiers] = useState<ClientTier[]>([]);
  const [priceBooks, setPriceBooks] = useState<PriceBook[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Fetch pricing options on mount
  useEffect(() => {
    async function fetchOptions() {
      try {
        const [typesRes, tiersRes, booksRes] = await Promise.all([
          fetch('/api/admin/pricing/client-types'),
          fetch('/api/admin/pricing/client-tiers?activeOnly=true'),
          fetch('/api/admin/pricing/price-books'),
        ]);

        if (typesRes.ok) {
          const types = await typesRes.json();
          setClientTypes(types.filter((t: ClientType) => t.isActive));
        }
        if (tiersRes.ok) {
          setClientTiers(await tiersRes.json());
        }
        if (booksRes.ok) {
          const books = await booksRes.json();
          setPriceBooks(books.filter((b: PriceBook) => b.isActive));
        }
      } catch (error) {
        console.error('Failed to fetch pricing options:', error);
      } finally {
        setLoadingOptions(false);
      }
    }
    fetchOptions();
  }, []);

  // Clear tier when client type changes
  const handleClientTypeChange = (newTypeId: string) => {
    setForm({ ...form, clientTypeId: newTypeId, clientTierId: '' });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...form,
        clientTypeId: form.clientTypeId || null,
        clientTierId: form.clientTierId || null,
        defaultPriceBookId: form.defaultPriceBookId || null,
      };

      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success('Customer created!');
        router.push('/customers');
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to create customer');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">New Customer</h1>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4 max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Name *</label>
            <input
              type="text"
              required
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Company</label>
            <input
              type="text"
              className="input"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              type="tel"
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="label">Address</label>
          <textarea
            className="input"
            rows={2}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea
            className="input"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        {/* Pricing Classification Section */}
        <div className="border-t pt-4 mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Pricing Classification</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Client Type</label>
              <select
                className="input"
                value={form.clientTypeId}
                onChange={(e) => handleClientTypeChange(e.target.value)}
                disabled={loadingOptions}
              >
                <option value="">Select type...</option>
                {clientTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Client Tier</label>
              <select
                className="input"
                value={form.clientTierId}
                onChange={(e) => setForm({ ...form, clientTierId: e.target.value })}
                disabled={loadingOptions || !form.clientTypeId}
              >
                <option value="">Select tier...</option>
                {clientTiers.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name}
                  </option>
                ))}
              </select>
              {!form.clientTypeId && (
                <p className="text-xs text-gray-500 mt-1">Select a client type first</p>
              )}
            </div>
            <div>
              <label className="label">Default Price Book</label>
              <select
                className="input"
                value={form.defaultPriceBookId}
                onChange={(e) => setForm({ ...form, defaultPriceBookId: e.target.value })}
                disabled={loadingOptions}
              >
                <option value="">Select price book...</option>
                {priceBooks.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary"
            disabled={saving}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Create Customer'}
          </button>
        </div>
      </form>
    </div>
  );
}
