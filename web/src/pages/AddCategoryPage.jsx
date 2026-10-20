import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { bumpDataRevision } from '../lib/queryCache';

export default function AddCategoryPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Category name is required.');
      await addDoc(collection(db, 'verity_categories'), {
        name: trimmed,
        createdAt: serverTimestamp(),
      });
      bumpDataRevision();
      setSuccess('Category created successfully.');
      setName('');
    } catch (e) {
      setError(e?.message || 'Unable to create category');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page dashboard-page">
      <div className="card auth-card">
        <button type="button" className="secondary-button" onClick={() => navigate('/dashboard')}>← Back to Dashboard</button>
        <h1>Add Category</h1>
        <form onSubmit={handleSubmit} className="entity-form">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          {error && <p className="form-error">{error}</p>}
          {success && <p className="form-success">{success}</p>}
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Category'}</button>
        </form>
      </div>
    </div>
  );
}
