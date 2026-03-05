// Simple in-memory user store used for authentication logic.
// In a real application this should be replaced with a persistent
// PostgreSQL-backed ORM (Sequelize, Prisma, etc.).
//
// The exported functions mirror a minimal subset of what an ORM would
// provide so that the auth module can work without additional setup.

const bcrypt = require('bcrypt');

// internal array to hold user records
const users = [];

module.exports = {
  /**
   * Find a single user by arbitrary criteria.
   * @param {{ where: { email: string } }} query
   */
  async findOne(query) {
    const { email } = query.where;
    return users.find(u => u.email === email) || null;
  },

  /**
   * Lookup by primary key (id).
   * @param {number} id
   */
  async findByPk(id) {
    return users.find(u => u.id === id) || null;
  },

  /**
   * Create a new user with a hashed password.
   * @param {{ email: string, password: string }} data
   */
  async create(data) {
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = {
      id: users.length + 1,
      email: data.email,
      passwordHash,
      totpSecret: null, // will be set during 2FA setup
    };
    users.push(user);
    return user;
  },

  /**
   * Persist modifications to a user record (no-op for in-memory store).
   * @param {Object} user
   */
  async save(user) {
    // nothing to do since we modify the object in place
    return user;
  }
};
