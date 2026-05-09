/**
 * Constrói o prompt para a Claude API refinar a caption do post.
 * @param {{ pilar: string, tema: string, copy_principal: string }} post
 * @returns {string}
 */
export function buildPrompt(post) {
  return `Você é o redator do Atendevida, plataforma de telemedicina 24/7 para trabalhadores CLT no Brasil.

Refine este post para o Instagram mantendo:
- Tom acolhedor mas técnico
- Foco na dor do CLT (sem tempo, sem dinheiro, sem acesso)
- CTA claro: "Atendimento em minutos pelo link da bio"
- 10 hashtags relevantes
- 220 caracteres na copy_curta

NUNCA:
- Prometer cura, diagnóstico garantido ou resultado
- Mencionar medicamento controlado por nome
- Usar antes/depois, sensacionalismo
- Substituir o CRM/responsável técnico
- Usar termos como "garanto", "milagre", "100% eficaz", "sem efeitos colaterais"

Pilar: ${post.pilar}
Tema: ${post.tema}
Copy base: ${post.copy_principal}

Retorne SOMENTE um JSON válido, sem texto adicional, no formato:
{
  "caption": "texto completo do post",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7", "#tag8", "#tag9", "#tag10"],
  "copy_curta": "versão de até 220 chars"
}`;
}
