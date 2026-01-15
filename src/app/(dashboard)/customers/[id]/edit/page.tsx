'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';

export default function EditCustomerPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  });

  useEffect(() => {
    async function loadCustomer() {
      try {
        const res = await fetch(`/api/customers/${params.id}`);
        if (res.ok) {
          const data = await res.json();
          setForm({
            name: data.name || '',
            company: data.company || '',
            email: data.email || '',
            phone: data.phone || '',
            address: data.address || '',
            notes: data.notes || '',
          });
        } else {
          toast.error('Customer not found');
          router.push('/customers');
        }
      } catch {
        toast.error('Failed to load customer');
      } finally {
        setLoading(false);
      }
    }
    loadCustomer();
  }, [params.id, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`/api/customers/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        toast.success('Customer updated!');
        router.push('/customers');
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to update customer');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this customer?')) return;

    try {
      const res = await fetch(`/api/customers/${params.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Customer deleted');
        router.push('/customers');
        router.refresh();
      } else {
        toast.error('Failed to delete customer');
      }
    } catch {
      toast.error('An error occurred');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Edit Customer</h1>

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

        <div className="flex justify-between pt-4">
          <button
            type="button"
            onClick={handleDelete}
            className="btn-danger"
          >
            Delete Customer
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary"
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
