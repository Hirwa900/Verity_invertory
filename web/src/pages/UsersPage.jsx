import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listUsers } from '../lib/collections';
import { call, friendlyFunctionMessage } from '../lib/functions';

export default function UsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('seller');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const load = () => listUsers();

  useEffect(() => {
    load()
      .then(setUsers)
      .catch((e) => setError(friendlyFunctionMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(null), 6000);
    return () => clearTimeout(timer);
  }, [success]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setFormError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const result = await call('createAppUser', { name, email, role, password });
      setSuccess(
        result.generatedPassword
          ? `User created. Generated password (shown once, give it to them securely): ${result.generatedPassword}`
          : 'User created successfully.',
      );
      setName(''); setEmail(''); setPassword(''); setRole('seller');
      setUsers(await load());
    } catch (createError) {
      setFormError(friendlyFunctionMessage(createError));
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (user) => {
    setActionError(null);
    setEditingUserId(user.id);
    setEditForm({ name: user.name, role: user.role, isActive: user.isActive !== false, password: '' });
  };

  const cancelEdit = () => { setEditingUserId(null); setEditForm(null); };

  const handleEditChange = (field, value) => setEditForm((current) => ({ ...current, [field]: value }));

  const handleUpdate = async (event, uid) => {
    event.preventDefault();
    setActionError(null);
    try {
      const payload = {
        uid,
        name: editForm.name.trim(),
        role: editForm.role,
        isActive: editForm.isActive,
      };
      if (editForm.password) payload.password = editForm.password;
      await call('updateAppUser', payload);
      setUsers(await load());
      setSuccess('User updated. If their role changed, they must reload the app or sign out and back in for the new role to take effect.');
      cancelEdit();
    } catch (updateError) {
      setActionError(friendlyFunctionMessage(updateError));
    }
  };

  const handleDeactivate = async (user) => {
    setActionError(null);
    try {
      await call('updateAppUser', { uid: user.id, isActive: false });
      setUsers(await load());
      setSuccess(`${user.name} deactivated. They can no longer sign in.`);
    } catch (deactivateError) {
      setActionError(friendlyFunctionMessage(deactivateError));
    }
  };

  return (
    <div className="page dashboard-page">
      <div className="card product-card">
        <div className="product-header">
          <div>
            <div className="product-header-actions">
              <button type="button" className="secondary-button" onClick={() => navigate('/dashboard')}>← Back to Dashboard</button>
            </div>
            <h1>Users</h1>
            <p className="product-subtitle">Create new users and manage system access.</p>
          </div>
          <div className="product-summary">
            <div><span>{loading ? '...' : users.length}</span><p>Total users</p></div>
          </div>
        </div>

        {success && <div className="toast-message">{success}</div>}
        {error && <p className="form-error">{error}</p>}
        {actionError && <p className="form-error">{actionError}</p>}

        <div className="card auth-card">
          <h2>Add New User</h2>
          <form onSubmit={handleCreate} className="entity-form">
            <label>Full Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jean Mugisha" required />

            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="user@company.com" required />

            <label>Password (leave empty to generate a secure one)</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters" minLength={password ? 8 : undefined} />

            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="seller">Seller</option>
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
                <div><h2>Registered Users</h2><p>Accounts are managed through Firebase Authentication.</p></div>
              </div>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr><td colSpan="6">No users found.</td></tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id}>
                          <td>
                            {editingUserId === user.id ? (
                              <input aria-label={`Name for ${user.email}`} value={editForm.name}
                                onChange={(e) => handleEditChange('name', e.target.value)} required />
                            ) : user.name}
                          </td>
                          <td>{user.email}</td>
                          <td>
                            {editingUserId === user.id ? (
                              <select aria-label={`Role for ${user.email}`} value={editForm.role}
                                onChange={(e) => handleEditChange('role', e.target.value)}>
                                <option value="admin">Admin</option>
                                <option value="seller">Seller</option>
                              </select>
                            ) : user.role}
                          </td>
                          <td>
                            {editingUserId === user.id ? (
                              <select aria-label={`Status for ${user.email}`} value={String(editForm.isActive)}
                                onChange={(e) => handleEditChange('isActive', e.target.value === 'true')}>
                                <option value="true">Active</option>
                                <option value="false">Inactive</option>
                              </select>
                            ) : (user.isActive !== false ? 'Active' : 'Inactive')}
                          </td>
                          <td>{user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString('en-GB') : '—'}</td>
                          <td className="product-actions">
                            {editingUserId === user.id ? (
                              <form className="user-edit-actions" onSubmit={(event) => handleUpdate(event, user.id)}>
                                <input
                                  aria-label={`New password for ${user.email}`}
                                  type="password" minLength="8" autoComplete="new-password"
                                  placeholder="New password (optional)"
                                  value={editForm.password}
                                  onChange={(e) => handleEditChange('password', e.target.value)}
                                />
                                <button type="submit" className="btn-action btn-action-save">Save</button>
                                <button type="button" className="btn-action btn-action-cancel" onClick={cancelEdit}>Cancel</button>
                              </form>
                            ) : (
                              <>
                                <button type="button" className="btn-action btn-action-edit" onClick={() => startEdit(user)}>Edit</button>
                                {user.isActive !== false && (
                                  <button type="button" className="btn-action btn-action-delete" onClick={() => handleDeactivate(user)}>Deactivate</button>
                                )}
                              </>
                            )}
                          </td>
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
