import 'dotenv/config';
import axios from 'axios';

const { META_ACCESS_TOKEN, META_GRAPH_API_VERSION = 'v21.0', META_IG_BUSINESS_ID } = process.env;

if (!META_ACCESS_TOKEN || !META_IG_BUSINESS_ID) {
  console.error('❌ META_ACCESS_TOKEN e META_IG_BUSINESS_ID são obrigatórios no .env');
  process.exit(1);
}

async function main() {
  console.log('🔍 Verificando token da Meta...\n');

  // 1. Verificar token
  try {
    const meRes = await axios.get(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/me`, {
      params: { fields: 'id,name', access_token: META_ACCESS_TOKEN },
    });
    console.log(`✅ Token válido — Conta: ${meRes.data.name} (ID: ${meRes.data.id})`);
  } catch (err) {
    console.error('❌ Token inválido:', err.response?.data?.error?.message ?? err.message);
    process.exit(1);
  }

  // 2. Verificar conta IG Business
  try {
    const igRes = await axios.get(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${META_IG_BUSINESS_ID}`,
      {
        params: {
          fields: 'id,username,followers_count,media_count',
          access_token: META_ACCESS_TOKEN,
        },
      },
    );
    const ig = igRes.data;
    console.log(`✅ Conta Instagram: @${ig.username}`);
    console.log(`   Seguidores: ${ig.followers_count ?? 'N/A'}`);
    console.log(`   Posts: ${ig.media_count ?? 'N/A'}`);
  } catch (err) {
    console.error(
      '❌ Erro ao buscar conta IG Business:',
      err.response?.data?.error?.message ?? err.message,
    );
    process.exit(1);
  }

  // 3. Verificar permissões
  try {
    const permRes = await axios.get(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}/me/permissions`,
      { params: { access_token: META_ACCESS_TOKEN } },
    );
    const perms = permRes.data.data.filter((p) => p.status === 'granted').map((p) => p.permission);
    const required = ['instagram_content_publish', 'instagram_basic', 'pages_show_list'];
    const missing = required.filter((p) => !perms.includes(p));

    if (missing.length) {
      console.warn(`⚠️  Permissões faltando: ${missing.join(', ')}`);
    } else {
      console.log(`✅ Todas as permissões necessárias estão presentes`);
    }
    console.log(`   Permissões concedidas: ${perms.join(', ')}`);
  } catch (err) {
    console.warn('⚠️  Não foi possível verificar permissões:', err.message);
  }

  console.log('\n✅ Token OK — pronto para usar!');
}

main();
