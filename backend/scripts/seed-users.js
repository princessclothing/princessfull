#!/usr/bin/env node
/**
 * seed-users.js — Cria usuários iniciais no banco de dados.
 *
 * Uso:
 *   cd backend
 *   NODE_ENV=development node -r dotenv/config scripts/seed-users.js
 *
 * Variável obrigatória: DATABASE_URL
 */

const User = require('../src/models/user');

const SEED_USERS = [
  // mustChangePassword: true (padrão) — usuário deverá trocar a senha no primeiro acesso
  { name: 'Admin',    email: 'admin@fulfillpanel.com',   password: 'Admin@1234!', role: 'admin'   },
  { name: 'Operador', email: 'operador@fulfillpanel.com', password: 'Oper@1234!',  role: 'usuario' },
  { name: 'Mateus',   email: 'mateus@princessfull.com',  password: '123456',       role: 'admin'   },
  { name: 'Usuario',  email: 'usuario@princessfull.com', password: '123456',       role: 'usuario' },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn('[seed] DATABASE_URL não definido — usando store em memória (não persiste).');
  }

  for (const u of SEED_USERS) {
    const existing = await User.findOne({ where: { email: u.email } });
    if (existing) {
      console.log(`[seed] Usuário já existe: ${u.email} (${u.role})`);
    } else {
      await User.create(u);
      console.log(`[seed] Criado: ${u.email} (${u.role})`);
    }
  }

  console.log('[seed] Concluído.');
  process.exit(0);
}

main().catch(err => {
  console.error('[seed] Erro:', err);
  process.exit(1);
});
