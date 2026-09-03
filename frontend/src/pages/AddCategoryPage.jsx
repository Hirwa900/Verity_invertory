import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API from '../api';

function AddCategoryPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const token = localStorage.getItem('authToken');
    if (!token) {
      setError('You must be logged in to add a category.');
      return;
    }

    try {
      const response = await axios.post(
        `${API}/categories`,
        { name },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const createdCategory = response.data;
      if (createdCategory?.id) {
        localStorage.setItem('lastSelectedCategoryId', createdCategory.id.toString());
        localStorage.setItem('lastSelectedCategoryName', createdCategory.name || name);
      }

      setSuccess('Category created successfully.');
      setName('');
    } catch (submitError) {
      const backendMessage = submitError.response?.data?.message || submitError.response?.data?.error;
      setError(backendMessage || 'Unable to create category');
    }
  };

  return (
    <div className="page dashboard-page">
      <div className="card auth-card">
        <button type="button" className="secondary-button" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
        <h1>Add Category</h1>
        <form onSubmit={handleSubmit} className="entity-form">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          {error && <p className="form-error">{error}</p>}
          {success && <p className="form-success">{success}</p>}
          <button type="submit">Save Category</button>
        </form>
      </div>
    </div>
  );
}

export default AddCategoryPage;

