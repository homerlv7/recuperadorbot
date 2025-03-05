const venom = require('venom-bot');
const axios = require("axios");

let leadData = {}; // Armazena os leads e seus status

// Cria a sessão do Venom Bot com as configurações desejadas
venom
  .create({
    session: 'zap-session', // Nome da sessão
    headless: false,        // Abre o navegador visível
    useChrome: true,        // Usa o Chrome padrão
    autoClose: false,       // Mantém a sessão ativa
    disableSpins: true,     // Opcional: desativa spinners
    disableWelcome: true,   // Opcional: desativa mensagem de boas-vindas
  })
  .then((client) => startBot(client))
  .catch((error) => console.error("❌ Erro ao iniciar o Venom:", error));

function startBot(client) {
  console.log("✅ Bot iniciado com sucesso!");

  // Captura todas as mensagens recebidas
  client.onMessage(async (message) => {
    console.log(`📩 Nova mensagem recebida de ${message.from}: ${message.body}`);
    const numero = message.from;
    const texto = message.body.toLowerCase().trim();

    // Atualiza ou cria a entrada para esse número
    if (!leadData[numero]) {
      leadData[numero] = { ultimaMensagem: Date.now(), status: 'novo' };
    } else {
      leadData[numero].ultimaMensagem = Date.now();
    }

    // Se a mensagem contiver "preço" ou "quanto custa", registra o lead como "curioso"
    if (texto.includes("preço") || texto.includes("quanto custa")) {
      leadData[numero].status = "curioso";
      registrarLead(numero, "curioso");
      // Agenda verificação para 30 minutos depois
      setTimeout(() => verificarLead(client, numero), 30 * 60 * 1000);
    }

    // Se a mensagem contiver "chave pix" ou "pix para pagamento", registra o lead como "indeciso"
    if (texto.includes("chave pix") || texto.includes("pix para pagamento")) {
      leadData[numero].status = "indeciso";
      registrarLead(numero, "indeciso");
      // Agenda verificação para 2 horas depois
      setTimeout(() => verificarLead(client, numero), 2 * 60 * 60 * 1000);
    }
  });
}

// Função para enviar o lead ao backend
function registrarLead(numero, status) {
  axios
    .post("http://localhost:5000/leads", { numero, status })
    .then(() => console.log(`✅ Lead salvo no banco: ${numero} - Status: ${status}`))
    .catch((error) => console.error("❌ Erro ao salvar lead no banco:", error.message));
}

// Função para verificar leads e enviar mensagens de recuperação conforme o tempo
function verificarLead(client, numero) {
  const lead = leadData[numero];
  if (!lead) return;

  // Registra a tentativa de recuperação no histórico do backend
  axios
    .post("http://localhost:5000/historico", { 
      numero, 
      mensagem: "Oi [Nome], vi que perguntou sobre o preço, mas não respondeu. Tem alguma dúvida?" 
    })
    .then(() => console.log(`✅ Mensagem salva no histórico para ${numero}`))
    .catch(error => console.error("❌ Erro ao salvar histórico:", error.message));

  const tempoDesdeUltimaMsg = Date.now() - lead.ultimaMensagem;

  // Se o lead é "curioso" e passou 30 minutos sem resposta, envia mensagem de recuperação
  if (lead.status === 'curioso' && tempoDesdeUltimaMsg > 30 * 60 * 1000) {
    client.sendText(numero, 'Oi! Vi que perguntou sobre o preço, mas não respondeu. Tem alguma dúvida?')
      .then(() => console.log(`📩 Mensagem enviada para ${numero}`))
      .catch(error => console.error("❌ Erro ao enviar mensagem:", error.message));
  }

  // Se o lead é "indeciso" e passou 2 horas sem resposta, envia outra mensagem
  if (lead.status === 'indeciso' && tempoDesdeUltimaMsg > 2 * 60 * 60 * 1000) {
    client.sendText(numero, 'Seu pedido ainda está reservado! Se precisar de um novo Pix, posso gerar pra você.')
      .then(() => console.log(`📩 Mensagem enviada para ${numero}`))
      .catch(error => console.error("❌ Erro ao enviar mensagem:", error.message));
  }

  // Se o lead for classificado como "fantasma" (exemplo para 6 horas), envia mensagem final
  if (lead.status === 'fantasma' && tempoDesdeUltimaMsg > 6 * 60 * 60 * 1000) {
    client.sendText(numero, 'Estamos segurando sua reserva por mais algumas horas. Se precisar, me chama aqui!')
      .then(() => console.log(`📩 Mensagem enviada para ${numero}`))
      .catch(error => console.error("❌ Erro ao enviar mensagem:", error.message));
  }
}
