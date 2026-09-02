const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const { listUsers, createUser, updateUser, deleteUser } = require('../controllers/userController');

const router = express.Router();

router.use(authenticate);
router.get('/', authorize(['admin']), listUsers);
router.post('/', authorize(['admin']), createUser);
router.put('/:id', authorize(['admin']), updateUser);
router.delete('/:id', authorize(['admin']), deleteUser);

module.exports = router;
