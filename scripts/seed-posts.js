import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const PILARES = ['educacao', 'casos_comuns', 'bastidores', 'mitos', 'renovacao_receita'];
const FORMATOS = ['estatico', 'carrossel', 'estatico'];
const JANELAS = [
  { janela: 'manha', horario: '07:00:00' },
  { janela: 'almoco', horario: '12:00:00' },
  { janela: 'noite', horario: '21:00:00' },
];

const TEMAS = {
  educacao: [
    'Quando ir ao pronto-socorro vs. quando pode esperar',
    'Sintomas que não podem ser ignorados',
    'Diferença entre telemedicina e consulta presencial',
    'Como se preparar para uma consulta online',
    'O que o médico pode e não pode fazer por telemedicina',
    'Febre: quando tratar em casa e quando buscar ajuda',
    'Dor no peito: entendendo os sinais de alerta',
  ],
  casos_comuns: [
    'Dor de garganta de madrugada — e agora?',
    'Conjuntivite: tratamento rápido sem sair de casa',
    'Infecção urinária: como agilizar o tratamento',
    'Gripe forte no fim de semana',
    'Dor de ouvido às 22h',
    'Alergia cutânea repentina',
    'Crise de rinite no trabalho',
  ],
  bastidores: [
    'Como funciona uma consulta de telemedicina por dentro',
    'O que fazemos para garantir a segurança dos seus dados',
    'Por que nossos médicos são todos registrados no CRM',
    'Bastidores: como montamos nossa equipe médica',
    'A história do Atendevida',
    'Como garantimos atendimento 24h sem comprometer a qualidade',
    'Parceria com farmácias para agilizar suas receitas',
  ],
  mitos: [
    'Mito: telemedicina é só para casos leves',
    'Mito: médico online não pode passar receita',
    'Mito: consulta online é menos segura',
    'Mito: só idosos precisam de plano de saúde',
    'Mito: dá para se automedicar com antibióticos',
    'Mito: febre baixa não precisa de atenção médica',
    'Mito: telemedicina não é reconhecida pelo CFM',
  ],
  renovacao_receita: [
    'Renovação de anti-hipertensivo sem sair de casa',
    'Como renovar receita de antidepressivo por telemedicina',
    'Anticoncepcional: quando renovar e como',
    'Medicamentos de uso contínuo — guia completo',
    'Economize tempo: receita em minutos pelo celular',
    'Receita digital: o que é e como usar na farmácia',
    'Prazo de validade da receita: o que você precisa saber',
  ],
};

function generatePosts() {
  const posts = [];
  const today = new Date();

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() + dayOffset);
    const dataAgendada = date.toISOString().split('T')[0];

    JANELAS.forEach(({ janela, horario }, janelaIndex) => {
      const pilarIndex = (dayOffset * 3 + janelaIndex) % PILARES.length;
      const pilar = PILARES[pilarIndex];
      const formatoIndex = janelaIndex % FORMATOS.length;
      const formato = FORMATOS[formatoIndex];

      const temasList = TEMAS[pilar];
      const tema = temasList[(dayOffset + janelaIndex) % temasList.length];

      const copyPrincipal = generateCopy(pilar, tema, janela);
      const hashtags = generateHashtags(pilar);

      posts.push({
        data_agendada: dataAgendada,
        horario,
        janela,
        timezone: 'America/Fortaleza',
        pilar,
        formato,
        tema,
        copy_principal: copyPrincipal,
        copy_curta: copyPrincipal.slice(0, 220),
        hashtags,
        cta: 'Atendimento em minutos pelo link da bio 🔗',
        imagem_url: `https://via.placeholder.com/1080x1080?text=${encodeURIComponent(tema.slice(0, 30))}`,
        status: dayOffset === 0 ? 'agendado' : 'agendado',
      });
    });
  }

  return posts;
}

function generateCopy(pilar, tema, janela) {
  const copys = {
    educacao: `📚 ${tema}\n\nMuita gente não sabe quando é hora de buscar ajuda médica. Aqui no Atendevida, nossos médicos estão disponíveis 24h para te orientar — sem fila, sem espera.\n\nNão deixe a dúvida virar problema. Fala com a gente agora. ⬇️`,
    casos_comuns: `🏥 ${tema}\n\nJá passou por isso? A gente sabe que dói. E que você não pode simplesmente parar tudo para ir a uma UPA às 23h.\n\nNossos médicos atendem agora, pelo celular, em qualquer horário. Sem complicação. ⬇️`,
    bastidores: `👨‍⚕️ ${tema}\n\nTransparência é fundamental quando o assunto é saúde. Por isso, queremos te mostrar como o Atendevida funciona por dentro.\n\nSegurança, ética e tecnologia — tudo para você receber o melhor atendimento. ⬇️`,
    mitos: `❌ MITO: ${tema}\n\nAinda existe muita desinformação sobre telemedicina. Vamos falar a verdade?\n\nConsultas online são regulamentadas pelo CFM, realizadas por médicos com CRM ativo e totalmente seguras. ⬇️`,
    renovacao_receita: `💊 ${tema}\n\nTrabalha o dia todo e não tem tempo de ir ao médico só para renovar receita?\n\nNo Atendevida, nossos médicos renovam receitas de medicamentos de uso contínuo em minutos, com receita digital válida em todo o Brasil. ⬇️`,
  };
  return copys[pilar] ?? `${tema}\n\nAtendimento em minutos pelo link da bio.`;
}

function generateHashtags(pilar) {
  const base = ['#telemedicina', '#saúde', '#atendevida', '#médico24h', '#consultaonline'];
  const byPilar = {
    educacao: ['#educacaomedica', '#dicas', '#saúdeemcasa', '#prevenção', '#médico'],
    casos_comuns: ['#prontoatendimento', '#urgência', '#clt', '#trabalhador', '#febre'],
    bastidores: ['#bastidores', '#transparência', '#equipemedica', '#tecnologia', '#saúde'],
    mitos: ['#mitosesaude', '#informação', '#telemedicina', '#cfm', '#médico'],
    renovacao_receita: ['#receita', '#medicamento', '#usocontinuo', '#receitaldigital', '#farmácia'],
  };
  return [...base, ...(byPilar[pilar] ?? [])].slice(0, 10);
}

async function main() {
  console.log('🌱 Populando tabela atendevida_social_posts...');

  const posts = generatePosts();
  console.log(`📝 Gerando ${posts.length} posts (7 dias × 3 janelas)...`);

  const { data, error } = await supabase
    .from('atendevida_social_posts')
    .insert(posts)
    .select('id');

  if (error) {
    console.error('❌ Erro ao inserir posts:', error);
    process.exit(1);
  }

  console.log(`✅ ${data.length} posts inseridos com sucesso!`);
}

main();
