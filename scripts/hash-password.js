#!/usr/bin/env node
import bcrypt from 'bcryptjs';

const password = process.argv[2];

if (!password) {
  console.error('Uso: node scripts/hash-password.js "minha-senha"');
  console.error('     ou: npm run hash-password "minha-senha"');
  process.exit(1);
}

if (password.length < 8) {
  console.error('Senha precisa ter no mínimo 8 caracteres.');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
console.log('\nHash gerado — copie para DASHBOARD_PASSWORD_HASH no .env:');
console.log('\n' + hash + '\n');
