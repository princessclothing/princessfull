// Authentication controller
//  POST /auth/login  — email + senha → JWT com role
//  GET  /auth/me     — retorna dados do usuário autenticado

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXP = '8h';

/**
 * Login — verifica email/senha e emite JWT com role (admin | usuario).
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: TOKEN_EXP }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        mustChangePassword: user.mustChangePassword ?? false,
      },
    });
  } catch (err) {
    console.error('[auth] login error', err);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

/**
 * Me — retorna dados do usuário autenticado (lidos do JWT via authMiddleware).
 */
exports.me = (req, res) => {
  const { userId, email, name, role } = req.user;
  res.json({ id: userId, email, name, role });
};

/**
 * ChangePassword — troca a senha do usuário autenticado.
 * Body: { newPassword }
 * Requer: header Authorization com JWT válido.
 */
exports.changePassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ message: 'Nova senha é obrigatória.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'A senha deve ter pelo menos 8 caracteres.' });
    }

    const updated = await User.updatePassword(req.user.userId, newPassword);
    if (!updated) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    res.json({ message: 'Senha alterada com sucesso.' });
  } catch (err) {
    console.error('[auth] changePassword error', err);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

