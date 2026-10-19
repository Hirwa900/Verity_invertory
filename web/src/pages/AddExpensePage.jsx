import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { parseToCents } from '../lib/money';
import getBusinessDate from '../lib/businessDate';

export default function AddExpensePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({ title: '', category: '', amount: '', description: '', expenseDate: getBusinessDate() });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const amountCents = parseToCents(form.amount);
      if (!Number.isSafeInteger(amountCents)) throw new Error('Amount must be a valid non-negative number.');
      await addDoc(collection(db, 'verity_expenses'), {
        title: form.title.trim(),
        category: form.category.trim(),
        amountCents,
        description: form.description.trim() || null,
        businessDate: form.expenseDate,
        userId: user.uid,
        userName: user.name,
        createdAt: serverTimestamp(),
      });
      setSuccess('Expense created successfully.');
      setForm({ title: '', category: '', amount: '', description: '', expenseDate: getBusinessDate() });
    } catch (submitError) {
      setError(submitError?.message || 'Unable to create expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page dashboard-page">
      <div className="card auth-card">
        <button type="button" className="secondary-button" onClick={() => navigate('/dashboard')}>← Back to Dashboard</button>
        <h1>Add Expense</h1>
        <form onSubmit={handleSubmit} className="entity-form">
          <label>Title</label>
          <input name="title" value={form.title} onChange={handleChange} required />
          <label>Category</label>
          <input name="category" value={form.category} onChange={handleChange} required />
          <label>Amount</label>
          <input name="amount" type="number" min="0" step="0.01" value={form.amount} onChange={handleChange} required />
          <label>Description</label>
          <textarea name="description" value={form.description} onChange={handleChange} />
          <label>Expense Date</label>
          <input name="expenseDate" type="date" value={form.expenseDate} onChange={handleChange} required />
          {error && <p className="form-error">{error}</p>}
          {success && <p className="form-success">{success}</p>}
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Expense'}</button>
        </form>
      </div>
    </div>
  );
}
