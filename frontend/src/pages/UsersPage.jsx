import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API from '../api';

function UsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('cashier');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const token = localStorage.getItem('authToken');

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!token) {
          setError('You must be logged in to view users. Please login first.');
          setLoading(false);
          return;
        }
        const response = await axios.get(`${API}/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!Array.isArray(response.data)) {
          setError('Unexpected users response from server.');
          setUsers([]);
          return;
        }
        setUsers(response.data);
      } catch (fetchError) {
        const status = fetchError.response?.status;
        if (status === 401 || status === 403) {
          setError('Authentication error. Only admins can manage users.');
        } else {
          setError(fetchError.response?.data?.message || 'Unable to load users.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [token]);

  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(timer);
  }, [success]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setFormError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      if (!token) {
        setFormError('You must be logged in to create a user.');
        return;
      }
      await axios.post(
        `${API}/users`,
        { name, email, password, role },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('New user created successfully.');
      setName('');
      setEmail('');
      setPassword('');
      setRole('cashier');

      const response = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data);
    } catch (createError) {
      const message = createError.response?.data?.message || createError.response?.data?.error;
      setFormError(message || 'Unable to create user. Please check the details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page dashboard-page">
      <div className="card product-card">
        <div className="product-header">
          <div>
            <div className="product-header-actions">
              <button type="button" className="secondary-button" onClick={() => navigate('/dashboard')}>
                ← Back to Dashboard
              </button>
            </div>
            <h1>Users</h1>
            <p className="product-subtitle">Create new users and manage system access.</p>
          </div>
          <div className="product-summary">
            <div>
              <span>{loading ? '...' : users.length}</span>
              <p>Total users</p>
            </div>
          </div>
        </div>

        {success && <div className="toast-message">{success}</div>}
        {error && <p className="form-error">{error}</p>}

        <div className="card auth-card">
          <h2>Add New User</h2>
          <form onSubmit={handleCreate} className="entity-form">
            <label>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jean Mugisha"
              required
            />

            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@company.com"
              required
            />

            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter a secure password"
              required
            />

            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="cashier">Cashier</option>
              <option value="admin">Admin</option>
            </select>

            {formError && <p className="form-error">{formError}</p>}
            <button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create User'}
            </button>
          </form>
        </div>

        {loading ? (
          <p className="page-message">Loading users...</p>
        ) : (
          !error && (
            <div className="table-card products-table-card">
              <div className="card-header">
                <div>
                  <h2>Registered Users</h2>
                  <p>Email and password are stored securely in the database.</p>
                </div>
              </div>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr><td colSpan="5">No users found.</td></tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id}>
                          <td>{user.name}</td>
                          <td>{user.email}</td>
                          <td>{user.role}</td>
                          <td>{user.is_active ? 'Active' : 'Inactive'}</td>
                          <td>{user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB') : '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default UsersPage;

