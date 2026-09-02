import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function AddExpensePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', category: '', amount: '', description: '', expense_date: '' });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const token = localStorage.getItem('authToken');
    if (!token) {
      setError('You must be logged in to add an expense.');
      return;
    }

    try {
      await axios.post(
        'https://verity-inventory-backend.onrender.com/api/expenses',
        {
          title: form.title,
          category: form.category,
          amount: Number(form.amount),
          description: form.description,
          expense_date: form.expense_date,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Expense created successfully.');
      setForm({ title: '', category: '', amount: '', description: '', expense_date: '' });
    } catch (submitError) {
      setError(submitError.response?.data?.message || 'Unable to create expense');
    }
  };

  return (
    <div className="page dashboard-page">
      <div className="card auth-card">
        <button type="button" className="secondary-button" onClick={() => navigate('/dashboard')}>
          â† Back to Dashboard
        </button>
        <h1>Add Expense</h1>
        <form onSubmit={handleSubmit} className="entity-form">
          <label>Title</label>
          <input name="title" value={form.title} onChange={handleChange} required />
          <label>Category</label>
          <input name="category" value={form.category} onChange={handleChange} required />
          <label>Amount</label>
          <input name="amount" type="number" step="0.01" value={form.amount} onChange={handleChange} required />
          <label>Description</label>
          <textarea name="description" value={form.description} onChange={handleChange} />
          <label>Expense Date</label>
          <input name="expense_date" type="date" value={form.expense_date} onChange={handleChange} required />
          {error && <p className="form-error">{error}</p>}
          {success && <p className="form-success">{success}</p>}
          <button type="submit">Save Expense</button>
        </form>
      </div>
    </div>
  );
}

export default AddExpensePage;

